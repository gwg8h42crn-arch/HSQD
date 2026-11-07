import {raw} from './store.js';
export default async function h(req,res){
 const v=await raw(['GET','img:'+String(req.query.id).replace(/\W/g,'')]),m=v&&/^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(v);
 if(!m)return res.status(404).end();
 res.setHeader('Content-Type',m[1]);res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.send(Buffer.from(m[2],'base64'))}
