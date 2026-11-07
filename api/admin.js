import {get,set,products,setStatus} from './store.js';
export default async function h(req,res){
 const b=req.body||{};
 if(!process.env.ADMIN_PASSWORD||b.pw!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:'auth'});
 if(b.a==='get')return res.json({products:await products(),orders:await get('orders',[])});
 if(b.a==='save'&&Array.isArray(b.products)){await set('products',b.products);return res.json({ok:1})}
 if(b.a==='status'){await setStatus(+b.id,b.s);return res.json({orders:await get('orders',[])})}
 res.status(400).json({error:'bad'})}
