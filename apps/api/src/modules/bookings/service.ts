import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { bookingSchema, periodSchema, type BookingStatus } from '../../../../../packages/contracts/index.js';
import { pool, one, rows, transaction, dateSql, dateIso, type Sql, type Row } from '../../database/db.js';
import { ensure } from '../../lib/errors.js';
import { hashToken } from '../../lib/crypto.js';
import { calculatePrice, assertTransition } from '../../domain/pricing.js';
import type { PaymentProvider } from '../../providers/index.js';
import { occupancySql } from '../vehicles/repository.js';
export const bookingSelect=`SELECT b.*,v.name AS vehicle_name,v.pickup_address,v.pickup_instructions,h.nickname AS host_nickname,g.nickname AS guest_nickname FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN users h ON h.id=b.host_id JOIN users g ON g.id=b.guest_id`;
export function bookingView(row:Row){const {idempotencyKey,requestHash,paymentMethodId,...safe}=row;return {...safe,startsAt:dateIso(row.startsAt),endsAt:dateIso(row.endsAt),createdAt:dateIso(row.createdAt),expiresAt:row.expiresAt?dateIso(row.expiresAt):null};}
export async function participant(db:Sql,id:string,userId:string){await expireDue(userId);const row=await one(db,`${bookingSelect} WHERE b.id=? AND (b.guest_id=? OR b.host_id=?)`,[id,userId,userId]);ensure(row,404,'BOOKING_NOT_FOUND','예약을 찾을 수 없습니다.');return row;}
export async function expireDue(userId:string) {
  const expired=await rows(pool,"SELECT id FROM bookings WHERE (guest_id=? OR host_id=?) AND status IN ('REQUESTED','APPROVED') AND expires_at<=UTC_TIMESTAMP(3) LIMIT 50",[userId,userId]);
  for(const item of expired)await transaction(async db=>{await lockBooking(db,item.id,userId);await db.query("UPDATE bookings SET status='EXPIRED',expires_at=NULL WHERE id=? AND status IN ('REQUESTED','APPROVED') AND expires_at<=UTC_TIMESTAMP(3)",[item.id]);});
}
export async function lockBooking(db:Sql,id:string,userId:string){const ref=await one(db,'SELECT vehicle_id FROM bookings WHERE id=? AND (guest_id=? OR host_id=?)',[id,userId,userId]);ensure(ref,404,'BOOKING_NOT_FOUND','예약을 찾을 수 없습니다.');await db.query('SELECT id FROM vehicles WHERE id=? FOR UPDATE',[ref.vehicleId]);const booking=await one(db,'SELECT * FROM bookings WHERE id=? FOR UPDATE',[id]);ensure(booking,404,'BOOKING_NOT_FOUND','예약을 찾을 수 없습니다.');return booking;}
export async function quote(db:Sql,data:z.infer<typeof periodSchema>){
  ensure(Date.parse(data.startsAt)>Date.now(),400,'PAST_START','시작 시간은 현재 이후여야 합니다.');
  const vehicle=await one(db,"SELECT * FROM vehicles WHERE id=? AND status='published' AND deleted_at IS NULL",[data.vehicleId]);ensure(vehicle,404,'VEHICLE_NOT_FOUND','예약할 수 있는 차량이 아닙니다.');
  const insurance=await one(db,'SELECT * FROM insurance_products WHERE id=? AND active=TRUE',[data.insuranceId]);ensure(insurance,400,'INVALID_INSURANCE','보험 상품을 다시 선택해 주세요.');
  const price=calculatePrice(vehicle.dailyPrice,insurance.dailyPrice,data.startsAt,data.endsAt);
  ensure(await one(db,'SELECT id FROM vehicle_availability WHERE vehicle_id=? AND starts_at<=? AND ends_at>=?',[data.vehicleId,dateSql(data.startsAt),dateSql(data.endsAt)]),409,'UNAVAILABLE','대여 가능한 기간이 아닙니다.');
  ensure(!await one(db,`SELECT b.id FROM bookings b WHERE b.vehicle_id=? AND ${occupancySql} AND b.starts_at<? AND b.ends_at>?`,[data.vehicleId,dateSql(data.endsAt),dateSql(data.startsAt)]),409,'BOOKING_CONFLICT','이미 예약된 시간입니다. 다른 일정을 선택해 주세요.');
  return {price,vehicle,insurance};
}
export class BookingService {
  constructor(private payments:PaymentProvider){}
  async create(userId:string,data:z.infer<typeof bookingSchema>,key:string){
    const requestHash=hashToken(JSON.stringify(data));
    return transaction(async db=>{
      await db.query('SELECT id FROM vehicles WHERE id=? FOR UPDATE',[data.vehicleId]);
      const prior=await one(db,'SELECT * FROM bookings WHERE guest_id=? AND idempotency_key=?',[userId,key]);
      if(prior){ensure(prior.requestHash===requestHash,409,'KEY_REUSED','다른 요청에 같은 재시도 키를 사용할 수 없습니다.');return prior.id;}
      const {price,vehicle}=await quote(db,data);
      ensure(vehicle.hostId!==userId,400,'SELF_BOOKING','본인의 차량은 예약할 수 없습니다.');
      const verified=await one(db,"SELECT COUNT(DISTINCT kind) AS total FROM user_verifications WHERE user_id=? AND kind IN ('identity','neighborhood','license') AND status='success' AND expires_at>UTC_TIMESTAMP(3)",[userId]);
      ensure(verified?.total===3,403,'VERIFICATION_REQUIRED','본인·동네·면허 인증을 모두 완료해 주세요.');
      ensure(await one(db,"SELECT id FROM payment_methods WHERE id=? AND user_id=? AND status='active'",[data.paymentMethodId,userId]),400,'INVALID_PAYMENT_METHOD','본인 결제수단을 선택해 주세요.');
      ensure(data.quoteTotal===price.total,409,'PRICE_CHANGED','요금이 변경되었습니다. 견적을 다시 확인해 주세요.');
      const id=randomUUID();
      await db.query("INSERT INTO bookings(id,vehicle_id,guest_id,host_id,starts_at,ends_at,status,daily_price,days,rental,insurance,guest_fee,host_commission,total,host_net,insurance_id,included_km,extra_km_price,payment_method_id,expires_at,idempotency_key,request_hash) VALUES (?,?,?,?,?,?,'REQUESTED',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,vehicle.id,userId,vehicle.hostId,dateSql(data.startsAt),dateSql(data.endsAt),vehicle.dailyPrice,price.days,price.rental,price.insurance,price.guestFee,price.hostCommission,price.total,price.hostNet,data.insuranceId,price.includedKm,price.extraKmPrice,data.paymentMethodId,dateSql(new Date(Date.now()+86400000)),key,requestHash]);return id;
    });
  }
  async approve(id:string,hostId:string,reject=false){return transaction(async db=>{const booking=await lockBooking(db,id,hostId);ensure(booking.hostId===hostId,403,'HOST_ONLY','차량 호스트만 관리할 수 있습니다.');assertTransition(booking.status,reject?'REJECTED':'APPROVED');ensure(Date.parse(dateIso(booking.expiresAt))>Date.now(),409,'EXPIRED','요청 기한이 만료되었습니다.');await db.query('UPDATE bookings SET status=?,expires_at=? WHERE id=?',[reject?'REJECTED':'APPROVED',reject?null:dateSql(new Date(Date.now()+1800000)),id]);});}
  async pay(id:string,userId:string,kind:'booking'|'extra'='booking'){
    const prepared=await transaction(async db=>{
      const booking=await lockBooking(db,id,userId);ensure(booking.guestId===userId,403,'GUEST_ONLY','예약자만 결제할 수 있습니다.');
      const key=`${id}:${kind}`,existing=await one(db,'SELECT * FROM payments WHERE idempotency_key=? FOR UPDATE',[key]);
      if(existing?.status==='SUCCEEDED')return {done:true,booking,amount:existing.amount,key,paymentId:existing.id};
      let amount=booking.total;
      if(kind==='booking'){ensure(booking.status==='APPROVED',409,'NOT_APPROVED','호스트 승인 후 결제할 수 있습니다.');ensure(Date.parse(dateIso(booking.expiresAt))>Date.now(),409,'EXPIRED','결제 기한이 만료되었습니다.');}
      else {ensure(booking.status==='SETTLEMENT_PENDING',409,'NOT_SETTLEABLE','정산을 확인할 수 없는 상태입니다.');const settlement=await one(db,'SELECT * FROM settlements WHERE booking_id=?',[id]);ensure(settlement?.status==='agreed' && settlement.balance>0,409,'AGREEMENT_REQUIRED','양측의 차량 상태 확인이 필요합니다.');amount=settlement.balance;}
      ensure(await one(db,"SELECT id FROM payment_methods WHERE id=? AND user_id=? AND status='active'",[booking.paymentMethodId,userId]),400,'INVALID_PAYMENT_METHOD','등록된 결제수단을 확인해 주세요.');
      const paymentId=existing?.id??randomUUID();
      if(existing)await db.query("UPDATE payments SET status='PENDING' WHERE id=?",[paymentId]);else await db.query("INSERT INTO payments(id,booking_id,kind,status,amount,idempotency_key) VALUES (?,?,?,'PENDING',?,?)",[paymentId,id,kind,amount,key]);return {done:false,booking,amount,key,paymentId};
    });
    if(prepared.done)return;
    let reference:string;
    try{reference=(await this.payments.charge(prepared.key,prepared.amount)).reference;}
    catch(error){await pool.query("UPDATE payments SET status='FAILED' WHERE id=? AND status='PENDING'",[prepared.paymentId]);throw error;}
    const late=await transaction(async db=>{
      const booking=await lockBooking(db,id,userId),payment=await one(db,'SELECT status FROM payments WHERE id=? FOR UPDATE',[prepared.paymentId]);
      if(payment?.status==='SUCCEEDED')return false;
      await db.query("UPDATE payments SET status='SUCCEEDED',provider_ref=? WHERE id=?",[reference,prepared.paymentId]);
      if(kind==='booking'){
        if(booking.status!=='APPROVED'||Date.parse(dateIso(booking.expiresAt))<=Date.now())return true;
        assertTransition(booking.status,'CONFIRMED');await db.query("UPDATE bookings SET status='CONFIRMED',expires_at=NULL WHERE id=?",[id]);
      }else{ensure(booking.status==='SETTLEMENT_PENDING',409,'STATE_CHANGED','예약 상태가 변경되었습니다.');await db.query("UPDATE settlements SET balance=0,status='paid' WHERE booking_id=?",[id]);await db.query("UPDATE bookings SET status='COMPLETED' WHERE id=?",[id]);}
      return false;
    });
    if(late){await this.refund(id,userId);ensure(false,409,'LATE_PAYMENT','기한이 지난 결제는 환불 처리했습니다.');}
  }
  async refund(id:string,userId:string){
    const approved=await transaction(async db=>{await lockBooking(db,id,userId);const payment=await one(db,"SELECT * FROM payments WHERE booking_id=? AND kind='booking' AND status='SUCCEEDED'",[id]);if(!payment)return null;
      const key=`${id}:refund`,existing=await one(db,'SELECT * FROM payments WHERE idempotency_key=?',[key]);if(existing?.status==='SUCCEEDED')return null;
      const refundId=existing?.id??randomUUID();if(!existing)await db.query("INSERT INTO payments(id,booking_id,kind,status,amount,idempotency_key) VALUES (?,?,'refund','PENDING',?,?)",[refundId,id,payment.amount,key]);else await db.query("UPDATE payments SET status='PENDING' WHERE id=?",[refundId]);return {id:refundId,key,amount:payment.amount};});
    if(!approved)return;
    try{const result=await this.payments.refund(approved.key,approved.amount);await pool.query("UPDATE payments SET status='SUCCEEDED',provider_ref=? WHERE id=?",[result.reference,approved.id]);}
    catch(error){await pool.query("UPDATE payments SET status='FAILED' WHERE id=?",[approved.id]);throw error;}
  }
  async cancel(id:string,userId:string){await transaction(async db=>{const booking=await lockBooking(db,id,userId);ensure(booking.guestId===userId,403,'GUEST_ONLY','예약자만 취소할 수 있습니다.');if(booking.status==='CANCELLED')return;assertTransition(booking.status,'CANCELLED');ensure(!await one(db,"SELECT id FROM payments WHERE booking_id=? AND status='PENDING'",[id]),409,'PAYMENT_PENDING','결제 처리 중입니다. 잠시 후 취소해 주세요.');await db.query("UPDATE bookings SET status='CANCELLED',expires_at=NULL WHERE id=?",[id]);});await this.refund(id,userId);}
}
