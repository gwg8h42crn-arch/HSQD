import {cfg,berlin,addDays,slots} from './store.js';
export default async function h(req,res){const C=await cfg(),t=berlin().date,days=[];
 for(let i=0;i<(+C.days||1);i++){const d=addDays(t,i);days.push({date:d,times:await slots(d)})}
 res.setHeader('Cache-Control','no-store');res.json({days})}
