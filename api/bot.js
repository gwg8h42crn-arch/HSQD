import {get,set,raw,incr,products,tg,ADMINS,ST,setStatus,cfg,berlin,addDays,slots,restock,loyInfo,fmt} from './store.js';
const CATS={liq:'Жидкости',snus:'SNUS'},EM={liq:'',snus:''};
let HOST='';
const esc=s=>String(s).replace(/[<>&]/g,'');
const kb=r=>({inline_keyboard:r});
const B=(t,d)=>({text:t,callback_data:d});
const send=(id,text,rows)=>tg('sendMessage',{chat_id:id,text,parse_mode:'HTML',reply_markup:rows&&kb(rows)});
const del=q=>tg('deleteMessage',{chat_id:q.message.chat.id,message_id:q.message.message_id});
const edit=async(q,text,rows)=>{const m=q.message;if(m.photo){await del(q);return send(m.chat.id,text,rows)}return tg('editMessageText',{chat_id:m.chat.id,message_id:m.message_id,text,parse_mode:'HTML',reply_markup:kb(rows||[])})};
const imgUrl=p=>p.img?(p.img[0]==='/'?'https://'+HOST+p.img:p.img):'';
const cardTx=(p,full)=>`<b>${esc(p.brand)} · ${esc(p.name)}</b>\n\nЦена: <b>${p.eur} €</b>\n${p.qty>0?(full?'В наличии: '+p.qty:'В наличии'):'Нет в наличии'}`;
// показать карточку товара (с фото, если есть)
async function card(chat,p,rows,q,full){const u=imgUrl(p);
 if(q&&(u||q.message.photo))await del(q);
 if(u)return tg('sendPhoto',{chat_id:chat,photo:u,caption:cardTx(p,full),parse_mode:'HTML',reply_markup:kb(rows)});
 return q&&!q.message.photo?edit(q,cardTx(p,full),rows):send(chat,cardTx(p,full),rows)}
const prodRows=p=>{const r=[];if(p.qty>0)r.push([B('В корзину','add:'+p.id)]);else r.push([B('Сообщить, когда будет','ntf:'+p.id)]);r.push([B('←','cat:'+p.brand),B('Корзина','cart')]);return r};
const HOME='<b>HOOD · München</b>\nВыбирай, назначай время и место — забираешь без лишних слов.';
const menu=()=>[[B('Каталог','cat')],[B('Корзина','cart'),B('Мои заказы','my')],[B('Повторить заказ','rep')],[B('Часы и места','info'),{text:'Менеджер',url:'https://t.me/'+(process.env.MANAGER||'telegram')}]];
const dayLabel=(d,t)=>d===t?'Сегодня':d===addDays(t,1)?'Завтра':new Date(d+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'numeric',timeZone:'UTC'});
const nextBtns=o=>{const i=o.id;return o.st==='new'?[[B('Принять',`os:${i}:acc`),B('Отмена',`os:${i}:cx`)]]:o.st==='acc'?[[B('Передан',`os:${i}:ship`),B('Отмена',`os:${i}:cx`)]]:o.st==='ship'?[[B('Выполнен',`os:${i}:done`)]]:[]};
const orderTxt=o=>`<b>Заказ №${o.id}</b> · <a href="tg://user?id=${o.uid}">${esc(o.u)}</a>\n${o.items.map(i=>`• ${esc(i.n)} × ${i.q}`).join('\n')}${o.pct?`\nСкидка ${o.pct}%`:''}\nСумма: ${fmt(o.t)} €\nМесто: ${esc(o.slot.place)}\nВремя: ${o.slot.date.split('-').reverse().slice(0,2).join('.')} в ${o.slot.time}\n${ST[o.st]}`;

export default async function h(req,res){
 if(req.headers['x-telegram-bot-api-secret-token']!==process.env.WEBHOOK_SECRET)return res.status(403).end();
 HOST=req.headers.host;
 try{const u=req.body;if(u.message)await onMsg(u.message);if(u.callback_query)await onCb(u.callback_query)}catch(e){console.error(e)}
 res.status(200).send('ok')}

async function cartView(id,P){const c=await get('cart:'+id,{}),rows=[];let t=0,tx='<b>Корзина</b>\n\n';
 for(const k in c){const p=P.find(x=>x.id==k);if(!p)continue;t+=p.eur*c[k];tx+=`${esc(p.name)} × ${c[k]} = ${p.eur*c[k]} €\n`;rows.push([B('− '+p.name,'dec:'+k),B('+','add:'+k)])}
 if(!rows.length)return['Корзина пуста',[[B('Каталог','cat')]]];
 const li=await loyInfo(id);if(li.on&&li.elig){const dd=Math.round(t*(100-li.pct))/100;tx+=`\n<s>${fmt(t)} €</s>\nСкидка за лояльность ${li.pct}%\n<b>Итого: ${fmt(dd)} €</b>`}else tx+=`\n<b>Итого: ${t} €</b>`;rows.push([B('Выбрать время и место','buy')],[B('Очистить','clr'),B('Ещё','cat')]);return[tx,rows]}

