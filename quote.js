// Vercel serverless: ASX:CTD quote from public sources (Yahoo Finance 1-min bars; ASX public API fallback). ~20 min delayed.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KallorInsights/1.0';
const SYMBOL = process.env.KALLOR_SYMBOL || 'CTD';
function sydneyOpen(){const s=new Date(new Date().toLocaleString('en-US',{timeZone:'Australia/Sydney'}));const m=s.getHours()*60+s.getMinutes();return s.getDay()>0&&s.getDay()<6&&m>=600&&m<=976}
async function yahoo(){
  const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}.AX?interval=1m&range=1d&includePrePost=false`,{headers:{'User-Agent':UA,Accept:'application/json'}});
  if(!r.ok)throw new Error('yahoo '+r.status);const j=await r.json();const res=j.chart?.result?.[0];if(!res)throw new Error('yahoo empty');
  const meta=res.meta||{},q=res.indicators?.quote?.[0]||{};let pv=0,v=0,hi=-Infinity,lo=Infinity;
  (q.close||[]).forEach((c,i)=>{const vol=q.volume?.[i]||0;if(c!=null&&vol>0){pv+=c*vol;v+=vol}if(q.high?.[i]!=null)hi=Math.max(hi,q.high[i]);if(q.low?.[i]!=null)lo=Math.min(lo,q.low[i])});
  const price=meta.regularMarketPrice??[...(q.close||[])].reverse().find(x=>x!=null);if(!price)throw new Error('yahoo no price');
  return{source:'Yahoo Finance',price,volume:meta.regularMarketVolume??v,vwap:v?pv/v:null,high:isFinite(hi)?hi:null,low:isFinite(lo)?lo:null,prevClose:meta.chartPreviousClose??meta.previousClose??null,asOf:meta.regularMarketTime?meta.regularMarketTime*1000:Date.now()}}
async function asx(){
  const r=await fetch(`https://asx.api.markitdigital.com/asx-research/1.0/companies/${SYMBOL.toLowerCase()}/header`,{headers:{'User-Agent':UA,Accept:'application/json'}});
  if(!r.ok)throw new Error('asx '+r.status);const d=(await r.json()).data||{};if(!d.priceLast)throw new Error('asx no price');
  return{source:'ASX (public)',price:d.priceLast,volume:d.volume??null,vwap:null,high:d.priceDayHigh??null,low:d.priceDayLow??null,prevClose:d.priceLast-(d.priceChange??0),asOf:Date.now()}}
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=20, stale-while-revalidate=60');
  const errors=[];for(const fn of [yahoo,asx]){try{const q=await fn();q.marketOpen=sydneyOpen();q.symbol='ASX:'+SYMBOL;q.fetchedAt=Date.now();return res.status(200).json(q)}catch(e){errors.push(String(e.message||e))}}
  res.status(502).json({error:errors.join(' | ')})}
