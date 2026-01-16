// ==============================
// Presser Investment — auth.js
// Tabs + Coins (loop real) + Supabase Auth (login/signup -> dashboard)
// + Phone picker (country + dial) no SIGNUP
// ==============================

/* =========================
   SUPABASE
   ========================= */
const SUPABASE_URL = "https://dmydhaompvanujvpkngz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmRteWRoYW9tcHZhbnVqdnBrbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDEzNjUsImV4cCI6MjA3MTMxNzM2NX0.xPxalOxi4PR0z7Jo9m2JodFF4Z8Eiw0U-pAxDMFvvV0";

// Para onde ir após autenticar
const DASHBOARD_URL = "dashboard.html";

// Cria o client
const sb = (window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* =========================
   TABS
   ========================= */
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

  // evita “pulos” visuais ao trocar login/signup (mobile etc.)
  requestAnimationFrame(() => {
    setScanToMiddleOfBlue();
    setMarqueeDistance();
    updateCoinColors();
  });
}

tabs.forEach(t => t.addEventListener("click", () => openTab(t.dataset.tab)));
goSignup?.addEventListener("click", (e) => { e.preventDefault(); openTab("signup"); });
goLogin?.addEventListener("click", (e) => { e.preventDefault(); openTab("login"); });

/* =========================
   COINS — loop + scan-line correta
   ========================= */
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

function setScanToMiddleOfBlue(){
  if(!scan || !leftPanel || !track || !marquee) return;

  const marqueeRect = marquee.getBoundingClientRect();
  const leftRect    = leftPanel.getBoundingClientRect();
  const trackRect   = track.getBoundingClientRect();

  const xViewport = leftRect.left + (leftRect.width / 2);
  const xLocal = xViewport - marqueeRect.left;
  scan.style.left = `${xLocal}px`;

  const yViewport = trackRect.top + (trackRect.height / 2);
  const yLocal = yViewport - marqueeRect.top;
  scan.style.top = `${yLocal}px`;
}

const coins = row ? Array.from(row.querySelectorAll(".coin")) : [];

function updateCoinColors(){
  if(!scan || !coins || coins.length === 0) return;

  const scanRect = scan.getBoundingClientRect();
  const scanX = scanRect.left + (scanRect.width / 2);

  coins.forEach((coin) => {
    const neonImg = coin.querySelector(".coin-img.neon");
    const target = neonImg || coin.querySelector(".coin-face") || coin;

    const r = target.getBoundingClientRect();

    let progress = (scanX - r.left) / Math.max(1, r.width);
    progress = Math.max(0, Math.min(1, progress));

    coin.style.setProperty("--reveal", `${(progress * 100).toFixed(2)}%`);
  });
}

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

/* =========================
   PHONE PICKER (Country + Dial) — SIGNUP
   Requer estes IDs no HTML:
   phoneField, countryBtn, countryMenu,
   countryFlag, countryName, countryDial,
   phoneInput, phoneDial, phoneCountry
   ========================= */
const phoneField   = document.getElementById("phoneField");
const countryBtn   = document.getElementById("countryBtn");
const countryMenu  = document.getElementById("countryMenu");
const phoneInput   = document.getElementById("phoneInput");
const phoneDialEl  = document.getElementById("phoneDial");
const phoneCtryEl  = document.getElementById("phoneCountry");

const countryFlag = document.getElementById("countryFlag");
const countryName = document.getElementById("countryName");
const countryDial = document.getElementById("countryDial");

function openCountryMenu(){
  if(!phoneField) return;
  phoneField.classList.add("is-open");
  countryBtn?.setAttribute("aria-expanded", "true");
}
function closeCountryMenu(){
  if(!phoneField) return;
  phoneField.classList.remove("is-open");
  countryBtn?.setAttribute("aria-expanded", "false");
}
function toggleCountryMenu(){
  if(!phoneField) return;
  phoneField.classList.contains("is-open") ? closeCountryMenu() : openCountryMenu();
}

countryBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleCountryMenu();
});

document.addEventListener("click", (e) => {
  if(!phoneField) return;
  if(!phoneField.contains(e.target)) closeCountryMenu();
});

document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeCountryMenu();
});

countryMenu?.addEventListener("click", (e) => {
  const btn = e.target.closest(".country-item");
  if(!btn) return;

  const iso = btn.dataset.iso || "BR";
  const flag = btn.dataset.flag || "🇧🇷";
  const name = btn.dataset.name || "Brasil";
  const dial = btn.dataset.dial || "+55";
  const placeholder = btn.dataset.placeholder || "";

  // UI
  if(countryFlag) countryFlag.textContent = flag;
  if(countryName) countryName.textContent = name;
  if(countryDial) countryDial.textContent = dial;

  // hidden values
  if(phoneDialEl) phoneDialEl.value = dial;
  if(phoneCtryEl) phoneCtryEl.value = iso;

  // marca ativo
  countryMenu.querySelectorAll(".country-item").forEach(x => x.classList.remove("is-active"));
  btn.classList.add("is-active");

  // placeholder
  if(phoneInput) phoneInput.placeholder = placeholder;

  // Se vazio -> coloca DDI
  if(phoneInput){
    const v = (phoneInput.value || "").trim();
    const hadPlus = v.startsWith("+");

    if(!v){
      phoneInput.value = `${dial} `;
    } else if(hadPlus) {
      // Troca o DDI anterior pelo novo
      phoneInput.value = v.replace(/^\+\d+\s*/, `${dial} `);
    }
    phoneInput.focus();
  }

  closeCountryMenu();
});

/* =========================
   AUTH — Supabase real
   ========================= */
const loginForm  = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginHint  = document.getElementById("loginHint");
const signupHint = document.getElementById("signupHint");

function setHint(el, msg){
  if(!el) return;
  el.textContent = msg || "";
}

function setBusy(form, busy){
  if(!form) return;
  const btn = form.querySelector('button[type="submit"]');
  form.querySelectorAll("input, button, a").forEach(el => {
    // não desabilita links de alternância (opcional)
    if(el.tagName.toLowerCase() === "a") return;
    el.disabled = !!busy;
  });
  if(btn){
    const original = btn.dataset.originalText || btn.textContent;
    btn.dataset.originalText = original;
    btn.textContent = busy ? "Aguarde..." : original;
  }
}

function getSiteOrigin(){
  // Para redirecionamento de confirmação de e-mail (quando enabled)
  return window.location.origin;
}

/* =========================
   PHONE PICKER (emoji flags)
   ========================= */
(function initPhonePicker(){
  const field = document.getElementById("phoneField");
  if(!field) return;

  const btn   = document.getElementById("countryBtn");
  const menu  = document.getElementById("countryMenu");

  const flagEl = document.getElementById("countryFlag");
  const nameEl = document.getElementById("countryName");
  const dialEl = document.getElementById("countryDial");

  const input = document.getElementById("phoneInput");
  const hiddenDial = document.getElementById("phoneDial");
  const hiddenCountry = document.getElementById("phoneCountry");

  const hint = field.parentElement?.querySelector(".phone-hint");

  if(!btn || !menu || !flagEl || !nameEl || !dialEl || !input || !hiddenDial || !hiddenCountry) return;

  function open(){
    field.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
  }
  function close(){
    field.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  }
  function toggle(){
    field.classList.contains("is-open") ? close() : open();
  }

  function applyCountry(item){
    const flag = item.dataset.flag || "🇧🇷";
    const name = item.dataset.name || "Brasil";
    const dial = item.dataset.dial || "+55";
    const iso  = item.dataset.iso  || "BR";
    const ph   = item.dataset.placeholder || "";

    flagEl.textContent = flag;
    nameEl.textContent = name;
    dialEl.textContent = dial;

    hiddenDial.value = dial;
    hiddenCountry.value = iso;

    if(ph) input.placeholder = ph;

    // hint “Ex.: ...”
    if(hint){
      hint.textContent = `Ex.: ${dial} ${ph || ""}`.trim();
    }

    // ativa visualmente
    menu.querySelectorAll(".country-item").forEach(b => b.classList.remove("is-active"));
    item.classList.add("is-active");
  }

  // abre/fecha
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  // click nos países
  menu.addEventListener("click", (e) => {
    const item = e.target.closest(".country-item");
    if(!item) return;
    applyCountry(item);
    close();
    input.focus();
  });

  // fecha clicando fora
  document.addEventListener("click", (e) => {
    if(!field.contains(e.target)) close();
  });

  // ESC fecha
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") close();
  });

  // estado inicial: pega o que estiver como active, senão o primeiro
  const initial = menu.querySelector(".country-item.is-active") || menu.querySelector(".country-item");
  if(initial) applyCountry(initial);
})();


