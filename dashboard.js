// === CHAVES SUPABASE ===
const SUPABASE_URL = "https://dmydhaompvanujvpkngz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteWRoYW9tcHZhbnVqdnBrbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDEzNjUsImV4cCI6MjA3MTMxNzM2NX0.xPxalOxi4PR0z7Jo9m2JodFF4Z8Eiw0U-pAxDMFvvV0";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("[dbg] dashboard.js atualizado (com reset de senha + toolbar bycoin)");

/* =========================================================================
   HOTFIX: variáveis usadas precocemente pelo roteador
   ========================================================================= */
let __ALL_TRADES__ = [];   // cache completo (Operações/Relatórios)
let DATA_READY = false;    // vira true quando loadData termina

/* =========================================================================
   INÍCIO (neonStorm) — grid de porcentagens
   ========================================================================= */
let neonField = null;

/* ---- Config do campo de % ---- */
const NEON_CFG = {
  posRatio: 0.75,
  density: 0.82,
  gridMin: 130, gridMinY: 115,
  tiers: [
    { cls:'fs-sm',  weight: 26 },
    { cls:'fs-md',  weight: 34 },
    { cls:'fs-lg',  weight: 22 },
    { cls:'fs-xl',  weight: 12 },
    { cls:'fs-xxl', weight: 6  },
  ],
  speed: [7,14],
  offset:{ dx:[-140,140], dy:[-120,120] },
  drift: 1200
};

class PercentField {
  constructor(container, config){
    this.el = container;
    this.cfg = config;
    this._onResize = () => this.respawn();
    this._timer = null;
    this._attempts = 0;
  }
  start(){
    if(!this.el) return;
    this.stop();
    this.respawn();
    this._timer = setInterval(() => this._tickValues(), this.cfg.drift);
    addEventListener("resize", this._onResize, { passive:true });
  }
  stop(){
    if(this._timer){ clearInterval(this._timer); this._timer = null; }
    removeEventListener("resize", this._onResize);
  }
  respawn(){
    const c=this.el; if(!c) return;
    c.dataset.ready = "0";
    const w=c.clientWidth, h=c.clientHeight;
    if (!w || !h){
      if (this._attempts < 40){
        this._attempts++;
        return requestAnimationFrame(()=>this.respawn());
      }
      return;
    }
    this._attempts = 0;

    c.innerHTML = "";
    const cols=Math.max(8, Math.floor(w/this.cfg.gridMin));
    const rows=Math.max(5, Math.floor(h/this.cfg.gridMinY));
    const cellW=w/cols, cellH=h/rows;
    const total=Math.max(60, Math.round(cols*rows*this.cfg.density));
    const used=new Set();

    for(let k=0;k<total;k++){
      let i=0,j=0,key="",tries=0;
      do{ i=(Math.random()*cols)|0; j=(Math.random()*rows)|0; key=`${i},${j}`; }while(used.has(key)&&tries++<40);
      used.add(key);

      const el=document.createElement("span");
      const tier=this._pickTierClass();
      const isPos=Math.random()<this.cfg.posRatio;
      const val=isPos?(20+Math.random()*80):(5+Math.random()*30);
      el.className=`pct ${isPos?"pos":"neg"} ${tier}`;
      el.textContent=`${isPos?"+":"-"}${Math.round(val)}%`;

      const padX=10,padY=10;
      const x=i*cellW + padX + Math.random()*Math.max(0, (cellW-padX*2));
      const y=j*cellH + padY + Math.random()*Math.max(0, (cellH-padY*2));
      const dx=this._rand(this.cfg.offset.dx[0], this.cfg.offset.dx[1]);
      const dy=this._rand(this.cfg.offset.dy[0], this.cfg.offset.dy[1]);
      const t=this._rand(this.cfg.speed[0], this.cfg.speed[1]);
      const d=Math.random()*2;

      el.style.setProperty("--x0", x+"px");
      el.style.setProperty("--y0", y+"px");
      el.style.setProperty("--dx", dx+"px");
      el.style.setProperty("--dy", dy+"px");
      el.style.setProperty("--t", `${t}s`);
      el.style.setProperty("--d", `${d}s`);
      el.style.animationPlayState = "paused";
      c.appendChild(el);
    }

    requestAnimationFrame(()=>{
      [...c.children].forEach(n => void n.offsetHeight);
      [...c.children].forEach(n => n.style.animationPlayState = "running");
      c.dataset.ready = "1";
    });
  }
  _tickValues(){
    const nodes=this.el.querySelectorAll(".pct");
    const n=Math.max(14, Math.round(nodes.length*0.25));
    for(let i=0;i<n;i++){
      const el=nodes[(Math.random()*nodes.length)|0]; if(!el) continue;
      const isPos=Math.random()<this.cfg.posRatio;
      const base=isPos?(22+Math.random()*78):(5+Math.random()*30);
      el.classList.toggle("pos", isPos);
      el.classList.toggle("neg", !isPos);
      el.textContent=`${isPos?"+":"-"}${Math.round(base)}%`;
    }
  }
  _pickTierClass(){
    const arr=this.cfg.tiers;
    const total=arr.reduce((s,t)=>s+t.weight,0);
    let r=Math.random()*total;
    for(const t of arr){ if((r-=t.weight)<=0) return t.cls; }
    return arr[arr.length-1].cls;
  }
  _rand(a,b){ return a + Math.random()*(b-a); }
}

/* =========================================================================
   Ticker ao vivo (Binance)
   ========================================================================= */
const STREAMS = [
  { sym: 'BTC',  stream: 'btcusdt' },
  { sym: 'ETH',  stream: 'ethusdt' },
  { sym: 'SOL',  stream: 'solusdt' },
  { sym: 'XRP',  stream: 'xrpusdt' },
  { sym: 'ADA',  stream: 'adausdt' },
  { sym: 'DOGE', stream: 'dogeusdt' },
  { sym: 'WIF',  stream: 'wifusdt' },
  { sym: 'MATIC',stream: 'maticusdt' },
  { sym: 'AVAX', stream: 'avaxusdt' },
];

let tickerTrackEl = null;
let priceWS = null;
let wsReconnectTimer = null;
let tickerResizeHandler = null;

