// kallor-sankey.js - THE HOUSE SANKEY (owner 2026-09-02: "a Sankey format that goes over all - a common chart").
// Dependency-free. One renderer, one spec: {unit, mini, est, nodes:[{id,label,col,kind:src|rev|prof|cost|unk,sub,noval,valLabel}], links:[[s,t,v]]}.
// 80/20: the renderer and the income-statement builders are the 80%; a page supplies the lines (the 20%).
(function(global){
var C={src:'#C9CED4',rev:'#8A939E',prof:'#7FBF9A',cost:'#E39A8C',est:'#C7A24E',estc:'#E3C98A',unk:'#E3E6EA'};
function fmt(v,unit){ if(unit==='%') return (Math.round(v*10)/10)+'%'; return unit+(v>=10000? (v/1000).toFixed(1)+'B' : (Math.round(v*10)/10).toLocaleString('en-US')+'M'); }
function sankey(el,D){
 var W=D.mini?560:1400,padL=6,padR=6,nodeW=D.mini?12:16,cols=Math.max.apply(null,D.nodes.map(function(n){return n.col;}))+1;
 var byId={}; D.nodes.forEach(function(n){byId[n.id]=n;n.in=0;n.out=0;n.links_in=[];n.links_out=[];});
 var links=D.links.map(function(l){var L={s:byId[l[0]],t:byId[l[1]],v:l[2]};L.s.out+=L.v;L.s.links_out.push(L);L.t.in+=L.v;L.t.links_in.push(L);return L;});
 D.nodes.forEach(function(n){n.val=Math.max(n.in,n.out);});
 var colNodes=[]; for(var c=0;c<cols;c++) colNodes.push(D.nodes.filter(function(n){return n.col===c;}));
 var gap=D.mini?10:12, top=D.mini?18:28, bottom=D.mini?14:24, avail=D.mini?330:480;
 var scale=Infinity; colNodes.forEach(function(ns){var tot=ns.reduce(function(a,n){return a+n.val;},0); var s=(avail-gap*(ns.length-1))/tot; if(s<scale) scale=s;});
 var labelW=D.mini?0:200, labelR=D.mini?140:170, span=W-padL-padR-labelW-labelR-nodeW; var wts=[]; for(c=0;c<cols-1;c++){ var revOnly=colNodes[c].length&&colNodes[c].every(function(n){return n.kind==='rev';}); wts.push(revOnly?1.6:1); } var wsum=wts.reduce(function(a,b){return a+b;},0)||1; var xs=[padL+labelW]; for(c=0;c<cols-1;c++) xs.push(xs[c]+span*wts[c]/wsum);
 var last=cols-1; D.nodes.forEach(function(n){n.x=xs[n.col];});
 D.nodes.forEach(function(n){ var left=n.col===0&&!D.mini, wide=(n.col===last)||left; n.lines=wrap(n.label,D.mini?20:wide?30:24); n.subl=n.sub?wrap(n.sub,D.mini?24:wide?36:28):[]; n.lh=n.lines.length*(D.mini?11:13)+(n.noval?0:(D.mini?11:13))+n.subl.length*(D.mini?9:11)+2; });
 var H=0;
 colNodes.forEach(function(ns){ var y=top; ns.forEach(function(n){n.h=Math.max(n.val*scale,2); n.y=y; y+=Math.max(n.h,n.lh)+gap;}); if(y-gap+bottom>H) H=y-gap+bottom; });
 // centre the shorter columns vertically
 colNodes.forEach(function(ns){ var lastN=ns[ns.length-1]; var used=lastN.y+Math.max(lastN.h,lastN.lh)-top; var off=(H-top-bottom-used)/2; if(off>0) ns.forEach(function(n){n.y+=off;}); });
 D.nodes.forEach(function(n){ n.links_out.sort(function(a,b){return a.t.y-b.t.y;}); n.links_in.sort(function(a,b){return a.s.y-b.s.y;}); var o=0; n.links_out.forEach(function(l){l.sy=n.y+o;o+=l.v*scale;}); o=0; n.links_in.forEach(function(l){l.ty=n.y+o;o+=l.v*scale;}); });
 var col=function(k){return k==='src'?C.src:k==='rev'?C.rev:k==='prof'?C.prof:k==='unk'?C.unk:C.cost;};
 var fill=function(k){return k==='unk'?C.unk:D.est?(k==='prof'?C.prof:k==='cost'?C.estc:C.est):col(k);};
 var s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
 s+='<defs><style>.lk{opacity:.55;transition:opacity .15s}.lk:hover{opacity:.9}</style></defs>';
 links.forEach(function(l){ var x0=l.s.x+nodeW,x1=l.t.x,h=l.v*scale,mx=(x0+x1)/2; var y0=l.sy+h/2,y1=l.ty+h/2;
  var k=l.t.kind==='prof'?'prof':l.t.kind==='cost'?'cost':l.t.kind==='unk'?'unk':l.s.kind==='src'?'src':'rev'; if(l.t.kind==='src') k='src';
  s+='<path class="lk" d="M'+x0+','+y0+' C'+mx+','+y0+' '+mx+','+y1+' '+x1+','+y1+'" fill="none" stroke="'+fill(k)+'" stroke-width="'+Math.max(h,1.5)+'" data-tip="'+esc(l.s.label)+' → '+esc(l.t.label)+' · '+fmt(l.v,D.unit)+'"/>'; });
 D.nodes.forEach(function(n){ var k=n.kind; var nf=k==='unk'?'#9aa3b0':D.est?(k==='prof'?'#23684F':k==='cost'?C.est:'#8F6C22'):(k==='prof'?'#23684F':k==='cost'?'#B0522F':k==='rev'?'#5C6875':'#8A939E');
  s+='<rect x="'+n.x+'" y="'+n.y+'" width="'+nodeW+'" height="'+n.h+'" rx="2" fill="'+nf+'" data-tip="'+esc(n.label)+' · '+fmt(n.val,D.unit)+'"/>';
  var left=n.col===0&&!D.mini, lx=left?n.x-8:n.x+nodeW+6, anchor=left?'end':'start', cls=(k==='prof'?' p':k==='cost'?' c':'')+(D.mini?' mini':'');
  var base=n.y+(D.mini?9:11);
  var LH=D.mini?11:13; n.lines.forEach(function(t,i){ s+='<text class="nl'+cls+'" x="'+lx+'" y="'+(base+i*LH)+'" text-anchor="'+anchor+'">'+esc(t)+'</text>'; });
  var yv=base+n.lines.length*LH; if(!n.noval){ s+='<text class="nv'+cls+'" x="'+lx+'" y="'+yv+'" text-anchor="'+anchor+'">'+(n.valLabel||fmt(n.val,D.unit))+'</text>'; yv+=1; } else yv-=12;
  n.subl.forEach(function(t,i){ s+='<text class="ns'+(D.mini?' mini':'')+'" x="'+lx+'" y="'+(yv+(D.mini?9:11)+i*(D.mini?9:11))+'" text-anchor="'+anchor+'">'+esc(t)+'</text>'; });
 });
 s+='</svg>'; el.innerHTML=s;
}
function wrap(t,n){ var w=t.split(' '),o=[],cur=''; w.forEach(function(x){ if((cur+' '+x).trim().length>n){o.push(cur.trim());cur=x;} else cur+=' '+x; }); if(cur.trim())o.push(cur.trim()); return o; }
function esc(x){return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}

// ---------- builders: income statement from Kallor TMC-FINANCIALS lines ----------
function byKey(lines){ var m={}; lines.forEach(function(l){ if(l.value!=null && m[l.key]==null) m[l.key]=Number(l.value); }); return m; }
var COSTS=[['employee_benefits','Employee benefits','people'],['cost_of_revenue','Cost of revenue','undisc'],['cost_of_sales','Cost of sales','other'],['technology','Technology & IT','tech'],['sales_marketing','Sales & marketing','sm'],['consulting','Consulting & outsourcing','other'],['agent_fees','Independent agent fees','other'],['occupancy','Occupancy & rent','other'],['general_admin','General & administrative','other'],['restructuring','Restructuring & exit','other'],['remediation','Remediation / non-underlying','other'],['other_expenses','Other expenses','other']];
function pctOf(v,r){ return (Math.round(v/r*1000)/10)+'% of revenue'; }
// full statement: sources -> revenue -> costs + EBITDA -> D&A / finance / pre-tax -> tax / net
function fromLines(lines, opts){
 opts=opts||{}; var K=byKey(lines), unit=opts.unit||'', est=!!opts.est, N=[], L=[];
 var rev=K.revenue; if(rev==null) return null;
 var segs=lines.filter(function(l){ return /^revenue_/.test(l.key) && l.value!=null && !/_corpseg$/.test(l.key); });
 var segSum=0; segs.forEach(function(l){ N.push({id:l.key,label:l.label||l.key,col:0,kind:'src',sub:l.note||''}); L.push([l.key,'rev',Number(l.value)]); segSum+=Number(l.value); });
 if(segs.length && segSum<rev-0.5){ N.push({id:'seg_rest',label:'Split not disclosed',col:0,kind:'unk',sub:''}); L.push(['seg_rest','rev',rev-segSum]); }
 if(!segs.length){ N.push({id:'ttv',label:K.ttv!=null?('From TTV '+fmt(K.ttv,unit)):'Clients',col:0,kind:'src',noval:true,sub:K.ttv!=null?((Math.round(rev/K.ttv*1000)/10)+'% kept as revenue'):''}); L.push(['ttv','rev',rev]); }
 N.push({id:'rev',label:'Revenue',col:1,kind:'rev',sub:K.ttv!=null?((Math.round(rev/K.ttv*1000)/10)+'% of TTV'):''});
 var income=rev; if(K.other_income){ N.push({id:'oi',label:'Other income',col:1,kind:'src',sub:''}); income+=K.other_income; }
 var known=[]; COSTS.forEach(function(c){ if(K[c[0]]!=null){ known.push({key:c[0],label:c[1],v:K[c[0]],cls:c[2]}); } });
 var costSum=known.reduce(function(a,c){return a+c.v;},0);
 var ebitda=K.ebitda_underlying!=null&&!known.length?K.ebitda_underlying:(known.length?income-costSum:(K.ebitda!=null?K.ebitda:null));
 var ebLabel=known.length?'EBITDA':(K.ebitda_underlying!=null?'Underlying EBITDA':'EBITDA');
 if(ebitda==null) return null;
 N.push({id:'ebitda',label:ebLabel,col:2,kind:'prof',sub:pctOf(ebitda,rev)+(known.length&&K.ebitda!=null&&Math.abs(K.ebitda-ebitda)>0.5?' · reported '+fmt(K.ebitda,unit):'')});
 L.push(['rev','ebitda',Math.max(ebitda-(K.other_income||0),0)]); if(K.other_income) L.push(['oi','ebitda',Math.min(K.other_income,ebitda)]);
 known.forEach(function(c){ N.push({id:c.key,label:c.label,col:2,kind:c.cls==='undisc'?'unk':'cost',sub:pctOf(c.v,rev)+(c.cls==='undisc'?' · not split by nature':'')}); L.push(['rev',c.key,c.v]); });
 if(!known.length){ N.push({id:'opex',label:'Operating costs - not split',col:2,kind:'unk',sub:pctOf(income-ebitda,rev)}); L.push(['rev','opex',income-ebitda]); }
 // below EBITDA
 var pbt=K.pbt!=null?K.pbt:(K.operating_income!=null?null:null);
 var below=0;
 if(K.depreciation!=null){ N.push({id:'da',label:'Depreciation & amortisation',col:3,kind:'cost',sub:pctOf(K.depreciation,rev)}); L.push(['ebitda','da',K.depreciation]); below+=K.depreciation; }
 if(K.finance_costs!=null){ var fin=K.finance_costs; N.push({id:'fin',label:'Finance costs',col:3,kind:'cost',sub:''}); L.push(['ebitda','fin',fin]); below+=fin; }
 if(pbt!=null){
  var rest=ebitda-below-pbt;
  if(rest>0.5){ N.push({id:'brest',label:(K.depreciation==null?'D&A, interest, non-underlying':'Other below EBITDA')+' - not split',col:3,kind:'unk',sub:pctOf(rest,rev)}); L.push(['ebitda','brest',rest]); }
  N.push({id:'pbt',label:'Profit before tax',col:3,kind:'prof',sub:pctOf(pbt,rev)}); L.push(['ebitda','pbt',pbt-(rest<-0.5?-rest:0)]);
  if(rest<-0.5){ N.push({id:'gains',label:'Non-operating gains, net',col:2,kind:'src',sub:''}); L.push(['gains','pbt',-rest]); }
  var net=K.npat!=null?K.npat:K.net_income; if(net!=null){ N.push({id:'net',label:'Net profit',col:4,kind:'prof',sub:pctOf(net,rev)}); L.push(['pbt','net',net]); var tax=K.tax!=null?K.tax:(pbt-net); N.push({id:'tax',label:'Tax',col:4,kind:'cost',sub:''}); L.push(['pbt','tax',tax]); if(pbt-net-tax>0.5){ N.push({id:'nother',label:'Other',col:4,kind:'cost',sub:''}); L.push(['pbt','nother',pbt-net-tax]); } if(pbt-net-tax<-0.5){ N.push({id:'ngain',label:'Equity income & other',col:3,kind:'src',sub:''}); L.push(['ngain','net',net+tax-pbt]); } }
 } else {
  var left=ebitda-below; if(K.operating_income!=null){ N.push({id:'oi2',label:'Operating income',col:3,kind:'prof',sub:pctOf(K.operating_income,rev)}); L.push(['ebitda','oi2',K.operating_income]); left-=K.operating_income; }
  if(left>0.5){ N.push({id:'nb',label:'Below: not public',col:3,kind:'unk',sub:''}); L.push(['ebitda','nb',left]); }
 }
 return {unit:unit,est:est,nodes:N,links:L,K:K};
}
// normalised (revenue = 100) shape on the five common names
function norm(lines, opts){
 opts=opts||{}; var K=byKey(lines), r=K.revenue; if(r==null) return null; var N=[],L=[], p=function(v){return Math.round(v/r*1000)/10;};
 var g={people:0,tech:0,sm:0,other:0,undisc:0}, any=false; COSTS.forEach(function(c){ if(K[c[0]]!=null){ g[c[2]]+=K[c[0]]; any=true; } });
 var income=r+(K.other_income||0); var ebitda=any?income-(g.people+g.tech+g.sm+g.other+g.undisc):(K.ebitda_underlying!=null?K.ebitda_underlying:K.ebitda); if(ebitda==null) return null;
 if(!any) g.undisc=income-ebitda;
 N.push({id:'rev',label:'Revenue',col:0,kind:'rev',sub:'= 100'}); if(K.other_income){ N.push({id:'oi',label:'Other income',col:0,kind:'src',sub:''}); }
 N.push({id:'ebitda',label:any?'EBITDA':(K.ebitda_underlying!=null?'Underlying EBITDA':'EBITDA'),col:1,kind:'prof',sub:''}); L.push(['rev','ebitda',p(Math.max(ebitda-(K.other_income||0),0))]); if(K.other_income) L.push(['oi','ebitda',p(Math.min(K.other_income,ebitda))]);
 [['people','People','cost'],['tech','Technology','cost'],['sm','Sales & marketing','cost'],['other','Other opex','cost'],['undisc','Undisclosed opex','unk']].forEach(function(o){ if(g[o[0]]>0){ N.push({id:o[0],label:o[1],col:1,kind:o[2],sub:''}); L.push(['rev',o[0],p(g[o[0]])]); } });
 var below=0; if(K.depreciation!=null){ N.push({id:'da',label:'D&A',col:2,kind:'cost',sub:''}); L.push(['ebitda','da',p(K.depreciation)]); below+=K.depreciation; }
 if(K.finance_costs!=null){ var fin=K.finance_costs; N.push({id:'int',label:'Interest',col:2,kind:'cost',sub:''}); L.push(['ebitda','int',p(fin)]); below+=fin; }
 var pbt=K.pbt; if(pbt!=null){ var rest=ebitda-below-pbt; if(rest>0.5){ N.push({id:'brest',label:'Undisclosed below EBITDA',col:2,kind:'unk',sub:''}); L.push(['ebitda','brest',p(rest)]); } N.push({id:'pbt',label:'Pre-tax',col:2,kind:'prof',sub:''}); L.push(['ebitda','pbt',p(pbt-(rest<-0.5?-rest:0))]); if(rest<-0.5){ N.push({id:'gains',label:'Non-op gains',col:1,kind:'src',sub:''}); L.push(['gains','pbt',p(-rest)]); }
  var net=K.npat!=null?K.npat:K.net_income; if(net!=null){ N.push({id:'net',label:'Net profit',col:3,kind:'prof',sub:''}); N.push({id:'tax',label:'Tax & other',col:3,kind:'cost',sub:''}); L.push(['pbt','net',p(net)]); L.push(['pbt','tax',p(Math.max(pbt-net,0))]); } else { N.push({id:'nb',label:'Below: not public',col:3,kind:'unk',sub:''}); L.push(['pbt','nb',p(pbt)]); } }
 else { var left=ebitda-below; N.push({id:'nb',label:'Below: not public',col:2,kind:'unk',sub:''}); L.push(['ebitda','nb',p(left)]); }
 return {unit:'%',mini:true,est:!!opts.est,nodes:N,links:L,K:K,shape:g,ebitda:ebitda};
}
global.KallorSankey={render:sankey,fromLines:fromLines,norm:norm,byKey:byKey,fmt:fmt,esc:esc,C:C};
})(window);
