import {get,set,raw,incr,products,tg,cfg,slots,bestDisc,useDisc,setStatus,fmt,mail,SITE,HIDDEN,ADMINS} from './store.js';
const esc=s=>String(s).replace(/[<>&]/g,'');
const rnd=n=>Array.from({length:n},()=>'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random()*31)]).join('');
async function limited(req,key,max,sec){const ip=String(req.headers['x-forwarded-for']||'x').split(',')[0].trim(),k='rl:'+key+':'+ip,n=await raw(['INCR',k]);if(n===1)await raw(['EXPIRE',k,sec]);return n>max}
const pub=o=>({id:o.id,st:o.st,t:o.t,sub:o.sub,pct:o.pct,items:o.items.map(i=>({n:i.n,q:i.q})),slot:o.slot,linked:!!o.uid,ts:o.ts});
export default async function h(req,res){
 res.setHeader('Cache-Control','no-store');
 const err=(m,c)=>res.status(c||400).json({error:m});
 if(req.method==='GET'){
  if(req.query.link){const L=await get('lnk:'+String(req.query.link).replace(/\W/g,''));return res.json({linked:!!(L&&L.uid)})}
  const o=(await get('orders',[])).find(x=>x.id===+req.query.id);
  if(!o||!o.web||o.web.key!==String(req.query.key))return err('not found',404);
  return res.json(pub(o))}
 const b=req.body||{};
 if(b.a==='link'){const t=String(b.token||'').replace(/\W/g,'');if(t.length<8||t.length>24)return err('bad');if(await limited(req,'lk',20,600))return err('Слишком много попыток',429);await set('lnk:'+t,{ts:Date.now(),uid:null});return res.json({ok:1})}
 if(b.a==='quote'){const P=await products();let sub=0;for(const it of (b.items||[]).slice(0,20)){const p=P.find(x=>x.id==it.id),q=Math.floor(+it.q);if(p&&q>0)sub+=p.eur*q}
  let bd=null;if(b.link){const L=await get('lnk:'+String(b.link).replace(/\W/g,''));if(L&&L.uid)bd=await bestDisc(L.uid)}
  const pct=bd?bd.pct:0;return res.json({sub,pct,type:bd?bd.type:'',total:Math.round(sub*(100-pct))/100})}
 if(b.a==='cancel'){const o=(await get('orders',[])).find(x=>x.id===+b.id);
  if(!o||!o.web||o.web.key!==String(b.key))return err('not found',404);
  if(!['new','acc'].includes(o.st))return err('Этот заказ уже нельзя отменить');
  await setStatus(o.id,'cx');for(const a of ADMINS)await tg('sendMessage',{chat_id:a,text:`Клиент отменил заказ №${o.id} (${o.u}), выдача ${o.slot.date.split('-').reverse().slice(0,2).join('.')} в ${o.slot.time}`});
  return res.json({ok:1})}
 if(b.a==='create'){
  if(b.hp)return res.json({ok:1,id:0,key:'x'});
  if(await limited(req,'cr',6,900))return err('Слишком много попыток, попробуй чуть позже',429);
  const C=await cfg(),name=String(b.name||'').trim().slice(0,60)||'Клиент',contact=String(b.contact||'').trim().slice(0,80),email='';
    let uid=null,u=name;if(b.link){const L=await get('lnk:'+String(b.link).replace(/\W/g,''));if(L&&L.uid){uid=L.uid;u=L.u||name}}
  if(!uid&&contact.length<3)return err('Укажи Telegram или телефон для связи, либо привяжи Telegram');
  if(!b.age)return err('Нужно подтвердить, что тебе есть 18 лет');
  if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return err('Проверь адрес почты');
  const place=C.places[+b.place];if(!place)return err('Выбери точку выдачи');
  const date=String(b.date||''),time=String(b.time||'');
  if(!(await slots(date)).includes(time))return err('Это время уже занято, выбери другое');
  const P=await products(),items=[];let t=0;
  for(const it of (b.items||[]).slice(0,20)){const p=P.find(x=>x.id==it.id),q=Math.floor(+it.q);
   if(!p||HIDDEN.includes(p.cat)||!(q>0))return err('В корзине есть недоступный товар');
   if(p.qty<q)return err(`${p.brand} ${p.name}: столько нет в наличии`);
   items.push({id:p.id,n:p.brand+' '+p.name,q,eur:p.eur});t+=p.eur*q;p.qty-=q}
  if(!items.length)return err('Корзина пуста');
  const bd=uid?await bestDisc(uid):null,pct=bd?bd.pct:0,sub=t;t=Math.round(t*(100-pct))/100;
  const oid=await incr('oc'),key=rnd(12),o={id:oid,uid,u,web:{name,contact,email,key},items,t,sub,pct,dtype:bd?bd.type:'',slot:{place,date,time},st:'new',method:'pickup',src:'web',ts:Date.now()};
  const os=await get('orders',[]);os.unshift(o);await set('orders',os.slice(0,300));await set('products',P);if(bd)await useDisc(uid,bd);
  const when=`${date.split('-').reverse().slice(0,2).join('.')} в ${time}`,link=`${SITE()}/order.html?id=${oid}&key=${key}`;
  const adm=`<b>Новый заказ №${oid}</b> (сайт)\n${esc(u)}${contact?' · '+esc(contact):''}${uid?' · Telegram привязан':''}\n${items.map(i=>`• ${esc(i.n)} × ${i.q}`).join('\n')}${pct?`\nСкидка ${pct}% (было ${fmt(sub)} €)`:''}\nСумма: ${fmt(t)} €\nМесто: ${esc(place)}\nВремя: ${when}`;
  for(const a of ADMINS){await tg('sendMessage',{chat_id:a,text:adm,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'Принять',callback_data:`os:${oid}:acc`},{text:'Отмена',callback_data:`os:${oid}:cx`}]]}});
   for(const p of P)if(p.qty<=2&&items.some(i=>i.id===p.id))await tg('sendMessage',{chat_id:a,text:`Заканчивается: ${p.brand} ${p.name} — осталось ${p.qty}`})}
  const ctext=`Заказ №${oid} принят.\n${items.map(i=>`${i.n} × ${i.q}`).join('\n')}\nСумма: ${fmt(t)} €\nМесто: ${place}\nВремя: ${when}\n\nСтатус заказа: ${link}`;
  if(uid)await tg('sendMessage',{chat_id:uid,text:ctext});
  if(email)await mail(email,`HOOD: заказ №${oid} принят`,ctext);
  return res.json({ok:1,id:oid,key,total:t})}
 return err('bad')}
