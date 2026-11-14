import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../apps/api/src/app.js';
import { pool } from '../../apps/api/src/database/db.js';
import { fixture,client } from './helpers.js';
import { photoAngles } from '../../packages/contracts/index.js';
test('MariaDB: 호스트 등록 단계·공개 요건·버전 충돌·추천 적용·예약 보호·수익·평가 권한',async()=>{
  const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
  try{
    const host=await fixture('host'),guest=await fixture(),other=await fixture('host'),h=client(base),g=client(base),o=client(base);await h('/auth/login','POST',host);await g('/auth/login','POST',guest);await o('/auth/login','POST',other);
    const basic={name:'차량등록검증 EV6',year:2023,registrationPlate:randomUUID().slice(0,12),area:'차량등록검증구'};
    assert.equal((await g('/host/vehicles','POST',basic)).status,403);
    const created=await h('/host/vehicles','POST',basic),id=created.data.id;assert.equal(created.status,201);
    assert.equal((await o(`/host/vehicles/${id}`)).status,404);assert.equal((await g(`/vehicles/${id}`)).status,404);
    assert.equal((await h(`/host/vehicles/${id}/publish`,'POST')).status,400);
    let v=(await h(`/host/vehicles/${id}`)).data;
    const specs={size:'중형',bodyType:'SUV',fuel:'전기차',seats:5,transmission:'자동',efficiency:5,efficiencyUnit:'km/kWh'};
    assert.equal((await h(`/host/vehicles/${id}/specs`,'PATCH',{...specs,efficiencyUnit:'km/L',version:v.version})).status,400);
    assert.equal((await h(`/host/vehicles/${id}/specs`,'PATCH',{...specs,version:v.version})).status,200);
    assert.equal((await h(`/host/vehicles/${id}/specs`,'PATCH',{...specs,version:v.version})).status,409);
    v=(await h(`/host/vehicles/${id}`)).data;
    assert.equal((await h(`/host/vehicles/${id}/details`,'PATCH',{pickupAddress:'테스트 전용 인수 장소',pickupInstructions:'비공개 안내',description:'검증용',options:['블루투스'],latitude:37.48442,longitude:126.92942,version:v.version})).status,200);
    assert.ok((await h(`/host/vehicles/${id}/registration-progress`)).data.detailsSavedAt);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64'),photos=[];
    for(const angle of photoAngles){const form=new FormData();form.set('purpose','vehicle-photo');form.set('file',new Blob([png],{type:'image/png'}),'test.png');const uploaded=await h('/uploads','POST',form);photos.push({angle,uploadId:uploaded.data.id});}
    v=(await h(`/host/vehicles/${id}`)).data;assert.equal((await h(`/host/vehicles/${id}/photos`,'PUT',{photos,version:v.version})).status,200);
    const analysis=await h(`/host/vehicles/${id}/analysis`,'POST');assert.equal(analysis.data.mode,'development');
    const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+30*86400000).toISOString();assert.equal((await h(`/host/vehicles/${id}/availability`,'PUT',{periods:[{startsAt:start,endsAt:end}]})).status,200);
    assert.equal((await h(`/host/vehicles/${id}/publish`,'POST')).status,200);assert.equal((await g(`/vehicles/${id}`)).status,200);
    const before=(await h(`/host/vehicles/${id}`)).data.dailyPrice,recommendation=(await h(`/host/vehicles/${id}/pricing-recommendation`)).data;assert.equal((await h(`/host/vehicles/${id}`)).data.dailyPrice,before);assert.equal(recommendation.mode,'rule-based-development');
    assert.equal((await h(`/host/vehicles/${id}/pricing-recommendation/apply`,'POST',{recommendationId:recommendation.id})).status,200);assert.equal((await h(`/host/vehicles/${id}`)).data.dailyPrice,recommendation.amount);
    await pool.query("INSERT IGNORE INTO insurance_products(id,name,daily_price,deductible,description) VALUES ('full','테스트보험',18000,0,'개발용')");
    const period={vehicleId:id,startsAt:new Date(Date.now()+2*86400000).toISOString(),endsAt:new Date(Date.now()+3*86400000).toISOString(),insuranceId:'full'},quote=(await g('/bookings/quote','POST',period)).data;
    const b=(await g('/bookings','POST',{...period,quoteTotal:quote.total,paymentMethodId:guest.methodId},{'Idempotency-Key':randomUUID()})).data;assert.ok(b.id);
    assert.equal((await h(`/host/vehicles/${id}`,'DELETE')).status,409);
    assert.equal((await h(`/host/vehicles/${id}/availability`,'PUT',{periods:[{startsAt:new Date(Date.now()+10*86400000).toISOString(),endsAt:end}]})).status,409);
    assert.equal((await o(`/host/bookings/${b.id}/guest-profile`)).status,404);assert.equal((await h(`/host/bookings/${b.id}/guest-profile`)).data.nickname,'통합 guest');
    assert.equal((await h('/host/earnings')).data.paidOut,0);assert.equal((await g('/host/earnings')).status,403);
    await g(`/bookings/${b.id}/cancel`,'POST');assert.equal((await h(`/host/vehicles/${id}`,'DELETE')).status,200);assert.equal((await g(`/vehicles/${id}`)).status,404);assert.equal((await g(`/bookings/${b.id}`)).status,200);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();}
});