function fmtUSD(n){
  const v = Number(n);
  const opts = { minimumFractionDigits: v < 1 ? 4 : 2, maximumFractionDigits: v < 1 ? 4 : 2 };
  return `$${v.toLocaleString('en-US', opts)}`;
}
function buildTickerItem(sym){
  const el = document.createElement('div');
  el.className = 'ti';
  el.setAttribute('data-sym', sym);
  el.innerHTML = `
    <span class="badge">${sym}</span>
    <span class="price">--</span>
    <span class="chg">--</span>
  `;
  return el;
}
function buildTickerTrack(){
  tickerTrackEl = document.getElementById('ticker-track');
  if(!tickerTrackEl) return;

  tickerTrackEl.innerHTML = '';
  for (let k = 0; k < 2; k++){
    STREAMS.forEach(s => tickerTrackEl.appendChild(buildTickerItem(s.sym)));
  }

  requestAnimationFrame(() => {
    const half = [...tickerTrackEl.children]
      .slice(0, STREAMS.length)
      .reduce((w, el) => w + el.offsetWidth + 16, 24);
    const pxPerSec = 90;
    const dur = Math.max(18, Math.round(half / pxPerSec));
    tickerTrackEl.style.setProperty('--loopW', half + 'px');
    tickerTrackEl.style.setProperty('--dur', dur + 's');
  });
}
function setTicker(sym, last, pct){
  if(!tickerTrackEl) return;
  const nodes = tickerTrackEl.querySelectorAll(`.ti[data-sym="${sym}"]`);
  nodes.forEach(el => {
    el.querySelector('.price').textContent = fmtUSD(last);
    const chg = el.querySelector('.chg');
    chg.textContent = `${pct >= 0 ? '+' : ''}${Number(pct).toFixed(2)}%`;
    chg.classList.toggle('up', pct >= 0);
    chg.classList.toggle('down', pct < 0);
  });
}
async function fetchInitialPrices(){
  try{
    await Promise.all(STREAMS.map(async s => {
      const sym = s.stream.toUpperCase();
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`);
      if(!res.ok) return;
      const j = await res.json();
      const last = Number(j.lastPrice ?? j.c ?? 0);
      const pct  = Number(j.priceChangePercent ?? j.P ?? 0);
      setTicker(s.sym, last, pct);
    }));
  }catch(_){}
}
function openPriceStream(){
  const url = 'wss://stream.binance.com:9443/stream?streams=' +
              STREAMS.map(s => `${s.stream}@ticker`).join('/');

  if(priceWS){ try{ priceWS.close(); }catch(_){ } priceWS = null; }
  if(wsReconnectTimer){ clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }

  priceWS = new WebSocket(url);

  priceWS.onmessage = (ev) => {
    try{
      const msg = JSON.parse(ev.data);
      const d = msg?.data;
      if(!d || !d.s) return;
      const map = STREAMS.find(x => x.stream.toUpperCase() === d.s);
      if(!map) return;
      const last = Number(d.c ?? d.lastPrice ?? 0);
      const pct  = Number(d.P ?? d.priceChangePercent ?? 0);
      setTicker(map.sym, last, pct);
    }catch(_){}
  };

  priceWS.onclose = () => {
    priceWS = null;
    wsReconnectTimer = setTimeout(openPriceStream, 3000);
  };
  priceWS.onerror = () => { try{ priceWS.close(); }catch(_){ } };
}
function startLiveTicker(){
  buildTickerTrack();
  fetchInitialPrices();
  openPriceStream();

  if(!tickerResizeHandler){
    tickerResizeHandler = () => buildTickerTrack();
    addEventListener('resize', tickerResizeHandler, { passive:true });
  }
}
function stopLiveTicker(){
  if(tickerResizeHandler){ removeEventListener('resize', tickerResizeHandler); tickerResizeHandler = null; }
  if(priceWS){ try{ priceWS.close(); }catch(_){ } priceWS = null; }
  if(wsReconnectTimer){ clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
}

/* =========================================================================
   Tema Chart.js
   ========================================================================= */
(function setupChartTheme(){
  const linkId="gf-poppins";
  if(!document.getElementById(linkId)){
    const l=document.createElement("link");
    l.id=linkId; l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap";
    document.head.appendChild(l);
  }
  const FAMILY=`Poppins, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;
  if(window.Chart){
    Chart.defaults.font.family=FAMILY;
    Chart.defaults.font.size=12;
    Chart.defaults.color="#e5e7eb";
    Chart.defaults.borderColor="rgba(255,255,255,0.12)";
    Chart.defaults.plugins.legend.labels.color="#e5e7eb";
    Chart.defaults.plugins.legend.labels.font={family:FAMILY,weight:"600"};
    Chart.defaults.plugins.tooltip.titleFont={family:FAMILY,weight:"700"};
    Chart.defaults.plugins.tooltip.bodyFont={family:FAMILY};
  }
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(()=>{ try{
      chartDailyDashboard?.update(); chartDailyReport?.update();
      chartMonthly?.update(); chartByCoin?.update();
      chartPatrimony7d?.update?.();
    }catch(_){}} )
  }
})();

/* =========================================================================
   Altura da topbar -> variável CSS (--topbar-h)
   ========================================================================= */
(function setTopbarVar(){
  const upd = () => {
    const tb = document.querySelector('.topbar');
    const h = tb ? tb.getBoundingClientRect().height : 64;
    document.documentElement.style.setProperty('--topbar-h', h + 'px');
  };
  upd();
  window.addEventListener('resize', upd, { passive:true });
})();

/* =========================================================================
   Sidebar + Roteamento (usa classe .is-active)
   ========================================================================= */
(function sidebarAndRouting(){
  const layout = document.querySelector(".app-layout");
  const btnToggle = document.getElementById("sb-toggle");
  if (layout && btnToggle) {
    const saved = localStorage.getItem("sb-collapsed");
    if (saved === "1") layout.classList.add("sidebar-collapsed");
    btnToggle.addEventListener("click", () => {
      layout.classList.toggle("sidebar-collapsed");
      localStorage.setItem("sb-collapsed",
        layout.classList.contains("sidebar-collapsed") ? "1" : "0");
    });
  }

  const links = [...document.querySelectorAll(".sb-link")];
  const setActive = () => {
    const here = (location.hash || "#dashboard").toLowerCase();
    links.forEach(a =>
      a.classList.toggle("is-active", a.getAttribute("href").toLowerCase() === here)
    );
  };

  const routes = {
    "#inicio":      "route-inicio",
    "#dashboard":   "route-dashboard",
    "#operacoes":   "route-operacoes",
    "#relatorios":  "route-relatorios",
    "#carteiras":   "route-carteiras",
    "#config":      "route-config",
    "#forgot":      "route-forgot", // ✅ NOVO
  };

  const showRoute = () => {
    const hash = (location.hash || "#dashboard").toLowerCase();
    const id   = routes[hash] || "route-dashboard";
    console.log("[dbg] showRoute ->", hash, "=>", id);

    document.querySelectorAll(".route").forEach(sec => {
      sec.classList.remove("is-active");
      sec.hidden = true;
      sec.style.display = "none";
    });

    const el = document.getElementById(id);
    if (el) {
      el.classList.add("is-active");
      el.hidden = false;
      el.style.display = "block";
    } else {
      console.warn("[dbg] seção não encontrada:", id);
    }

    setActive();
    window.scrollTo({ top: 0, behavior: "instant" });

    if (hash === "#inicio") startInicio();
    else stopInicio();

    // Renderizações só quando os dados já estiverem prontos
    if (hash === "#operacoes") {
      setupOpsToolbar();
      if (DATA_READY) renderOperationsPage();
    }
    if (hash === "#relatorios") {
      if (DATA_READY) renderReportKPIs(__ALL_TRADES__);
      // garante toolbar bycoin ligada ao seu HTML (btn-bycoin-top/bottom)
      initByCoinToolbar();
    }
  };

  window.addEventListener("hashchange", showRoute);
  if (!location.hash) location.hash = "#dashboard";
  showRoute();

  const logoutSide = document.getElementById("logout-side");
  const logoutTop  = document.getElementById("logout");
  const doLogout = async () => { await sb.auth.signOut(); window.location.href = "index.html"; };
  if (logoutSide) logoutSide.addEventListener("click", doLogout);
  if (logoutTop)  logoutTop.addEventListener("click", doLogout);
})();

/* =========================================================================
   Utils / Charts / Tables / Wallet
   ========================================================================= */
// ====== FORMATADORES (somente "$") ======
const USD2 = new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 });
const USD4 = new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD', minimumFractionDigits:4, maximumFractionDigits:4 });
const round4 = (n)=> Math.round(Number(n||0)*1e4)/1e4;
const fmtUSDT2 = (n)=> USD2.format(Number(n||0));        // 2 casas
const fmtUSDT4 = (n)=> USD4.format(round4(n));           // 4 casas
const fmtUSDT  = fmtUSDT2;                               // alias padrão (2 casas)

