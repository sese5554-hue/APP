import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { config } from '../config.js';
import { pool, transaction, one, dateSql } from './db.js';
import { hashPassword } from '../lib/crypto.js';
export async function seed() {
  if(config.NODE_ENV!=='development' && config.NODE_ENV!=='test') throw new Error('개발용 seed는 운영에서 실행할 수 없습니다.');
  await transaction(async db=>{
    for(const [id,name,price,deductible] of [['full','완전자차',18000,0],['standard','일반자차',9000,300000]] as const) {
      await db.query('INSERT IGNORE INTO insurance_products(id,name,daily_price,deductible,description) VALUES (?,?,?,?,?)',[id,name,price,deductible,'개발용 상품입니다. 실제 보험 가입/보장을 제공하지 않습니다.']);
    }
    const passwordHash=await hashPassword('Geuncha123!');
    for(const [login,nickname,phone,role] of [['hostdemo','민지','01000000001','host'],['guestdemo','서준','01000000002','guest']] as const) {
      const exists=await one(db,'SELECT id FROM users WHERE login_id=?',[login]);
      if(exists)continue;
      const id=randomUUID();
      await db.query('INSERT INTO users(id,login_id,nickname,phone,password_hash,active_role,neighborhood) VALUES (?,?,?,?,?,?,?)',[id,login,nickname,phone,passwordHash,role,'서울시 관악구 신림동']);
      await db.query('INSERT INTO user_roles(user_id,role) VALUES (?,?)',[id,role]);
      for(const kind of ['identity','neighborhood','license']) await db.query('INSERT INTO user_verifications(id,user_id,kind,status,mode,metadata_json,expires_at) VALUES (?,?,?,?,?,?,?)',[randomUUID(),id,kind,'success','development',JSON.stringify(kind==='license'?{type:'1종 보통',maskedNumber:'12-34-******-12',issuedOn:'2020-05-14',expiresOn:'2035-05-14'}:{neighborhood:'서울시 관악구 신림동'}),dateSql(new Date(Date.now()+365*86400000))]);
      await db.query('INSERT INTO payment_methods(id,user_id,provider,vault_ref,brand,last_four,is_default) VALUES (?,?,?,?,?,?,TRUE)',[randomUUID(),id,'development',`dev-${randomUUID()}`,'개발 테스트 카드','1234']);
      if(role==='host') {
        for(const [index,name,fuel,bodyType,price,efficiency] of [[0,'기아 EV6 롱레인지','전기차','SUV',68000,5],[1,'현대 아반떼 1.6','가솔린','세단',45000,15],[2,'테슬라 모델 3','전기차','세단',82000,5.8]] as const) {
          const vehicleId=randomUUID();
          await db.query("INSERT INTO vehicles(id,host_id,name,year,registration_plate,area,fuel,body_type,daily_price,efficiency,efficiency_unit,status,grade,verification_status,pickup_address,pickup_instructions,description,options_json,details_saved_at,latitude,longitude) VALUES (?,?,?,2023,?,?,?,?,?,?,?,'published','B','development',?,?,?, ?,UTC_TIMESTAMP(3),?,?)",[vehicleId,id,name,`개발${index}가000${index}`,'서울시 관악구',fuel,bodyType,price,efficiency,fuel==='전기차'?'km/kWh':'km/L','서울시 관악구 신림동','개발 예시: 신림역 인근 주차장에서 만나요.','동네에서 편하게 만나는 차량입니다. 이 차량은 개발용 샘플 데이터입니다.',JSON.stringify(['블루투스','후방카메라']),37.484+index*.004,126.929+index*.004]);
          await db.query('INSERT INTO vehicle_availability(id,vehicle_id,starts_at,ends_at) VALUES (?,?,?,?)',[randomUUID(),vehicleId,dateSql(new Date(Date.now()-86400000)),dateSql(new Date(Date.now()+365*86400000))]);
        }
      }
    }
  });
  console.log('Development seed ready (idempotent). Accounts: hostdemo / guestdemo; password: Geuncha123!');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) { try { await seed(); } finally { await pool.end(); } }
