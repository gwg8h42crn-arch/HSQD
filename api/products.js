import {products,HIDDEN} from './store.js';
// клиентам не отдаём реальное количество: только 0 (нет) или 10 (максимум в один заказ)
export default async function h(req,res){res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=30');res.json((await products()).filter(p=>!HIDDEN.includes(p.cat)).map(p=>({...p,qty:p.qty>0?10:0})))}
