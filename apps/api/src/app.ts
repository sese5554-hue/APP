import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ZodError } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { pool } from './database/db.js';
import { AppError, ensure } from './lib/errors.js';
import { sessionUser } from './middleware/auth.js';
import { authRoutes } from './modules/auth/routes.js';
export function createApp() {
  const app=express();app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:config.NODE_ENV==='production'?undefined:false}));
  app.use((req,res,next)=>{ req.requestId=randomUUID();res.setHeader('X-Request-Id',req.requestId);next(); });
  app.get('/api/health',async(_req,res)=>{ await pool.query('SELECT 1');res.json({data:{status:'ok',database:'mariadb',providerMode:config.PROVIDER_MODE}}); });
  app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false}));
  app.use('/api',express.json({limit:'128kb'}));
  app.use('/api',(req,_res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      ensure(req.get('X-Geuncha-Request')==='1',403,'CSRF_REQUIRED','요청 헤더를 확인해 주세요.');
      ensure(!req.headers.origin || req.headers.origin===config.APP_ORIGIN,403,'ORIGIN_REJECTED','허용되지 않은 출처입니다.');
    }
    next();
  });
  app.use('/api',sessionUser,authRoutes);
  app.use('/api',(_req,_res,next)=>next(new AppError(404,'NOT_FOUND','요청한 API를 찾을 수 없습니다.')));
  if(config.NODE_ENV==='production') { app.use(express.static(path.resolve('dist/web')));app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/web/index.html'))); }
  const errorHandler:ErrorRequestHandler=(error,req,res,_next)=>{
    if(res.headersSent)return;
    if(error instanceof ZodError) { res.status(400).json({error:{code:'VALIDATION',message:'입력 내용을 확인해 주세요.',fields:error.flatten().fieldErrors,requestId:req.requestId}});return; }
    if(error?.code==='ER_DUP_ENTRY') {res.status(409).json({error:{code:'DUPLICATE',message:'이미 등록되었거나 중복된 요청입니다.',requestId:req.requestId}});return;}
    const status=error instanceof AppError?error.status:error?.type==='entity.parse.failed'?400:500;
    if(status===500)console.error(JSON.stringify({level:'error',requestId:req.requestId,name:error?.name,code:error?.code??'INTERNAL'}));
    res.status(status).json({error:{code:error instanceof AppError?error.code:'INTERNAL',message:error instanceof AppError?error.message:status===400?'올바른 JSON이 필요합니다.':'서버 처리 중 오류가 발생했습니다.',requestId:req.requestId}});
  };app.use(errorHandler);return app;
}
