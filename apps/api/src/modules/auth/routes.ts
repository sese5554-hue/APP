import { Router } from 'express';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { loginSchema, signupSchema, roleSchema, loginIdSchema } from '../../../../../packages/contracts/index.js';
import { pool, one, rows, transaction, dateSql, json } from '../../database/db.js';
import { hashPassword, verifyPassword, hashToken } from '../../lib/crypto.js';
import { ensure, AppError } from '../../lib/errors.js';
import { config } from '../../config.js';
import { publicUser, requireUser } from '../../middleware/auth.js';
import { provider } from '../../providers/index.js';
export const authRoutes=Router();
const limited=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{code:'RATE_LIMIT',message:'잠시 후 다시 시도해 주세요.'}}});
const phoneSchema=z.string().regex(/^01[016789]\d{7,8}$/);
const consentChoices=z.object({privacy:z.literal(true),thirdParty:z.literal(true),locationTerms:z.literal(true),locationCollection:z.literal(true),marketingApp:z.boolean(),marketingSms:z.boolean(),marketingEmail:z.boolean()});
authRoutes.get('/terms',(_req,res)=>res.json({data:{version:'2026-11-14',required:['privacy','thirdParty','locationTerms','locationCollection'],marketingOptional:true}}));
authRoutes.post('/consents',async(req,res)=>{ const input=z.object({version:z.literal('2026-11-14'),choices:consentChoices}).parse(req.body);const id=randomUUID();await pool.query('INSERT INTO consent_records(id,version,choices_json) VALUES (?,?,?)',[id,input.version,JSON.stringify(input.choices)]);res.status(201).json({data:{id}}); });
authRoutes.get('/auth/me',(req,res)=>res.json({data:req.user??null}));
authRoutes.get('/auth/login-id-availability',async(req,res)=>{ const loginId=loginIdSchema.parse(req.query.loginId);res.json({data:{available:!await one(pool,'SELECT id FROM users WHERE login_id=?',[loginId])}}); });
authRoutes.post('/auth/phone-challenges',limited,async(req,res)=>{
  const phone=phoneSchema.parse(req.body.phone);await provider.verify('phone');
  const id=randomUUID(),code=String(randomInt(100000,1000000));
  await pool.query('INSERT INTO auth_challenges(id,phone,code_hash,expires_at) VALUES (?,?,?,?)',[id,phone,hashToken(`${id}:${code}`),dateSql(new Date(Date.now()+300000))]);
  res.status(201).json({data:{id,expiresIn:300,mode:provider.mode,...(provider.mode==='development'?{developmentCode:code}:{})}});
});
authRoutes.post('/auth/phone-challenges/:id/verify',limited,async(req,res)=>{
  const id=z.uuid().parse(req.params.id),code=z.string().regex(/^\d{6}$/).parse(req.body.code);
  const success=await transaction(async db=>{
    const challenge=await one(db,'SELECT * FROM auth_challenges WHERE id=? AND expires_at>UTC_TIMESTAMP(3) AND consumed=FALSE FOR UPDATE',[id]);
    if(!challenge || challenge.attempts>=5)return false;
    const valid=challenge.codeHash===hashToken(`${id}:${code}`);
    await db.query('UPDATE auth_challenges SET attempts=attempts+1,verified=? WHERE id=?',[valid,id]);return valid;
  });
  ensure(success,400,'INVALID_CODE','인증번호가 잘못되었거나 만료되었습니다.');res.json({data:{verified:true}});
});
authRoutes.post('/auth/signup',limited,async(req,res)=>{
  const data=signupSchema.parse(req.body),passwordHash=await hashPassword(data.password),id=randomUUID();
  await transaction(async db=>{
    const challenge=await one(db,'SELECT * FROM auth_challenges WHERE id=? FOR UPDATE',[data.challengeId]);
    ensure(challenge && challenge.phone===data.phone && challenge.verified && !challenge.consumed && Date.parse(challenge.expiresAt.replace(' ','T')+'Z')>Date.now(),400,'PHONE_REQUIRED','휴대폰 인증을 다시 진행해 주세요.');
    const consent=await one(db,'SELECT * FROM consent_records WHERE id=? FOR UPDATE',[data.consentId]);
    ensure(consent && !consent.userId && Date.parse(consent.createdAt.replace(' ','T')+'Z')>Date.now()-86400000,400,'CONSENT_REQUIRED','약관 동의를 확인해 주세요.');
    consentChoices.parse(json(consent.choicesJson,{}));
    await db.query('INSERT INTO users(id,login_id,nickname,phone,password_hash,active_role) VALUES (?,?,?,?,?,?)',[id,data.loginId,data.nickname,data.phone,passwordHash,data.role]);
    await db.query('INSERT INTO user_roles(user_id,role) VALUES (?,?)',[id,data.role]);
    await db.query('UPDATE auth_challenges SET consumed=TRUE WHERE id=?',[data.challengeId]);await db.query('UPDATE consent_records SET user_id=? WHERE id=?',[id,data.consentId]);
  });
  await createSession(id,res);res.status(201).json({data:await publicUser(id)});
});
async function createSession(id: string,res: import('express').Response) { const token=randomBytes(32).toString('hex');await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)',[hashToken(token),id,dateSql(new Date(Date.now()+config.SESSION_DAYS*86400000))]);res.cookie('geuncha_session',token,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax',maxAge:config.SESSION_DAYS*86400000,path:'/'}); }
authRoutes.post('/auth/login',limited,async(req,res)=>{ const data=loginSchema.parse(req.body),user=await one(pool,'SELECT * FROM users WHERE login_id=? AND status=?',[data.loginId,'active']);ensure(user && await verifyPassword(data.password,user.passwordHash),401,'LOGIN_FAILED','아이디 또는 비밀번호를 확인해 주세요.');await createSession(user.id,res);res.json({data:await publicUser(user.id)}); });
authRoutes.post('/auth/logout',async(req,res)=>{ const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('geuncha_session='))?.slice(16);if(token)await pool.query('DELETE FROM sessions WHERE token_hash=?',[hashToken(token)]);res.clearCookie('geuncha_session',{path:'/'});res.json({data:{ok:true}}); });
authRoutes.get('/auth/kakao/start',()=>{throw new AppError(503,'PROVIDER_UNCONFIGURED','카카오 로그인은 공급자 키와 callback 설정 후 사용할 수 있습니다.');});
authRoutes.post('/auth/recovery',limited,async(req,res)=>{
  const data=z.object({challengeId:z.uuid(),action:z.enum(['loginId','password']),newPassword:z.string().min(8).max(128).optional()}).parse(req.body);
  const passwordHash=data.action==='password'?await hashPassword(z.string().min(8).parse(data.newPassword)):null;
  const result=await transaction(async db=>{
    const challenge=await one(db,'SELECT * FROM auth_challenges WHERE id=? AND expires_at>UTC_TIMESTAMP(3) AND verified=TRUE AND consumed=FALSE FOR UPDATE',[data.challengeId]);ensure(challenge,400,'INVALID_CHALLENGE','휴대폰 인증이 필요합니다.');
    const user=await one(db,'SELECT id,login_id FROM users WHERE phone=?',[challenge.phone]);await db.query('UPDATE auth_challenges SET consumed=TRUE WHERE id=?',[data.challengeId]);
    if(user && passwordHash) {await db.query('UPDATE users SET password_hash=? WHERE id=?',[passwordHash,user.id]);await db.query('DELETE FROM sessions WHERE user_id=?',[user.id]);}
    return data.action==='loginId'?{loginId:user?.loginId??null}:{ok:true};
  });res.json({data:result});
});
authRoutes.post('/me/roles',async(req,res)=>{const user=requireUser(req),role=roleSchema.parse(req.body.role);await pool.query('INSERT IGNORE INTO user_roles(user_id,role) VALUES (?,?)',[user.id,role]);res.json({data:await publicUser(user.id)});});
authRoutes.patch('/me/active-role',async(req,res)=>{const user=requireUser(req),role=roleSchema.parse(req.body.role);ensure(user.roles.includes(role),403,'ROLE_REQUIRED','먼저 해당 역할을 추가해 주세요.');await pool.query('UPDATE users SET active_role=? WHERE id=?',[role,user.id]);res.json({data:await publicUser(user.id)});});
authRoutes.get('/me/verifications',async(req,res)=>{const user=requireUser(req);res.json({data:await rows(pool,'SELECT kind,status,mode,metadata_json,expires_at FROM user_verifications WHERE user_id=?',[user.id])});});
authRoutes.get('/me/payment-methods',async(req,res)=>{const user=requireUser(req);res.json({data:await rows(pool,"SELECT id,brand,last_four,is_default,provider FROM payment_methods WHERE user_id=? AND status='active' ORDER BY is_default DESC,created_at",[user.id])});});
authRoutes.post('/verifications/:kind',limited,async(req,res)=>{
  const user=requireUser(req),kind=z.enum(['identity','neighborhood','license']).parse(req.params.kind);let metadata:Record<string,unknown>={};
  if(kind==='identity')metadata=z.object({method:z.enum(['PASS','SMS'])}).parse(req.body);
  if(kind==='neighborhood') { const position=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().positive().max(10000),capturedAt:z.iso.datetime()}).parse(req.body);ensure(Math.abs(Date.now()-Date.parse(position.capturedAt))<120000,400,'STALE_POSITION','위치를 다시 확인해 주세요.');metadata={neighborhood:'서울시 관악구 신림동',accuracy:position.accuracy}; }
  if(kind==='license') { const data=z.object({type:z.enum(['1종 보통','2종 보통']),number:z.string().regex(/^\d{2}-\d{2}-\d{6}-\d{2}$/),issuedOn:z.iso.date(),expiresOn:z.iso.date()}).parse(req.body);ensure(data.expiresOn>data.issuedOn && Date.parse(data.expiresOn)>Date.now(),400,'EXPIRED_LICENSE','면허 발급일과 유효기간을 확인해 주세요.');metadata={type:data.type,maskedNumber:data.number.replace(/-\d{6}-/,'-******-'),issuedOn:data.issuedOn,expiresOn:data.expiresOn}; }
  const verification=await provider.verify(kind);
  await pool.query('INSERT INTO user_verifications(id,user_id,kind,status,mode,metadata_json,expires_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),mode=VALUES(mode),metadata_json=VALUES(metadata_json),expires_at=VALUES(expires_at)',[randomUUID(),user.id,kind,verification.status,provider.mode,JSON.stringify(metadata),dateSql(new Date(kind==='license'?Math.min(Date.parse(String(metadata.expiresOn)),Date.now()+365*86400000):Date.now()+30*86400000))]);
  if(kind==='neighborhood')await pool.query('UPDATE users SET neighborhood=? WHERE id=?',[metadata.neighborhood,user.id]);
  res.json({data:{kind,status:verification.status,mode:provider.mode,metadata}});
});
