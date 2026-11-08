import {get,set,raw,products,setStatus,cfg,restock} from './store.js';
export default async function h(req,res){
 const b=req.body||{};
 if(!process.env.ADMIN_PASSWORD||b.pw!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:'auth'});
 if(b.a==='get')return res.json({products:await products(),orders:await get('orders',[]),cfg:await cfg()});
 if(b.a==='save'&&Array.isArray(b.products)){const bef=await products();await set('products',b.products);await restock(bef,b.products);return res.json({ok:1})}
 if(b.a==='cfg'&&b.cfg){const c=b.cfg;await set('cfg',{open:c.open,close:c.close,step:+c.step||30,cap:+c.cap||1,days:+c.days||1,loyEvery:Math.max(0,Math.floor(+c.loyEvery)||0),loyPct:Math.min(90,Math.max(0,+c.loyPct||0)),places:(c.places||[]).filter(Boolean)});return res.json({ok:1})}
 if(b.a==='img'&&/^data:image\/(jpeg|png|webp);base64,/.test(b.data||'')&&b.data.length<950000){const id=String(b.id).replace(/\W/g,'');await raw(['SET','img:'+id,b.data]);return res.json({url:'/api/img?id='+id+'&v='+Date.now()})}
 if(b.a==='status'){await setStatus(+b.id,b.s);return res.json({orders:await get('orders',[])})}
 res.status(400).json({error:'bad'})}
