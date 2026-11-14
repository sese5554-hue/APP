import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { inspectionSchema,photoAngles,reviewSchema } from '../../../../../packages/contracts/index.js';
import { pool,one,rows,transaction } from '../../database/db.js';
import { dateIso } from '../../database/db.js';
import { lockBooking,participant } from '../bookings/service.js';
import { bookingService } from '../bookings/routes.js';
import { assertTransition,distanceFee } from '../../domain/pricing.js';
import { requireUser } from '../../middleware/auth.js';
import { ensure } from '../../lib/errors.js';
import { ownUpload } from './uploads.js';
import { provider } from '../../providers/index.js';
export const inspectionRoutes=Router();
inspectionRoutes.get('/bookings/:id/inspections',async(req,res)=>{
  const user=requireUser(req),id=z.uuid().parse(req.params.id);await participant(pool,id,user.id);
  const list=await rows(pool,'SELECT * FROM inspections WHERE booking_id=?',[id]);
  res.json({data:await Promise.all(list.map(async inspection=>({...inspection,photos:(await rows(pool,'SELECT upload_id,angle FROM inspection_photos WHERE inspection_id=?',[inspection.id])).map(photo=>({...photo,url:`/api/uploads/${photo.uploadId}`}))})))});
});
inspectionRoutes.put('/bookings/:id/inspections/:phase',async(req,res)=>{
  const user=requireUser(req),id=z.uuid().parse(req.params.id),phase=z.enum(['pickup','return']).parse(req.params.phase),data=inspectionSchema.parse(req.body),draft=z.boolean().default(true).parse(req.body.draft);
  await transaction(async db=>{
    const booking=await lockBooking(db,id,user.id);ensure(booking.guestId===user.id,403,'GUEST_ONLY','예약자가 점검 자료를 제출해야 합니다.');ensure(booking.status===(phase==='pickup'?'CONFIRMED':'IN_USE'),409,'INVALID_STATE','현재 단계에서 점검을 제출할 수 없습니다.');
    if(phase==='pickup')ensure(Date.parse(dateIso(booking.startsAt))<=Date.now()+30*60000,409,'TOO_EARLY','인수는 대여 시작 30분 전부터 가능합니다.');
    const previous=await one(db,'SELECT * FROM inspections WHERE booking_id=? AND phase=?',[id,phase]);ensure(!previous||previous.status==='draft',409,'ALREADY_SUBMITTED','이미 제출된 점검입니다.');
    const angles=data.photos.map(p=>p.angle);ensure(new Set(angles).size===angles.length,400,'DUPLICATE_ANGLE','사진 각도가 중복되었습니다.');
    ensure(new Set(data.photos.map(p=>p.uploadId)).size===data.photos.length,400,'DUPLICATE_PHOTO','각 방향과 계기판은 별도의 사진으로 등록해 주세요.');
    for(const photo of data.photos)await ownUpload(db,photo.uploadId,user.id,'inspection');
    if(!draft)ensure([...photoAngles,'odometer'].every(angle=>angles.includes(angle as typeof angles[number])),400,'PHOTOS_REQUIRED','8방향 외관과 계기판 사진이 모두 필요합니다.');
    if(phase==='return'){const pickup=await one(db,"SELECT odometer_km FROM inspections WHERE booking_id=? AND phase='pickup' AND status='submitted'",[id]);ensure(pickup,409,'PICKUP_REQUIRED','인수 점검이 필요합니다.');distanceFee(pickup.odometerKm,data.odometerKm,booking.includedKm,booking.extraKmPrice);}
    const inspectionId=previous?.id??randomUUID();
    if(previous)await db.query('UPDATE inspections SET odometer_km=?,status=? WHERE id=?',[data.odometerKm,draft?'draft':'submitted',inspectionId]);else await db.query('INSERT INTO inspections(id,booking_id,inspector_id,phase,odometer_km,status) VALUES (?,?,?,?,?,?)',[inspectionId,id,user.id,phase,data.odometerKm,draft?'draft':'submitted']);
    await db.query('DELETE FROM inspection_photos WHERE inspection_id=?',[inspectionId]);for(const photo of data.photos)await db.query('INSERT INTO inspection_photos(inspection_id,upload_id,angle) VALUES (?,?,?)',[inspectionId,photo.uploadId,photo.angle]);
    if(!draft){const next=phase==='pickup'?'IN_USE':'RETURNED';assertTransition(booking.status,next);await db.query('UPDATE bookings SET status=? WHERE id=?',[next,id]);
      if(phase==='return'){const pickup=await one(db,"SELECT odometer_km FROM inspections WHERE booking_id=? AND phase='pickup'",[id]);const extra=distanceFee(pickup!.odometerKm,data.odometerKm,booking.includedKm,booking.extraKmPrice);await db.query("INSERT INTO settlements(booking_id,distance_km,extra_distance,total,balance,status) VALUES (?,?,?,?,?,'review')",[id,data.odometerKm-pickup!.odometerKm,extra,booking.total+extra,extra]);}
    }
  });res.json({data:{saved:true,submitted:!draft}});
});
inspectionRoutes.get('/bookings/:id/comparison',async(req,res)=>{const user=requireUser(req),id=z.uuid().parse(req.params.id);await participant(pool,id,user.id);const inspections=await rows(pool,'SELECT phase,odometer_km,status FROM inspections WHERE booking_id=?',[id]);res.json({data:{inspections,acknowledgements:await rows(pool,'SELECT user_id,decision,note FROM comparison_acknowledgements WHERE booking_id=?',[id]),mode:provider.mode,analysisStatus:'manual_review_required',damageCandidates:null,message:'자동 손상 탐지는 미연동입니다. 원본 사진을 비교한 후 양측이 확인해 주세요. 자동 손상 청구는 하지 않습니다.'}});});
inspectionRoutes.post('/bookings/:id/comparison/acknowledgements',async(req,res)=>{
  const user=requireUser(req),id=z.uuid().parse(req.params.id),data=z.object({decision:z.enum(['confirmed','dispute']),note:z.string().max(500).default('')}).parse(req.body);
  await transaction(async db=>{const booking=await lockBooking(db,id,user.id);ensure(['RETURNED','SETTLEMENT_PENDING'].includes(booking.status),409,'INVALID_STATE','반납 후에 확인할 수 있습니다.');await db.query('INSERT INTO comparison_acknowledgements(booking_id,user_id,decision,note) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE decision=VALUES(decision),note=VALUES(note)',[id,user.id,data.decision,data.note]);const ack=await rows(db,'SELECT decision FROM comparison_acknowledgements WHERE booking_id=?',[id]);const agreed=ack.length===2&&ack.every(a=>a.decision==='confirmed');await db.query('UPDATE settlements SET status=? WHERE booking_id=?',[agreed?'agreed':ack.some(a=>a.decision==='dispute')?'disputed':'review',id]);if(booking.status==='RETURNED')await db.query("UPDATE bookings SET status='SETTLEMENT_PENDING' WHERE id=?",[id]);});res.json({data:{ok:true}});
});
inspectionRoutes.get('/bookings/:id/settlement',async(req,res)=>{const user=requireUser(req),id=z.uuid().parse(req.params.id),booking=await participant(pool,id,user.id);const settlement=await one(pool,'SELECT * FROM settlements WHERE booking_id=?',[id]);ensure(settlement,409,'RETURN_REQUIRED','반납 점검을 먼저 제출해 주세요.');res.json({data:{...settlement,bookingTotal:booking.total,includedKm:booking.includedKm,extraKmPrice:booking.extraKmPrice,hostNet:booking.hostNet,providerMode:provider.mode}});});
inspectionRoutes.post('/bookings/:id/settlement/complete',async(req,res)=>{const user=requireUser(req),id=z.uuid().parse(req.params.id);await transaction(async db=>{const b=await lockBooking(db,id,user.id);ensure(b.guestId===user.id,403,'GUEST_ONLY','예약자만 완료할 수 있습니다.');if(b.status==='COMPLETED')return;const s=await one(db,'SELECT * FROM settlements WHERE booking_id=?',[id]);ensure(s?.status==='agreed'&&s.balance===0,409,'AGREEMENT_REQUIRED','양측 확인 및 추가 결제를 먼저 완료해 주세요.');assertTransition(b.status,'COMPLETED');await db.query("UPDATE bookings SET status='COMPLETED' WHERE id=?",[id]);await db.query("UPDATE settlements SET status='paid' WHERE booking_id=?",[id]);});res.json({data:{ok:true}});});
inspectionRoutes.post('/bookings/:id/settlement/pay',async(req,res)=>{const user=requireUser(req);await bookingService.pay(z.uuid().parse(req.params.id),user.id,'extra');res.json({data:{ok:true}});});
inspectionRoutes.post('/bookings/:id/reviews',async(req,res)=>{const user=requireUser(req),id=z.uuid().parse(req.params.id),data=reviewSchema.parse(req.body);await transaction(async db=>{const booking=await lockBooking(db,id,user.id);ensure(booking.status==='COMPLETED',409,'NOT_COMPLETED','정산 완료 후 후기를 작성할 수 있습니다.');const target=booking.guestId===user.id?booking.hostId:booking.guestId;await db.query('INSERT INTO reviews(id,booking_id,author_id,target_id,rating,manner_rating,tags_json,content) VALUES (?,?,?,?,?,?,?,?)',[randomUUID(),id,user.id,target,data.rating,data.mannerRating,JSON.stringify(data.tags),data.content]);});res.status(201).json({data:{ok:true}});});
