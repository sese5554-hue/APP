import type { Request, Response, NextFunction } from 'express';
import type { User } from '../../../../packages/contracts/index.js';
import { one, rows, pool } from '../database/db.js';
import { hashToken } from '../lib/crypto.js';
import { ensure } from '../lib/errors.js';
declare global { namespace Express { interface Request { user?: User; requestId: string } } }
export async function publicUser(id: string): Promise<User | undefined> {
  const user=await one(pool,'SELECT id,login_id,nickname,email,phone,active_role,manner_temperature,neighborhood,avatar_id FROM users WHERE id=? AND status=?',[id,'active']);
  if(!user)return;
  const roles=await rows(pool,'SELECT role FROM user_roles WHERE user_id=?',[id]);
  return {...user,roles:roles.map(row=>row.role)} as User;
}
export async function sessionUser(req: Request,_res: Response,next: NextFunction) {
  try {
    const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('geuncha_session='))?.slice(16);
    if(token && /^[a-f0-9]{64}$/.test(token)) { const session=await one(pool,'SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(3)',[hashToken(token)]); if(session)req.user=await publicUser(session.userId); }
    next();
  } catch(error) { next(error); }
}
export function requireUser(req: Request): User { ensure(req.user,401,'AUTH_REQUIRED','로그인이 필요합니다.');return req.user; }
export function requireHost(req: Request): User { const user=requireUser(req);ensure(user.roles.includes('host'),403,'HOST_REQUIRED','호스트 권한이 필요합니다.');return user; }
