import fs from 'node:fs/promises';
import Core from '../registration-core.js';
import { onRequest } from '../functions/api/registration-endpoint.mjs';
const url='https://sale.591.com.tw/home/house/detail/2/21046507.html';
const deployed=process.argv.includes('--deployed');
const endpoint='https://house-trade-strategy.snakelee72.workers.dev/api/parse-house?';
const response=deployed?await fetch(endpoint+new URLSearchParams({url}),{signal:AbortSignal.timeout(60000),cache:'no-store'}):await onRequest({request:new Request('https://local/api/parse-house?'+new URLSearchParams({url}))});
const result=await response.json();
await fs.mkdir('.wrangler/registration-v2',{recursive:true});
await fs.writeFile('.wrangler/registration-v2/'+(deployed?'deployed-result':'live-result')+'.json',JSON.stringify(result,null,2));
const data=result.data;
console.log(JSON.stringify({http:response.status,success:result.success,error:result.error,community:data?.community,id:data?.communityId,asking:data?.askingPrice,area:data?.size,parkingArea:data?.parkingAreaPing,registration:data?.registration && {...data.registration,rows:`${data.registration.rows.length} rows`},statistics:data?.statistics && {used:data.statistics.usedCount,excluded:data.statistics.excluded,complete:data.statistics.complete}},null,2));
if(!result.success || data.parkingAreaPing!==12.217 || data.registration.status!=='complete' || data.registration.rows.length!==64)process.exitCode=1;

if(result.success){
 const three=Core.summarize(data.registration,{includeEstimatedParking:true});
 const five=Core.summarize(data.registration,{includeEstimatedParking:true,months:60});
 const pricing=Core.derivePricing({...data,analysisOptions:{includeEstimatedParking:true}});
 console.log(JSON.stringify({threeYears:{used:three.usedCount,median:three.medianUnit,weighted:three.weightedUnit},fiveYears:{used:five.usedCount},reference:pricing.reference,offers:[pricing.fake1,pricing.fake2,pricing.fake3,pricing.trueBottom]},null,2));
 if(three.usedCount!==2 || five.usedCount!==4 || pricing.reference!==null)process.exitCode=1;
}
if(deployed){const response=await fetch(endpoint+new URLSearchParams({url:'https://market.591.com.tw/10007/price'}));const body=await response.json();console.log(JSON.stringify({wrongUrlStatus:response.status,status:body.status}));if(response.status!==422 || body.success!==false)process.exitCode=1;}
