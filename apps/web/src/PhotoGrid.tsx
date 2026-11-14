import { useEffect,useState } from 'react';
import { api } from './api';
import { Notice } from './components';
export interface Photo { angle:string;uploadId:string;url:string }
export const angleLabels:Record<string,string>={front:'앞면',rear:'뒷면',left:'왼쪽',right:'오른쪽','front-left':'왼쪽 앞 모서리','front-right':'오른쪽 앞 모서리','rear-left':'왼쪽 뒤 모서리','rear-right':'오른쪽 뒤 모서리',odometer:'주행거리 계기판'};
export function PhotoGrid({angles,purpose,photos,onChange,onBusy}:{angles:string[];purpose:string;photos:Photo[];onChange:(updater:(previous:Photo[])=>Photo[])=>void;onBusy?:(busy:boolean)=>void}) {
  const [busy,setBusy]=useState<string[]>([]),[error,setError]=useState('');
  useEffect(()=>onBusy?.(busy.length>0),[busy.length,onBusy]);
  async function upload(angle:string,file:File) {
    setError('');if(file.size>8*1024*1024){setError('사진은 장당 8MB 이하로 올려 주세요.');return;}
    setBusy(value=>[...value,angle]);
    try {const body=new FormData();body.set('file',file);body.set('purpose',purpose);const result=await api('/uploads','POST',body);onChange(previous=>[...previous.filter(p=>p.angle!==angle),{angle,uploadId:result.id,url:result.url}]);}
    catch(e){setError((e as Error).message);}finally{setBusy(value=>value.filter(a=>a!==angle));}
  }
  return <>{error&&<Notice>{error}</Notice>}<div className="photo-grid">{angles.map(angle=>{const item=photos.find(p=>p.angle===angle);return <label className="photo-input" key={angle}>{item?<img src={item.url} alt={angleLabels[angle]}/>:<span className="photo-plus">＋</span>}<span>{busy.includes(angle)?'올리는 중…':`${angleLabels[angle]} ${item?'변경':'추가'}`}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy.includes(angle)} onChange={e=>{if(e.target.files?.[0])void upload(angle,e.target.files[0]);}}/></label>;})}</div></>;
}
