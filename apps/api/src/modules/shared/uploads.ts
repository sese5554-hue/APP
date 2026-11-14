import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile,unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../../config.js';
import { pool,one, type Sql } from '../../database/db.js';
import { requireUser } from '../../middleware/auth.js';
import { ensure } from '../../lib/errors.js';
export const uploadRoutes=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:2}});
export async function ownUpload(db:Sql,id:string,ownerId:string,purpose?:string) {const item=await one(db,'SELECT * FROM uploads WHERE id=? AND owner_id=?',[id,ownerId]);ensure(item&&(!purpose||item.purpose===purpose),400,'INVALID_UPLOAD','첨부 파일의 소유자 또는 용도를 확인해 주세요.');return item;}
uploadRoutes.post('/uploads',(req,_res,next)=>{requireUser(req);next();},upload.single('file'),async(req,res)=>{
  const user=requireUser(req),purpose=z.enum(['vehicle-photo','inspection','profile','inquiry']).parse(req.body.purpose),file=req.file;ensure(file,400,'FILE_REQUIRED','이미지를 선택해 주세요.');
  const bytes=file.buffer;let extension='',mime='';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){extension='png';mime='image/png';}
  else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){extension='jpg';mime='image/jpeg';}
  else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'){extension='webp';mime='image/webp';}
  ensure(extension&&mime===file.mimetype,400,'INVALID_IMAGE','JPG·PNG·WebP 이미지만 등록할 수 있습니다.');
  const id=randomUUID(),key=`${id}.${extension}`,directory=path.resolve(config.UPLOAD_DIR);await mkdir(directory,{recursive:true});await writeFile(path.join(directory,key),bytes,{flag:'wx'});
  try {await pool.query('INSERT INTO uploads(id,owner_id,purpose,storage_key,mime,size) VALUES (?,?,?,?,?,?)',[id,user.id,purpose,key,mime,file.size]);}catch(error){await unlink(path.join(directory,key));throw error;}
  res.status(201).json({data:{id,url:`/api/uploads/${id}`,mime,size:file.size}});
});
uploadRoutes.get('/uploads/:id',async(req,res)=>{
  const id=z.uuid().parse(req.params.id),file=await one(pool,'SELECT * FROM uploads WHERE id=?',[id]);ensure(file,404,'FILE_NOT_FOUND','파일을 찾을 수 없습니다.');let allowed=file.ownerId===req.user?.id;
  if(!allowed&&file.purpose==='vehicle-photo')allowed=Boolean(await one(pool,"SELECT p.id FROM vehicle_photos p JOIN vehicles v ON v.id=p.vehicle_id WHERE p.upload_id=? AND v.status='published' AND v.deleted_at IS NULL",[id]));
  if(!allowed&&req.user&&file.purpose==='inspection')allowed=Boolean(await one(pool,'SELECT i.id FROM inspection_photos p JOIN inspections i ON i.id=p.inspection_id JOIN bookings b ON b.id=i.booking_id WHERE p.upload_id=? AND (b.host_id=? OR b.guest_id=?)',[id,req.user.id,req.user.id]));
  ensure(allowed,404,'FILE_NOT_FOUND','파일을 찾을 수 없습니다.');res.setHeader('Cache-Control','private, max-age=60');res.type(file.mime).sendFile(path.resolve(config.UPLOAD_DIR,file.storageKey),{dotfiles:'allow'});
});