// Se o Supabase não carregou, avisa
if(!sb){
  setHint(loginHint, "Erro: supabase-js não carregou. Verifique o <script> do supabase-js no auth.html.");
  setHint(signupHint, "Erro: supabase-js não carregou. Verifique o <script> do supabase-js no auth.html.");
} else {

  // (Opcional) Se já estiver logado, manda pro dashboard
  (async () => {
    try{
      const { data: { session } } = await sb.auth.getSession();
      if(session){
        window.location.href = DASHBOARD_URL;
      }
    }catch(_){}
  })();

  // LOGIN
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (loginForm.email?.value || "").trim();
    const password = (loginForm.password?.value || "").trim();

    if(!email || !password){
      setHint(loginHint, "Preencha e-mail e senha.");
      return;
    }

    setBusy(loginForm, true);
    setHint(loginHint, "Validando credenciais...");

    try{
      const { error } = await sb.auth.signInWithPassword({ email, password });

      if(error){
        setHint(loginHint, "Falha no login: " + error.message);
        return;
      }

      setHint(loginHint, "Login OK. Redirecionando...");
      window.location.href = DASHBOARD_URL;

    } finally {
      setBusy(loginForm, false);
    }
  });

  // SIGNUP
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (signupForm.name?.value || "").trim();
    const email = (signupForm.email?.value || "").trim();
    const password = (signupForm.password?.value || "").trim();

    // novo: telefone
    const phone = (signupForm.phone?.value || "").trim();
    const phoneDial = (signupForm.phone_dial?.value || "").trim();
    const phoneCountry = (signupForm.phone_country?.value || "").trim();

    if(!name || !email || !password){
      setHint(signupHint, "Preencha nome, e-mail e senha.");
      return;
    }

    if(password.length < 6){
      setHint(signupHint, "A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    // telefone não é verificado, mas se você quiser obrigar, descomente:
    // if(!phone){
    //   setHint(signupHint, "Informe seu número (WhatsApp).");
    //   return;
    // }

    setBusy(signupForm, true);
    setHint(signupHint, "Criando conta...");

    try{
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          // salva metadados
          data: {
            full_name: name,
            phone: phone,
            phone_dial: phoneDial,
            phone_country: phoneCountry
          },

          // se seu Supabase exigir confirmação por e-mail,
          // isso define para onde o usuário volta após confirmar
          emailRedirectTo: `${getSiteOrigin()}/auth.html?tab=login`
        }
      });

      if(error){
        setHint(signupHint, "Erro ao criar conta: " + error.message);
        return;
      }

      // Se a confirmação por e-mail estiver ligada, normalmente data.session vem null
      const needsConfirm = !data?.session;

      if(needsConfirm){
        setHint(signupHint, "Conta criada. Verifique seu e-mail para confirmar e depois faça login.");
        openTab("login");
        return;
      }

      // Se a confirmação estiver desligada e já tiver sessão, manda pro dashboard
      setHint(signupHint, "Conta criada. Redirecionando...");
      window.location.href = DASHBOARD_URL;

    } finally {
      setBusy(signupForm, false);
    }
  });
}
