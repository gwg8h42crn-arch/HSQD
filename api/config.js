import {cfg} from './store.js';
export default async function h(req,res){res.setHeader('Cache-Control','s-maxage=10');res.json(await cfg())}
