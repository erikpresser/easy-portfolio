// === CHAVES DO SEU PROJETO SUPABASE ===
const SUPABASE_URL = "https://dmydhaompvanujvpkngz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteWRoYW9tcHZhbnVqdnBrbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDEzNjUsImV4cCI6MjA3MTMxNzM2NX0.xPxalOxi4PR0z7Jo9m2JodFF4Z8Eiw0U-pAxDMFvvV0";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// elementos
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
  title.textContent = mode === "login" ? "Iniciar Sessão" : "Criar Conta";
  msg.textContent = "";
  modal.style.display = "flex";
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

form?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";
  msg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try{
    if(mode === "login"){
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      msg.textContent = "Login realizado. Redirecionando...";
      window.location.href = "dashboard.html";
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      msg.textContent = "Conta criada! Verifique seu e-mail para confirmar.";
    }
  }catch(err){
    msg.textContent = "Erro: " + (err?.message || 'tente novamente');
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = "Continuar";
  }
});