const pct      = (n)=>`${Number(n||0).toFixed(2)}%`;
const fmtDate  = (iso)=>new Date(iso).toLocaleDateString("pt-BR");

// <<< Helpers de data e linha automática >>>
function isoFromLocalDate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function lastNDays(n){
  const today=new Date();
  const datesISO=[], labelsBR=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(today); d.setDate(d.getDate()-i);
    datesISO.push(isoFromLocalDate(d));
    labelsBR.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
  }
  return { datesISO, labelsBR };
}
function renderPatrimonyLine(canvasId, labels, values){
  const canvas=document.getElementById(canvasId);
  if(!canvas) return null;
  const ctx=canvas.getContext('2d');

  const gradStroke=ctx.createLinearGradient(0,0,canvas.width,0);
  gradStroke.addColorStop(0,'#b79aff');
  gradStroke.addColorStop(1,'#7c3aed');

  const gradFill=ctx.createLinearGradient(0,0,0,canvas.height);
  gradFill.addColorStop(0,'rgba(124,58,237,0.25)');
  gradFill.addColorStop(1,'rgba(124,58,237,0.02)');

  const nums=values.filter(v=>Number.isFinite(v));
  const minV=Math.min(...nums), maxV=Math.max(...nums);
  const pad=Math.max(50,(maxV-minV||1)*0.05);

  return new Chart(ctx,{
    type:'line',
    data:{ labels, datasets:[{
      label:'Patrimônio',
      data:values,
      borderColor:gradStroke,
      backgroundColor:gradFill,
      borderWidth:2,
      pointRadius:0,
      tension:0.25,
      fill:true
    }]},
    options:{
      responsive:true, maintainAspectRatio:false, animation:{duration:700},
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{
        label:(ctx)=>`Patrimônio: ${fmtUSDT(ctx.parsed.y)}`
      }}} ,
      scales:{
        x:{ grid:{display:false,drawBorder:false,drawTicks:false},
            ticks:{color:'#e5e7eb',font:{weight:600}} },
        y:{ grid:{color:'rgba(255,255,255,.08)',drawBorder:false,drawTicks:false},
            ticks:{ color:'#cbd5e1', callback:(v)=>fmtUSDT(v) },
            suggestedMin:minV-pad, suggestedMax:maxV+pad }
      }
    }
  });
}
function buildAutoPatrimonySeries(initialValue, dailyRaw, last7ISO){
  const days=Object.keys(dailyRaw).sort(); // 'YYYY-MM-DD'
  let acc=Number(initialValue||0);
  const mapAcc={};
  days.forEach(d=>{ acc += Number(dailyRaw[d]||0); mapAcc[d]=acc; });

  const out=[]; let carry=Number(initialValue||0);
  last7ISO.forEach(d=>{
    if(d in mapAcc) carry=mapAcc[d];
    out.push(carry);
  });
  return out;
}

