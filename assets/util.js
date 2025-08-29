(function(){
  function fmtDate(d){try{const x=(d instanceof Date)?d:new Date(d);return x.toLocaleString([], {hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'})}catch(e){return '—'}}
  function fmtDay(d){try{const x=(d instanceof Date)?d:new Date(d);return x.toLocaleDateString([], {month:'short',day:'numeric'})}catch(e){return ''}}
  function strip(html){const t=document.createElement('div');t.innerHTML=html;return t.textContent||t.innerText||''}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g, function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c];})}
  function uniqBy(arr, key){const seen=new Set();return arr.filter(x=>{const k=key(x);if(seen.has(k))return false;seen.add(k);return true})}
  function getWeekRange(date){const d=new Date(date||new Date());const day=d.getDay();const diffToMon=(day===0?-6:1-day);const monday=new Date(d);monday.setDate(d.getDate()+diffToMon);monday.setHours(0,0,0,0);const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);sunday.setHours(23,59,59,999);return {monday,sunday,label:'Week of '+monday.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};}
  function monthGrid(date){
    const now=new Date(date||new Date()); const y=now.getFullYear(); const m=now.getMonth();
    const first=new Date(y,m,1); const start=new Date(first); start.setDate(first.getDate()-((first.getDay()+6)%7));
    const days=[]; for(let i=0;i<42;i++){const d=new Date(start); d.setDate(start.getDate()+i); days.push(d)}
    return {year:y, month:m, days:days};
  }
  function setTheme(t){document.documentElement.setAttribute('data-theme', t);localStorage.setItem('theme', t)}
  function initTheme(){const t=localStorage.getItem('theme')||'light';setTheme(t);return t}
  function summarize(text, maxSentences){maxSentences=maxSentences||2;const sents=text.replace(/\s+/g,' ').split(/(?<=[\.!?])\s/).slice(0,18);const keywords=['inflation','rates','earnings','revenue','guidance','demand','growth','yields','prices','policy','jobs','labor','spending','sales','forecast','manufacturing','housing','chip','semiconductor','bank','credit','oil','energy','PMI','ISM','FOMC','payrolls','CPI','PPI','GDP'];const scored=sents.map(s=>({s,score:keywords.reduce((a,k)=>a+(s.toLowerCase().includes(k.toLowerCase())?1:0),0)+s.length/200}));return scored.sort((a,b)=>b.score-a.score).slice(0,maxSentences).map(x=>x.s).join(' ')}
  window.fmtDate=fmtDate; window.fmtDay=fmtDay; window.strip=strip; window.escapeHtml=escapeHtml; window.uniqBy=uniqBy; window.getWeekRange=getWeekRange; window.monthGrid=monthGrid; window.setTheme=setTheme; window.initTheme=initTheme; window.summarize=summarize;
})();