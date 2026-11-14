import { Router } from 'express';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool,one,rows,transaction,dateIso } from '../../database/db.js';
import { participant } from '../bookings/service.js';
import { requireUser } from '../../middleware/auth.js';
import { ensure } from '../../lib/errors.js';
export const chatRoutes=Router();
const events=new EventEmitter(),connections=new Map<string,number>();
export function notifyUsers(ids:string[],bookingId:string){for(const id of ids)events.emit(id,{bookingId});}
chatRoutes.get('/events',async(req,res)=>{
  const user=requireUser(req);ensure((connections.get(user.id)||0)<4,429,'TOO_MANY_STREAMS','열린 채팅 연결이 너무 많습니다.');connections.set(user.id,(connections.get(user.id)||0)+1);
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();res.write('retry: 3000\n\n');
  const listener=(event:unknown)=>res.write(`data: ${JSON.stringify(event)}\n\n`);events.on(user.id,listener);
  const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),20000);
  req.on('close',()=>{clearInterval(heartbeat);events.off(user.id,listener);connections.set(user.id,Math.max(0,(connections.get(user.id)||1)-1));});
});
chatRoutes.get('/bookings/:id/messages',async(req,res)=>{const user=requireUser(req),id=z.uuid().parse(req.params.id);await participant(pool,id,user.id);const before=z.coerce.number().int().positive().optional().parse(req.query.before);const list=await rows(pool,`SELECT id,seq,sender_id,content,sent_at FROM chat_messages WHERE booking_id=?${before?' AND seq<?':''} ORDER BY seq DESC LIMIT 50`,[id,...(before?[before]:[])]);res.json({data:list.reverse().map(r=>({...r,sentAt:dateIso(r.sentAt)}))});});
chatRoutes.post('/bookings/:id/messages',async(req,res)=>{
  const user=requireUser(req),id=z.uuid().parse(req.params.id),data=z.object({clientMessageId:z.uuid(),content:z.string().trim().min(1).max(2000)}).parse(req.body);const booking=await participant(pool,id,user.id);
  const existing=await one(pool,'SELECT id,booking_id FROM chat_messages WHERE sender_id=? AND client_message_id=?',[user.id,data.clientMessageId]);
  ensure(!existing||existing.bookingId===id,409,'KEY_REUSED','다른 채팅에 같은 메시지 키를 사용할 수 없습니다.');
  if(!existing)await pool.query('INSERT IGNORE INTO chat_messages(id,booking_id,sender_id,client_message_id,content) VALUES (?,?,?,?,?)',[randomUUID(),id,user.id,data.clientMessageId,data.content]);
  notifyUsers([booking.guestId,booking.hostId],id);res.status(201).json({data:{ok:true}});
});
chatRoutes.post('/bookings/:id/read',async(req,res)=>{const user=requireUser(req),id=z.uuid().parse(req.params.id),seq=z.number().int().nonnegative().parse(req.body.seq);await participant(pool,id,user.id);if(seq>0)ensure(await one(pool,'SELECT id FROM chat_messages WHERE booking_id=? AND seq=?',[id,seq]),400,'INVALID_CURSOR','읽음 위치를 확인해 주세요.');await pool.query('INSERT INTO chat_reads(booking_id,user_id,last_read_at,last_seq) VALUES (?,?,UTC_TIMESTAMP(3),?) ON DUPLICATE KEY UPDATE last_read_at=UTC_TIMESTAMP(3),last_seq=GREATEST(last_seq,VALUES(last_seq))',[id,user.id,seq]);res.json({data:{ok:true}});});
chatRoutes.get('/me/conversations',async(req,res)=>{
  const user=requireUser(req),search=z.string().max(100).default('').parse(req.query.q),page=z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const list=await rows(pool,`SELECT b.id,b.vehicle_id,v.name AS vehicle_name,CASE WHEN b.guest_id=? THEN h.nickname ELSE g.nickname END AS partner,
   (SELECT content FROM chat_messages m WHERE m.booking_id=b.id ORDER BY seq DESC LIMIT 1) AS last_message,
   (SELECT sent_at FROM chat_messages m WHERE m.booking_id=b.id ORDER BY seq DESC LIMIT 1) AS last_sent_at,
   (SELECT COUNT(*) FROM chat_messages m WHERE m.booking_id=b.id AND m.sender_id<>? AND m.seq>COALESCE(cr.last_seq,0)) AS unread
   FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN users g ON g.id=b.guest_id JOIN users h ON h.id=b.host_id LEFT JOIN chat_reads cr ON cr.booking_id=b.id AND cr.user_id=?
   WHERE (b.guest_id=? OR b.host_id=?) AND (v.name LIKE ? OR g.nickname LIKE ? OR h.nickname LIKE ?) ORDER BY COALESCE(last_sent_at,b.created_at) DESC,b.id LIMIT 30 OFFSET ?`,[user.id,user.id,user.id,user.id,user.id,...Array(3).fill(`%${search}%`),(page-1)*30]);
  res.json({data:list});
});
