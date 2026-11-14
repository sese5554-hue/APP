import { randomUUID } from 'node:crypto';
import { pool,dateSql } from '../../apps/api/src/database/db.js';
import { hashPassword } from '../../apps/api/src/lib/crypto.js';
export async function fixture(role='guest') {
  const id=randomUUID(),suffix=randomUUID().replaceAll('-','').slice(0,12),loginId='t'+suffix,phone='010'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');
  await pool.query('INSERT INTO users(id,login_id,nickname,phone,password_hash,active_role) VALUES (?,?,?,?,?,?)',[id,loginId,'통합 '+role,phone,await hashPassword('Geuncha123!'),role]);await pool.query('INSERT INTO user_roles(user_id,role) VALUES (?,?)',[id,role]);
  for(const kind of ['identity','neighborhood','license'])await pool.query("INSERT INTO user_verifications(id,user_id,kind,status,mode,metadata_json,expires_at) VALUES (?,?,?,'success','development','{}',?)",[randomUUID(),id,kind,dateSql(new Date(Date.now()+86400000))]);
  const methodId=randomUUID();await pool.query("INSERT INTO payment_methods(id,user_id,provider,vault_ref,brand,last_four,is_default) VALUES (?,?,'development',?,'테스트','1234',TRUE)",[methodId,id,'dev-'+randomUUID()]);return {id,loginId,password:'Geuncha123!',methodId};
}
export async function fixtureVehicle(hostId:string) {
  await pool.query("INSERT IGNORE INTO insurance_products(id,name,daily_price,deductible,description) VALUES ('full','개발 완전자차',18000,0,'개발용 보험')");
  const id=randomUUID();await pool.query("INSERT INTO vehicles(id,host_id,name,year,registration_plate,area,status,verification_status,pickup_address) VALUES (?,?,'통합 EV6',2023,?,'통합테스트구','published','development','비공개 테스트 인수 주소')",[id,hostId,randomUUID().slice(0,12)]);
  await pool.query('INSERT INTO vehicle_availability(id,vehicle_id,starts_at,ends_at) VALUES (?,?,?,?)',[randomUUID(),id,dateSql(new Date(Date.now()+3600000)),dateSql(new Date(Date.now()+30*86400000))]);return id;
}
export function client(base:string) {
  let cookie='';
  const request=async(path:string,method='GET',body?:unknown,headers:Record<string,string>={})=>{
    const response=await fetch(base+path,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),'X-Geuncha-Request':'1',Cookie:cookie,...headers},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie')!.split(';')[0];
    return {status:response.status,...(response.headers.get('content-type')?.includes('application/json')?await response.json():{data:{bytes:(await response.arrayBuffer()).byteLength}})};
  };
  return Object.assign(request,{cookie:()=>cookie});
}