function animateNumber(el, start, end, duration, fmtFn){
  if(!el) return;
  const s=Number(start||0), e=Number(end||0);
  if(!isFinite(s) || !isFinite(e)) { el.textContent = fmtFn(e); return; }
  const t0=performance.now();
  const ease=x=>1-Math.cos((x*Math.PI)/2);
  function frame(now){
    const p=Math.min((now - t0)/duration, 1);
    const val=s + (e - s) * ease(p);
    el.textContent = fmtFn(val);
    if(p<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

let chartDailyDashboard=null, chartDailyReport=null, chartMonthly=null, chartByCoin=null;
let chartPatrimony7d=null;
let __PATRIMONIO_ATUAL = null;

/* ========= Atualizador do Valor Patrimonial ========= */
function setValorPatrimonial(rawValue){
  const el =
    document.getElementById("valor-patrimonial") ||
    document.getElementById("vp-number") ||
    document.getElementById("vp-hero");
  if(!el) return;

  const start = parseFloat(el.dataset.val || "0") || 0;
  const end   = Number(rawValue || 0);

  const fmt = (v) => (Number(v)||0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const t0 = performance.now();
  const dur = 1200;
  const ease = x => 1 - Math.cos((x*Math.PI)/2);

  function frame(now){
    const p = Math.min((now - t0)/dur, 1);
    const val = start + (end - start) * ease(p);
    el.textContent = fmt(val);
    if(p < 1) requestAnimationFrame(frame);
  }
  el.dataset.val = String(end);
  requestAnimationFrame(frame);
}

function setMetricValue(id, raw, type){
  const el=document.getElementById(id); if(!el) return;
  const fmt = type==="percent" ? (v)=>pct(v) : (v)=>fmtUSDT(v);
  const currentText=el.textContent||"0";
  let start=0;
  if(type==="percent" && currentText.includes("%")) {
    start=parseFloat(currentText);
  }
  if(type==="currency"){
    const clean = currentText.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    start = parseFloat(clean) || 0;
  }
  animateNumber(el, start, Number(raw||0), 1200, fmt);
}
function setDelta(deltaSel, delta){
  const el=document.getElementById(deltaSel); if(!el) return;
  if(delta==null || isNaN(delta)){ el.textContent=""; el.className="delta"; return; }
  const cls = delta>=0 ? "up" : "down";
  el.className = "delta "+cls;
  el.textContent = `${delta>=0?"+":""}${Number(delta).toFixed(2)}%`;
}

// ===== Helpers de seta nos KPIs =====
function ensureKpiArrow(valueId, arrowId){
  const host = document.getElementById(valueId);
  if (!host) return;

  host.style.display = 'inline-flex';
  host.style.alignItems = 'baseline';
  host.style.gap = '6px';

  if (document.getElementById(arrowId)) return;

  const span = document.createElement('span');
  span.id = arrowId;
  span.className = 'kpi-arrow';
  span.textContent = '';
  host.insertAdjacentElement('afterend', span);
}
function setKpiArrow(arrowId, kind){
  const el = document.getElementById(arrowId);
  if (!el) return;
  el.className = 'kpi-arrow';
  el.style.color = '';

  switch(kind){
    case 'up-green':  el.textContent = '▲'; el.classList.add('up','green');  el.style.color = '#22c55e'; break;
    case 'up-red':    el.textContent = '▲'; el.classList.add('up','red');    el.style.color = '#ef4444'; break;
    case 'down-red':  el.textContent = '▼'; el.classList.add('down','red');  el.style.color = '#ef4444'; break;
    case 'down-green':el.textContent = '▼'; el.classList.add('down','green');el.style.color = '#22c55e'; break;
    default:          el.textContent = ''; break;
  }
}

/* ========= Normalização de ativos ========= */
function normalizeTicker(raw){
  if(!raw) return null;
  let s=String(raw).trim().toUpperCase();
  s=s.replace(/[.\-_/]/g," ").replace(/\s+/g," ").trim();
  const synonyms={"BITCOIN":"BTC","ETHEREUM":"ETH","RIPPLE":"XRP","SOLANA":"SOL","DOGECOIN":"DOGE","CARDANO":"ADA","POLYGON":"MATIC"};
  if(synonyms[s]) return synonyms[s];
  const parts=s.split(" "); let token=parts[parts.length-1];
  token=token.replace(/(USDT|USD|BRL)$/,"");
  if(!token && parts.length>1){ token=parts[parts.length-2].replace(/(USDT|USD|BRL)$/,""); }
  if(!token && parts.length){ token=parts[0]; }
  token=token.replace(/[^A-Z0-9]/g,"");
  if(!token || token.length<2) return null;
  if(synonyms[token]) return synonyms[token];
  return token;
}
function extractAsset(operacao, ativo){
  const fromOp=normalizeTicker(operacao); if(fromOp) return fromOp;
  const fromAtivo=normalizeTicker(ativo); if(fromAtivo) return fromAtivo;
  return null;
}

/* ===== Gráficos ===== */
function buildChart(canvasId, label, dataObj) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const labels = Object.keys(dataObj || {});
  const values = Object.values(dataObj || {}).map(Number);

  const HEX_POS = "#7c3aed";
  const HEX_NEG = "#ff4db8";

  const minVal = values.length ? Math.min(...values, 0) : 0;
  const maxVal = values.length ? Math.max(...values, 0) : 0;
  const bottomPad = minVal < 0 ? Math.max(100, Math.abs(minVal) * 0.5) : 0;
  const topPad    = maxVal > 0 ? Math.max(100, maxVal * 0.05) : 0;

  const ctx = canvas.getContext("2d");

  function barGradient(sctx) {
    try {
      const chart = sctx?.chart;
      const parsed = sctx?.parsed;
      const v = Number(parsed?.y ?? parsed ?? NaN);
      const scaleY = chart?.scales?.y;
      if (!scaleY || !Number.isFinite(v)) return HEX_POS;

      const yZero = scaleY.getPixelForValue(0);
      const yVal  = scaleY.getPixelForValue(v);
      if (!Number.isFinite(yZero) || !Number.isFinite(yVal)) return HEX_POS;

      let yTop = Math.min(yZero, yVal);
      let yBottom = Math.max(yZero, yVal);
      if (Math.abs(yBottom - yTop) < 0.001) yBottom = yTop + 0.001;

      const g = chart.ctx.createLinearGradient(0, yTop, 0, yBottom);
      g.addColorStop(0, HEX_POS);
      g.addColorStop(1, HEX_NEG);
      return g;
    } catch {
      return HEX_POS;
    }
  }

  const isMobile = window.innerWidth <= 768;

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        borderWidth: 0,
        borderRadius: 6,

        /* ===== Ajuste para Mobile ===== */
        barThickness: isMobile ? 14 : 40,        // ✅ mais fina
        maxBarThickness: isMobile ? 22 : 64,
        categoryPercentage: isMobile ? 0.55 : 0.82,

        backgroundColor: barGradient,
        hoverBackgroundColor: barGradient,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${fmtUSDT(ctx.parsed.y ?? ctx.parsed)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display:false, drawBorder:false, drawTicks:false },
          ticks:{ color:"#e5e7eb", font:{ weight:600 } }
        },
        y: {
          grid:{ color:"rgba(255,255,255,.08)", drawBorder:false, drawTicks:false },
          ticks:{
            color:"#cbd5e1",
            callback: (v) => fmtUSDT(v)
          },
          suggestedMin: minVal - bottomPad,
          suggestedMax: maxVal + topPad
        }
      }
    }
  });
}

