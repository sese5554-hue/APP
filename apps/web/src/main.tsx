import React from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect,useState } from 'react';
import type { User } from '../../../packages/contracts';
import { api } from './api';
import { AppContext,Button,Intro,Notice } from './components';
import { AuthPage } from './pages/Auth';
import './style.css';
function App(){
  const [location,setLocation]=useState(window.location.pathname+window.location.search),[user,setUser]=useState<User|null>(null),[revision,setRevision]=useState(0),[toast,setToast]=useState(''),[ready,setReady]=useState(false);
  const screen=Number(location.match(/\/screens\/(\d{1,2})/)?.[1]??0),params=new URLSearchParams(location.split('?')[1]);
  function go(next:number,values:Record<string,string|number|null>={}){const query=new URLSearchParams(params);for(const [key,value]of Object.entries(values)){if(value===null)query.delete(key);else query.set(key,String(value));}const url=`/screens/${String(next).padStart(2,'0')}${query.size?'?'+query:''}`;history.pushState({},'',url);setLocation(url);window.scrollTo({top:0});}
  useEffect(()=>{const pop=()=>setLocation(window.location.pathname+window.location.search);window.addEventListener('popstate',pop);void api<User|null>('/auth/me').then(setUser).catch(()=>{}).finally(()=>setReady(true));return()=>window.removeEventListener('popstate',pop);},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
  return <AppContext.Provider value={{user,setUser,go,params,refresh:()=>setRevision(v=>v+1),revision,notify:setToast}}><div className="app-shell"><aside className="brand-panel"><div className="wordmark">근차<span>GEUNCHA</span></div><h2>우리 동네에서,<br/>가볍게 떠나요.</h2><p>가까운 이웃의 차와 만나는<br/>새로운 이동의 시작.</p><div className="brand-road"/><small>내 동네 차량 공유</small></aside><div className="phone"><header className="topbar"><button aria-label="뒤로가기" onClick={()=>history.back()}>‹</button><button className="brand" onClick={()=>go(user?.activeRole==='host'?25:8)}>근차</button><button onClick={()=>go(user?(user.activeRole==='host'?47:37):3)}>{user?user.nickname:'로그인'}</button></header>{toast&&<div className="toast" role="status">{toast}</div>}<main key={screen}>{!ready?<p role="status">연결 중…</p>:screen<=7&&screen!==1?<AuthPage screen={screen}/>:<><Intro title="근차를 만들고 있어요" description="화면 연결을 순서대로 구현 중입니다."/><Button onClick={()=>go(3)}>로그인</Button><Notice>현재 인증 화면 00~07을 사용할 수 있습니다.</Notice></>}</main><footer className="bottom-nav">{(user?.activeRole==='host'?[[25,'⌂','홈'],[34,'▤','예약'],[44,'▧','채팅'],[47,'◉','마이']]:[[8,'⌕','검색'],[45,'▤','예약'],[44,'▧','채팅'],[37,'◉','마이']]).map(([n,icon,label])=><button key={n} className={screen===n?'active':''} onClick={()=>go(Number(n))}><span aria-hidden="true">{icon}</span>{label}</button>)}</footer></div></div></AppContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
