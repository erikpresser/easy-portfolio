// === CHAVES DO SEU PROJETO SUPABASE ===
const SUPABASE_URL = "https://dmydhaompvanujvpkngz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteWRoYW9tcHZhbnVqdnBrbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDEzNjUsImV4cCI6MjA3MTMxNzM2NX0.xPxalOxi4PR0z7Jo9m2JodFF4Z8Eiw0U-pAxDMFvvV0";

// Evita quebrar se a lib não carregar
const sb = (window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* =========================
   NAVBAR MOBILE (toggle menu) — ATUALIZADO
   ========================= */
(() => {
  const body = document.body;
  const nav = document.querySelector('.navbar');
  const toggle = document.querySelector('.nav-toggle');
  const overlay = document.querySelector('.nav-overlay');
  const linksWrap = document.querySelector('.nav-links');

  // Se não existir, sai sem quebrar
  if (!toggle || !overlay || !linksWrap) return;

  const isOpen = () => body.classList.contains('nav-open');

  const open = () => {
    body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  const toggleMenu = () => (isOpen() ? close() : open());

  // Botão hamburguer abre/fecha
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Clicar no overlay fecha
  overlay.addEventListener('click', close);

  // Clicou em "Quem Somos / Estratégia / Contato" -> fecha
  linksWrap.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', close);
  });

  // ESC fecha
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Clique fora da navbar fecha (segurança)
  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (nav && !nav.contains(e.target)) close();
  });

  // Se aumentar a tela (desktop), garante que não fica travado aberto
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 901) close();
  });
})();

/* ==============================
   AUTENTICAÇÃO (login/cadastro)
   ============================== */
const modal = document.getElementById("auth-modal");
const btnLogin = document.getElementById("btn-login");
const btnSignup = document.getElementById("btn-signup");
const closeModal = document.getElementById("close-modal");
const form = document.getElementById("auth-form");
const msg = document.getElementById("msg");
const title = document.getElementById("auth-title");
const linkToLogin = document.getElementById("switch-to-login");
const linkToSignup = document.getElementById("switch-to-signup");
const linkForgot = document.getElementById("forgot");

let mode = "login"; // "login" | "signup"

function openModal(newMode){
  mode = newMode;
  if (title) title.textContent = mode === "login" ? "Iniciar Sessão" : "Criar Conta";
  if (msg) msg.textContent = "";
  if (modal) modal.style.display = "flex";
}

// abrir modal
btnLogin?.addEventListener("click", ()=> openModal("login"));
btnSignup?.addEventListener("click", ()=> openModal("signup"));
// trocar modo
linkToLogin?.addEventListener("click", (e)=>{ e.preventDefault(); openModal("login"); });
linkToSignup?.addEventListener("click", (e)=>{ e.preventDefault(); openModal("signup"); });
// fechar
closeModal?.addEventListener("click", ()=> modal.style.display = "none");
window.addEventListener("click", (e)=> { if (e.target === modal) modal.style.display = "none"; });

// login/cadastro
form?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if (!sb) { if (msg) msg.textContent = "Serviço indisponível no momento."; return; }

  if (msg) msg.textContent = "Processando...";
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  try{
    if(mode === "login"){
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (msg) msg.textContent = "Login realizado. Redirecionando...";
      window.location.href = "dashboard.html";
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (msg) msg.textContent = "Conta criada! Verifique seu e-mail para confirmar.";
    }
  }catch(err){
    if (msg) msg.textContent = "Erro: " + (err?.message || 'tente novamente');
  }
});

