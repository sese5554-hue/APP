import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, distanceFee, assertTransition } from '../apps/api/src/domain/pricing.js';
import { hashPassword, verifyPassword } from '../apps/api/src/lib/crypto.js';
test('보험료와 두 종류 수수료를 구분하며 24시간 초과를 올림한다',()=>{
  const quote=calculatePrice(68000,18000,'2030-01-01T01:00:00Z','2030-01-02T01:00:00Z');
  assert.equal(quote.total,92800); assert.equal(quote.hostNet,61200); assert.equal(quote.insurance,18000);
  assert.equal(calculatePrice(68000,18000,'2030-01-01T01:00:00Z','2030-01-02T01:00:01Z').days,2);
  assert.throws(()=>calculatePrice(68000,18000,'2030-01-02T01:00:00Z','2030-01-01T01:00:00Z'));
});
test('주행거리 초과료와 계기판 역전 방지',()=>{ assert.equal(distanceFee(24180,24322,130,300),3600);assert.equal(distanceFee(24180,24263,130,300),0);assert.throws(()=>distanceFee(200,100,130,300)); });
test('승인 전 확정과 확정 전 인수 등 단계 생략 거부',()=>{ assertTransition('REQUESTED','APPROVED');assert.throws(()=>assertTransition('REQUESTED','CONFIRMED'));assert.throws(()=>assertTransition('APPROVED','IN_USE'));assert.throws(()=>assertTransition('COMPLETED','CANCELLED')); });
test('동일한 비밀번호도 다른 salt를 사용하고 잘못된 비밀번호를 거부한다',async()=>{ const a=await hashPassword('test-password'),b=await hashPassword('test-password');assert.notEqual(a,b);assert.equal(await verifyPassword('test-password',a),true);assert.equal(await verifyPassword('wrong-password',a),false); });