/* ===== Sparkline Patrimonial ===== */
const SPARK_IDS = ["sparkline-patrimonio", "hero-spark", "spark-vp"];
function getSparkCanvas(){
  for(const id of SPARK_IDS){
    const el = document.getElementById(id);
    if(el) return el;
  }
  return null;
}
function drawSparkline(values){
  const canvas = getSparkCanvas();
  if(!canvas || !values || values.length < 2) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 520;
  const cssH = canvas.clientHeight || 96;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,cssW,cssH);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 6;
  const W = cssW - pad*2;
  const H = cssH - pad*2;
  const n = values.length;

  const x = (i)=> pad + (i/(n-1))*W;
  const y = (v)=> pad + (1 - (v - min)/(max - min || 1))*H;

  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap  = "round";

  const grad = ctx.createLinearGradient(0,0,cssW,0);
  grad.addColorStop(0, "#b79aff");
  grad.addColorStop(1, "#9b5cff");

  ctx.shadowColor = "rgba(155,92,255,0.35)";
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = grad;

  ctx.beginPath();
  ctx.moveTo(x(0), y(values[0]));
  for(let i=1;i<n;i++) ctx.lineTo(x(i), y(values[i]));
  ctx.stroke();

  const tail = Math.max(3, Math.round(n*0.35));
  const s = n - tail;
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(x(s), y(values[s]));
  for(let i=s+1;i<n;i++) ctx.lineTo(x(i), y(values[i]));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ==================== Tabelas (Operações) ==================== */