// esqueci a senha
linkForgot?.addEventListener("click", async (e)=>{
  e.preventDefault();
  if (!sb) { if (msg) msg.textContent = "Serviço indisponível no momento."; return; }

  if (msg) msg.textContent = "Processando...";
  const email = document.getElementById("email")?.value.trim();
  if(!email){ if (msg) msg.textContent = "Digite seu e-mail primeiro."; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if(error) msg.textContent = "Erro: " + error.message;
  else msg.textContent = "Se o e-mail existir, enviaremos instruções de reset.";
});

/* =========================================
   Gauge "Nossos Números" (LEGADO) – no-op seguro
   ========================================= */
(function initNossoNumerosGaugeSVG(){
  const fg   = document.getElementById('g-fg');
  const val  = document.getElementById('nn-gauge-value');
  const card = document.querySelector('.nn-gauge-card');
  if (!fg || !val || !card) return; // se não for este markup, sai

  let raw = parseFloat(card?.getAttribute('data-success'));
  let PCT = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 72;
  val.textContent = `${Math.round(PCT)}%`;

  function setGauge(pct, animate = true){
    if (!Number.isFinite(pct)) pct = 72;
    const total = fg.getTotalLength?.() ?? 0;
    fg.style.strokeDasharray = total;
    const target = total * (1 - pct / 100);

    if (!animate || !total){
      fg.style.strokeDashoffset = target || 0;
      val.textContent = Math.round(pct) + '%';
      return;
    }

    const start = performance.now();
    const duration = 900;
    const fromOffset = total;
    const toOffset   = target;

    function frame(t){
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      fg.style.strokeDashoffset = fromOffset + (toOffset - fromOffset) * eased;
      val.textContent = Math.round(pct * eased) + '%';
      if (p < 1) requestAnimationFrame(frame);
      else val.textContent = Math.round(pct) + '%';
    }
    requestAnimationFrame(frame);
  }

  setGauge(PCT, true);

  if (card && window.ResizeObserver){
    new ResizeObserver(() => setGauge(PCT, false)).observe(card);
  }
})();

/* ======================================================
   Quem Somos v6 — Drag + dots + barra + setas do teclado
   ====================================================== */
(function(){
  const rail = document.getElementById('rail');
  const bar  = document.getElementById('v6-bar');
  const dots = Array.from(document.querySelectorAll('.dots button'));
  const slides = Array.from(document.querySelectorAll('.slide'));
  if(!rail) return;

  /* ===== DRAG-TO-SCROLL ===== */
  let isDown = false, startX = 0, scrollL = 0;
  const start = (x) => { isDown = true; rail.classList.add('dragging'); startX = x; scrollL = rail.scrollLeft; };
  const move  = (x) => { if(!isDown) return; const walk = (x - startX) * 1.1; rail.scrollLeft = scrollL - walk; };
  const end   = () => { isDown = false; rail.classList.remove('dragging'); };

  // mouse
  rail.addEventListener('mousedown', e => { e.preventDefault(); start(e.pageX); });
  rail.addEventListener('mousemove', e => move(e.pageX));
  rail.addEventListener('mouseleave', end);
  rail.addEventListener('mouseup', end);

  // touch
  rail.addEventListener('touchstart', e => start(e.touches[0].pageX), {passive:true});
  rail.addEventListener('touchmove',  e => move(e.touches[0].pageX),  {passive:true});
  rail.addEventListener('touchend', end);

  /* ===== PROGRESS BAR ===== */
  const updateBar = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const pct = max > 0 ? (rail.scrollLeft / max) * 100 : 0;
    if(bar) bar.style.width = `${pct}%`;
  };
  rail.addEventListener('scroll', updateBar);
  window.addEventListener('resize', updateBar);
  requestAnimationFrame(updateBar);

  /* ===== DOTS: clique rola até o slide ===== */
  const byId = id => document.getElementById(id);
  dots.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-target');
      const el = byId(id);
      if(!el) return;
      rail.scrollTo({ left: el.offsetLeft, behavior: 'smooth' });
    });
  });

  /* ===== CENTRAL HIGHLIGHT + DOT ACTIVE ===== */
  const io = new IntersectionObserver((entries) => {
    let best = null;
    entries.forEach(en => {
      if(en.isIntersecting){
        if(!best || en.intersectionRatio > best.intersectionRatio) best = en;
      }
    });
    if(!best) return;
    slides.forEach(s => s.classList.remove('is-center'));
    best.target.classList.add('is-center');

    const id = best.target.id;
    dots.forEach(d => d.classList.toggle('active', d.getAttribute('data-target') === id));
  }, { root: rail, threshold: buildThresholds(10) });

  slides.forEach(s => io.observe(s));
  requestAnimationFrame(()=>{
    slides[0]?.classList.add('is-center');
    dots[0]?.classList.add('active');
  });

  function buildThresholds(n){
    const t = [];
    for(let i=0;i<=n;i++) t.push(i/n);
    return t;
  }

  /* ===== Navegação pelas setas do teclado ===== */
  function getGapPx() {
    const cs = getComputedStyle(rail);
    const g = parseFloat(cs.columnGap || cs.gap || "0");
    return isNaN(g) ? 0 : g;
  }
  function go(delta){
    const w = slides[0]?.clientWidth || 0;
    const step = w + getGapPx();
    rail.scrollBy({ left: delta * step, behavior: 'smooth' });
  }
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight') go(+1);
    if (e.key === 'ArrowLeft')  go(-1);
  });
})();

