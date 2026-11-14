import { useEffect,useRef,useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Vehicle } from '../../../packages/contracts';
import { money } from './api';
import { Button,Notice,useApp } from './components';
export function GeoMap({vehicles,onBounds}:{vehicles:Vehicle[];onBounds:(bounds:string)=>void}) {
  const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),layer=useRef<L.LayerGroup|null>(null),callbacks=useRef({onBounds});const {go}=useApp();const [error,setError]=useState('');callbacks.current={onBounds};
  useEffect(()=>{
    const instance=L.map(container.current!).setView([37.484,126.929],13);map.current=instance;layer.current=L.layerGroup().addTo(instance);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).on('tileerror',()=>setError('지도 타일을 불러오지 못했습니다. 아래 차량 목록은 계속 이용할 수 있어요.')).addTo(instance);
    const update=()=>{const b=instance.getBounds();callbacks.current.onBounds([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(','));};instance.on('moveend',update);update();return()=>{instance.remove();map.current=null;layer.current=null;};
  },[]);
  useEffect(()=>{layer.current?.clearLayers();for(const v of vehicles){L.marker([v.latitude,v.longitude],{icon:L.divIcon({className:'price-marker',html:`<span>${money(v.dailyPrice)}</span>`,iconSize:[82,32],iconAnchor:[41,16]})}).on('click',()=>go(12,{vehicle:v.id})).addTo(layer.current!);}},[vehicles]);
  return <><div className="geo-map" ref={container} aria-label="주변 차량 지도"/><Button secondary onClick={()=>navigator.geolocation?.getCurrentPosition(p=>map.current?.setView([p.coords.latitude,p.coords.longitude],14),()=>setError('현재 위치 권한을 확인해 주세요.'),{timeout:15000})}>현재 위치에서 찾기</Button>{error&&<Notice>{error}</Notice>}<p className="muted">지도 이동·확대 후 이 지역에서 다시 검색합니다. 마커는 대략적인 위치입니다.</p></>;
}
