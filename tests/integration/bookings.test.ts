import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../../apps/api/src/app.js';
import { pool,one } from '../../apps/api/src/database/db.js';
import { fixture,fixtureVehicle,client } from './helpers.js';
test('MariaDB: 동시 예약 충돌·요금 스냅샷·접근제어·승인·중복결제·취소환불',async()=>{
  const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
  try {
    const host=await fixture('host'),guest=await fixture(),other=await fixture(),vehicleId=await fixtureVehicle(host.id);
    const h=client(base),g=client(base),o=client(base);await h('/auth/login','POST',host);await g('/auth/login','POST',guest);await o('/auth/login','POST',other);
    const period={vehicleId,startsAt:new Date(Date.now()+2*86400000).toISOString(),endsAt:new Date(Date.now()+3*86400000).toISOString(),insuranceId:'full'};
    const detail=await g(`/vehicles/${vehicleId}`);assert.equal(detail.status,200);assert.ok(!('pickupInstructions' in detail.data));assert.ok(!('registrationPlate' in detail.data));
    const quote=await g('/bookings/quote','POST',period);assert.equal(quote.data.total,92800);
    assert.equal((await g('/vehicles?minPrice=100000&maxPrice=1')).status,400);
    const keyA=randomUUID(),keyB=randomUUID(),data={...period,quoteTotal:quote.data.total};
    const [a,b]=await Promise.all([g('/bookings','POST',{...data,paymentMethodId:guest.methodId},{'Idempotency-Key':keyA}),o('/bookings','POST',{...data,paymentMethodId:other.methodId},{'Idempotency-Key':keyB})]);
    assert.deepEqual([a.status,b.status].sort(),[201,409]);const winner=a.status===201?g:o,loser=a.status===201?o:g,account=a.status===201?guest:other,key=a.status===201?keyA:keyB,booking=a.status===201?a.data:b.data;
    assert.equal((await winner('/bookings','POST',{...data,paymentMethodId:account.methodId},{'Idempotency-Key':key})).data.id,booking.id);
    assert.equal((await loser(`/bookings/${booking.id}`)).status,404);
    assert.equal((await winner(`/bookings/${booking.id}/pay`,'POST')).status,409);
    assert.equal((await h(`/host/bookings/${booking.id}/approve`,'POST')).data.status,'APPROVED');
    assert.equal((await h(`/host/bookings/${booking.id}/approve`,'POST')).status,409);
    const payments=await Promise.all([winner(`/bookings/${booking.id}/pay`,'POST'),winner(`/bookings/${booking.id}/pay`,'POST')]);assert.ok(payments.every(p=>p.status===200));
    const count=await one(pool,"SELECT COUNT(*) AS total FROM payments WHERE booking_id=? AND kind='booking' AND status='SUCCEEDED'",[booking.id]);assert.equal(count!.total,1);
    assert.equal((await winner(`/bookings/${booking.id}/cancel`,'POST')).data.status,'CANCELLED');
    await winner(`/bookings/${booking.id}/cancel`,'POST');assert.equal((await one(pool,"SELECT COUNT(*) AS total FROM payments WHERE booking_id=? AND kind='refund' AND status='SUCCEEDED'",[booking.id]))!.total,1);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();}
});