// COUNTDOWN robusto: aceita ISO, "DD/MM/YYYY HH:mm:ss", "YYYY-MM-DD HH:mm:ss" ou relativo "+10m/+2h/+7d"
(function(){
  const meta = document.getElementById('countdown-end');
  const raw  = meta?.getAttribute('data-end') || '';

  function parseEnd(str){
    if(!str) return null;

    // relativo: +10m, +2h, +7d
    const rel = str.match(/^\+(\d+)\s*(m|h|d)$/i);
    if(rel){
      const n = +rel[1], u = rel[2].toLowerCase();
      const ms = u==='d' ? n*864e5 : u==='h' ? n*36e5 : n*6e4;
      return new Date(Date.now() + ms);
    }

    // ISO: 2025-12-31T23:59:59Z ou com offset
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.test(str)) return new Date(str);

    // "YYYY-MM-DD HH:mm:ss"
    if(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(str)) return new Date(str.replace(' ', 'T'));

    // "DD/MM/YYYY HH:mm:ss" (ou só data)
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if(m){
      const [_, dd, mm, yyyy, HH='23', MM='59', SS='59'] = m;
      return new Date(+yyyy, +mm-1, +dd, +HH, +MM, +SS);
    }
    return null;
  }

  let end = parseEnd(raw);
  if(!end){
    end = new Date(Date.now() + 10*60*1000);
    console.warn('[contador] Data inválida. Usando +10m para teste.');
  }

  const els = {
    d: document.querySelector('[data-unit="days"]'),
    h: document.querySelector('[data-unit="hours"]'),
    m: document.querySelector('[data-unit="minutes"]'),
    s: document.querySelector('[data-unit="seconds"]'),
  };
  const pad = n => String(Math.max(0,n)).padStart(2,'0');

  function tick(){
    const now = new Date();
    let diff = end - now;

    if(diff <= 0){
      if(els.d) els.d.textContent = '0';
      if(els.h) els.h.textContent = '00';
      if(els.m) els.m.textContent = '00';
      if(els.s) els.s.textContent = '00';
      clearInterval(timer);
      return;
    }
    const days = Math.floor(diff/864e5); diff -= days*864e5;
    const hrs  = Math.floor(diff/36e5);  diff -= hrs*36e5;
    const min  = Math.floor(diff/6e4);   diff -= min*6e4;
    const sec  = Math.floor(diff/1e3);

    if(els.d) els.d.textContent = String(days);
    if(els.h) els.h.textContent = pad(hrs);
    if(els.m) els.m.textContent = pad(min);
    if(els.s) els.s.textContent = pad(sec);
  }

  tick();
  const timer = setInterval(tick, 1000);
})();

/* =======================================================
   BLOCO NAVY #nn-pro (Gauge + Sparklines) — ISOLADO/FIX
   ======================================================= */
