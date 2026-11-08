const E=process.env,F=re=>E[Object.keys(E).find(k=>re.test(k))];
const U=F(/REST_API_URL$/)||E.UPSTASH_REDIS_REST_URL,T=F(/REST_API_TOKEN$/)||E.UPSTASH_REDIS_REST_TOKEN;
async function r(c){const x=await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)});return (await x.json()).result}
export const get=async(k,d=null)=>{const v=await r(['GET',k]);return v?JSON.parse(v):d};
export const set=(k,v)=>r(['SET',k,JSON.stringify(v)]);
export const incr=k=>r(['INCR',k]);
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
   for(const u of subs[p.id])await tg('sendMessage',{chat_id:u,text:`Снова в наличии: ${p.brand} ${p.name}`,reply_markup:{inline_keyboard:[[{text:'Открыть',callback_data:'p:'+p.id}]]}});
   delete subs[p.id];ch=true}}
 if(ch)await set('notify',subs)}
export const fmt=n=>{n=Math.round(n*100)/100;return Number.isInteger(n)?String(n):n.toFixed(2)};
export async function loyInfo(uid){
 const c=await cfg(),L=await get('loy:'+uid,{c:0,used:-1}),N=Math.floor(+c.loyEvery)||0,pct=+c.loyPct||0;
 if(!N||!pct)return{on:false};
 const elig=(L.c+1)%N===0&&L.used!==L.c;
 return{on:true,N,pct,c:L.c,elig,left:N-1-(L.c%N),L}}
export async function setStatus(id,s){
 const os=await get('orders',[]),o=os.find(x=>x.id===id);if(!o||o.st===s||!ST[s])return null;
 if(s==='cx'&&o.st!=='cx'){const P=await products(),bef=JSON.parse(JSON.stringify(P));
  o.items.forEach(i=>{const p=P.find(x=>x.id===i.id);if(p)p.qty+=i.q});await set('products',P);await restock(bef,P);
  if(o.pct){const L=await get('loy:'+o.uid,{c:0,used:-1});L.used=-1;await set('loy:'+o.uid,L)}}
 const was=o.st;o.st=s;await set('orders',os);
 await tg('sendMessage',{chat_id:o.uid,text:`Заказ №${id}: ${ST[s]}`});
 if(s==='done'&&was!=='done'){const L=await get('loy:'+o.uid,{c:0,used:-1});L.c++;await set('loy:'+o.uid,L);const li=await loyInfo(o.uid);
  if(li.on)await tg('sendMessage',{chat_id:o.uid,text:li.elig?`Спасибо за заказ! Твой следующий заказ со скидкой ${li.pct}%.`:`Спасибо за заказ! До заказа со скидкой ${li.pct}% осталось: ${li.left}.`})}
 return o}
// ===== расписание выдачи =====
export const raw=r;
export const DEFCFG={open:'12:00',close:'22:00',step:30,cap:3,days:3,places:['Hauptbahnhof (Hbf)','Ostbahnhof'],loyEvery:5,loyPct:10};
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
