const E=process.env,F=re=>E[Object.keys(E).find(k=>re.test(k))];
const U=F(/REST_API_URL$/)||E.UPSTASH_REDIS_REST_URL,T=F(/REST_API_TOKEN$/)||E.UPSTASH_REDIS_REST_TOKEN;
async function r(c){const x=await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)});return (await x.json()).result}
export const get=async(k,d=null)=>{const v=await r(['GET',k]);return v?JSON.parse(v):d};
export const set=(k,v)=>r(['SET',k,JSON.stringify(v)]);
export const incr=k=>r(['INCR',k]);
export const SITE=()=>process.env.SITE_URL||'https://nocture-alpha.vercel.app';
export async function mail(to,subject,text){const k=process.env.RESEND_API_KEY;if(!k||!to)return;try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+k,'content-type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'HOOD <onboarding@resend.dev>',to:[to],subject,text})})}catch(e){}}
export const ADMINS=(process.env.ADMIN_IDS||'').split(',').map(Number).filter(Boolean);
export const ST={new:'Новый',acc:'Принят',ship:'Отправлен',done:'Выполнен',cx:'Отменён'};
export const SEED=[
{id:1,brand:'ELFLIQ',cat:'liq',name:'Apple Pear',desc:'Яблоко и груша — сладкий фруктовый микс, 5%',vol:'30 ML',eur:13,qty:10,e:'',img:''},
{id:2,brand:'ELFLIQ',cat:'liq',name:'Cool Mint',desc:'Освежающая мята — чистый холодок, 5%',vol:'30 ML',eur:13,qty:10,e:'',img:''},
{id:3,brand:'ELFLIQ',cat:'liq',name:'Elf Jack',desc:'Ягодный микс с ice, 5%',vol:'30 ML',eur:13,qty:6,e:'',img:''},
{id:4,brand:'HQD',cat:'liq',name:'Grape Mint',desc:'Виноград и мята — классика с холодком',vol:'10 ML',eur:10,qty:8,e:'',img:''},
{id:5,brand:'SNUS',cat:'snus',name:'Cuba Cherry',desc:'Вишнёвые никотиновые паучи',vol:'БАНКА',eur:7,qty:12,e:'',img:''},];
export const HIDDEN=['pod'];
export const products=async()=>{let p=await get('products');if(!p){p=SEED;await set('products',p)}return p};
export const tg=(m,b)=>fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${m}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(x=>x.json()).catch(()=>({}));
// смена статуса заказа: возвращает остатки при отмене и пишет клиенту в бота
export async function restock(before,after){
 const subs=await get('notify',{});let ch=false;
 for(const p of after){const b=before.find(x=>x.id===p.id);
  if(b&&b.qty<=0&&p.qty>0&&subs[p.id]&&subs[p.id].length){
   for(const u of subs[p.id])await tg('sendMessage',{chat_id:u,text:`Снова в наличии: ${p.brand} ${p.name}`,reply_markup:{inline_keyboard:[[{text:'Открыть на сайте',url:SITE()}]]}});
   delete subs[p.id];ch=true}}
 if(ch)await set('notify',subs)}
export const fmt=n=>{n=Math.round(n*100)/100;return Number.isInteger(n)?String(n):n.toFixed(2)};
export async function loyInfo(uid){
 const c=await cfg(),L=await get('loy:'+uid,{c:0,used:-1}),N=Math.floor(+c.loyEvery)||0,pct=+c.loyPct||0;
 if(!N||!pct)return{on:false};
 const elig=(L.c+1)%N===0&&L.used!==L.c;
 return{on:true,N,pct,c:L.c,elig,left:N-1-(L.c%N),L}}
export async function undoDisc(o){
 if(!o.pct)return;const t=o.dtype||'loy';
 if(t==='loy'){const L=await get('loy:'+o.uid,{c:0,used:-1});L.used=-1;await set('loy:'+o.uid,L)}
 else if(t==='welcome'){const rf=await get('ref:'+o.uid);if(rf){rf.w=0;await set('ref:'+o.uid,rf)}}
 else if(t==='credit'){await set('refcr:'+o.uid,(+(await get('refcr:'+o.uid,0))||0)+1)}}
export async function useDisc(uid,d){
 if(d.type==='loy'){const L=d.li.L;L.used=L.c;await set('loy:'+uid,L)}
 else if(d.type==='welcome'){const rf=await get('ref:'+uid);if(rf){rf.w=1;await set('ref:'+uid,rf)}}
 else if(d.type==='credit'){await set('refcr:'+uid,Math.max(0,(+(await get('refcr:'+uid,0))||0)-1))}}
// лучшая из доступных скидок (не суммируются): лояльность, приглашение друга, награда за друга
export async function bestDisc(uid){
 const c=await cfg(),out=[],li=await loyInfo(uid);
 if(li.on&&li.elig)out.push({pct:li.pct,type:'loy',li});
 const rp=+c.refPct||0;
 if(rp>0){const rf=await get('ref:'+uid);
  if(rf&&!rf.w){const os=await get('orders',[]);if(!os.some(o=>o.uid===uid&&o.st!=='cx'))out.push({pct:rp,type:'welcome'})}
  if((+(await get('refcr:'+uid,0))||0)>0)out.push({pct:rp,type:'credit'})}
 out.sort((a,b)=>b.pct-a.pct);return out[0]||null}
export async function setStatus(id,s){
 const os=await get('orders',[]),o=os.find(x=>x.id===id);if(!o||o.st===s||!ST[s])return null;
 if(s==='cx'&&o.st!=='cx'){const P=await products(),bef=JSON.parse(JSON.stringify(P));
  o.items.forEach(i=>{const p=P.find(x=>x.id===i.id);if(p)p.qty+=i.q});await set('products',P);await restock(bef,P);
  await undoDisc(o)}
 const was=o.st;o.st=s;await set('orders',os);
 const txt=`Заказ №${id}: ${ST[s]}`;
 if(o.uid)await tg('sendMessage',{chat_id:o.uid,text:txt});
 if(o.web&&o.web.email)await mail(o.web.email,`HOOD: заказ №${id}`,`${txt}\n\nСтраница заказа: ${SITE()}/order.html?id=${id}&key=${o.web.key}`);
 if(s==='done'&&was!=='done'&&o.uid){
  const L=await get('loy:'+o.uid,{c:0,used:-1});L.c++;await set('loy:'+o.uid,L);const li=await loyInfo(o.uid);
  if(li.on)await tg('sendMessage',{chat_id:o.uid,text:li.elig?`Спасибо за заказ! Твой следующий заказ со скидкой ${li.pct}%.`:`Спасибо за заказ! До заказа со скидкой ${li.pct}% осталось: ${li.left}.`});
  const rf=await get('ref:'+o.uid),first=!os.some(x=>x.uid===o.uid&&x.st==='done'&&x.id!==o.id);
  if(rf&&rf.by&&!rf.paid&&first){const c=await cfg(),rp=+c.refPct||0;rf.paid=1;await set('ref:'+o.uid,rf);
   if(rp>0){await set('refcr:'+rf.by,(+(await get('refcr:'+rf.by,0))||0)+1);await tg('sendMessage',{chat_id:rf.by,text:`Твой друг получил первый заказ. Тебе скидка ${rp}% на следующий заказ.`})}}}
 return o}
export function calcStats(os,usersCount){
 const dk=ts=>berlin(new Date(ts)).date,today=berlin().date;
 const ago=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)};
 const ok=os.filter(o=>o.st!=='cx'),days={},prod={},br={},pl={},hr={},cust={},dc={loy:0,welcome:0,credit:0};let saved=0;
 for(const o of ok){const d=dk(o.ts);(days[d]=days[d]||{n:0,rev:0});days[d].n++;days[d].rev+=o.t;
  for(const i of o.items){const p=prod[i.n]=prod[i.n]||{n:i.n,q:0,rev:0};p.q+=i.q;p.rev+=i.q*i.eur;const bn=i.n.split(' ')[0],b=br[bn]=br[bn]||{b:bn,q:0,rev:0};b.q+=i.q;b.rev+=i.q*i.eur}
  if(o.slot){pl[o.slot.place]=(pl[o.slot.place]||0)+1;const h=String(o.slot.time).slice(0,2);hr[h]=(hr[h]||0)+1}
  cust[o.uid]=(cust[o.uid]||0)+1;
  if(o.pct){const k=o.dtype||'loy';dc[k]=(dc[k]||0)+1;saved+=(o.sub||o.t)-o.t}}
 const r2=n=>Math.round(n*100)/100,sum=from=>{let n=0,rev=0;for(const d in days)if(d>=from){n+=days[d].n;rev+=days[d].rev}return{n,rev:r2(rev)}};
 const all=sum('0000'),series=[];for(let i=13;i>=0;i--){const d=ago(i),v=days[d]||{n:0,rev:0};series.push({d,n:v.n,rev:r2(v.rev)})}
 const srt=(o,k)=>Object.values(o).sort((a,b)=>b[k]-a[k]),ids=Object.keys(cust);
 return{today:sum(today),d7:sum(ago(6)),d30:sum(ago(29)),all,avg:all.n?r2(all.rev/all.n):0,cancelled:os.length-ok.length,done:os.filter(o=>o.st==='done').length,customers:ids.length,returning:ids.filter(k=>cust[k]>1).length,users:usersCount,series,top:srt(prod,'q').slice(0,8).map(x=>({...x,rev:r2(x.rev)})),brands:srt(br,'rev').map(x=>({...x,rev:r2(x.rev)})),places:Object.entries(pl).map(([p,n])=>({p,n})).sort((a,b)=>b.n-a.n),hours:Object.entries(hr).map(([h,n])=>({h,n})).sort((a,b)=>a.h<b.h?-1:1),disc:dc,saved:r2(saved)}}
// ===== расписание выдачи =====
export const raw=r;
export const DEFCFG={open:'12:00',close:'22:00',step:30,cap:3,days:3,places:['Hauptbahnhof (Hbf)','Ostbahnhof'],loyEvery:5,loyPct:10,refPct:10,botShop:false,geo:['48.1402,11.5586','48.1274,11.6043']};
export const cfg=async()=>({...DEFCFG,...(await get('cfg',{}))});
export const berlin=(d=new Date())=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return{date:`${p.year}-${p.month}-${p.day}`,min:+p.hour*60+ +p.minute}};
export const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const toMin=s=>{const[h,m]=s.split(':');return +h*60+ +m};
const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
export async function slots(date){
 const c=await cfg(),n=berlin(),os=await get('orders',[]),out=[];
 if(date<n.date)return out;
 for(let m=toMin(c.open);m<=toMin(c.close);m+=+c.step||30){
  if(date===n.date&&m<n.min+30)continue;
  const used=os.filter(o=>o.st!=='cx'&&o.slot&&o.slot.date===date&&o.slot.time===hm(m)).length;
  if(used<c.cap)out.push(hm(m))}
 return out}
