// Kallor Insights — single Vercel function: basic auth + static screen + /api/quote (ASX:CTD public data, ~20 min delayed)
import fs from 'node:fs';
import path from 'node:path';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) KallorInsights/1.0';
const SYMBOL=process.env.KALLOR_SYMBOL||'CTD';
const USER=process.env.KALLOR_USER||'nate', PASS=process.env.KALLOR_PASS||'ctd-2026';
let cache={at:0,data:null};
function sydneyOpen(){const s=new Date(new Date().toLocaleString('en-US',{timeZone:'Australia/Sydney'}));const m=s.getHours()*60+s.getMinutes();return s.getDay()>0&&s.getDay()<6&&m>=600&&m<=976}
async function yahoo(){
  const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}.AX?interval=1m&range=1d&includePrePost=false`,{headers:{'User-Agent':UA,Accept:'application/json'}});
  if(!r.ok)throw new Error('yahoo '+r.status);const j=await r.json();const res=j.chart?.result?.[0];if(!res)throw new Error('yahoo empty');
  const meta=res.meta||{},q=res.indicators?.quote?.[0]||{};let pv=0,v=0,hi=-Infinity,lo=Infinity;
  (q.close||[]).forEach((c,i)=>{const vol=q.volume?.[i]||0;if(c!=null&&vol>0){pv+=c*vol;v+=vol}if(q.high?.[i]!=null)hi=Math.max(hi,q.high[i]);if(q.low?.[i]!=null)lo=Math.min(lo,q.low[i])});
  const price=meta.regularMarketPrice??[...(q.close||[])].reverse().find(x=>x!=null);if(!price)throw new Error('yahoo no price');
  const open=(q.open||[]).find(x=>x!=null)??null;return{source:'Yahoo Finance',price,open,volume:meta.regularMarketVolume??v,vwap:v?pv/v:null,high:isFinite(hi)?hi:null,low:isFinite(lo)?lo:null,prevClose:meta.chartPreviousClose??meta.previousClose??null,asOf:meta.regularMarketTime?meta.regularMarketTime*1000:Date.now()}}
async function asx(){
  const r=await fetch(`https://asx.api.markitdigital.com/asx-research/1.0/companies/${SYMBOL.toLowerCase()}/header`,{headers:{'User-Agent':UA,Accept:'application/json'}});
  if(!r.ok)throw new Error('asx '+r.status);const d=(await r.json()).data||{};if(!d.priceLast)throw new Error('asx no price');
  return{source:'ASX (public)',price:d.priceLast,volume:d.volume??null,vwap:null,high:d.priceDayHigh??null,low:d.priceDayLow??null,prevClose:d.priceLast-(d.priceChange??0),asOf:Date.now()}}
async function quote(){
  if(Date.now()-cache.at<20000&&cache.data)return cache.data;
  const errors=[];for(const fn of [yahoo,asx]){try{const q=await fn();q.marketOpen=sydneyOpen();q.symbol='ASX:'+SYMBOL;q.fetchedAt=Date.now();cache={at:Date.now(),data:q};return q}catch(e){errors.push(String(e.message||e))}}
  if(cache.data)return{...cache.data,stale:true,errors};throw new Error(errors.join(' | '))}