async function checkout(q,date,time){
 const id=q.from.id,st=(await get('st:'+id))||{},C=await cfg(),place=C.places[st.place];
 if(!place)return edit(q,'Начни заново',menu());
 if(!(await slots(date)).includes(time))return edit(q,'Это время только что заняли. Выбери другое.',[[B('Выбрать','pl:'+st.place)]]);
 const c=await get('cart:'+id,{}),P=await products(),items=[];let t=0;
 for(const k in c){const p=P.find(x=>x.id==k);if(!p||p.qty<c[k])return edit(q,`${p?esc(p.name):'Товар'} закончился. Проверь корзину.`,[[B('Корзина','cart')]]);
  items.push({id:p.id,n:p.brand+' '+p.name,q:c[k],eur:p.eur});t+=p.eur*c[k];p.qty-=c[k]}
 if(!items.length)return edit(q,'Корзина пуста',menu());
 const li=await loyInfo(id),pct=li.on&&li.elig?li.pct:0,sub=t;t=Math.round(t*(100-pct))/100;
 const oid=await incr('oc'),o={id:oid,uid:id,u:q.from.username?'@'+q.from.username:q.from.first_name,items,t,sub,pct,slot:{place,date,time},st:'new',method:'pickup',ts:Date.now()};
 const os=await get('orders',[]);os.unshift(o);
 await set('orders',os.slice(0,300));if(pct){const L=li.L;L.used=L.c;await set('loy:'+id,L)}await set('products',P);await set('cart:'+id,{});await set('st:'+id,null);
 for(const a of ADMINS){await send(a,''+orderTxt(o),nextBtns(o));
  for(const p of P)if(p.qty<=2&&items.some(i=>i.id===p.id))await send(a,`Заканчивается: ${esc(p.brand)} ${esc(p.name)} — осталось ${p.qty}`)}
 return edit(q,`<b>Заказ №${oid} принят!</b>\n\nМесто: ${esc(place)}\nВремя: ${date.split('-').reverse().slice(0,2).join('.')} в ${time}${pct?`\nСкидка ${pct}% (было ${fmt(sub)} €)`:''}\nСумма: ${fmt(t)} €\n\nПодтверждение придёт сюда.`,menu())}

async function adminMenu(id,q){
 const tx='<b>Админ-панель</b>\n\n<code>/add БРЕНД|liq|Название|Описание|цена|кол-во</code> — новый товар (liq / snus). Отправь это <b>подписью к фото</b>, и товар создастся сразу с фото.\n<code>/send текст</code> — рассылка всем клиентам',
 rows=[[B('Товары, фото и остатки','ap')],[B('Активные заказы','ao'),B('Статистика','ast')],[B('Часы и места','acfg')]];
 return q?edit(q,tx,rows):send(id,tx,rows)}

async function saveCfg(f){const C=(await get('cfg',{}));f(C);await set('cfg',C)}
async function newProduct(str,img){
 const[br,cat,name,desc,eur,qty]=str.split('|').map(s=>s.trim());
 if(!CATS[cat]||!name||isNaN(+eur))return null;
 const P=await products(),id=Date.now()%1e9;let url='';
 if(img){await raw(['SET','img:'+id,img]);url='/api/img?id='+id+'&v='+Date.now()}
 P.push({id,brand:(br||'').toUpperCase(),cat,name,desc:desc||'',vol:'',eur:+eur,qty:+qty||0,e:EM[cat],img:url});await set('products',P);return name}