function renderTradesSummary(trades){
  const tbody=document.getElementById("tbody-trades"); if(!tbody) return;
  tbody.innerHTML="";
  (trades||[]).slice(0,8).forEach(t=>{
    const lucroNum=Number(t.lucro||0);
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${fmtDate(t.data)}</td>
      <td>${t.operacao||"-"}</td>
      <td class="${lucroNum>=0?"profit-pos":"profit-neg"}">${fmtUSDT4(lucroNum)}</td>
    `;
    tbody.appendChild(tr);
  });
}
function renderTradesFull(trades){
  const tbody=document.getElementById("tbody-trades-full"); if(!tbody) return;
  tbody.innerHTML="";
  (trades||[]).forEach(t=>{
    const lucroNum=Number(t.lucro||0);
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${fmtDate(t.data)}</td>
      <td>${t.operacao||"-"}</td>
      <td>${normalizeTicker(t.ativo) || extractAsset(t.operacao, t.ativo) || "-"}</td>
      <td class="${lucroNum>=0?"profit-pos":"profit-neg"}">${fmtUSDT4(lucroNum)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ======== FILTROS DE OPERAÇÕES — toolbar #ops-toolbar ======== */
const OPS_FILTER = { range: 'all', side: 'all' };

function applyOpsFilter(trades){
  const now = new Date(); now.setHours(0,0,0,0);
  let fromDate = null;

  if (OPS_FILTER.range !== 'all'){
    const days = Number(OPS_FILTER.range || 0);
    fromDate = new Date(now);
    fromDate.setDate(now.getDate() - (days - 1));
  }

  return (trades||[]).filter(t=>{
    if (fromDate){
      const d = new Date(t.data); d.setHours(0,0,0,0);
      if (d < fromDate || d > now) return false;
    }
    if (OPS_FILTER.side !== 'all'){
      const op = String(t.operacao||'').toUpperCase();
      const isLong  = op.startsWith('LONG');
      const isShort = op.startsWith('SHORT');
      if (OPS_FILTER.side === 'LONG'  && !isLong)  return false;
      if (OPS_FILTER.side === 'SHORT' && !isShort) return false;
    }
    return true;
  }).sort((a,b)=> new Date(b.data) - new Date(a.data));
}
function renderOperationsPage(){
  const rows = applyOpsFilter(__ALL_TRADES__);
  renderTradesFull(rows);
}
function setupOpsToolbar(){
  const toolbar = document.getElementById('ops-toolbar');
  if (!toolbar || toolbar.dataset.ready === '1') return;

  toolbar.querySelectorAll('[data-range]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      toolbar.querySelectorAll('[data-range]').forEach(b=>b.classList.remove('is-active'));
      btn.classList.add('is-active');
      OPS_FILTER.range = btn.dataset.range;
      renderOperationsPage();
    });
  });

  toolbar.querySelectorAll('[data-side]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      toolbar.querySelectorAll('[data-side]').forEach(b=>b.classList.remove('is-active'));
      btn.classList.add('is-active');
      OPS_FILTER.side = btn.dataset.side;
      renderOperationsPage();
    });
  });

  toolbar.dataset.ready = '1';
}

/* ==================== KPIs do RELATÓRIO (com setas) ==================== */
// P&L = só HOJE; N trades / ganhos / perdidos / win rate = TODO O HISTÓRICO
function renderReportKPIs(trades){
  const elPNL = document.getElementById('rlt-pl-hoje');
  const elN   = document.getElementById('rlt-ntrades');
  const elW   = document.getElementById('rlt-wins');
  const elL   = document.getElementById('rlt-losses');
  const elWR  = document.getElementById('rlt-winrate');
  if (!elPNL || !elN || !elW || !elL || !elWR) return;

  ensureKpiArrow('rlt-pl-hoje',  'rlt-pl-arrow');
  ensureKpiArrow('rlt-wins',     'rlt-wins-arrow');
  ensureKpiArrow('rlt-losses',   'rlt-losses-arrow');
  ensureKpiArrow('rlt-winrate',  'rlt-win-arrow');

  const start = new Date(); start.setHours(0,0,0,0);
  const end   = new Date(start); end.setDate(start.getDate() + 1);
  const rows = (trades||[]).slice().sort((a,b)=> new Date(a.data) - new Date(b.data));

  let total = 0, wins = 0, losses = 0;
  rows.forEach(t=>{
    const l = Number(t.lucro||0);
    if (!Number.isFinite(l)) return;
    total++;
    if (l > 0) wins++;
    else if (l < 0) losses++;
  });
  const wrAll = total ? (wins/total)*100 : 0;

  let pnlToday = 0;
  rows.forEach(t=>{
    const d = new Date(t.data);
    if (d >= start && d < end) pnlToday += Number(t.lucro||0);
  });

  const last = rows[rows.length-1] || null;
  const lastLucro = Number(last?.lucro || 0);
  const lastDate  = last ? new Date(last.data) : null;
  const lastIsToday = lastDate ? (lastDate >= start && lastDate < end) : false;

  let wrBefore = wrAll, wrAfter = wrAll, wrDelta = 0;
  if (last){
    const beforeTotal = Math.max(0, total - 1);
    const beforeWins  = lastLucro > 0 ? Math.max(0, wins - 1) : wins;
    wrBefore = beforeTotal ? (beforeWins / beforeTotal) * 100 : 0;
    wrAfter  = wrAll;
    wrDelta  = wrAfter - wrBefore;
  }

  elPNL.textContent = fmtUSDT(pnlToday);
  elN.textContent   = String(total);
  elW.textContent   = String(wins);
  elL.textContent   = String(losses);
  elWR.textContent  = pct(wrAll);

  if (last && lastIsToday){
    setKpiArrow('rlt-pl-arrow', lastLucro > 0 ? 'up-green' : (lastLucro < 0 ? 'down-red' : 'none'));
  }else{
    setKpiArrow('rlt-pl-arrow', 'none');
  }
  setKpiArrow('rlt-wins-arrow',   lastLucro > 0 ? 'up-green' : 'none');
  setKpiArrow('rlt-losses-arrow', lastLucro < 0 ? 'up-red'   : 'none');

  if (wrDelta > 0)      setKpiArrow('rlt-win-arrow', 'up-green');
  else if (wrDelta < 0) setKpiArrow('rlt-win-arrow', 'down-red');
  else                  setKpiArrow('rlt-win-arrow', 'none');
}

/* ==================== Carteiras ==================== */
function renderMoneyRows(tbodyId, rows){
  const tbody=document.getElementById(tbodyId); if(!tbody) return;
  if(!rows || !rows.length){
    tbody.innerHTML=`<tr><td colspan="2" class="muted">Sem registros.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r =>
    `<tr><td>${fmtDate(r.data)}</td><td>${fmtUSDT2(Number(r.valor||0))}</td></tr>`
  ).join("");
}

/* =========================================================================
   ✅ NOVO (NÃO REMOVE NADA): soma depósitos/saques para entrar no Patrimônio
   ========================================================================= */
async function sumWalletTable(tableName, userId){
  const { data, error } = await sb
    .from(tableName)
    .select("valor")
    .eq("user_id", userId)
    .limit(10000);

  if (error) throw error;

  return (data || []).reduce((s, r) => s + Number(r.valor || 0), 0);
}
async function getNetFlows(userId){
  const deposits = await sumWalletTable("wallet_deposits", userId);
  const withdrawals = await sumWalletTable("wallet_withdrawals", userId);
  return { deposits, withdrawals, net: deposits - withdrawals };
}

async function loadWallet(user){
  try{
    const { data: m } = await sb.from("metrics")
      .select("valor_inicial, valor_patrimonial")
      .eq("user_id", user.id).maybeSingle();
    const ini = m?.valor_inicial ?? 0;
    const pat = m?.valor_patrimonial ?? 0;
    setMetricValue("wl-inicial", ini, "currency");
    setMetricValue("wl-patrimonial", pat, "currency");

    if(Number.isFinite(__PATRIMONIO_ATUAL)){
      setMetricValue("wl-patrimonial", __PATRIMONIO_ATUAL, "currency");
    }

    const { data: deps } = await sb.from("wallet_deposits")
      .select("data, valor").eq("user_id", user.id)
      .order("data", { ascending:false }).limit(100);
    renderMoneyRows("tbody-depositos", deps||[]);

    const { data: saqs } = await sb.from("wallet_withdrawals")
      .select("data, valor").eq("user_id", user.id)
      .order("data", { ascending:false }).limit(100);
    renderMoneyRows("tbody-saques", saqs||[]);
  }catch(e){
    console.warn("[dbg] loadWallet error:", e);
    setMetricValue("wl-inicial", 0, "currency");
    setMetricValue("wl-patrimonial", 0, "currency");
    renderMoneyRows("tbody-depositos", []);
    renderMoneyRows("tbody-saques", []);
  }
}

/* ===== Helpers p/ cálculo mensal e acertividade a partir dos trades ===== */
function calcWinrateAll(trades){
  let wins=0, total=0;
  (trades||[]).forEach(t=>{
    const l=Number(t.lucro||0);
    if(!Number.isFinite(l)) return;
    if(l>0) wins++;
    total++;
  });
  return total? (wins/total)*100 : 0;
}

/* ======= FILTRO "MAIS POSITIVAS / MAIS NEGATIVAS" (12 moedas) ======= */
let __BYCOIN_ALL__ = {};
let __COIN_FILTER__ = 'top';

function top12Coins(data, mode='top'){
  const arr = Object.entries(data || {});
  if(!arr.length) return {};

  arr.sort((a,b)=> (mode==='top' ? b[1]-a[1] : a[1]-b[1]));
  const sliced = arr.slice(0,12);

  const out = {};
  sliced.forEach(([k,v]) => out[k]=v);
  return out;
}

function redrawByCoinChart(){
  const filtered = top12Coins(__BYCOIN_ALL__, __COIN_FILTER__);
  chartByCoin?.destroy();
  chartByCoin = buildChart("chart-lucro-moeda","Lucro por moeda ($)", filtered);
  chartByCoin?.update();
}

/* ✅ NOVO: usar seus botões do HTML (btn-bycoin-top / btn-bycoin-bottom),
   sem criar wrap absoluto (isso era o que estava sobrepondo). */
function initByCoinToolbar(){
  const btnTop = document.getElementById("btn-bycoin-top");
  const btnBot = document.getElementById("btn-bycoin-bottom");
  if(!btnTop || !btnBot) return;

  if(btnTop.dataset.bound === "1") return; // evita duplicar listeners

  const activate = (mode)=>{
    __COIN_FILTER__ = mode;
    btnTop.classList.toggle("is-active", mode === "top");
    btnBot.classList.toggle("is-active", mode === "bottom");
    redrawByCoinChart();
  };

  btnTop.addEventListener("click", ()=> activate("top"));
  btnBot.addEventListener("click", ()=> activate("bottom"));

  btnTop.dataset.bound = "1";
  btnBot.dataset.bound = "1";
}

/* ===== Load Data ===== */
function toLocalISODate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

async function loadData(user){
  try{
    const { data:mRows }=await sb.from("metrics")
      .select("valor_inicial, valor_patrimonial, lucro_mensal_pct, acertividade")
      .eq("user_id",user.id).limit(1);
    const { data:tRows }=await sb.from("trades").select("*")
      .eq("user_id",user.id).order("data",{ascending:false}).limit(500);

    const m=mRows?.[0]||{valor_inicial:0,valor_patrimonial:0,lucro_mensal_pct:0,acertividade:0};
    const trades=tRows||[];

    // --- Lucros agregados por dia
    const dailyRaw={};
    trades.forEach(r=>{
      const d=new Date(r.data);
      const iso=toLocalISODate(d);
      dailyRaw[iso]=(dailyRaw[iso]||0)+Number(r.lucro||0);
    });

    // ==========================================================
    // ✅ ATUALIZADO (NÃO REMOVE NADA): trades + depósitos - saques
    // ==========================================================
    const totalLucro = trades.reduce((s,r)=>s + Number(r.lucro||0), 0);
    const flows = await getNetFlows(user.id); // { deposits, withdrawals, net }

    const patrAutomatico =
      Number(m.valor_inicial || 0) +
      totalLucro +
      Number(flows.net || 0);

    __PATRIMONIO_ATUAL = patrAutomatico;
    setValorPatrimonial(patrAutomatico);

    // KPIs
    const wrAll = calcWinrateAll(trades);

    // Lucro Mensal (%) SEMPRE manual (Admin -> metrics.lucro_mensal_pct)
    setMetricValue("lucro-mensal", m.lucro_mensal_pct || 0, "percent");

    // Acertatividade (%) automática pelos trades (fallback p/ metrics se não houver)
    setMetricValue("acertividade", trades.length ? wrAll : (m.acertividade || 0), "percent");

    setDelta("vp-delta", null);
    setDelta("lm-delta", null);
    setDelta("ac-delta", null);

    // Tabelas
    renderTradesSummary(trades);
    __ALL_TRADES__ = trades.slice();   // cache global
    if ((location.hash || '#dashboard').toLowerCase() === '#operacoes') {
      renderOperationsPage();
    } else {
      renderTradesFull(trades);
    }

    // KPIs do Relatório
    renderReportKPIs(trades);

    // Sparkline (cumulativo a partir do inicial)
    const initial = Number(m.valor_inicial || 0);
    const days = Object.keys(dailyRaw).sort();
    const patrSeries = [];
    let acc = initial;
    days.forEach(d=>{
      acc += Number(dailyRaw[d]||0);
      patrSeries.push(acc);
    });
    if(patrSeries.length === 0){
      const current = patrAutomatico;
      patrSeries.push(current * 0.98, current * 1.02, current);
    }
    drawSparkline(patrSeries.slice(-40));

    // Gráficos: diário / mensal
    const dailyOrdered={};
    Object.keys(dailyRaw).sort().forEach(iso=>{
      const [Y,M,D]=iso.split("-").map(Number);
      const label=new Date(Y,M-1,D).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
      dailyOrdered[label]=dailyRaw[iso];
    });
    const dailyLast7=Object.fromEntries(Object.entries(dailyOrdered).slice(-7));

    const monthlyRaw={};
    trades.forEach(r=>{
      const d=new Date(r.data);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      monthlyRaw[key]=(monthlyRaw[key]||0)+Number(r.lucro||0);
    });
    const monthly={};
    Object.keys(monthlyRaw)
      .sort((a,b)=>{
        const [ay,am]=a.split("-").map(Number);
        const [by,bm]=b.split("-").map(Number);
        return ay!==by?ay-by:am-bm;
      })
      .forEach(k=>monthly[k]=monthlyRaw[k]);

    // Gráfico por moeda: guarda o mapa completo
    const byCoinRaw={};
    trades.forEach(r=>{
      const sym=extractAsset(r.operacao, r.ativo);
      if(!sym){ byCoinRaw["OUTRO"]=(byCoinRaw["OUTRO"]||0)+Number(r.lucro||0); }
      else{ byCoinRaw[sym]=(byCoinRaw[sym]||0)+Number(r.lucro||0); }
    });
    __BYCOIN_ALL__ = byCoinRaw;

    chartDailyDashboard?.destroy();
    chartDailyReport?.destroy();
    chartMonthly?.destroy();
    chartByCoin?.destroy();

    chartDailyDashboard=buildChart("chart-lucro-dashboard","Lucro diário ($)",dailyLast7);
    chartDailyReport   =buildChart("chart-lucro-dia","Lucro diário ($)",dailyLast7);
    chartMonthly       =buildChart("chart-lucro-mensal","Lucro mensal ($)",monthly);

    // ✅ Toolbar bycoin do seu HTML + render inicial
    initByCoinToolbar();
    __COIN_FILTER__ = 'top';
    redrawByCoinChart();

    // Linha patrimonial (7d), se existir
    const canvasLine = document.getElementById('chart-patrimonio-7d');
    if (canvasLine){
      const { datesISO:last7ISO, labelsBR:last7Labels } = lastNDays(7);
      const patr7 = buildAutoPatrimonySeries(initial, dailyRaw, last7ISO);
      chartPatrimony7d?.destroy();
      chartPatrimony7d = renderPatrimonyLine('chart-patrimonio-7d', last7Labels, patr7);
    }

    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(()=> {
        chartDailyDashboard?.update();
        chartDailyReport?.update();
        chartMonthly?.update();
        chartByCoin?.update();
        chartPatrimony7d?.update?.();
      });
    }

    DATA_READY = true;

    if((location.hash||"#dashboard") === "#inicio") startInicio();

  }catch(e){
    console.error("[dbg] loadData error:", e);
    setValorPatrimonial(0);
    drawSparkline([0,0,0]);
    setMetricValue("lucro-mensal",0,"percent");
    setMetricValue("acertividade",0,"percent");
    renderTradesSummary([]); renderTradesFull([]);
  }
}

