(function(){
  async function fetchWithFallback(url){
    try{const r=await fetch(url,{headers:{'Accept':'application/rss+xml, application/xml, text/xml'}});if(r.ok)return await r.text()}catch(e){}
    try{const r=await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(url));if(r.ok)return await r.text()}catch(e){}
    try{const r=await fetch('https://r.jina.ai/http/'+url.replace(/^https?:\/\//,''));if(r.ok)return await r.text()}catch(e){}
    // Extra fallback
    try{const r=await fetch('https://cors.isomorphic-git.org/'+url);if(r.ok)return await r.text()}catch(e){}
    return '';
  }
  function firstImage(node){
    var media=node.querySelector('media\\:content, content, media\\:thumbnail, thumbnail');
    if(media && media.getAttribute('url')) return media.getAttribute('url');
    var enc=node.querySelector('enclosure');
    if(enc && enc.getAttribute('url') && /(jpg|jpeg|png|gif)$/i.test(enc.getAttribute('url'))) return enc.getAttribute('url');
    var desc=(node.querySelector('description, summary')||{}).textContent||'';
    var m=desc.match(/https?:\/\/[^"']+\.(?:png|jpg|jpeg|gif)/i);
    if(m) return m[0];
    return 'https://images.unsplash.com/photo-1641939402613-6ec1345ca901?q=80&w=800&auto=format&fit=crop';
  }
  function parseRSS(xmlText){
    if(!xmlText) return [];
    var p=new DOMParser();var xml=p.parseFromString(xmlText,'application/xml');
    return Array.from(xml.querySelectorAll('item,entry')).map(function(n){
      function g(s){var x=n.querySelector(s);return (x&&x.textContent||'').trim()}
      var ln=n.querySelector('link'); var link=(ln&&(ln.getAttribute('href')||ln.textContent))||g('id');
      var pub=g('pubDate')||g('updated')||g('published')||new Date().toISOString();
      return {title:g('title'),link:link,pub:new Date(pub),desc:g('description')||g('summary')||'',img:firstImage(n),src:'',node:n};
    });
  }
  async function fetchFeeds(){
    var FEEDS=[
      {name:'Reuters Markets',url:'https://feeds.reuters.com/reuters/USMarketNews'},
      {name:'Reuters Business',url:'https://feeds.reuters.com/reuters/businessNews'},
      {name:'MarketWatch',url:'https://www.marketwatch.com/rss/topstories'},
      {name:'WSJ Markets',url:'https://feeds.a.dj.com/rss/RSSMarketsMain.xml'},
      {name:'Yahoo Finance',url:'https://finance.yahoo.com/news/rssindex'}
    ];
    var jobs=FEEDS.map(async function(f){try{var x=await fetchWithFallback(f.url);return parseRSS(x).map(function(i){i.src=f.name;return i})}catch(e){return []}});
    var groups=await Promise.all(jobs);
    var items=groups.flat();
    return uniqBy(items, function(i){return i.link||i.title}).sort(function(a,b){return b.pub-a.pub});
  }
  function financeFilter(item){
    const bad=/(sports?|entertainment|celebrity|gossip|travel|recipes?|lifestyle|video:)/i;
    const ok=/(market|stocks?|bonds?|yields?|fed|inflation|earnings|revenue|guidance|ipo|merger|acquisition|m&a|oil|commodity|forex|rates?|central bank|jobs?|unemployment|housing|gdp|tariff|chip|semiconductor|bank|credit|equity|indexes?)/i;
    const txt=(item.title+' '+item.desc+' '+item.link).toLowerCase();
    return ok.test(txt)&&!bad.test(txt);
  }
  async function renderDailyHeadlines(sel, limit){
    limit=limit||14;
    var t=document.querySelector(sel);
    var items=await fetchFeeds();
    items=items.filter(financeFilter);
    t.innerHTML=items.slice(0,limit).map(function(i){
      return '<div class="news-item">'+
        '<img src="'+i.img+'" alt="image" loading="lazy"/>'+
        '<div><div class="news-meta"><span>'+i.src+'</span><span>•</span><time>'+fmtDate(i.pub)+'</time></div>'+
        '<div class="news-title">'+escapeHtml(i.title)+'</div>'+
        (i.desc?('<p class="small">'+escapeHtml(strip(i.desc)).slice(0,220)+(i.desc.length>220?'…':'')+'</p>'):'')+
        '<div><a href="'+i.link+'" target="_blank" rel="noopener">Read</a></div></div></div>';
    }).join('');
  }
  async function weeklyItems(){
    const wr=getWeekRange(new Date());
    const items=await fetchFeeds();
    const week=items.filter(i=>i.pub>=wr.monday&&i.pub<=wr.sunday).filter(financeFilter);
    return {wr, week, items};
  }
  async function renderWeeklyBlog(sel){
    var c=document.querySelector(sel);
    var {wr, week}=await weeklyItems();
    var top=week.slice(0,30);
    var joined=top.map(i=>i.title+' '+strip(i.desc)).join(' ');
    var summary=summarize(joined,6)||'Markets were relatively calm this week. Key stories focused on earnings, policy expectations and demand for technology infrastructure.';
    var drivers=summarize(joined,6);
    var dateStr=wr.monday.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
    try{
      var archive=JSON.parse(localStorage.getItem('tfb_blog_archive')||'[]');
      var slug=wr.monday.toISOString().slice(0,10);
      archive=archive.filter(x=>x.slug!==slug);
      archive.push({slug:slug,date:dateStr,html:summary+'\n\nWhy: '+drivers,headlines:top.map(i=>({t:i.title,l:i.link,s:i.src}))});
      localStorage.setItem('tfb_blog_archive', JSON.stringify(archive));
    }catch(e){}
    c.innerHTML='<div class="card">'+
      '<div style="display:flex;justify-content:space-between;align-items:center">'+
      '<div style="display:flex;align-items:center;gap:10px"><img src="assets/financial-bird-logo.png" class="logo" alt="logo"/><strong>The Financial Bird</strong></div>'+
      '<div class="muted">Written '+dateStr+'</div></div>'+
      '<div class="rule"></div>'+
      '<h2 class="h2">This week in markets</h2><p>'+summary+'</p>'+
      '<h2 class="h2">Why it is happening</h2><p>'+drivers+'</p>'+
      '<h2 class="h2">Selected headlines</h2><ul>'+top.slice(0,10).map(i=>'<li><a href="'+i.link+'" target="_blank" rel="noopener">'+escapeHtml(i.title)+'</a> <span class="news-meta">('+i.src+')</span></li>').join('')+'</ul>'+
      '<div><button class="button secondary" onclick="window.print()">Save as PDF</button></div>'+
    '</div>';
  }
  async function renderEarningsCalendar(sel){
    const {wr, week}=await weeklyItems();
    const earns=week.filter(i=>/(earnings|eps|revenue|guidance|quarter|results)/i.test(i.title+' '+i.desc));
    const byTicker={};
    earns.forEach(i=>{
      const m=(i.title.match(/\b[A-Z]{1,5}(?:\.[A-Z])?\b/g)||[]);
      const tk=m.find(x=>x!=='EPS'&&x!=='USD'&&x!=='CEO')||'—';
      if(!byTicker[tk]) byTicker[tk]=[];
      byTicker[tk].push(i);
    });
    const list=Object.keys(byTicker).slice(0,30).map(t=>({t,items:byTicker[t]}));
    document.querySelector(sel).innerHTML = list.length?('<table class="table"><thead><tr><th>Ticker</th><th>Headlines</th></tr></thead><tbody>'+
      list.map(g=>'<tr><td><strong>'+g.t+'</strong></td><td>'+g.items.slice(0,3).map(i=>'<a href="'+i.link+'" target="_blank">'+escapeHtml(i.title)+'</a> <span class="small">'+fmtDate(i.pub)+'</span>').join('<br>')+'</td></tr>').join('')
      +'</tbody></table>'):'<p class="small">No clear earnings items detected yet this week.</p>';
  }
  async function renderEconomicCalendarMonth(sel){
    const {days}=monthGrid(new Date());
    const t=document.querySelector(sel);
    t.innerHTML='';
    const items=await fetchFeeds();
    const econKeys=/(CPI|PPI|payrolls|jobs report|unemployment|GDP|FOMC|PMI|ISM|retail sales|housing starts|confidence|PCE|rate decision|durable goods|JOLTS)/i;
    const econ=items.filter(i=>econKeys.test(i.title+' '+i.desc));
    const byDate={};
    econ.forEach(i=>{ const key=i.pub.toISOString().slice(0,10); (byDate[key]||(byDate[key]=[])).push(i); });
    const grid=document.createElement('div'); grid.className='calendar';
    days.forEach(d=>{
      const key=d.toISOString().slice(0,10);
      const box=document.createElement('div'); box.className='day';
      const inMonth = d.getMonth()===new Date().getMonth();
      box.style.opacity = inMonth? '1':'0.45';
      box.innerHTML='<div class="date">'+d.getDate()+'</div>';
      (byDate[key]||[]).slice(0,3).forEach(ev=>{
        const e=document.createElement('div'); e.className='event';
        e.innerHTML = escapeHtml(ev.title.slice(0,60));
        e.title = ev.title;
        e.onclick = ()=> window.open(ev.link, '_blank','noopener');
        box.appendChild(e);
      });
      grid.appendChild(box);
    });
    t.appendChild(grid);
  }
  // Wider pools to reduce chance of empty stocks-to-watch
  var SP500=['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','JPM','NFLX','BRK.B','AVGO','PEP','COST','BAC','KO','V','MA'];
  var NICHE=['SMCI','ARM','PLTR','RIVN','SRPT','SHOP','SQ','U','LCID','NIO','DKNG','COIN'];
  async function fetchSymbolNews(ticker){
    var urls=['https://finance.yahoo.com/rss/headline?s='+encodeURIComponent(ticker),'https://feeds.finance.yahoo.com/rss/2.0/headline?s='+encodeURIComponent(ticker)];
    for(var i=0;i<urls.length;i++){try{var x=await fetchWithFallback(urls[i]);var arr=parseRSS(x).map(function(it){it.src='Yahoo '+ticker;return it});if(arr.length) return arr}catch(e){}}
    return [];
  }
  function parseRSS(xmlText){
    if(!xmlText) return []; var p=new DOMParser(); var xml=p.parseFromString(xmlText,'application/xml');
    return Array.from(xml.querySelectorAll('item,entry')).map(function(n){
      function g(s){var x=n.querySelector(s);return (x&&x.textContent||'').trim()}
      var ln=n.querySelector('link'); var link=(ln&&(ln.getAttribute('href')||ln.textContent))||g('id');
      var pub=g('pubDate')||g('updated')||g('published')||new Date().toISOString();
      return {title:g('title'),link:link,pub:new Date(pub),desc:g('description')||g('summary')||'',img:'',src:''};
    });
  }
  function logoFor(domain){return 'https://logo.clearbit.com/'+domain}
  function companyLogo(t){var m={AAPL:'apple.com',MSFT:'microsoft.com',NVDA:'nvidia.com',TSLA:'tesla.com',AMZN:'amazon.com',META:'meta.com',GOOGL:'abc.xyz',JPM:'jpmorganchase.com',NFLX:'netflix.com','BRK.B':'berkshirehathaway.com',AVGO:'broadcom.com',PEP:'pepsico.com',COST:'costco.com',BAC:'bankofamerica.com',KO:'coca-cola.com',V:'visa.com',MA:'mastercard.com',SMCI:'supermicro.com',ARM:'arm.com',PLTR:'palantir.com',RIVN:'rivian.com',SRPT:'sarepta.com',SHOP:'shopify.com',SQ:'block.xyz',U:'unity.com',LCID:'lucidmotors.com',NIO:'nio.com',DKNG:'draftkings.com',COIN:'coinbase.com'};return logoFor(m[t]||'investopedia.com')}
  async function renderWeeklyStocks(sel){
    var c=document.querySelector(sel); var wr=getWeekRange(new Date());
    async function pick(list){var res=[];for(var i=0;i<list.length;i++){var t=list[i];var items=await fetchSymbolNews(t);var wk=items.filter(i=>i.pub>=wr.monday&&i.pub<=wr.sunday);if(wk.length>0){res.push({ticker:t,items:wk})}if(res.length>=6)break}return res}
    var sp=await pick(SP500); var niche=await pick(NICHE);
    function why(desc){return summarize(strip(desc||''),2)||'This matters for expected earnings, growth or pricing power this week.'}
    function section(name, groups){
      if(groups.length===0) return '<div class="card small">No qualifying headlines detected yet this week.</div>';
      return '<div class="section"><div class="h2">'+name+'</div>'+
        '<div class="grid cols-3">'+
        groups.map(function(g){
          return '<div class="card"><div class="h3">'+g.ticker+'</div>'+
            '<div style="display:flex;gap:12px;align-items:center">'+
              '<div style="flex:1"><ul>'+g.items.slice(0,3).map(function(i){return '<li><a href="'+i.link+'" target="_blank" rel="noopener">'+escapeHtml(i.title)+'</a><div class="small">'+escapeHtml(why(i.desc||i.title))+'</div></li>'}).join('')+'</ul></div>'+
              '<img src="'+companyLogo(g.ticker)+'" alt="'+g.ticker+' logo" width="80" height="80" style="border:1px solid var(--border);border-radius:10px;background:#fff"/>'+
            '</div></div>';
        }).join('')+
        '</div></div>';
    }
    c.innerHTML=section('S and P 500 stocks to watch', sp)+section('Niche stocks to watch', niche);
  }
  async function fetchHistory(ticker){
    const url='https://stooq.com/q/d/l/?s='+encodeURIComponent(ticker.toLowerCase())+'&i=d';
    const text=await fetchWithFallback(url);
    if(!text) return [];
    const rows=text.trim().split(/\r?\n/).slice(1).map(r=>r.split(','));
    return rows.map(r=>({date:r[0], close:parseFloat(r[4])})).filter(x=>isFinite(x.close));
  }
  async function portfolioMetrics(tickers, weights){
    const wsum=weights.reduce((a,b)=>a+b,0)||1;
    const w=weights.map(x=>x/wsum);
    const series=await Promise.all(tickers.map(t=>fetchHistory(t)));
    if(series.some(s=>s.length===0)) return {mean:0,stdev:0,sharpe:0};
    const minLen=Math.min(...series.map(s=>s.length));
    const aligned=series.map(s=>s.slice(-minLen));
    function returns(arr){const r=[];for(let i=1;i<arr.length;i++){r.push((arr[i].close-arr[i-1].close)/arr[i-1].close)}return r}
    const rets=aligned.map(returns);
    const T=Math.min(...rets.map(r=>r.length));
    const truncated=rets.map(r=>r.slice(-T));
    function mean(a){return a.reduce((x,y)=>x+y,0)/a.length}
    const means=truncated.map(mean);
    const cov=truncated.map((ri,i)=>truncated.map((rj,j)=>{let s=0;for(let k=0;k<T;k++){s+=(ri[k]-means[i])*(rj[k]-means[j])}return s/(T-1);}));
    let pm=0; for(let i=0;i<w.length;i++){pm+=w[i]*means[i]}
    let pv=0; for(let i=0;i<w.length;i++){for(let j=0;j<w.length;j++){pv+=w[i]*w[j]*cov[i][j]}} 
    const sd=Math.sqrt(pv);
    const rf=0.00; const sharpe=(pm-rf)/(sd||1e-9);
    return {mean:pm, stdev:sd, sharpe:sharpe};
  }
  // Header bindings with proper initial toggle state and re-render
  function initHeaderBindings(){
    const currentTheme=initTheme();
    const themeToggle=document.getElementById('themeToggle');
    if(themeToggle){
      themeToggle.checked = (currentTheme==='dark');
      themeToggle.addEventListener('change', function(){
        const t = themeToggle.checked ? 'dark':'light';
        setTheme(t);
        // Re-render TradingView widget if present
        try{
          const input=document.getElementById('symInput');
          const saved=(input && input.value)||localStorage.getItem('tfb_lastSymbol')||'AAPL';
          if(typeof renderSymbol==='function'){ renderSymbol(saved); }
        }catch(e){}
      });
    }
    const subBtn=document.getElementById('subscribeBtn');
    if(subBtn){subBtn.addEventListener('click', function(e){e.preventDefault();const m=document.getElementById('newsletterModal'); if(m) m.style.display='flex';});}
  }
  function initNewsletter(){ if(localStorage.getItem('tfb_sub_seen')) return; const m=document.getElementById('newsletterModal'); if(m) m.style.display='flex'; }
  window.closeNewsletter=function(){const m=document.getElementById('newsletterModal'); if(m) m.style.display='none'; localStorage.setItem('tfb_sub_seen','1')}
  window.renderDailyHeadlines=renderDailyHeadlines;
  window.renderWeeklyBlog=renderWeeklyBlog;
  window.renderEarningsCalendar=renderEarningsCalendar;
  window.renderEconomicCalendarMonth=renderEconomicCalendarMonth;
  window.renderWeeklyStocks=renderWeeklyStocks;
  window.fetchHistory=fetchHistory;
  window.portfolioMetrics=portfolioMetrics;
  window.initHeaderBindings=initHeaderBindings;
  window.initNewsletter=initNewsletter;
  // expose for theme re-render on Home
  window.renderSymbol = window.renderSymbol || function(){};
})();