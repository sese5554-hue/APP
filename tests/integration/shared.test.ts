import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../../apps/api/src/app.js';
import { pool,one,dateSql } from '../../apps/api/src/database/db.js';
import { fixture,fixtureVehicle,client } from './helpers.js';
import { photoAngles } from '../../packages/contracts/index.js';
test('MariaDB: SSE 채팅·읽음·업로드 권한·인수반납·양측 확인·추가결제·후기·설정·문의',async()=>{
  const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
  const streamAbort=new AbortController();
  try {
    const host=await fixture('host'),guest=await fixture(),outsider=await fixture(),vehicleId=await fixtureVehicle(host.id),h=client(base),g=client(base),o=client(base);
    await h('/auth/login','POST',host);await g('/auth/login','POST',guest);await o('/auth/login','POST',outsider);
    const period={vehicleId,startsAt:new Date(Date.now()+2*86400000).toISOString(),endsAt:new Date(Date.now()+3*86400000).toISOString(),insuranceId:'full'},quote=await g('/bookings/quote','POST',period);
    const b=(await g('/bookings','POST',{...period,quoteTotal:quote.data.total,paymentMethodId:guest.methodId},{'Idempotency-Key':randomUUID()})).data;
    assert.ok(b?.id);await h(`/host/bookings/${b.id}/approve`,'POST');await g(`/bookings/${b.id}/pay`,'POST');
    assert.equal((await o(`/bookings/${b.id}/messages`)).status,404);
    const stream=await fetch(base+'/events',{headers:{Cookie:h.cookie()},signal:streamAbort.signal});assert.equal(stream.status,200);
    const message={clientMessageId:randomUUID(),content:'<script>그대로 텍스트로 표시</script>'};await g(`/bookings/${b.id}/messages`,'POST',message);await g(`/bookings/${b.id}/messages`,'POST',message);
    const reader=stream.body!.getReader(),decoder=new TextDecoder();let received='';const timeout=setTimeout(()=>streamAbort.abort(),5000);
    while(!received.includes(b.id)){const chunk=await reader.read();if(chunk.done)break;received+=decoder.decode(chunk.value);}clearTimeout(timeout);assert.ok(received.includes(b.id));streamAbort.abort();
    const chat=await h(`/bookings/${b.id}/messages`);assert.equal(chat.data.length,1);assert.equal(chat.data[0].content,message.content);
    assert.equal((await h('/me/conversations')).data.find((c:any)=>c.id===b.id).unread,1);await h(`/bookings/${b.id}/read`,'POST',{seq:chat.data[0].seq});assert.equal((await h('/me/conversations')).data.find((c:any)=>c.id===b.id).unread,0);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
    const invalid=new FormData();invalid.set('purpose','inspection');invalid.set('file',new Blob(['not an image'],{type:'image/png'}),'bad.png');assert.equal((await g('/uploads','POST',invalid)).status,400);
    const photos=[];
    for(const angle of [...photoAngles,'odometer']){const form=new FormData();form.set('purpose','inspection');form.set('file',new Blob([png],{type:'image/png'}),'test.png');const result=await g('/uploads','POST',form);assert.equal(result.status,201);photos.push({angle,uploadId:result.data.id});}
    assert.equal((await o(`/uploads/${photos[0].uploadId}`)).status,404);
    assert.equal((await g(`/bookings/${b.id}/inspections/pickup`,'PUT',{odometerKm:1000,photos,draft:false})).status,409);
    await pool.query('UPDATE bookings SET starts_at=? WHERE id=?',[dateSql(new Date(Date.now()-60000)),b.id]);
    assert.equal((await g(`/bookings/${b.id}/inspections/pickup`,'PUT',{odometerKm:1000,photos:photos.slice(1),draft:false})).status,400);
    assert.equal((await g(`/bookings/${b.id}/inspections/pickup`,'PUT',{odometerKm:1000,photos,draft:false})).status,200);
    assert.equal((await h(`/uploads/${photos[0].uploadId}`)).status,200);
    assert.equal((await g(`/bookings/${b.id}/inspections/return`,'PUT',{odometerKm:999,photos,draft:false})).status,400);
    assert.equal((await g(`/bookings/${b.id}/inspections/return`,'PUT',{odometerKm:1142,photos,draft:false})).status,200);
    assert.equal((await g(`/bookings/${b.id}/settlement`)).data.balance,3600);
    assert.equal((await g(`/bookings/${b.id}/settlement/pay`,'POST')).status,409);
    await g(`/bookings/${b.id}/comparison/acknowledgements`,'POST',{decision:'confirmed'});await h(`/bookings/${b.id}/comparison/acknowledgements`,'POST',{decision:'confirmed'});
    assert.equal((await g(`/bookings/${b.id}/settlement/pay`,'POST')).status,200);assert.equal((await g(`/bookings/${b.id}`)).data.status,'COMPLETED');
    const review={rating:5,mannerRating:5,tags:['친절해요'],content:'검증 후기'};assert.equal((await g(`/bookings/${b.id}/reviews`,'POST',review)).status,201);assert.equal((await g(`/bookings/${b.id}/reviews`,'POST',review)).status,409);
    const settings={booking:false,chat:true,settlement:true,benefit:false};await g('/me/notification-settings','PUT',settings);assert.deepEqual((await g('/me/notification-settings')).data,settings);
    const inquiry={idempotencyKey:randomUUID(),category:'예약',title:'검증 문의',content:'내용',uploadIds:[]};assert.equal((await g('/support/inquiries','POST',inquiry)).status,201);await g('/support/inquiries','POST',inquiry);assert.equal((await one(pool,'SELECT COUNT(*) AS total FROM inquiries WHERE id=?',[inquiry.idempotencyKey]))!.total,1);
    const setup=(await g('/me/payment-method-setup','POST')).data;assert.equal((await o('/me/payment-methods','POST',{setupId:setup.id,isDefault:true})).status,400);assert.equal((await g('/me/payment-methods','POST',{setupId:setup.id,isDefault:true})).status,201);assert.equal((await g('/me/payment-methods','POST',{setupId:setup.id,isDefault:true})).status,400);
  }finally{streamAbort.abort();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();}
});