/* =========================================================================
   Liga/Desliga da rota INÍCIO
   ========================================================================= */
function startInicio() {
  const fieldEl = document.getElementById("pct-field");
  if (fieldEl) {
    if (!neonField) neonField = new PercentField(fieldEl, NEON_CFG);
    neonField.start();
  }
  startLiveTicker();
}
function stopInicio() {
  try { neonField?.stop(); } catch (_) {}
  stopLiveTicker();
}

/* =========================================================================
   Init
   ========================================================================= */
(async()=>{
  const { data:{user} } = await sb.auth.getUser();
  if(!user){ window.location.href="index.html"; return; }
  const el=document.getElementById("user-email"); if(el) el.textContent=user.email||"";

  try{
    const { data:prof }=await sb.from("profiles").select("user_id,is_admin").eq("user_id",user.id).maybeSingle();
    if(prof?.is_admin){
      const btn=document.getElementById("btn-admin");
      const link=document.querySelector(".only-admin");
      if(btn) btn.style.display="inline-block";
      if(link) link.style.display="flex";

      /* ============================================================
         ✅ FIX: botão Admin deve abrir admin.html (não rota/hash)
         Colocado aqui para bindar só quando for admin.
         ============================================================ */
      (function bindAdminButton(){
        const btnAdmin =
          document.getElementById("btn-admin") ||
          document.querySelector(".only-admin");

        if (!btnAdmin) return;

        // evita bind duplicado se o script for recarregado
        if (btnAdmin.dataset.boundAdmin === "1") return;
        btnAdmin.dataset.boundAdmin = "1";

        btnAdmin.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = "admin.html";
        }, { passive:false });
      })();
      /* ============================================================ */
    }
  }catch(e){ console.warn("[dbg] admin check:", e); }

  await loadData(user);
  await loadWallet(user);

  /* ================== SETTINGS (Config) ================== */
  (function initSettings(){
    const root = document.documentElement;

    const getFlag  = (k, d=false)=> (localStorage.getItem(k) ?? (d?"1":"0")) === "1";
    const setFlag  = (k, v)=> localStorage.setItem(k, v ? "1" : "0");

    const elEmail   = document.getElementById("cfg-email");
    const elAdminF  = document.getElementById("cfg-admin-flag");
    const elAdminT  = document.getElementById("cfg-admin-tag");
    const swMotion  = document.getElementById("sw-reduced-motion");
    const swCompact = document.getElementById("sw-compact");
    const swTicker  = document.getElementById("sw-ticker");
    const swDigest  = document.getElementById("sw-digest");
    const swAlerts  = document.getElementById("sw-alerts");
    const btnLogout = document.getElementById("btn-logout-cfg");
    const feedback  = document.getElementById("cfg-feedback");
    const btnSend   = document.getElementById("btn-enviar-feedback");
    const btnClear  = document.getElementById("btn-limpar-feedback");

    (async () => {
      try {
        const { data:{ user } } = await sb.auth.getUser();
        if (user) {
          if (elEmail) elEmail.textContent = user.email || "—";
          const { data:prof } = await sb.from("profiles")
            .select("is_admin").eq("user_id", user.id).maybeSingle();
          const isAdm = !!prof?.is_admin;
          if (elAdminF) elAdminF.textContent = isAdm ? "Sim" : "Não";
          if (elAdminT) {
            elAdminT.textContent = isAdm ? "ADMIN" : "USER";
            elAdminT.style.background = isAdm ? "rgba(16,185,129,.18)" : "rgba(124,58,237,.18)";
            elAdminT.style.color = isAdm ? "#c7fde8" : "#e3d9ff";
          }
        }
      } catch {}
    })();

    const prefMotion  = getFlag("pref-reduced-motion", false);
    const prefCompact = getFlag("pref-compact", false);
    const prefTicker  = getFlag("pref-home-ticker", true);
    const prefDigest  = getFlag("pref-email-digest", false);
    const prefAlerts  = getFlag("pref-alerts", false);

    if (swMotion)  swMotion.checked  = prefMotion;
    if (swCompact) swCompact.checked = prefCompact;
    if (swTicker)  swTicker.checked  = prefTicker;
    if (swDigest)  swDigest.checked  = prefDigest;
    if (swAlerts)  swAlerts.checked  = prefAlerts;

    const applyCompact = (on)=> root.classList.toggle("compact", !!on);
    const applyMotion = (off)=> {
      document.body.style.setProperty("--anim-off", off ? "paused" : "running");
      try { if (off) stopInicio(); else if ((location.hash||"").toLowerCase()==="#inicio") startInicio(); } catch {}
    };

    applyCompact(prefCompact);
    applyMotion(prefMotion);

    swCompact?.addEventListener("change", e=>{
      setFlag("pref-compact", e.target.checked);
      applyCompact(e.target.checked);
    });
    swMotion?.addEventListener("change", e=>{
      setFlag("pref-reduced-motion", e.target.checked);
      applyMotion(e.target.checked);
    });
    swTicker?.addEventListener("change", e=>{
      setFlag("pref-home-ticker", e.target.checked);
      if ((location.hash||"").toLowerCase() === "#inicio") {
        e.target.checked ? startLiveTicker() : stopLiveTicker();
      }
    });
    swDigest?.addEventListener("change", e=> setFlag("pref-email-digest", e.target.checked));
    swAlerts?.addEventListener("change", e=> setFlag("pref-alerts", e.target.checked));

    btnLogout?.addEventListener("click", async ()=>{
      try { await sb.auth.signOut(); } catch {}
      window.location.href = "index.html";
    });

    btnClear?.addEventListener("click", ()=> feedback && (feedback.value=""));
    btnSend?.addEventListener("click", ()=>{
      const msg = (feedback?.value || "").trim();
      const enc = encodeURIComponent(msg || "Olá! Gostaria de deixar um feedback:");
      window.location.href = `mailto:suporte@presser-investment.com?subject=Feedback do painel&body=${enc}`;
    });
  })();
})();
