import {products} from './store.js';
export default async function h(req,res){res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=30');res.json(await products())}
