import { validateTarget, safeFetch, parseListing, loadRegistration } from './registration-adapters.mjs';
import Core from '../../registration-core.js';
import { loadCommunityOverview, loadWalkingContext } from './property-context.mjs';
const headers = { 'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store' };
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers});
export async function onRequestOptions(){return new Response(null,{status:204,headers});}
export async function onRequest({ request }) {
  if(request.method==='OPTIONS')return onRequestOptions();
  if(!['GET','POST'].includes(request.method))return json({success:false,error:'method_not_allowed'},405);
  try {
    const value=request.method==='GET'?new URL(request.url).searchParams.get('url'):(await request.json()).url;
    const url=validateTarget(String(value || '').trim());
    if(url.hostname==='market.591.com.tw')return json({success:false,status:'wrong_url_type',error:'這是社區實價登錄網址。請貼上售屋物件網址，系統會自動連結該社區成交資料。'},422);
    const response=await safeFetch(url.href);
    if(!response.ok)return json({success:false,status:[403,429].includes(response.status)?'blocked':'unavailable',error:`售屋來源 HTTP ${response.status}，未取得資料`},502);
    const html=await response.text();
    if(html.length>3000000)return json({success:false,status:'parse_error',error:'來源頁面超過讀取上限'},422);
    const data=parseListing(html,url.href);
    const matched=data.communityId && /^\d+$/.test(data.communityId) && data.community;
    const [registration,communityInfo,transit]=await Promise.all([
      matched?loadRegistration(data.communityId,data.community):{status:'unmatched',sourceUrl:null,reportedCount:null,rows:[],fetchedAt:new Date().toISOString(),error:'物件未提供可驗證的社區ID，未猜配社區'},
      matched?loadCommunityOverview(data.communityId,data.community):{status:'unmatched',households:null,message:'未能核對社區，戶數待確認'},
      loadWalkingContext(data.geo)
    ]);
    data.registration=registration;data.communityInfo=communityInfo;data.households=communityInfo.households ?? data.households ?? null;
    data.mrtDetails=transit;
    data.mrt=transit.station?`${transit.station}（地圖預估步行 ${transit.walkMinutes} 分鐘）`:transit.message;
    data.walkMinutes=transit.walkMinutes ?? null;
    data.walkEvidence=transit.status==='complete'?'map_route':'unavailable';
    data.modelVersion=2;
    data.statistics=Core.summarize(data.registration);
    return json({success:true,data});
  } catch(error) {
    const message=error.message || String(error);
    return json({success:false,status:message.includes('blocked')?'blocked':error.name==='TimeoutError'?'timeout':'parse_error',error:message},422);
  }
}
