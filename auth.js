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

  // Garantir que imagens carregaram (ou pelo menos layout estabilizou)
  // Distância = metade do scrollWidth (porque você duplicou o bloco)
  const total = row.scrollWidth;
  const half = Math.max(1, Math.round(total / 2));

  row.style.setProperty("--marquee-distance", `${half}px`);

  // Ajuste fino de velocidade: quanto maior a distância, maior o tempo
  // (você pode travar num valor fixo se preferir)
  const duration = Math.max(45, Math.round(half / 35)); // regra simples
  row.style.setProperty("--marquee-duration", `${duration}s`);

  // Garante que a classe moving está aplicada
  row.classList.add("moving");

  restartAnimation(row);
}

function setScanToMiddleOfBlue(){
  if(!scan || !leftPanel) return;

  const leftRect = leftPanel.getBoundingClientRect();
  // Meio do painel azul (metade da largura da seção .left)
  const x = leftRect.left + (leftRect.width / 2);

  // scan-line é absoluta dentro do marquee (viewport),
  // então usamos left em px relativo ao viewport
  scan.style.left = `${x}px`;
}

const coins = row ? Array.from(row.querySelectorAll(".coin")) : [];

function updateCoinColors(){
  if(!scan || coins.length === 0) return;

  const scanX = scan.getBoundingClientRect().left;

  coins.forEach((coin) => {
    const r = coin.getBoundingClientRect();
    const coinCenterX = r.left + (r.width / 2);

    // Neon quando já passou para a esquerda da linha
    const passed = coinCenterX < scanX;
    coin.classList.toggle("is-neon", passed);
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

// Inicialização (sem delay)
function initCoins(){
  if(!row) return;

  setScanToMiddleOfBlue();
  setMarqueeDistance();
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
