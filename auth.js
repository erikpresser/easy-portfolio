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
  // força restart do CSS animation (resolve travas)
  el.style.animation = "none";
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight; // reflow
  el.style.animation = "";
}

function setMarqueeDistance(){
  if(!row) return;

  const total = row.scrollWidth;
  const half = Math.max(1, Math.round(total / 2));

  row.style.setProperty("--marquee-distance", `${half}px`);

  // velocidade previsível
  // 40s a 80s, dependendo do tamanho
  const duration = Math.min(80, Math.max(40, Math.round(half / 25)));
  row.style.setProperty("--marquee-duration", `${duration}s`);

  row.classList.add("moving");
  restartAnimation(row);
}

function setScanToMiddleOfBlue(){
  if(!scan || !leftPanel || !track) return;

  // X = meio do painel azul
  const leftRect = leftPanel.getBoundingClientRect();
  const x = leftRect.left + (leftRect.width / 2);
  scan.style.left = `${x}px`;

  // Y = centro da faixa das moedas (coins-track)
  const trackRect = track.getBoundingClientRect();
  const y = trackRect.top + (trackRect.height / 2);
  scan.style.top = `${y}px`;
}


const coins = row ? Array.from(row.querySelectorAll(".coin")) : [];

function updateCoinColors(){
  if(!scan || coins.length === 0) return;

  const scanX = scan.getBoundingClientRect().left;

  coins.forEach((coin) => {
    const r = coin.getBoundingClientRect();

    // Progress 0..1:
    // 0 quando a borda ESQUERDA da moeda encosta na linha (primeiro toque)
    // 1 quando a linha já atravessou a moeda inteira (passou da borda direita)
    const progress = (scanX - r.left) / r.width;
    const clamped = Math.max(0, Math.min(1, progress));

    // passa para o CSS como porcentagem (0%..100%)
    coin.style.setProperty("--reveal", `${(clamped * 100).toFixed(2)}%`);

    // se quiser manter a classe "is-neon" quando terminar 100%
    coin.classList.toggle("is-neon", clamped >= 1);
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

  // recalcula 2x para pegar imagens/laytout estabilizado
  setMarqueeDistance();
  requestAnimationFrame(() => {
    setMarqueeDistance();
    updateCoinColors();
  });

  startLoop();
}

// Quando tudo estiver pronto
window.addEventListener("load", initCoins);

// Recalcula quando redimensiona
window.addEventListener("resize", () => {
  setScanToMiddleOfBlue();
  setMarqueeDistance();
  updateCoinColors();
});

// pausa quando a aba fica escondida
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
