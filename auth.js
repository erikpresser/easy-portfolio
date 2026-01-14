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

// Coin highlight loop
const coins = Array.from(document.querySelectorAll(".coin"));
let idx = 0;

function tickCoins(){
  coins.forEach(c => c.classList.remove("is-active"));
  const c = coins[idx % coins.length];
  c.classList.add("is-active");
  idx++;
}
tickCoins();
setInterval(tickCoins, 900);

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