// ---- ASX announcements (public asx.com.au JSON; fallback markit API) ----
let annCache={at:0,data:null};
async function announcements(){
  if(Date.now()-annCache.at<120000&&annCache.data)return annCache.data;
  const errors=[];
  try{const r=await fetch(`https://www.asx.com.au/asx/1/company/${SYMBOL}/announcements?count=25&market_sensitive=false`,{headers:{'User-Agent':UA,Accept:'application/json'}});
    if(!r.ok)throw new Error('asx.com.au '+r.status);const j=await r.json();const items=(j.data||[]).map(a=>({t:(a.document_release_date||a.document_date||'').slice(0,10),headline:a.header,url:a.url||('https://www.asx.com.au'+(a.relative_url||'')),sensitive:!!a.market_sensitive,src:'ASX'}));
    if(items.length){annCache={at:Date.now(),data:items};return items}throw new Error('asx.com.au empty')}catch(e){errors.push(String(e.message||e))}
  try{const r=await fetch(`https://asx.api.markitdigital.com/asx-research/1.0/companies/${SYMBOL.toLowerCase()}/announcements?count=25&expand=true`,{headers:{'User-Agent':UA,Accept:'application/json'}});
    if(!r.ok)throw new Error('markit '+r.status);const j=await r.json();const items=((j.data&&j.data.items)||[]).map(a=>{const ids=(a.documentKey||'').split('-').pop();const t=a.date?new Date(a.date).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}):'';return{t,headline:a.headline||a.header,url:a.url&&a.url.startsWith('http')?a.url:(ids?'https://www.asx.com.au/asx/v2/statistics/displayAnnouncement.do?display=pdf&idsId='+ids:'https://www.asx.com.au/markets/company/'+SYMBOL.toLowerCase()),sensitive:!!(a.isPriceSensitive||a.isSensitive),type:a.announcementType||'',src:'ASX'}});
    if(items.length){annCache={at:Date.now(),data:items};return items}throw new Error('markit empty')}catch(e){errors.push(String(e.message||e))}
  if(annCache.data)return annCache.data;throw new Error(errors.join(' | '))}
