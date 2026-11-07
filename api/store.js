const U=process.env.UPSTASH_REDIS_REST_URL,T=process.env.UPSTASH_REDIS_REST_TOKEN;
async function r(c){const x=await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)});return (await x.json()).result}
export const get=async(k,d=null)=>{const v=await r(['GET',k]);return v?JSON.parse(v):d};
export const set=(k,v)=>r(['SET',k,JSON.stringify(v)]);
export const incr=k=>r(['INCR',k]);
export const ADMINS=(process.env.ADMIN_IDS||'').split(',').map(Number).filter(Boolean);
export const ST={new:'🆕 Новый',acc:'✅ Принят',ship:'🚚 Отправлен',done:'🏁 Выполнен',cx:'❌ Отменён'};
export const SEED=[
{id:1,brand:'ELFLIQ',cat:'liq',name:'Apple Pear',desc:'Яблоко и груша — сладкий фруктовый микс, 5%',vol:'30 ML',eur:13,qty:10,e:'🍐',img:''},
{id:2,brand:'ELFLIQ',cat:'liq',name:'Cool Mint',desc:'Освежающая мята — чистый холодок, 5%',vol:'30 ML',eur:13,qty:10,e:'🌿',img:''},
{id:3,brand:'ELFLIQ',cat:'liq',name:'Elf Jack',desc:'Ягодный микс с ice, 5%',vol:'30 ML',eur:13,qty:6,e:'🫐',img:''},
{id:4,brand:'HQD',cat:'liq',name:'Grape Mint',desc:'Виноград и мята — классика с холодком',vol:'10 ML',eur:10,qty:8,e:'🍇',img:''},
{id:5,brand:'SNUS',cat:'snus',name:'Cuba Cherry',desc:'Вишнёвые никотиновые паучи',vol:'БАНКА',eur:7,qty:12,e:'🍒',img:''},
{id:6,brand:'POD',cat:'pod',name:'Elf Bar ELFX Kit',desc:'Компактная POD-система, 1000 mAh',vol:'УСТРОЙСТВО',eur:25,qty:4,e:'🔋',img:''},
{id:7,brand:'POD',cat:'pod',name:'XROS Mini 4',desc:'Ультракомпактная система, яркий вкус',vol:'УСТРОЙСТВО',eur:25,qty:4,e:'💨',img:''}];
export const products=async()=>{let p=await get('products');if(!p){p=SEED;await set('products',p)}return p};
export const tg=(m,b)=>fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${m}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(x=>x.json()).catch(()=>({}));
// смена статуса заказа: возвращает остатки при отмене и пишет клиенту в бота
export async function setStatus(id,s){
 const os=await get('orders',[]),o=os.find(x=>x.id===id);if(!o||o.st===s||!ST[s])return null;
 if(s==='cx'&&o.st!=='cx'){const P=await products();o.items.forEach(i=>{const p=P.find(x=>x.id===i.id);if(p)p.qty+=i.q});await set('products',P)}
 o.st=s;await set('orders',os);
 await tg('sendMessage',{chat_id:o.uid,text:`📦 Заказ №${id}: ${ST[s]}`});return o}
