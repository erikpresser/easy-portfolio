// ==============================
// Presser Investment — auth.js
// Tabs + Coins (prata -> neon ao cruzar a scan-line) + Demo submits
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
// Coins: prata -> NEON ao cruzar a scan-line (divisão)
// (VERSÃO CORRIGIDA: is-neon + loop estável)
// ==============================
const marquee = document.querySelector(".coins-marquee");
const scan = document.querySelector(".scan-line");

// seleciona moedas APENAS dentro do marquee
const coins = marquee ? Array.from(marquee.querySelectorAll(".coin")) : [];

function updateCoinColors(){
  if(!marquee || !scan || coins.length === 0) return;

  const scanRect = scan.getBoundingClientRect();
  const scanX = scanRect.left; // posição real da linha (divisão)

  coins.forEach((coin) => {
    const r = coin.getBoundingClientRect();
    const coinCenterX = r.left + (r.width / 2);

    // Se o centro da moeda já passou para a esquerda da linha, fica neon
    const passed = coinCenterX < scanX;
    coin.classList.toggle("is-neon", passed);
  });
}

// RAF loop (com pausa em background)
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

// inicia
startLoop();

// pausa quando a aba fica escondida
document.addEventListener("visibilitychange", () => {
  if(document.hidden) stopLoop();
  else startLoop();
});

// atualiza em resize (e evita “desincronia” visual)
window.addEventListener("resize", () => {
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

  // Aqui você chama seu Supabase (signInWithPassword) e redireciona pro dashboard
  setTimeout(() => {
    if(loginHint) loginHint.textContent = "Login OK. Redirecionando...";
    // window.location.href = "dashboard.html";
  }, 800);
});

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(signupHint) signupHint.textContent = "Criando conta...";

  // Aqui você chama seu Supabase (signUp) e confirma e-mail se necessário
  setTimeout(() => {
    if(signupHint) signupHint.textContent = "Conta criada. Verifique seu e-mail ou faça login.";
    openTab("login");
  }, 900);
});
