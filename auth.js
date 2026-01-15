// ==============================
// Presser Investment — auth.js
// Tabs + Coins (loop real) + scan-line no meio do painel azul
// ==============================

// Tabs
const tabs = document.querySelectorAll(".tab");
const panes = document.querySelectorAll(".pane");
const goSignup = document.getElementById("goSignup");
const goLogin = document.getElementById("goLogin");

function openTab(name){
  tabs.forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  panes.forEach(p => p.classList.toggle("is-active", p.dataset.pane === name));
}

tabs.forEach(t => t.addEventListener("click", () => openTab(t.dataset.tab)));
goSignup?.addEventListener("click", (e) => { e.preventDefault(); openTab("signup"); });
goLogin?.addEventListener("click", (e) => { e.preventDefault(); openTab("login"); });


// ==============================
// COINS — loop + scan-line correta
// ==============================
const marquee = document.querySelector(".coins-marquee");
const track   = marquee?.querySelector(".coins-track");
const row     = document.getElementById("coinRow");
const scan    = marquee?.querySelector(".scan-line");
const leftPanel = document.querySelector(".left");

function restartAnimation(el){
  el.style.animation = "none";
  el.offsetHeight; // reflow
  el.style.animation = "";
}

function setMarqueeDistance(){
  if(!row) return;

  const total = row.scrollWidth;
  const half = Math.max(1, Math.round(total / 2));

  row.style.setProperty("--marquee-distance", `${half}px`);

  const duration = Math.min(80, Math.max(40, Math.round(half / 25)));
  row.style.setProperty("--marquee-duration", `${duration}s`);

  row.classList.add("moving");
  restartAnimation(row);
}

/**
 * Posiciona a scan-line exatamente no meio do painel azul.
 * Importante: se .scan-line for absolute dentro de .coins-marquee,
 * precisamos converter coordenadas de viewport -> coordenadas do marquee.
 */
function setScanToMiddleOfBlue(){
  if(!scan || !leftPanel || !track || !marquee) return;

  const marqueeRect = marquee.getBoundingClientRect();
  const leftRect = leftPanel.getBoundingClientRect();

  // X = meio do painel azul (em coordenada de viewport)
  const xViewport = leftRect.left + (leftRect.width / 2);

  // converte para coordenada interna do marquee
  const xLocal = xViewport - marqueeRect.left;
  scan.style.left = `${xLocal}px`;

  // Y = centro da faixa das moedas (coins-track)
  const trackRect = track.getBoundingClientRect();
  const yViewport = trackRect.top + (trackRect.height / 2);
  const yLocal = yViewport - marqueeRect.top;
  scan.style.top = `${yLocal}px`;
}

const coins = row ? Array.from(row.querySelectorAll(".coin")) : [];

/**
 * REVEAL sincronizado:
 * - usa a borda DIREITA da linha (scanRect.right)
 *   para o reveal começar exatamente quando a linha encosta na moeda.
 */
function updateCoinColors(){
  if(!scan || coins.length === 0) return;

  const scanRect = scan.getBoundingClientRect();

  // Use o centro da linha (mais fiel visualmente)
  const scanX = scanRect.left + (scanRect.width / 2);

  coins.forEach((coin) => {
    // mede a área REAL onde o reveal acontece
    const face = coin.querySelector(".coin-face");
    if(!face) return;

    const r = face.getBoundingClientRect();

    // progresso enquanto a linha atravessa a coin-face
    let progress = (scanX - r.left) / Math.max(1, r.width);
    progress = Math.max(0, Math.min(1, progress));

    coin.style.setProperty("--reveal", `${(progress * 100).toFixed(2)}%`);
  });
}

// Loop RAF
let rafId = null;
function loop(){
  updateCoinColors();
  rafId = requestAnimationFrame(loop);
}
function startLoop(){
  if(rafId !== null) return;
  rafId = requestAnimationFrame(loop);
}
function stopLoop(){
  if(rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
}

function initCoins(){
  if(!row) return;

  setScanToMiddleOfBlue();

  setMarqueeDistance();
  requestAnimationFrame(() => {
    setMarqueeDistance();
    updateCoinColors();
  });

  startLoop();
}

window.addEventListener("load", initCoins);

window.addEventListener("resize", () => {
  setScanToMiddleOfBlue();
  setMarqueeDistance();
  updateCoinColors();
});

document.addEventListener("visibilitychange", () => {
  if(document.hidden) stopLoop();
  else startLoop();
});


// ==============================
// Demo submit (trocar pela integração Supabase real)
// ==============================
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginHint = document.getElementById("loginHint");
const signupHint = document.getElementById("signupHint");

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(loginHint) loginHint.textContent = "Validando credenciais...";

  setTimeout(() => {
    if(loginHint) loginHint.textContent = "Login OK. Redirecionando...";
    // window.location.href = "dashboard.html";
  }, 800);
});

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(signupHint) signupHint.textContent = "Criando conta...";

  setTimeout(() => {
    if(signupHint) signupHint.textContent = "Conta criada. Verifique seu e-mail ou faça login.";
    openTab("login");
  }, 900);
});
