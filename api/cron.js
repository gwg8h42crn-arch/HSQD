import {get,set,tg,berlin} from './store.js';
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
 res.json({ok:1,t:n.date+' '+n.min})}
