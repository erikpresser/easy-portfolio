// ==============================
// Presser Investment — auth.js
// Tabs + Coins (prata -> neon ao cruzar a scan-line no MEIO do painel azul)
// + Demo submits
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
// Coins: prata -> NEON ao cruzar a scan-line
// (scan-line posicionada no meio do painel azul, não no meio da tela)
// ==============================
const marquee = document.querySelector(".coins-marquee");
const scan = document.querySelector(".scan-line");
const leftPanel = document.querySelector("section.left"); // painel azul (se existir)

let coins = marquee ? Array.from(marquee.querySelectorAll(".coin")) : [];

function positionScanLine(){
  if(!scan) return;

  // Se houver painel esquerdo, usa o meio dele.
  // Se não houver, cai para o meio da tela.
  let scanX = window.innerWidth / 2;

  if(leftPanel){
    const r = leftPanel.getBoundingClientRect();
    scanX = r.left + (r.width / 2);
  }

  scan.style.left = `${scanX}px`;
}

function updateCoinColors(){
  if(!marquee || !scan || coins.length === 0) return;

  const scanRect = scan.getBoundingClientRect();
  const scanX = scanRect.left;

  coins.forEach((coin) => {
    const r = coin.getBoundingClientRect();
    const coinCenterX = r.left + (r.width / 2);

    // Neon quando o centro já passou para a esquerda da linha
    const passed = coinCenterX < scanX;
    coin.classList.toggle("is-neon", passed);
  });
}

// RAF loop (com pausa em background)
let rafId = null;

function loop(){
  positionScanLine();
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

// inicia
startLoop();

// pausa quando a aba fica escondida
document.addEventListener("visibilitychange", () => {
  if(document.hidden) stopLoop();
  else startLoop();
});

// atualiza em resize
window.addEventListener("resize", () => {
  positionScanLine();
  updateCoinColors();
});

// garante posição correta logo no load
window.addEventListener("load", () => {
  positionScanLine();
  updateCoinColors();
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
