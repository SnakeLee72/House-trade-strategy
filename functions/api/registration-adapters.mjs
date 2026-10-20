const num = v => { if(v==null)return null;const clean=String(v).replace(/,/g,'').replace(/[^\d.\-]/g,'');return clean!=='' && Number.isFinite(Number(clean))?Number(clean):null; };
export const plain = s => String(s || '').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const blocked = s => /<title[^>]*>\s*(?:Just a moment|Access Denied|驗證|安全驗證)|cf-chl-|captcha-container/i.test(s);
export function validateTarget(value) {
  const u = new URL(value);
  const allowed = ['sale.591.com.tw','market.591.com.tw','newhouse.591.com.tw','www.sinyi.com.tw','buy.sinyi.com.tw','www.leju.com.tw','www.yungching.com.tw','buy.yungching.com.tw','house.yungching.com.tw'];
  if(u.protocol!=='https:' || u.username || u.password || (u.port && u.port!=='443') || !allowed.includes(u.hostname))throw Error('unsupported_url: 僅支援指定購屋網站的 HTTPS 公開網址');
  return u;
}
export async function safeFetch(url, fetcher=fetch) {
  let target = validateTarget(url);
  for(let i=0;i<4;i++) {
    const response=await fetcher(target.href,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html,application/json','Accept-Language':'zh-TW,zh;q=0.9'}});
    if([301,302,303,307,308].includes(response.status)) { const location=response.headers.get('location');if(!location)throw Error('redirect_error');target=validateTarget(new URL(location,target).href);continue; }
    return response;
  }
  throw Error('redirect_limit');
}
export function parseListing(html,url) {
  if(blocked(html))throw Error('blocked: 來源要求驗證，未擷取物件');
  const scripts=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let product={};
  for(const m of scripts) {try {const v=JSON.parse(m[1]);const nodes=Array.isArray(v)?v:(v['@graph']||[v]);const found=nodes.find(x=>[].concat(x['@type']||[]).some(t=>['Product','Apartment','House','SingleFamilyResidence','RealEstateListing'].includes(t)) && (x.offers || x.floorSize));if(found){product=found;break;}}catch{}}
  const meta=html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)?.[1] || '';
  const title=plain(product.name || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s*-\s*591.*$/,'');
  const asking=product.offers?.priceCurrency && product.offers.priceCurrency!=='TWD'?null:num(product.offers?.price)>0?num(product.offers.price)/10000:num(meta.match(/總價\s*([\d,.]+)\s*萬/)?.[1]);
  let size=num(product.floorSize?.value) || num(meta.match(/面積\s*([\d.]+)\s*坪/)?.[1]);
  if(/m2|MTK|平方公尺|㎡/i.test(product.floorSize?.unitText || product.floorSize?.unitCode || ''))size=size/3.305785;
  if(!(asking>0) || !(size>0))throw Error('parse_error: 未能確認本物件開價與權狀面積，未套用預設值');
  const communityId=html.match(/\bcommunity-id=["'](\d+)["']/)?.[1] || html.match(/id=["']hid_communityId["'][^>]*value=["'](\d+)["']/)?.[1] || null;
  const community=plain(html.match(/\bcommunity-name=["']([^"']+)["']/)?.[1] || meta.match(/位於\s*([^，,。]+)/)?.[1]);
  const detailRows=[...html.matchAll(/class=["'][^"']*detail-house-key[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]{0,1000}?class=["'][^"']*detail-house-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/g)];
  const parking=detailRows.find(row=>plain(row[1]).replace(/\s+/g,'')==='車位')?.[2];
  const parkText=String(parking || '').replace(/<[^>]+>/g,'').replace(/\s+/g,'').replace(/&nbsp;/g,'');
  const hasParking=parking ? !/無車位|無$/.test(parkText) : /雙車位|附車位|含車位/.test(title)?true:null;
  const parkingAreaPing=hasParking===false?0:num(parkText.match(/([\d.]+)\s*坪/)?.[1]);
  const parkingPriceWan=hasParking===false?0:num(parkText.match(/(?:車位價|售價|價格)\s*[:：]?\s*([\d,.]+)\s*萬/)?.[1]);
  const text=plain(html);
  const floor=text.match(/樓層\s*(\d+)\s*F\s*\/\s*(\d+)\s*F/i);
  const householdMatch=detailRows.find(row=>/總戶數|社區規模|戶數/.test(plain(row[1]).replace(/\s+/g,'')))?.[2]?.match(/([\d,]+)/)?.[1] ||
    text.match(/(?:總戶數|社區總戶數|社區戶數)\s*[:：]?\s*([\d,]+)\s*戶/)?.[1] ||
    text.match(/社區(?:僅|共|規劃)\s*([\d,]+)\s*戶/)?.[1] ||
    text.match(/全區(?:僅|共|規劃)\s*([\d,]+)\s*戶/)?.[1] ||
    html.match(/"all_house_num"\s*:\s*\{"content"\s*:\s*"([\d,]+)"/)?.[1] ||
    html.match(/all_house_num[^}]*?"content"\s*:\s*"([\d,]+)"/)?.[1];
  const households=householdMatch?num(householdMatch):null;
  return {kind:'listing',url,title,community,communityId,district:[product.address?.addressRegion,product.address?.addressLocality].filter(Boolean).join(''),streetAddress:plain(product.address?.streetAddress),askingPrice:asking,size,totalAreaPing:size,hasParking,parkingAreaPing,parkingPriceWan,layout:num(product.numberOfRooms)?`${product.numberOfRooms}房`:'',rooms:num(product.numberOfRooms),households,floor:floor?`${floor[1]}F/${floor[2]}F`:'',geo:product.geo?{lat:num(product.geo.latitude),lng:num(product.geo.longitude)}:null,mrt:'尚未核對實際步行與通勤時間',mrtDetails:null,rawSnippet:`${title}｜開價${asking}萬｜權狀${size}坪`};
}
export function normalizeTransaction(item,communityId) {
  if(String(item.community?.id)!==String(communityId))throw Error('community_mismatch: 成交紀錄社區編號不符');
  if(item.id == null || !/^\d+$/.test(String(item.id)))throw Error('transaction_id_missing');
  const flag=value=>value===true || value===1 || value==='1'?true:value===false || value===0 || value==='0'?false:null;
  const hasParking=flag(item.has_park);
  const estimatedFlags=[flag(item.real_park_total_price_v?.estimate),flag(item.real_park_area?.estimate)];
  const parkingEstimated=hasParking===false?false:hasParking===true?(estimatedFlags.includes(true)?true:estimatedFlags.every(v=>v===false)?false:null):null;
  const value=(field,unit)=>field && field.unit===unit?num(field.price ?? field.area):null;
  return { id:String(item.id),date:String(item.trans_date || '').slice(0,7),transactionDate:item.trans_date || null,address:plain(item.address),floor:num(item.shift_floor_val),layout:plain(item.layout_v2 || item.layout),houseAreaPing:value(item.building_area,'坪'),housePriceWan:value(item.building_total_price,'萬'),totalPriceWan:num(item.total_price_v),hasParking,parkingAreaPing:hasParking===false?0:hasParking===true?value(item.real_park_area,'坪'):null,parkingPriceWan:hasParking===false?0:hasParking===true?value(item.real_park_total_price_v,'萬'):null,parkingEstimated,special:flag(item.is_special),sourceUnitPrice:value(item.unit_price,'萬/坪'),notes:plain([item.tips,item.context,item.price_tips].filter(Boolean).join('；')),communityId:String(communityId) };
}
export function parseMarketHtml(html) {
  if(blocked(html))throw Error('blocked');
  const text=plain(html);
  const reportedCount=num(text.match(/共有\s*(\d+)\s*筆實價登錄/)?.[1]);
  const blocks=[...html.matchAll(/<section\b[^>]*class="realprice-list-row\b[^>]*>[\s\S]*?<\/section>/g)];
  const rows=blocks.map(([block])=>{
    const read=(pattern)=>plain(block.match(pattern)?.[1]);
    const house=read(/<div class="house-total"([\s\S]*?)(?=<div class="park")/);
    const park=read(/<div class="park"([\s\S]*?)(?=<div class="none total")/);
    const month=read(/class="row-ctn year-month"[^>]*>([\s\S]*?)<\/div>/).match(/(\d{2,3})-(\d{2})/);
    const address=read(/<address[^>]*>([\s\S]*?)<\/address>/);
    const floor=num(read(/class="row-ctn floor"[^>]*>([\s\S]*?)<\/div>/));
    const housePriceWan=num(house.match(/([\d,]+(?:\.\d+)?)\s*萬/)?.[1]);
    const houseAreaPing=num(house.match(/\/\s*([\d.]+)\s*坪/)?.[1]);
    const totalPriceWan=num(read(/class="none total"[^>]*>([\s\S]*?)<\/div>/).match(/([\d,]+(?:\.\d+)?)\s*萬/)?.[1]);
    return {date:month?`${+month[1]+1911}-${month[2]}`:'',address,floor,housePriceWan,houseAreaPing,totalPriceWan,parkingPriceWan:/無車位/.test(park)?0:num(park.match(/([\d,]+(?:\.\d+)?)\s*萬/)?.[1]),parkingAreaPing:/無車位/.test(park)?0:num(park.match(/車位\s*([\d.]+)坪/)?.[1]),hasParking:!/無車位/.test(park),parkingEstimated:/class="estimate"/.test(block),special:plain(block).includes('特殊交易'),notes:'HTML首批資料；面積與價格依來源顯示精度'};
  });
  return {title:plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]),reportedCount,rows};
}
export async function loadRegistration(id,name,fetcher=fetch,options={}) {
  const sourceUrl=`https://market.591.com.tw/${id}/price`;
  const deadline=Date.now()+(options.budgetMs ?? 35000);
  const reg={status:'unavailable',communityId:String(id),sourceUrl,fetchedAt:new Date().toISOString(),reportedCount:null,rows:[],scope:'成屋期成交',error:null};
  try {
    const source=await fetcher(sourceUrl,{signal:AbortSignal.timeout(12000),redirect:'manual'});
    if(!source.ok){reg.status=[403,429].includes(source.status)?'blocked':'unavailable';reg.error=`實登頁 HTTP ${source.status}`;return reg;}
    const html=await source.text();if(blocked(html)){reg.status='blocked';reg.error='來源要求驗證';return reg;}
    const parsed=parseMarketHtml(html);reg.reportedCount=parsed.reportedCount;
    if(!name || !parsed.title.includes(name)){reg.status='mismatch';reg.error='社區名稱核對未通過';return reg;}
    reg.rows=parsed.rows; reg.status='partial';
    // Same anonymous, public list used by the source page. No cookies or verification bypass.
    const pageSize=options.pageSize || 20;
    const collected=new Map();const received=[];let expectedTotal=null;
    for(let page=1;page<=20;page++) {
      const u=new URL('https://bff-market.591.com.tw/v1/price/list');
      u.search=new URLSearchParams({community_id:String(id),split_park:'1',trans_type:'1',page:String(page),page_size:String(pageSize),_source:'0'});
      let response;
      for(let attempt=0;attempt<2;attempt++) {
        const remaining=deadline-Date.now();
        if(remaining<=0)throw new DOMException('成交讀取已達本次時間上限','TimeoutError');
        try {response=await fetcher(u.href,{signal:AbortSignal.timeout(Math.min(12000,remaining)),redirect:'manual',headers:{Accept:'application/json'}});break;}
        catch(error){if(attempt || !['TimeoutError','TypeError'].includes(error.name))throw error;}
      }
      if(!response.ok)throw Error(`成交分頁 HTTP ${response.status}`);
      const payload=await response.json();
      if(Number(payload.status)!==1 || !Array.isArray(payload.data?.items))throw Error('成交分頁格式不符');
      const data=payload.data;
      if(Number(data.page)!==page)throw Error('來源回傳錯誤或重複頁碼');
      if(expectedTotal==null)expectedTotal=Number(data.total);
      if(!Number.isInteger(expectedTotal) || expectedTotal<0 || Number(data.total)!==expectedTotal)throw Error('來源總數在讀取時變動');
      if(parsed.reportedCount!=null && parsed.reportedCount!==expectedTotal)throw Error('頁面與成交介面筆數不符，請重試');
      const before=collected.size;
      const pageRows=data.items.map(item=>normalizeTransaction(item,id));
      for(const row of pageRows){collected.set(row.id,row);received.push(row);}
      reg.reportedCount=expectedTotal;reg.rows=[...received];reg.fetchedPages=page;
      if(collected.size===expectedTotal){reg.status='complete';return reg;}
      if(!data.items.length || collected.size===before || collected.size>expectedTotal)throw Error('成交資料提前結束或重複');
    }
    reg.error='超過本次20頁讀取上限；請縮小查詢範圍';return reg;
  } catch(error) {
    reg.status=reg.rows.length?'partial':error.name==='TimeoutError'?'timeout':error.message.includes('community')?'mismatch':'unavailable';
    reg.error=error.name==='TimeoutError'?'成交來源讀取逾時，已保留取得的資料；請稍後重新分析。':error.message;return reg;
  }
}
