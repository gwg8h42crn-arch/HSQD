import {get,set,tg,berlin,products,calcStats,fmt} from './store.js';
// вызывать каждые 5-10 минут: /api/cron?key=CRON_SECRET
export default async function h(req,res){
 if(!process.env.CRON_SECRET||req.query.key!==process.env.CRON_SECRET)return res.status(403).end();
 const os=await get('orders',[]),n=berlin(),ADM=(process.env.ADMIN_IDS||'').split(',').map(Number).filter(Boolean);let ch=false;
 for(const o of os){
  if(!o.slot||['cx','done','ship'].includes(o.st))continue;
  const dd=Math.round((Date.parse(o.slot.date+'T00:00:00Z')-Date.parse(n.date+'T00:00:00Z'))/864e5),[hh,mm]=o.slot.time.split(':'),diff=dd*1440+(+hh*60+ +mm)-n.min;
  if(diff<=0||diff>60)continue;
  if(o.st==='new'&&!o.remA){for(const a of ADM)await tg('sendMessage',{chat_id:a,text:`Заказ №${o.id} ещё не принят, выдача через ${diff} мин (${o.slot.time}, ${o.slot.place}).`,reply_markup:{inline_keyboard:[[{text:'Принять',callback_data:`os:${o.id}:acc`}]]}});o.remA=1;ch=true}
  if(o.st==='acc'&&!o.rem){await tg('sendMessage',{chat_id:o.uid,text:`Напоминание: заказ №${o.id}. Выдача сегодня в ${o.slot.time}, место: ${o.slot.place}. Ждём тебя.`,reply_markup:{inline_keyboard:[[{text:'Не смогу, отменить',callback_data:'myc:'+o.id}]]}});o.rem=1;ch=true}}
 if(ch){const fresh=await get('orders',[]);for(const o of os){const f=fresh.find(x=>x.id===o.id);if(f){if(o.rem)f.rem=1;if(o.remA)f.remA=1}}await set('orders',fresh)}
 // утренний отчёт админам в 9:00 по Мюнхену
 if(Math.floor(n.min/60)===9&&n.min%60<15&&ADM.length&&!(await get('rep:'+n.date))){
  await set('rep:'+n.date,1);const S=calcStats(await get('orders',[]),0),y=S.series[S.series.length-2]||{n:0,rev:0},P=await products(),cur=await get('orders',[]);
  const td=cur.filter(o=>o.slot&&o.slot.date===n.date&&!['cx','done'].includes(o.st)).sort((a,b)=>a.slot.time<b.slot.time?-1:1),low=P.filter(p=>p.qty<=2&&p.cat!=='pod');
  const tx=`Утренний отчёт HOOD\n\nВчера: ${y.n} зак. · ${fmt(y.rev)} €\nЗа 7 дней: ${S.d7.n} зак. · ${fmt(S.d7.rev)} €\n\nВыдач сегодня: ${td.length}${td.length?'\n'+td.map(o=>`${o.slot.time} · ${o.slot.place} · №${o.id}`).join('\n'):''}${low.length?'\n\nЗаканчивается:\n'+low.map(p=>`${p.brand} ${p.name} — ${p.qty}`).join('\n'):''}`;
  for(const a of ADM)await tg('sendMessage',{chat_id:a,text:tx})}
 res.json({ok:1,t:n.date+' '+n.min})}
