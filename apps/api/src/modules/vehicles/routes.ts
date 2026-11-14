import { Router } from 'express';
import { z } from 'zod';
import { pool, rows, one, dateSql } from '../../database/db.js';
import { requireUser } from '../../middleware/auth.js';
import { ensure } from '../../lib/errors.js';
import { vehicleSelect, vehicleView, occupancySql } from './repository.js';
export const vehicleRoutes=Router();
const searchSchema=z.object({area:z.string().max(100).optional(),fuel:z.string().max(30).optional(),bodyType:z.string().max(20).optional(),size:z.string().max(20).optional(),seats:z.coerce.number().int().min(2).max(12).optional(),minPrice:z.coerce.number().min(0).optional(),maxPrice:z.coerce.number().max(1_000_000).optional(),sort:z.enum(['price','priceDesc','rating']).default('price'),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(12),startsAt:z.iso.datetime({offset:true}).optional(),endsAt:z.iso.datetime({offset:true}).optional(),bbox:z.string().optional()});
vehicleRoutes.get('/vehicles',async(req,res)=>{
  const q=searchSchema.parse(req.query),where=["v.status='published'","v.deleted_at IS NULL"],values:any[]=[];
  for(const [value,clause] of [[q.area,'v.area LIKE ?'],[q.fuel,'v.fuel=?'],[q.bodyType,'v.body_type=?'],[q.size,'v.size=?'],[q.seats,'v.seats>=?'],[q.minPrice,'v.daily_price>=?'],[q.maxPrice,'v.daily_price<=?']] as const)if(value!==undefined && value!==''){where.push(clause);values.push(clause.includes('LIKE')?`%${value}%`:value);}
  ensure(!(q.minPrice!=null && q.maxPrice!=null && q.minPrice>q.maxPrice),400,'INVALID_BUDGET','최소 예산은 최대 예산보다 클 수 없습니다.');
  if(q.startsAt || q.endsAt) {
    ensure(q.startsAt && q.endsAt && Date.parse(q.endsAt)>Date.parse(q.startsAt),400,'INVALID_PERIOD','대여 시작·종료를 확인해 주세요.');
    where.push('EXISTS(SELECT 1 FROM vehicle_availability a WHERE a.vehicle_id=v.id AND a.starts_at<=? AND a.ends_at>=?)');values.push(dateSql(q.startsAt),dateSql(q.endsAt));
    where.push(`NOT EXISTS(SELECT 1 FROM bookings b WHERE b.vehicle_id=v.id AND ${occupancySql} AND b.starts_at<? AND b.ends_at>?)`);values.push(dateSql(q.endsAt),dateSql(q.startsAt));
  }
  if(q.bbox){const box=q.bbox.split(',').map(Number);ensure(box.length===4&&box.every(Number.isFinite)&&box[0]>=-180&&box[2]<=180&&box[1]>=-90&&box[3]<=90&&box[0]<box[2]&&box[1]<box[3],400,'INVALID_BOUNDS','지도 범위를 확인해 주세요.');where.push('v.longitude BETWEEN ? AND ? AND v.latitude BETWEEN ? AND ?');values.push(box[0],box[2],box[1],box[3]);}
  const order={price:'v.daily_price ASC',priceDesc:'v.daily_price DESC',rating:'rating DESC'}[q.sort];
  const count=await one(pool,`SELECT COUNT(*) AS total FROM vehicles v WHERE ${where.join(' AND ')}`,values);
  const found=await rows(pool,`${vehicleSelect} WHERE ${where.join(' AND ')} ORDER BY ${order},v.id LIMIT ? OFFSET ?`,[...values,q.limit,(q.page-1)*q.limit]);
  res.json({data:{items:await Promise.all(found.map(v=>vehicleView(pool,v))),total:count!.total,page:q.page,limit:q.limit}});
});
vehicleRoutes.get('/vehicles/:id',async(req,res)=>{const id=z.uuid().parse(req.params.id),vehicle=await one(pool,`${vehicleSelect} WHERE v.id=? AND v.status='published' AND v.deleted_at IS NULL`,[id]);ensure(vehicle,404,'VEHICLE_NOT_FOUND','공개된 차량을 찾을 수 없습니다.');res.json({data:await vehicleView(pool,vehicle)});});
vehicleRoutes.get('/vehicles/:id/availability',async(req,res)=>{const id=z.uuid().parse(req.params.id);ensure(await one(pool,"SELECT id FROM vehicles WHERE id=? AND status='published'",[id]),404,'VEHICLE_NOT_FOUND','차량을 찾을 수 없습니다.');res.json({data:{available:await rows(pool,'SELECT starts_at,ends_at FROM vehicle_availability WHERE vehicle_id=?',[id]),blocked:await rows(pool,`SELECT b.starts_at,b.ends_at FROM bookings b WHERE b.vehicle_id=? AND ${occupancySql}`,[id])}});});
vehicleRoutes.get('/vehicles/:id/reviews',async(req,res)=>{const id=z.uuid().parse(req.params.id),page=z.coerce.number().int().min(1).default(1).parse(req.query.page);ensure(await one(pool,"SELECT id FROM vehicles WHERE id=? AND status='published'",[id]),404,'VEHICLE_NOT_FOUND','차량을 찾을 수 없습니다.');res.json({data:await rows(pool,'SELECT r.rating,r.content,r.created_at,u.nickname FROM reviews r JOIN bookings b ON b.id=r.booking_id JOIN users u ON u.id=r.author_id WHERE b.vehicle_id=? AND r.author_id=b.guest_id ORDER BY r.created_at DESC LIMIT 20 OFFSET ?',[id,(page-1)*20])});});
vehicleRoutes.get('/insurance-products',async(_req,res)=>res.json({data:await rows(pool,'SELECT id,name,daily_price,deductible,description,mode FROM insurance_products WHERE active=TRUE ORDER BY daily_price DESC')}));
