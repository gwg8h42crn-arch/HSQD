import {get,set,raw,products,setStatus,cfg,restock,calcStats} from './store.js';
export default async function h(req,res){
 const b=req.body||{};
 if(!process.env.ADMIN_PASSWORD||b.pw!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:'auth'});
 if(b.a==='get')return res.json({products:await products(),orders:await get('orders',[]),cfg:await cfg()});
 if(b.a==='save'&&Array.isArray(b.products)){const bef=await products();await set('products',b.products);await restock(bef,b.products);return res.json({ok:1})}
 if(b.a==='cfg'&&b.cfg){const c=b.cfg;await set('cfg',{open:c.open,close:c.close,step:+c.step||30,cap:+c.cap||1,days:+c.days||1,loyEvery:Math.max(0,Math.floor(+c.loyEvery)||0),loyPct:Math.min(90,Math.max(0,+c.loyPct||0)),botShop:c.botShop==='1'||c.botShop===true,refPct:Math.min(90,Math.max(0,+c.refPct||0)),geo:(c.geo||[]).map(String).slice(0,20),places:(c.places||[]).filter(Boolean)});return res.json({ok:1})}
 if(b.a==='img'&&/^data:image\/(jpeg|png|webp);base64,/.test(b.data||'')&&b.data.length<950000){const id=String(b.id).replace(/\W/g,'');await raw(['SET','img:'+id,b.data]);return res.json({url:'/api/img?id='+id+'&v='+Date.now()})}
 if(b.a==='stats')return res.json(calcStats(await get('orders',[]),(await get('users',[])).length));
 if(b.a==='status'){await setStatus(+b.id,b.s);return res.json({orders:await get('orders',[])})}
 res.status(400).json({error:'bad'})}