// ---- ASIC aggregated short positions (daily CSV, UTF-16LE, T+4 lag) ----
let shortCache={at:0,data:null};
function ymd(d){return d.toISOString().slice(0,10).replace(/-/g,'')}
async function shorts(){
  if(Date.now()-shortCache.at<3600000&&shortCache.data)return shortCache.data;
  const tried=[];for(let i=0;i<14;i++){const d=new Date(Date.now()-i*86400000);if(d.getUTCDay()===0||d.getUTCDay()===6)continue;
    const stamp=ymd(d);const url=`https://download.asic.gov.au/short-selling/RR${stamp}-001-SSDailyAggShortPos.csv`;
    try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',Accept:'text/csv,*/*'}});
      if(!r.ok){tried.push(stamp+':'+r.status);continue}const buf=Buffer.from(await r.arrayBuffer());
      const txt=(buf[0]===0xff&&buf[1]===0xfe)?buf.toString('utf16le'):buf.toString('utf8');
      const line=txt.split(/\r?\n/).find(l=>{const c=l.split(/[,\t]/);return c.length>=5&&c[c.length-4].trim().toUpperCase()===SYMBOL});
      if(!line){tried.push(stamp+':no-row');continue}const c=line.split(/[,\t]/).map(x=>x.trim());const n=c.length;
      const out={asOf:stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8),product:c.slice(0,n-4).join(','),code:c[n-4],shortPositions:+c[n-3].replace(/[^0-9.]/g,''),onIssue:+c[n-2].replace(/[^0-9.]/g,''),pct:+c[n-1].replace(/[^0-9.]/g,''),file:url,source:'ASIC'};
      shortCache={at:Date.now(),data:out};return out}catch(e){tried.push(stamp+':'+String(e.message||e).slice(0,60))}}
  throw new Error('no ASIC file found: '+tried.join(' | '))}

// ---- HISTORY since the return (owner 8 Sep 2026: "the price and how it flowed" / "see how clean that is" - Yahoo's 5D view) ----
// WHAT: two series from Yahoo, one call each: (1) DAILY bars from 3 Sep 2026 (the first day back) - close, shares traded, high, low - for the
//       session table; (2) INTRADAY 15-minute closes over the last 5 trading days - for the shaded price line, so it has real shape like
//       Yahoo's chart instead of three dots. WHY cached 5 minutes: enough for a walk-past screen, kind to Yahoo. If Yahoo is down the page
//       keeps its baked daily figures and says so; there is no second source for history.
let histCache={at:0,data:null};
async function yahooChart(interval,range){const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}.AX?interval=${interval}&range=${range}&includePrePost=false`,{headers:{'User-Agent':UA,Accept:'application/json'}});
  if(!r.ok)throw new Error('yahoo '+r.status);const res=(await r.json()).chart?.result?.[0];if(!res)throw new Error('yahoo empty');return res}
const sydDay=t=>new Date(t*1000).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}); // YYYY-MM-DD in Sydney
async function history(){
  if(Date.now()-histCache.at<300000&&histCache.data)return histCache.data;
  const d=await yahooChart('1d','3mo');const dq=d.indicators?.quote?.[0]||{};const daily=[];
  (d.timestamp||[]).forEach((t,i)=>{const c=dq.close?.[i],v=dq.volume?.[i]||0;if(c==null||!v)return;const day=sydDay(t);if(day<'2026-09-03')return; // skip the suspended year
    daily.push({d:day,close:+c,vol:+v,hi:dq.high?.[i]??null,lo:dq.low?.[i]??null})});
  if(!daily.length)throw new Error('no daily bars since 2026-09-03');
  let intraday=[];try{const m=await yahooChart('15m','5d');const mq=m.indicators?.quote?.[0]||{};
    (m.timestamp||[]).forEach((t,i)=>{const c=mq.close?.[i];if(c==null)return;const day=sydDay(t);if(day<'2026-09-03')return;intraday.push({t:t*1000,d:day,close:+c,vol:+(mq.volume?.[i]||0)})})}catch(e){}
  const data={source:'Yahoo Finance',sessions:daily,intraday,fetchedAt:Date.now()};histCache={at:Date.now(),data};return data}

export default async function handler(req,res){
  const h=req.headers.authorization||'';let ok=false;
  if(h.startsWith('Basic ')){try{ok=Buffer.from(h.slice(6),'base64').toString()===`${USER}:${PASS}`}catch(e){}}
  if(!ok){res.setHeader('WWW-Authenticate','Basic realm="Kallor Insights"');return res.status(401).send('Kallor Insights — sign in')}
  const url=new URL(req.url,'http://x');
  if(url.pathname==='/api/quote'){res.setHeader('Cache-Control','no-store');
    try{return res.status(200).json(await quote())}catch(e){return res.status(502).json({error:String(e.message||e)})}}
  if(url.pathname==='/api/announcements'){res.setHeader('Cache-Control','no-store');try{return res.status(200).json(await announcements())}catch(e){return res.status(502).json({error:String(e.message||e)})}}
  if(url.pathname==='/api/history'){res.setHeader('Cache-Control','no-store');try{return res.status(200).json(await history())}catch(e){return res.status(502).json({error:String(e.message||e)})}}
  if(url.pathname==='/api/shorts'){res.setHeader('Cache-Control','no-store');try{return res.status(200).json(await shorts())}catch(e){return res.status(502).json({error:String(e.message||e)})}}
  if(url.pathname==='/health')return res.status(200).send('ok');
  // ---- THE TMC FOUR (ported from the Library room /_tmc, owner ask 7 Sep 2026) ----
  // WHAT: serves the command centre, the money page, its Sankey script and the financials snapshot from the tmc/ folder.
  // WHY: the CEO walk-past screen was a single CTD page; the owner wants the full TMC Four depth on the public site too.
  //      Everything here sits behind the same sign-in as the home screen (checked above).
  if(url.pathname.startsWith('/tmc')){
    const TMC={'/tmc':['command-centre.html','text/html; charset=utf-8'],'/tmc/money':['money.html','text/html; charset=utf-8'],
      '/tmc/kallor-sankey.js':['kallor-sankey.js','text/javascript; charset=utf-8'],'/tmc/store':['financials.json','application/json; charset=utf-8']};
    const hit=TMC[url.pathname.replace(/\/$/,'')||'/tmc'];
    if(!hit)return res.status(404).send('not part of The TMC Four');
    res.setHeader('Content-Type',hit[1]);res.setHeader('Cache-Control','no-cache');
    return res.status(200).send(fs.readFileSync(path.join(process.cwd(),'tmc',hit[0]),'utf8'))}

  const file=path.join(process.cwd(),'index.html');
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-cache');
  return res.status(200).send(fs.readFileSync(file,'utf8'))}
