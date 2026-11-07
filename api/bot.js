import {get,set,incr,products,tg,ADMINS,ST,setStatus} from './store.js';
const CATS={liq:'💧 Жидкости',snus:'🫧 SNUS',pod:'🔋 POD-системы'},EM={liq:'💧',snus:'🍒',pod:'🔋'};
const esc=s=>String(s).replace(/[<>&]/g,'');
const kb=r=>({inline_keyboard:r});
const send=(id,text,rows)=>tg('sendMessage',{chat_id:id,text,parse_mode:'HTML',reply_markup:rows&&kb(rows)});
const edit=(q,text,rows)=>tg('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text,parse_mode:'HTML',reply_markup:kb(rows||[])});
const B=(t,d)=>({text:t,callback_data:d});
const HOME='🦇 <b>NOCTURNE München</b>\n<i>Врата открыты от заката до рассвета</i>\n\nВыбирай:';
const menu=()=>[[B('🛍 Каталог','cat')],[B('🧺 Корзина','cart'),B('📦 Мои заказы','my')],[{text:'💬 Менеджер',url:'https://t.me/'+(process.env.MANAGER||'telegram')}]];
const card=p=>`<b>${esc(p.brand)} · ${esc(p.name)}</b>\n${esc(p.desc)}\n${esc(p.vol||'')}\n\n💶 <b>${p.eur} €</b>   ${p.qty>0?'🟢 В наличии: '+p.qty:'🔴 Нет в наличии'}`;
const nextBtns=o=>{const i=o.id;return o.st==='new'?[[B('✅ Принять',`os:${i}:acc`),B('❌ Отмена',`os:${i}:cx`)]]:o.st==='acc'?[[B('🚚 Отправлен',`os:${i}:ship`),B('❌ Отмена',`os:${i}:cx`)]]:o.st==='ship'?[[B('🏁 Выполнен',`os:${i}:done`)]]:[]};
const orderTxt=o=>`<b>Заказ №${o.id}</b> · ${esc(o.u)}\n${o.items.map(i=>`• ${esc(i.n)} × ${i.q}`).join('\n')}\n💶 ${o.t} €\n📍 ${esc(o.addr)}\n${ST[o.st]}`;

export default async function h(req,res){
 if(req.headers['x-telegram-bot-api-secret-token']!==process.env.WEBHOOK_SECRET)return res.status(403).end();
 try{const u=req.body;if(u.message)await onMsg(u.message);if(u.callback_query)await onCb(u.callback_query)}catch(e){console.error(e)}
 res.status(200).send('ok')}

async function cartView(id,P){const c=await get('cart:'+id,{}),rows=[];let t=0,tx='🧺 <b>Корзина</b>\n\n';
 for(const k in c){const p=P.find(x=>x.id==k);if(!p)continue;t+=p.eur*c[k];tx+=`${esc(p.name)} × ${c[k]} = ${p.eur*c[k]} €\n`;rows.push([B('➖ '+p.name,'dec:'+k),B('➕','add:'+k)])}
 if(!rows.length)return['🧺 Корзина пуста',[[B('🛍 Каталог','cat')]]];
 tx+=`\n<b>Итого: ${t} €</b>`;rows.push([B('✅ Оформить','buy')],[B('🗑 Очистить','clr'),B('🛍 Ещё','cat')]);return[tx,rows]}

async function checkout(m,addr){
 const id=m.chat.id,c=await get('cart:'+id,{}),P=await products(),items=[];let t=0;
 for(const k in c){const p=P.find(x=>x.id==k);if(!p||p.qty<c[k])return send(id,`😔 ${p?esc(p.name):'Товар'} уже закончился. Проверь корзину.`,[[B('🧺 Корзина','cart')]]);
  items.push({id:p.id,n:p.brand+' '+p.name,q:c[k],eur:p.eur});t+=p.eur*c[k];p.qty-=c[k]}
 if(!items.length)return send(id,'Корзина пуста',menu());
 const oid=await incr('oc'),o={id:oid,uid:id,u:m.from.username?'@'+m.from.username:m.from.first_name,items,t,addr:addr.slice(0,400),st:'new',ts:Date.now()};
 const os=await get('orders',[]);os.unshift(o);
 await set('orders',os.slice(0,300));await set('products',P);await set('cart:'+id,{});await set('st:'+id,null);
 for(const a of ADMINS){await send(a,'🔔 '+orderTxt(o),nextBtns(o));
  for(const p of P)if(p.qty<=2&&items.some(i=>i.id===p.id))await send(a,`⚠️ Заканчивается: ${esc(p.brand)} ${esc(p.name)} — осталось ${p.qty}`)}
 return send(id,`✅ <b>Заказ №${oid} принят!</b>\nМенеджер свяжется с тобой, статус придёт сюда.`,menu())}

async function adminMenu(id,q){
 const tx='👑 <b>Админ-панель</b>\n\n<code>/add БРЕНД|liq|Название|Описание|цена|кол-во</code> — новый товар (liq / snus / pod)\n<code>/send текст</code> — рассылка всем клиентам',
 rows=[[B('📦 Товары и остатки','ap')],[B('📋 Активные заказы','ao'),B('📊 Статистика','ast')]];
 return q?edit(q,tx,rows):send(id,tx,rows)}

async function onMsg(m){
 const id=m.chat.id,t=(m.text||'').trim(),adm=ADMINS.includes(id);
 const us=await get('users',[]);if(!us.includes(id)){us.push(id);await set('users',us)}
 const st=await get('st:'+id);
 if(st&&st.k==='addr'&&t&&!t.startsWith('/'))return checkout(m,t);
 if(t.startsWith('/start')){await set('st:'+id,null);const a=t.split(' ')[1]||'';
  if(a[0]==='p'){const p=(await products()).find(x=>x.id==a.slice(1));if(p)return send(id,card(p),[...(p.qty>0?[[B('🧺 В корзину','add:'+p.id)]]:[]),[B('🧺 Корзина','cart'),B('🛍 Каталог','cat')]])}
  return send(id,HOME,menu())}
 if(adm){
  if(t==='/admin')return adminMenu(id);
  if(t.startsWith('/add ')){const[br,cat,name,desc,eur,qty]=t.slice(5).split('|').map(s=>s.trim());
   if(!CATS[cat]||!name||isNaN(+eur))return send(id,'Формат: <code>/add HQD|liq|Grape Mint|Описание|10|8</code>');
   const P=await products();P.push({id:Date.now()%1e9,brand:br.toUpperCase(),cat,name,desc:desc||'',vol:'',eur:+eur,qty:+qty||0,e:EM[cat],img:''});await set('products',P);return send(id,'✅ Добавлено: '+esc(name))}
  if(t.startsWith('/send ')){let n=0;for(const u of us){const r=await tg('sendMessage',{chat_id:u,text:t.slice(6)});if(r.ok)n++}return send(id,`📢 Отправлено: ${n}`)}}
 return send(id,HOME,menu())}

async function onCb(q){
 const id=q.from.id,[a,b,c]=q.data.split(':'),adm=ADMINS.includes(id),P=await products();
 tg('answerCallbackQuery',{callback_query_id:q.id});
 if(a==='home')return edit(q,HOME,menu());
 if(a==='cat'){
  if(!b)return edit(q,'🛍 <b>Выбери зал</b>',[...Object.entries(CATS).map(([k,v])=>[B(v,'cat:'+k)]),[B('⬅️ Назад','home')]]);
  return edit(q,CATS[b],[...P.filter(p=>p.cat===b).map(p=>[B(`${p.qty>0?'🟢':'🔴'} ${p.name} — ${p.eur} €`,'p:'+p.id)]),[B('⬅️ Назад','cat')]])}
 if(a==='p'){const p=P.find(x=>x.id==b);if(!p)return;const r=[];if(p.qty>0)r.push([B('🧺 В корзину','add:'+p.id)]);r.push([B('⬅️','cat:'+p.cat),B('🧺 Корзина','cart')]);return edit(q,card(p),r)}
 if(a==='add'||a==='dec'){const cr=await get('cart:'+id,{}),p=P.find(x=>x.id==b);if(!p)return;
  let n=(cr[b]||0)+(a==='add'?1:-1);n=Math.min(n,p.qty);if(n<=0)delete cr[b];else cr[b]=n;await set('cart:'+id,cr);const[t,r]=await cartView(id,P);return edit(q,t,r)}
 if(a==='cart'){const[t,r]=await cartView(id,P);return edit(q,t,r)}
 if(a==='clr'){await set('cart:'+id,{});return edit(q,'🧺 Корзина очищена',menu())}
 if(a==='buy'){await set('st:'+id,{k:'addr'});return send(id,'📍 Напиши <b>адрес / место встречи</b> и удобное время одним сообщением:')}
 if(a==='my'){const o=(await get('orders',[])).filter(x=>x.uid===id).slice(0,5);return edit(q,o.length?'📦 <b>Мои заказы</b>\n\n'+o.map(x=>`№${x.id} — ${ST[x.st]} — ${x.t} €`).join('\n'):'Заказов пока нет',[[B('⬅️ Назад','home')]])}
 if(!adm)return;
 if(a==='am')return adminMenu(id,q);
 if(a==='os'){const o=await setStatus(+b,c);if(o)await edit(q,orderTxt(o),nextBtns(o));return}
 if(a==='ap')return edit(q,'📦 <b>Товары</b> — нажми для правки',[...P.map(p=>[B(`${p.qty} шт · ${p.name} · ${p.eur}€`,'ae:'+p.id)]),[B('⬅️','am')]]);
 if(a==='ae'||a==='aq'||a==='apr'){const p=P.find(x=>x.id==b);if(!p)return;
  if(a==='aq')p.qty=Math.max(0,p.qty+ +c);if(a==='apr')p.eur=Math.max(0,p.eur+ +c);if(a!=='ae')await set('products',P);
  return edit(q,card(p),[[B('−1',`aq:${p.id}:-1`),B('+1',`aq:${p.id}:1`),B('+10',`aq:${p.id}:10`)],[B('цена −1 €',`apr:${p.id}:-1`),B('цена +1 €',`apr:${p.id}:1`)],[B('🗑 Удалить','adel:'+p.id)],[B('⬅️','ap')]])}
 if(a==='adel'){await set('products',P.filter(x=>x.id!=b));return edit(q,'🗑 Удалено',[[B('⬅️','ap')]])}
 if(a==='ao'){const os=(await get('orders',[])).filter(o=>['new','acc','ship'].includes(o.st)).slice(0,10);
  if(!os.length)return edit(q,'Активных заказов нет',[[B('⬅️','am')]]);
  for(const o of os)await send(id,orderTxt(o),nextBtns(o));return}
 if(a==='ast'){const os=(await get('orders',[])).filter(o=>o.st!=='cx'),day=Date.now()-864e5,td=os.filter(o=>o.ts>day);
  return edit(q,`📊 <b>Статистика</b>\n\nЗа 24 ч: ${td.length} зак. · ${td.reduce((s,o)=>s+o.t,0)} €\nВсего: ${os.length} зак. · ${os.reduce((s,o)=>s+o.t,0)} €\nКлиентов в боте: ${(await get('users',[])).length}`,[[B('⬅️','am')]])}}