(() => {
  "use strict";
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  // ===== Gauge (semicírculo) =====
  (function initGauge() {
    const card = document.querySelector("#nn-pro .nn-gauge-card");
    if (!card) return;

    // Valor alvo (%) vem de data-success; fallback 72
    let raw = parseFloat(card.getAttribute("data-success"));
    let targetPct = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 72;

    const valuePath = card.querySelector(".nn-value");
    const ticksG = card.querySelector(".nn-ticks");
    const label = card.querySelector("#nnPct");

    // segurança contra NaN: mostra já o valor inicial
    if (label) label.textContent = `${Math.round(targetPct)}%`;

    // Ticks ao longo do arco (7 divisões)
    const CX = 130, CY = 140, R = 100, DIVS = 7;
    if (ticksG){
      ticksG.innerHTML = "";
      for (let i = 1; i < DIVS; i++) {
        const t = i / DIVS;
        const ang = Math.PI * (1 + t);
        const r1 = R - 8, r2 = R - 2;
        const x1 = CX + r1 * Math.cos(ang);
        const y1 = CY + r1 * Math.sin(ang);
        const x2 = CX + r2 * Math.cos(ang);
        const y2 = CY + r2 * Math.sin(ang);
        const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
        ln.setAttribute("x1", x1.toFixed(1));
        ln.setAttribute("y1", y1.toFixed(1));
        ln.setAttribute("x2", x2.toFixed(1));
        ln.setAttribute("y2", y2.toFixed(1));
        ticksG.appendChild(ln);
      }
    }

    // Comprimento do arco e animação
    if (valuePath){
      const LEN = valuePath.getTotalLength();
      valuePath.style.strokeDasharray = LEN.toFixed(2);
      valuePath.style.strokeDashoffset = LEN.toFixed(2);

      requestAnimationFrame(() => {
        const dash = LEN * (1 - targetPct / 100);
        valuePath.style.strokeDashoffset = dash.toFixed(2);
      });
    }

    // Número central animado
    if (label){
      let start = null;
      const dur = 900;
      (function step(ts) {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / dur);
        label.textContent = Math.round(targetPct * ease(p)) + "%";
        if (p < 1) requestAnimationFrame(step);
      })();
    }

    // Garantia extra contra scripts legados: força 72% se algo sobrescrever
    setTimeout(() => {
      if (label && !/^\d+%$/.test(label.textContent)) label.textContent = '72%';
    }, 50);
  })();

  // ===== Sparklines (mini linhas) — DADOS FIXOS =====
  (function initSparks(){
    const canvases = document.querySelectorAll('#nn-pro .nn-spark');
    if(!canvases.length) return;

    // 4 séries fixas (ordem: Clientes, Volume, Retorno, Win Rate)
    const SPARKS = [
      // CLIENTES ATIVOS
      [42,44,48,49,50,50,52,55,58,57,59,61,60,60,63,66,67,68,70,72,71,73,75,76,77,78,80,79,81,83,84,85,86,88,89,90],
      // VOLUME NEGOCIADO
      [41,45,52,53,55,58,60,62,61,63,65,68,70,72,71,75,75,75,78,80,82,84,83,85,86,88,90,92,93,94,95,96,96,97,98,99],
      // RETORNO MÉDIO
      [55,46,38,57,59,48,41,42,43,44,46,48,49,50,51,55,61,75,66,67,68,60,61,62,63,60,63,65,62,63,61,66,62,63,66,69],
      // WIN RATE
      [63,62,66,63,61,63,59,60,61,60,62,58,64,69,66,67,66,68,69,66,65,67,71,75,76,73,71,66,67,68,69,66,69,71,70,72]
    ];

    canvases.forEach((c,i) => drawSpark(c, SPARKS[i] || SPARKS[0]));

    // Reposiciona os pins quando a janela muda de tamanho
    window.addEventListener('resize', () => {
      canvases.forEach((c)=>{
        const xf = parseFloat(c.dataset.xf || '0');
        const yf = parseFloat(c.dataset.yf || '0');
        if (xf && yf) pinCardValue(c, xf, yf);
      });
    });

    function drawSpark(c, data){
      const ctx = c.getContext('2d');
      const W=c.width, H=c.height;

      ctx.clearRect(0,0,W,H);

      const min = Math.min(...data), max = Math.max(...data);
      const X = j => (j/(data.length-1))*(W-24)+12;
      const Y = v => H - ((v-min)/(max-min))*(H-18) - 9;

      // área
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'rgba(42,168,255,.30)');
      g.addColorStop(1,'rgba(42,168,255,0)');
      ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
      for (let j=1;j<data.length;j++) ctx.lineTo(X(j), Y(data[j]));
      ctx.lineTo(W-12,H-9); ctx.lineTo(12,H-9); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();

      // linha
      ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
      for (let j=1;j<data.length;j++) ctx.lineTo(X(j), Y(data[j]));
      ctx.lineWidth = 2; ctx.strokeStyle = '#2aa8ff'; ctx.stroke();

      // ponto final (verde) + salva coords para o "pin" do valor
      const xf = X(data.length-1), yf = Y(data[data.length-1]);
      ctx.fillStyle='#28ffd3'; ctx.beginPath(); ctx.arc(xf,yf,3,0,Math.PI*2); ctx.fill();
      c.dataset.xf = String(xf);
      c.dataset.yf = String(yf);

      // posiciona o valor exatamente no ponto verde
      pinCardValue(c, xf, yf);
    }

    function pinCardValue(canvas, xCanvas, yCanvas){
      const card  = canvas.closest('.nn-card');
      if(!card) return;
      const valEl = card.querySelector('.nn-card-value');
      if(!valEl) return;

      // vira "pin" (precisa do CSS .nn-card-value.pin)
      valEl.classList.add('pin');

      // converte coordenadas do canvas (internas) para pixels reais do card
      const crect = canvas.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const scaleX = crect.width / canvas.width;
      const scaleY = crect.height / canvas.height;

      const left = (crect.left - cardRect.left) + xCanvas * scaleX;
      const top  = (crect.top  - cardRect.top)  + yCanvas * scaleY;

      valEl.style.left = `${left}px`;
      valEl.style.top  = `${top}px`;
    }
  })();
})();

/* Reveal ao rolar (sem libs) */
const obs = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){ e.target.classList.add('show'); obs.unobserve(e.target); }
  });
},{threshold:.14});

document.querySelectorAll('.why__head, .card, .why__cta').forEach(el=>{
  el.classList.add('reveal');
  obs.observe(el);
});

/* Tilt 3D leve (sem libs) */
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
document.querySelectorAll('[data-tilt]').forEach(card=>{
  let af=null;
  function update(e){
    const r=card.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const x=(e.clientX ?? e.touches?.[0]?.clientX)-cx;
    const y=(e.clientY ?? e.touches?.[0]?.clientY)-cy;
    const rx=clamp((+y/(r.height/2))*6,-8,8);
    const ry=clamp((-x/(r.width/2))*8,-10,10);
    if(!af){
      af=requestAnimationFrame(()=>{
        card.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;
        af=null;
      });
    }
  }
  function reset(){ card.style.transform=''; }
  card.addEventListener('mousemove',update);
  card.addEventListener('mouseleave',reset);
  card.addEventListener('touchmove',update,{passive:true});
  card.addEventListener('touchend',reset);
});

