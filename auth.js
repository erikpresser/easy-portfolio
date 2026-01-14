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

// ===== Coins: prata -> azul quando cruzar o meio =====
const stage = document.querySelector(".coins-marquee");
const coins = Array.from(document.querySelectorAll(".coin"));

function updateCoinColors(){
  if(!stage) return;

  const stageRect = stage.getBoundingClientRect();
  const centerX = stageRect.left + (stageRect.width / 2);

  coins.forEach((coin) => {
    const r = coin.getBoundingClientRect();
    const coinCenter = r.left + (r.width / 2);

    // Se o centro da moeda já passou do meio (à esquerda do centro), fica azul
    const passed = coinCenter < centerX;
    coin.classList.toggle("is-blue", passed);
  });
}

// Atualiza em loop (leve e preciso)
let rafId;
function loop(){
  updateCoinColors();
  rafId = requestAnimationFrame(loop);
}
loop();

// Pausa se a aba ficar em background (boa prática)
document.addEventListener("visibilitychange", () => {
  if(document.hidden){
    cancelAnimationFrame(rafId);
  } else {
    loop();
  }
});

// Demo submit (trocar pela sua integração Supabase)
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginHint = document.getElementById("loginHint");
const signupHint = document.getElementById("signupHint");

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginHint.textContent = "Validando credenciais...";
  // Aqui você chama seu Supabase (signInWithPassword) e redireciona pro dashboard
  setTimeout(() => {
    loginHint.textContent = "Login OK. Redirecionando...";
    // window.location.href = "dashboard.html";
  }, 800);
});

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupHint.textContent = "Criando conta...";
  // Aqui você chama seu Supabase (signUp) e confirma e-mail se necessário
  setTimeout(() => {
    signupHint.textContent = "Conta criada. Verifique seu e-mail ou faça login.";
    openTab("login");
  }, 900);
});