async function dl(fileId){const f=await tg('getFile',{file_id:fileId});if(!f.ok)return null;
 const r=await fetch(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${f.result.file_path}`);return 'data:image/jpeg;base64,'+Buffer.from(await r.arrayBuffer()).toString('base64')}

async function subN(id,pid){const nt=await get('notify',{});nt[pid]=[...new Set([...(nt[pid]||[]),id])];await set('notify',nt)}
async function onMsg(m){
 const id=m.chat.id,t=(m.text||m.caption||'').trim(),adm=ADMINS.includes(id);
 const us=await get('users',[]);if(!us.includes(id)){us.push(id);await set('users',us)}
 if(adm&&m.photo){const ph=m.photo.filter(x=>(x.file_size||0)<650000).pop()||m.photo[0],st=await get('st:'+id);
  if(t.startsWith('/add ')){const d=await dl(ph.file_id),n=d&&await newProduct(t.slice(5),d);return send(id,n?'Добавлено с фото: '+esc(n):'Формат: <code>/add HQD|liq|Grape Mint|Описание|10|8</code>')}
  if(st&&st.k==='photo'){const d=await dl(ph.file_id);if(!d)return send(id,'Не получилось скачать фото');
   await raw(['SET','img:'+st.id,d]);const P=await products(),p=P.find(x=>x.id==st.id);if(p){p.img='/api/img?id='+st.id+'&v='+Date.now();await set('products',P)}
   await set('st:'+id,null);return send(id,'Фото сохранено',[[B('← К товару','ae:'+st.id)]])}}
 if(t.startsWith('/start')){await set('st:'+id,null);const a=t.split(' ')[1]||'',P=await products();
  if(a[0]==='n'){const p=P.find(x=>x.id==a.slice(1));if(p){if(p.qty>0)return card(id,p,prodRows(p));await subN(id,p.id);return send(id,`Готово. Напишу сразу, как появится: ${esc(p.brand)} ${esc(p.name)}.`,[[B('Каталог','cat')]])}}
  if(a[0]==='p'){const p=P.find(x=>x.id==a.slice(1));if(p)return card(id,p,prodRows(p))}
  if(a[0]==='c'){const cr={};let cl=0;a.split('_').slice(1,9).forEach(s=>{const[i,n]=s.split('x'),p=P.find(x=>x.id==i);if(p&&+n>0&&p.qty>0){cr[i]=Math.min(+n,p.qty);if(cr[i]<+n)cl=1}});await set('cart:'+id,cr);const[tx,r]=await cartView(id,P);return send(id,(cl?'Некоторых позиций сейчас меньше, чем ты выбрал. Корзина обновлена.\n\n':'')+tx,r)}
  return send(id,HOME,menu())}
 if(adm){
  if(t==='/admin')return adminMenu(id);
  if(t.startsWith('/add ')){const n=await newProduct(t.slice(5));return send(id,n?'Добавлено: '+esc(n):'Формат: <code>/add HQD|liq|Grape Mint|Описание|10|8</code>')}
  if(t.startsWith('/send ')){let n=0;for(const u of us){const r=await tg('sendMessage',{chat_id:u,text:t.slice(6)});if(r.ok)n++}return send(id,`Отправлено: ${n}`)}
  if(t.startsWith('/hours ')){const x=t.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);if(!x)return send(id,'Формат: <code>/hours 12:00-22:00</code>');
   await saveCfg(C=>{C.open=x[1].padStart(5,'0');C.close=x[2].padStart(5,'0')});return send(id,`Часы: ${x[1]}–${x[2]}`)}
  if(t.startsWith('/places ')){const pl=t.slice(8).split('|').map(s=>s.trim()).filter(Boolean);if(!pl.length)return;await saveCfg(C=>{C.places=pl});return send(id,'Места:\n'+pl.map(x=>'• '+esc(x)).join('\n'))}
  if(t.startsWith('/loyalty ')){const x=t.split(/\s+/),n=+x[1],pp=+x[2];if(isNaN(n)||isNaN(pp))return send(id,'Формат: <code>/loyalty 5 10</code>');await saveCfg(C=>{C.loyEvery=Math.max(0,Math.floor(n));C.loyPct=Math.min(90,Math.max(0,pp))});return send(id,`Готово: каждый ${n}-й заказ, скидка ${pp}%`)}
  const M={'/step':'step','/cap':'cap','/days':'days'},k=M[t.split(' ')[0]],v=+t.split(' ')[1];
  if(k){if(!v||v<1)return send(id,'Нужно число, например <code>/step 30</code>');await saveCfg(C=>{C[k]=v});return send(id,'Готово')}}
 return send(id,HOME,menu())}

async function onCb(q){
 const id=q.from.id,[a,b,c]=q.data.split(':'),adm=ADMINS.includes(id),P=await products();
 tg('answerCallbackQuery',{callback_query_id:q.id});
 if(a==='home')return edit(q,HOME,menu());
 if(a==='info'){const C=await cfg();return edit(q,`<b>Часы выдачи:</b> ${C.open}–${C.close}\n<b>Места:</b>\n${C.places.map(x=>'• '+esc(x)).join('\n')}`,[[B('← Назад','home')]])}
 if(a==='cat'){const V=P.filter(p=>p.cat!=='pod');
  if(!b){const bs=[...new Set(V.map(p=>p.brand))];return edit(q,'<b>Выбери бренд</b>',[...bs.map(x=>[B(x,'cat:'+x)]),[B('← Назад','home')]])}
  return edit(q,'<b>'+esc(b)+'</b>',[...V.filter(p=>p.brand===b).map(p=>[B(`${p.qty>0?'':'нет · '}${p.name} — ${p.eur} €`,'p:'+p.id)]),[B('← Назад','cat')]])}
 if(a==='p'){const p=P.find(x=>x.id==b);if(!p)return;return card(q.message.chat.id,p,prodRows(p),q)}
 if(a==='add'||a==='dec'){const cr=await get('cart:'+id,{}),p=P.find(x=>x.id==b);if(!p)return;
  let n=(cr[b]||0)+(a==='add'?1:-1);n=Math.min(n,p.qty);if(n<=0)delete cr[b];else cr[b]=n;await set('cart:'+id,cr);const[t,r]=await cartView(id,P);return edit(q,t,r)}
 if(a==='cart'){const[t,r]=await cartView(id,P);return edit(q,t,r)}
 if(a==='clr'){await set('cart:'+id,{});return edit(q,'Корзина очищена',menu())}
 if(a==='buy'){const cr=await get('cart:'+id,{});if(!Object.keys(cr).length)return edit(q,'Корзина пуста',menu());
  return edit(q,'<b>Как получить заказ?</b>',[[B('Выдача (время и место)','pk')],[B('Доставка · скоро','dlv')],[B('← Назад','cart')]])}
 if(a==='dlv')return edit(q,'<b>Доставка в разработке.</b>\nСкоро появится. Пока можно оформить заказ с выдачей: выбери удобное время и место.',[[B('Выбрать выдачу','pk')],[B('← Назад','buy')]]);
 if(a==='pk'){const cr=await get('cart:'+id,{});if(!Object.keys(cr).length)return edit(q,'Корзина пуста',menu());const C=await cfg();
  return edit(q,'<b>Где заберёшь?</b>',[...C.places.map((x,i)=>[B(x,'pl:'+i)]),[B('← Назад','buy')]])}
 if(a==='pl'){await set('st:'+id,{place:+b});const C=await cfg(),t=berlin().date,rows=[];
  for(let i=0;i<C.days;i++){const d=addDays(t,i);if((await slots(d)).length)rows.push([B(dayLabel(d,t),'dy:'+d)])}
  return edit(q,rows.length?'<b>Какой день?</b>':'Свободных окон нет, напиши менеджеру',[...rows,[B('←','buy')]])}
 if(a==='dy'){const ts=await slots(b),rows=[];for(let i=0;i<ts.length;i+=4)rows.push(ts.slice(i,i+4).map(x=>B(x,`tm:${b}:${x.replace(':','')}`)));
  return edit(q,ts.length?'<b>Выбери время</b>':'На этот день всё занято',[...rows,[B('←','buy')]])}
 if(a==='tm')return checkout(q,b,c.slice(0,2)+':'+c.slice(2));
 if(a==='ntf'){const p=P.find(x=>x.id==b);if(!p)return;if(p.qty>0)return edit(q,'Этот товар уже в наличии',prodRows(p));await subN(id,p.id);return send(id,`Готово. Напишу сразу, как появится: ${esc(p.brand)} ${esc(p.name)}.`,[[B('Каталог','cat')]])}
 if(a==='rep'){const o=(await get('orders',[])).find(x=>x.uid===id);if(!o)return edit(q,'Прошлых заказов пока нет',[[B('← Назад','home')]]);
  const cr={},sk=[];for(const i of o.items){const p=P.find(x=>x.id===i.id);if(p&&p.qty>0)cr[p.id]=Math.min(i.q,p.qty);else sk.push(i.n)}
  await set('cart:'+id,cr);const[tx,rw]=await cartView(id,P);return edit(q,(sk.length?'Нет в наличии: '+esc(sk.join(', '))+'\n\n':'')+tx,rw)}
 if(a==='myc'){const o=(await get('orders',[])).find(x=>x.id==b&&x.uid===id);if(!o||!['new','acc'].includes(o.st))return send(id,'Этот заказ уже нельзя отменить');return edit(q,`Отменить заказ №${o.id}?`,[[B('Да, отменить','myy:'+o.id),B('Нет','home')]])}
 if(a==='myy'){const o=(await get('orders',[])).find(x=>x.id==b&&x.uid===id);if(!o||!['new','acc'].includes(o.st))return send(id,'Этот заказ уже нельзя отменить');await setStatus(o.id,'cx');for(const ad of ADMINS)await send(ad,`Клиент отменил заказ №${o.id} (${esc(o.u)}), выдача ${o.slot.date.split('-').reverse().slice(0,2).join('.')} в ${o.slot.time}`);return edit(q,'Заказ отменён',menu())}
 if(a==='my'){const o=(await get('orders',[])).filter(x=>x.uid===id),li=await loyInfo(id),act=o.find(x=>['new','acc'].includes(x.st));
  const tx=(o.length?'<b>Мои заказы</b>\n\n'+o.slice(0,5).map(x=>`№${x.id} — ${ST[x.st]} — ${fmt(x.t)} € — ${x.slot.date.split('-').reverse().slice(0,2).join('.')} ${x.slot.time}`).join('\n'):'Заказов пока нет')+(li.on?`\n\n<b>Бонус:</b> каждый ${li.N}-й заказ со скидкой ${li.pct}%.\n`+(li.elig?'Твой следующий заказ со скидкой.':`До заказа со скидкой осталось: ${li.left}.`):''),rows=[];
  if(o.length)rows.push([B('Повторить заказ','rep')]);if(act)rows.push([B('Отменить заказ №'+act.id,'myc:'+act.id)]);rows.push([B('← Назад','home')]);return edit(q,tx,rows)}
 if(!adm)return;
 if(a==='am')return adminMenu(id,q);
 if(a==='os'){const o=await setStatus(+b,c);if(o)await edit(q,orderTxt(o),nextBtns(o));return}
 if(a==='ap')return edit(q,'<b>Товары</b> — нажми для правки',[...P.map(p=>[B(`${p.img?'[фото] ':''}${p.qty} шт · ${p.name} · ${p.eur}€`,'ae:'+p.id)]),[B('←','am')]]);
 if(a==='ae'||a==='aq'||a==='apr'){const p=P.find(x=>x.id==b);if(!p)return;
  const wasQ=p.qty;if(a==='aq')p.qty=Math.max(0,p.qty+ +c);if(a==='apr')p.eur=Math.max(0,p.eur+ +c);if(a!=='ae'){await set('products',P);if(wasQ<=0&&p.qty>0)await restock([{id:p.id,qty:0}],P)}
  return card(q.message.chat.id,p,[[B('−1',`aq:${p.id}:-1`),B('+1',`aq:${p.id}:1`),B('+10',`aq:${p.id}:10`)],[B('цена −1 €',`apr:${p.id}:-1`),B('цена +1 €',`apr:${p.id}:1`)],[B('Загрузить фото','aph:'+p.id)],[B('Удалить','adel:'+p.id)],[B('←','ap')]],q,true)}
 if(a==='aph'){await set('st:'+id,{k:'photo',id:+b});return send(id,'Пришли фото товара следующим сообщением')}
 if(a==='adel'){await set('products',P.filter(x=>x.id!=b));return edit(q,'Удалено',[[B('←','ap')]])}
 if(a==='acfg'){const C=await cfg();return edit(q,`<b>Выдача</b>\n\n${C.open}–${C.close}, шаг ${C.step} мин\nЗаказов на одно время: ${C.cap}\nДней вперёд: ${C.days}\nМеста: ${C.places.map(esc).join(' · ')}\nБонус: каждый ${C.loyEvery}-й заказ, скидка ${C.loyPct}%\n\n<code>/hours 12:00-22:00</code>\n<code>/step 30</code>\n<code>/cap 3</code>\n<code>/days 3</code>\n<code>/loyalty 5 10</code> (каждый 5-й заказ, скидка 10%; 0 0 выключит)\n<code>/places Hauptbahnhof (Hbf)|Ostbahnhof</code>`,[[B('←','am')]])}
 if(a==='ao'){const os=(await get('orders',[])).filter(o=>['new','acc','ship'].includes(o.st)).slice(0,10);
  if(!os.length)return edit(q,'Активных заказов нет',[[B('←','am')]]);
  for(const o of os)await send(id,orderTxt(o),nextBtns(o));return}
 if(a==='ast'){const os=(await get('orders',[])).filter(o=>o.st!=='cx'),day=Date.now()-864e5,td=os.filter(o=>o.ts>day);
  return edit(q,`<b>Статистика</b>\n\nЗа 24 ч: ${td.length} зак. · ${td.reduce((s,o)=>s+o.t,0)} €\nВсего: ${os.length} зак. · ${os.reduce((s,o)=>s+o.t,0)} €\nКлиентов в боте: ${(await get('users',[])).length}`,[[B('←','am')]])}}
