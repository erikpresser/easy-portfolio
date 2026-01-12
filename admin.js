// === CHAVES DO PROJETO (mesmas do site) ===
const SUPABASE_URL = "https://dmydhaompvanujvpkngz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteWRoYW9tcHZhbnVqdnBrbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDEzNjUsImV4cCI6MjA3MTMxNzM2NX0.xPxalOxi4PR0z7Jo9m2JodFF4Z8Eiw0U-pAxDMFvvV0";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === Tabelas existentes ===
const T_METRICS = "metrics";
const T_TRADES  = "trades";
const T_DEPS    = "wallet_deposits";
const T_SAQS    = "wallet_withdrawals";

// === Tabelas do Pool ===
const T_POOL_CLIENTS = "pool_clients";
const T_POOL_LEDGER  = "pool_ledger";
const T_POOL_OPS     = "pool_ops";

// ==== FORMATADORES ====
// 2 casas: patrimônio, carteiras, KPIs
const USD2 = new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 });
// 4 casas: lucros/repasse/rateios
const USD4 = new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD', minimumFractionDigits:4, maximumFractionDigits:4 });
const round4    = (n)=> Math.round(Number(n||0)*1e4)/1e4;
const fmtUSDT2  = (n)=> `${USD2.format(Number(n||0))} USDT`;
const fmtUSDT4  = (n)=> `${USD4.format(round4(n))} USDT`;

const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR');
const todayISO = () => new Date().toISOString().slice(0,10);

let currentUser = null;
let selectedUserId = null;

// locks p/ evitar render duplicada
let poolListSeq = 0;
let poolHistSeq = 0;

// ===== Helpers =====
function parseNumber(v){
  if (v == null || v === "") return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).trim().replace(/\s/g,'');
  const hasComma = s.includes(','), hasDot = s.includes('.');
  let normalized = s;
  if (hasComma && hasDot){
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    const decIsComma = lastComma > lastDot;
    normalized = decIsComma ? s.replace(/\./g,'').replace(',', '.') : s.replace(/,/g,'');
  } else if (hasComma) { normalized = s.replace(',', '.'); }
  const num = Number(normalized);
  return isNaN(num) ? null : num;
}
function setMsg(id, text, type=""){
  const el = document.getElementById(id); if (!el) return;
  el.textContent = text||""; el.className = "muted " + (type==="ok"?"ok":type==="err"?"err":"");
}
function monthBounds(d=new Date()){
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to   = new Date(d.getFullYear(), d.getMonth()+1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
function safeTableError(err){
  if(!err) return false;
  const s = (err.message||"").toLowerCase();
  return s.includes("does not exist") || (s.includes("relation") && s.includes("does not exist"));
}
function dedupeByUserId(rows){
  const map = new Map();
  (rows||[]).forEach(r=>{ if(!map.has(r.user_id)) map.set(r.user_id, r); });
  return Array.from(map.values());
}
function uniqueBy(arr, keyFn){
  const seen = new Set(); const out=[];
  for (const it of arr){ const k = keyFn(it); if (k==null||seen.has(k)) continue; seen.add(k); out.push(it); }
  return out;
}

/* =========================================================================
   ✅ NOVO (sem remover nada): Recalcular VP baseado em:
   valor_inicial + SUM(trades.lucro) + SUM(depositos) - SUM(saques)
   E opcionalmente impedir saque > VP atual
   ========================================================================= */

async function sumColumnByUser(tableName, userId, colName){
  const { data, error } = await sb
    .from(tableName)
    .select(colName)
    .eq('user_id', userId)
    .limit(10000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number(r?.[colName] || 0), 0);
}

async function computeAutoVP(userId){
  const { data: m, error: eM } = await sb
    .from(T_METRICS)
    .select('valor_inicial')
    .eq('user_id', userId)
    .maybeSingle();

  if (eM) throw eM;

  const valorInicial = Number(m?.valor_inicial || 0);

  const lucroTrades = await sumColumnByUser(T_TRADES, userId, 'lucro');
  const totalDeps   = await sumColumnByUser(T_DEPS,   userId, 'valor');
  const totalSaqs   = await sumColumnByUser(T_SAQS,   userId, 'valor');

  const vp = valorInicial + Number(lucroTrades || 0) + Number(totalDeps || 0) - Number(totalSaqs || 0);

  return {
    valor_inicial: valorInicial,
    lucro_trades: Number(lucroTrades || 0),
    deposits: Number(totalDeps || 0),
    withdrawals: Number(totalSaqs || 0),
    valor_patrimonial: vp
  };
}

async function syncMetricsVP(userId){
  const snap = await computeAutoVP(userId);
  const payload = {
    user_id: userId,
    valor_patrimonial: Number(snap.valor_patrimonial || 0),
    updated_at: new Date().toISOString()
  };
  const { error } = await sb.from(T_METRICS).upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;

  // mantém o input VP do admin atualizado (sem mexer em outros campos)
  const VP = document.getElementById('vp');
  if (VP) VP.value = payload.valor_patrimonial;

  return snap;
}

// ===== Segurança =====
async function requireAdmin(){
  const { data:{ user } } = await sb.auth.getUser();
  if (!user){ window.location.href='index.html'; return null; }

  const emailEl = document.getElementById('admin-email');
  if (emailEl) emailEl.textContent = user.email||'';

  const { data: prof, error } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !prof?.is_admin){
    alert('Acesso restrito a administradores.');
    window.location.href='dashboard.html';
    return null;
  }
  return user;
}

// ===== Usuários (aba Operações) =====
async function loadUsers(filter=''){
  const sel = document.getElementById('sel-user');
  const where = filter?.trim();
  let q = sb.from('profiles').select('user_id,email,full_name').order('email',{ascending:true});
  if (where) q = q.ilike('email', `%${where}%`);
  const { data, error } = await q;
  sel.innerHTML='';
  if (error){ console.error(error); alert('Erro ao carregar usuários.'); return; }
  if (!data?.length){
    const opt=document.createElement('option'); opt.value=''; opt.textContent='Nenhum usuário encontrado';
    sel.appendChild(opt); selectedUserId=null; const ui=document.getElementById('user-info'); if (ui) ui.textContent=''; clearLists(); return;
  }
  data.forEach(u=>{ const opt=document.createElement('option'); opt.value=u.user_id; opt.textContent=u.email+(u.full_name?` — ${u.full_name}`:''); sel.appendChild(opt); });
  if (!selectedUserId) selectedUserId = data[0].user_id;
  sel.value = selectedUserId; updateSelectedInfo(); await loadClientData();
}
function updateSelectedInfo(){
  const sel=document.getElementById('sel-user'); const p=document.getElementById('user-info');
  const txt = sel?.options?.[sel.selectedIndex]?.textContent || ''; if (p) p.textContent = txt?`Cliente selecionado: ${txt}`:'';
}
function clearLists(){ ['tbody-trades','tbody-deps','tbody-saqs'].forEach(id=>{ const el=document.getElementById(id); if (el) el.innerHTML=''; }); }

async function loadClientData(){
  if(!selectedUserId) return;

  const { data:m } = await sb
    .from(T_METRICS)
    .select('valor_inicial,valor_patrimonial,lucro_mensal_pct,acertividade')
    .eq('user_id', selectedUserId)
    .maybeSingle();

  const VI=document.getElementById('vi'), VP=document.getElementById('vp'), LM=document.getElementById('lm'), AC=document.getElementById('ac');
  if (VI) VI.value = m?.valor_inicial ?? '';
  if (VP) VP.value = m?.valor_patrimonial ?? '';
  if (LM) LM.value = m?.lucro_mensal_pct ?? '';
  if (AC) AC.value = m?.acertividade ?? '';

  const { data:tRows } = await sb
    .from(T_TRADES)
    .select('id,data,operacao,lucro')
    .eq('user_id', selectedUserId)
    .order('data',{ascending:false})
    .limit(50);

  // --- Habilitar/desabilitar botões de Depósito/Saque para usuários específicos ---
  try {
    const { data: profile } = await sb
      .from('profiles')
      .select('user_id, email, full_name')
      .eq('user_id', selectedUserId)
      .maybeSingle();

    const isErik = profile && (
      (profile.full_name && profile.full_name.toLowerCase().includes('erik')) ||
      (profile.email && profile.email.toLowerCase().includes('erik'))
    );
    const isPresserInvestment = profile && (
      (profile.full_name && profile.full_name.toLowerCase().includes('presser investment')) ||
      (profile.email && profile.email.toLowerCase().includes('presser'))
    );

    const shouldEnable = !!(isErik || isPresserInvestment);

    const btnDep = document.getElementById('add-dep');
    const btnSaq = document.getElementById('add-saq');
    if (btnDep) btnDep.disabled = !shouldEnable;
    if (btnSaq) btnSaq.disabled = !shouldEnable;
  } catch (e) {
    console.warn('Erro ao verificar perfil para habilitar botões:', e);
    const btnDep = document.getElementById('add-dep');
    const btnSaq = document.getElementById('add-saq');
    if (btnDep) btnDep.disabled = true;
    if (btnSaq) btnSaq.disabled = true;
  }

  renderTrades(tRows||[]);

  const { data:dRows } = await sb
    .from(T_DEPS)
    .select('data,valor')
    .eq('user_id', selectedUserId)
    .order('data',{ascending:false})
    .limit(50);
  renderMoneyList('tbody-deps', dRows||[]);

  const { data:sRows } = await sb
    .from(T_SAQS)
    .select('data,valor')
    .eq('user_id', selectedUserId)
    .order('data',{ascending:false})
    .limit(50);
  renderMoneyList('tbody-saqs', sRows||[]);

  // ✅ NOVO: sincroniza VP automático
  try { await syncMetricsVP(selectedUserId); }
  catch(e){ console.warn('[dbg] syncMetricsVP(loadClientData):', e?.message||e); }
}

function renderTrades(rows){
  const tbody=document.getElementById('tbody-trades'); if (!tbody) return;
  tbody.innerHTML=''; if (!rows.length){ setMsg('msg-trades','Nenhuma operação lançada.'); return; }
  setMsg('msg-trades','');
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(r.data)}</td>
      <td>${r.operacao||'-'}</td>
      <td style="font-weight:700;color:${Number(r.lucro)>=0?'#22c55e':'#ef4444'}">${fmtUSDT4(r.lucro)}</td>
      <td><span class="action-link" data-id="${r.id}">Excluir</span></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.action-link').forEach(a=>{
    a.addEventListener('click', async e=>{
      const id=e.target.getAttribute('data-id'); if(!confirm('Excluir esta operação?')) return;
      const { error } = await sb.from(T_TRADES).delete().eq('id', id).eq('user_id', selectedUserId);
      if (error){ alert('Erro ao excluir.'); return; }
      await loadClientData();
      // ✅ NOVO: garante VP atualizado
      try { await syncMetricsVP(selectedUserId); } catch(_){}
    });
  });
}
function renderMoneyList(tbodyId, rows){
  const tb=document.getElementById(tbodyId); if (!tb) return;
  tb.innerHTML='';
  if(!rows.length){
    const tr=document.createElement('tr');
    tr.innerHTML='<td colspan="2" class="muted">Sem registros.</td>';
    tb.appendChild(tr);
    return;
  }
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${fmtDate(r.data)}</td><td>${fmtUSDT2(r.valor)}</td>`;
    tb.appendChild(tr);
  });
}

// ===== Salvar métricas =====
async function saveMetrics(){
  if(!selectedUserId) return;
  const valor_inicial=parseNumber(document.getElementById('vi').value);
  const valor_patrimonial=parseNumber(document.getElementById('vp').value);
  const lucro_mensal_pct=parseNumber(document.getElementById('lm').value);
  const acertividade=parseNumber(document.getElementById('ac').value);
  const payload={ user_id:selectedUserId, updated_at:new Date().toISOString() };
  if (valor_inicial!=null) payload.valor_inicial=valor_inicial;
  if (valor_patrimonial!=null) payload.valor_patrimonial=valor_patrimonial;
  if (lucro_mensal_pct!=null) payload.lucro_mensal_pct=lucro_mensal_pct;
  if (acertividade!=null) payload.acertividade=acertividade;

  const { error } = await sb.from(T_METRICS).upsert(payload,{ onConflict:'user_id' });
  if (error){ console.error(error); setMsg('msg-metrics','Erro ao salvar.','err'); return; }
  setMsg('msg-metrics','Métricas salvas com sucesso.','ok');
  setTimeout(()=>setMsg('msg-metrics',''),2500);

  // ✅ NOVO: se mexer no valor_inicial, re-sync do VP automático
  try { await syncMetricsVP(selectedUserId); } catch(_){}
}

// ===== Lançar trade (APENAS Dashboard) =====
async function addTrade(){
  if(!selectedUserId) return;
  const d=document.getElementById('trade-date').value || todayISO();
  const op=document.getElementById('trade-op').value.trim();
  const pr=parseNumber(document.getElementById('trade-profit').value);
  if(!op || pr==null){ setMsg('msg-trade','Preencha operação e lucro.','err'); return; }
  const iso=new Date(d).toISOString();
  const { error } = await sb.from(T_TRADES).insert({ user_id:selectedUserId, data:iso, operacao:op, lucro:pr });
  if (error){ console.error(error); setMsg('msg-trade','Erro ao lançar.','err'); return; }
  setMsg('msg-trade','Operação lançada no Dashboard.','ok');
  document.getElementById('trade-op').value='';
  document.getElementById('trade-profit').value='';
  await loadClientData();
  // ✅ NOVO: trade altera VP, então re-sync
  try { await syncMetricsVP(selectedUserId); } catch(_){}
}

// ===== Depósito/Saque (aba Operações) =====
async function addDeposit(){
  if(!selectedUserId) return;
  const d=document.getElementById('dep-date').value || todayISO();
  const v=parseNumber(document.getElementById('dep-value').value);
  if (v==null){ setMsg('msg-dep','Informe o valor.','err'); return; }

  const { error } = await sb.from(T_DEPS).insert({ user_id:selectedUserId, data:new Date(d).toISOString(), valor:v });
  if (error){ console.error(error); setMsg('msg-dep','Erro ao lançar depósito.','err'); return; }

  // ✅ NOVO: depósito soma no VP
  try { await syncMetricsVP(selectedUserId); } catch(e){ console.warn('[dbg] syncMetricsVP(dep):', e?.message||e); }

  setMsg('msg-dep','Depósito lançado!','ok');
  document.getElementById('dep-value').value='';
  await loadClientData();
}

async function addWithdrawal(){
  if(!selectedUserId) return;
  const d=document.getElementById('saq-date').value || todayISO();
  const v=parseNumber(document.getElementById('saq-value').value);
  if (v==null){ setMsg('msg-saq','Informe o valor.','err'); return; }

  // ✅ NOVO: impede saque maior que o patrimônio atual calculado
  try{
    const snap = await computeAutoVP(selectedUserId);
    const vpNow = Number(snap?.valor_patrimonial || 0);
    if (v > vpNow){
      setMsg('msg-saq',`Saque maior que o patrimônio atual (${fmtUSDT2(vpNow)}).`, 'err');
      return;
    }
  }catch(e){
    console.warn('[dbg] computeAutoVP(saq) falhou:', e?.message||e);
    // se falhar, segue como estava
  }

  const { error } = await sb.from(T_SAQS).insert({ user_id:selectedUserId, data:new Date(d).toISOString(), valor:v });
  if (error){ console.error(error); setMsg('msg-saq','Erro ao lançar saque.','err'); return; }

  // ✅ NOVO: saque subtrai do VP
  try { await syncMetricsVP(selectedUserId); } catch(e){ console.warn('[dbg] syncMetricsVP(saq):', e?.message||e); }

  setMsg('msg-saq','Saque lançado!','ok');
  document.getElementById('saq-value').value='';
  await loadClientData();
}

/* =========================================================================
   ==========================  ABA CLIENTES (POOL)  ========================
   ========================================================================= */

// ---- Modal simples (dep/saq pool) ----
const PoolModal = {
  mode:null, userId:null,
  open({mode, userId, title}){
    this.mode=mode; this.userId=userId;
    const m=document.getElementById('pool-modal');
    document.getElementById('pool-modal-title').textContent = title||'Ajustar Cliente';
    document.getElementById('pool-modal-date').value = todayISO();
    document.getElementById('pool-modal-value').value = '';
    document.getElementById('pool-modal-msg').textContent = '';
    if (m) m.hidden=false;
  },
  close(){ const m=document.getElementById('pool-modal'); if (m) m.hidden=true; }
};

// ---- Combo usuários do pool ----
async function poolLoadUserSelect(){
  const sel=document.getElementById('pool-sel-user'); if(!sel) return;
  const { data, error } = await sb.from('profiles').select('user_id,email,full_name').order('email',{ascending:true});
  sel.innerHTML=''; if (error){ console.warn(error); return; }
  (data||[]).forEach(u=>{
    const opt=document.createElement('option');
    opt.value=u.user_id;
    opt.textContent=u.email+(u.full_name?` — ${u.full_name}`:'');
    sel.appendChild(opt);
  });
}

// ---- Remover cliente do pool ----
async function poolRemoveClient(userId){
  if (!userId) return;
  if (!confirm('Tem certeza que deseja excluir este cliente do Pool? Os lançamentos do ledger desse cliente também serão removidos.')) return;
  const { error:e1 } = await sb.from(T_POOL_LEDGER).delete().eq('user_id', userId); if (e1){ alert('Erro ao excluir ledger do cliente.'); return; }
  const { error:e2 } = await sb.from(T_POOL_CLIENTS).delete().eq('user_id', userId); if (e2){ alert('Erro ao excluir cliente do pool.'); return; }
  await poolLoadSummaryAndList(); alert('Cliente removido do pool.');
}

// ---- Resumo + Tabela (Lucro Última Operação + Presser no montante) ----
async function poolLoadSummaryAndList(){
  const mySeq = ++poolListSeq;

  const totalEl=document.getElementById('pool-total');
  const nEl=document.getElementById('pool-n-clients');
  const splitCEl=document.getElementById('pool-split-client');
  const splitPEl=document.getElementById('pool-split-presser');
  const tbody=document.getElementById('pool-tbody-clients');
  const msgC=document.getElementById('pool-msg-clients');
  if (!tbody) return;
  if (msgC) msgC.textContent='';

  const { data: pcRaw, error } = await sb.from(T_POOL_CLIENTS)
    .select('user_id,patrimonio,split_client_pct,split_presser_pct');
  if (mySeq!==poolListSeq) return;

  if (error){
    if (safeTableError(error)){
      if (totalEl) totalEl.textContent="—"; if (nEl) nEl.textContent="—";
      if (splitCEl) splitCEl.textContent="—"; if (splitPEl) splitPEl.textContent="—";
      if (tbody) tbody.innerHTML=''; if (msgC) msgC.textContent='As tabelas do Pool ainda não existem.';
      return;
    }
    console.error(error); if (msgC) msgC.textContent='Erro ao carregar clientes do pool.'; if (tbody) tbody.innerHTML=''; return;
  }

  const ids=(pcRaw||[]).map(r=>r.user_id);
  let profiles=[];
  if (ids.length){
    const { data:pf } = await sb.from('profiles').select('user_id,email,full_name').in('user_id', ids);
    if (mySeq!==poolListSeq) return;
    profiles=pf||[];
  }
  const mapP=new Map(profiles.map(p=>[p.user_id,p]));

  const { data:lastOpArr } = await sb.from(T_POOL_OPS).select('id,date,operacao,repasse_presser').order('date',{ascending:false}).limit(1);
  const lastOp = (lastOpArr&&lastOpArr[0])||null;

  let pcLabeled=(pcRaw||[]).map(r=>{
    const prof=mapP.get(r.user_id); const label=(prof?.email||r.user_id||'').trim();
    return { ...r, label };
  }).filter(r=>r.label.toLowerCase()!=='presser investment');
  pcLabeled = uniqueBy(pcLabeled, r => (r.label||'').toLowerCase());

  const { data: opsAll } = await sb.from(T_POOL_OPS).select('repasse_presser');
  if (mySeq!==poolListSeq) return;
  const presserTotal = (opsAll||[]).reduce((s,r)=> s + Number(r.repasse_presser||0), 0);

  const poolTotalWithoutPresser = pcLabeled.reduce((s,r)=> s + Number(r.patrimonio||0), 0);
  const poolTotal = poolTotalWithoutPresser + Math.max(0, presserTotal);
  const nClients = pcLabeled.length + 1;

  let sameSplit=true, sC=null, sP=null;
  pcLabeled.forEach(r=>{
    if (sC==null){ sC=r.split_client_pct; sP=r.split_presser_pct; }
    else if (sC!==r.split_client_pct||sP!==r.split_presser_pct){ sameSplit=false; }
  });

  if (totalEl) totalEl.textContent = fmtUSDT2(poolTotal);
  if (nEl) nEl.textContent = String(nClients);
  if (splitCEl) splitCEl.textContent = sameSplit&&sC!=null?String(sC):"—";
  if (splitPEl) splitPEl.textContent = sameSplit&&sP!=null?String(sP):"—";

  let lastByUser = new Map();
  if (lastOp){
    const { data: ledRows } = await sb.from(T_POOL_LEDGER)
      .select('user_id,type,amount,date')
      .eq('date', lastOp.date)
      .in('type', ['pnl_pos','pnl_neg']);
    (ledRows||[]).forEach(r=> lastByUser.set(r.user_id, Number(r.amount||0)));
  }

  tbody.innerHTML='';
  pcLabeled.forEach(r=>{
    const pct = poolTotal>0 ? (Number(r.patrimonio||0)/poolTotal)*100 : 0;
    const lucroUlt = lastByUser.get(r.user_id) || 0;
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${r.label}</td>
      <td>${fmtUSDT2(r.patrimonio||0)}</td>
      <td>${pct.toFixed(2)}%</td>
      <td>${(r.split_client_pct??'—')}% / ${(r.split_presser_pct??'—')}%</td>
      <td style="font-weight:600;color:${lucroUlt>=0?'#22c55e':'#ef4444'}">${fmtUSDT4(lucroUlt)}</td>
      <td>
        <button class="link small" data-act="dep" data-id="${r.user_id}">Depósito</button>
        <button class="link small" data-act="saq" data-id="${r.user_id}">Saque</button>
        <button class="link small danger" data-act="del-client" data-id="${r.user_id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  });

  const presserPct = poolTotal>0 ? (Math.max(0, presserTotal)/poolTotal)*100 : 0;
  const presserLast = lastOp ? Number(lastOp.repasse_presser||0) : 0;

  const trP=document.createElement('tr');
  trP.innerHTML = `
    <td><strong>Presser Investment</strong></td>
    <td>${fmtUSDT2(presserTotal)}</td>
    <td>${presserPct.toFixed(2)}%</td>
    <td>100% / 0%</td>
    <td style="font-weight:600;color:${presserLast>=0?'#22c55e':'#ef4444'}">${fmtUSDT4(presserLast)}</td>
    <td class="muted">—</td>`;
  tbody.appendChild(trP);

  tbody.querySelectorAll('button[data-act]').forEach(btn=>{
    const act=btn.dataset.act, uid=btn.dataset.id;
    if (act==='dep'||act==='saq'){
      btn.addEventListener('click', ()=>{
        const title = act==='dep'?'Lançar Depósito (Pool)':'Lançar Saque (Pool)';
        PoolModal.open({mode:act,userId:uid,title});
      });
    } else if (act==='del-client'){
      btn.addEventListener('click', ()=> poolRemoveClient(uid));
    }
  });
}

// ---- Add/Editar cliente no pool ----
async function poolAddOrUpdateClient(){
  const selUser=document.getElementById('pool-sel-user');
  const splitC=parseNumber(document.getElementById('pool-split-user').value);
  const splitP=parseNumber(document.getElementById('pool-split-presser-input').value);
  const iniDep=parseNumber(document.getElementById('pool-initial-dep').value);

  if (!selUser?.value){ setMsg('pool-msg-add','Selecione um cliente.','err'); return; }
  if (splitC==null || splitP==null || splitC+splitP!==100){ setMsg('pool-msg-add','Split inválido. Deve somar 100%.','err'); return; }

  const payload={ user_id:selUser.value, split_client_pct:Math.round(splitC), split_presser_pct:Math.round(splitP), updated_at:new Date().toISOString() };
  const { data: cur } = await sb.from(T_POOL_CLIENTS).select('user_id,patrimonio').eq('user_id', selUser.value).maybeSingle();
  if (!cur){ payload.created_at=new Date().toISOString(); payload.patrimonio=iniDep||0; }

  const { error } = await sb.from(T_POOL_CLIENTS).upsert(payload,{ onConflict:'user_id' });
  if (error){
    if (safeTableError(error)){ setMsg('pool-msg-add','Crie as tabelas do Pool no Supabase.','err'); return; }
    console.error(error); setMsg('pool-msg-add','Erro ao salvar no Pool.','err'); return;
  }

  if (!cur && iniDep && iniDep>0){
    await sb.from(T_POOL_LEDGER).insert({ user_id:selUser.value, date:new Date().toISOString(), type:'dep', amount:round4(iniDep), meta:{note:'dep_inicial'} });
  }

  setMsg('pool-msg-add','Salvo no Pool.','ok');
  document.getElementById('pool-initial-dep').value='';
  await poolLoadSummaryAndList();
}

// ---- Modal dep/saq ----
async function poolModalConfirm(){
  const dateISO=new Date(document.getElementById('pool-modal-date').value||todayISO()).toISOString();
  const val=parseNumber(document.getElementById('pool-modal-value').value);
  const outMsg=document.getElementById('pool-modal-msg');
  if (val==null || val<=0){ outMsg.textContent='Informe um valor válido.'; return; }
  try{
    await poolAdjustClient({ userId:PoolModal.userId, type:PoolModal.mode, value:val, dateISO });
    PoolModal.close(); await poolLoadSummaryAndList();
  }catch(e){ console.error(e); outMsg.textContent='Erro ao salvar.'; }
}
function poolModalCancel(){ PoolModal.close(); }

async function poolAdjustClient({ userId, type, value, dateISO }){
  const sign = type==='dep' ? +1 : -1;
  const { data:cur, error:e0 } = await sb.from(T_POOL_CLIENTS).select('patrimonio').eq('user_id', userId).maybeSingle();
  if (e0) throw e0; if (!cur) throw new Error('Cliente não está no pool.');
  const novoPat = Math.max(0, round4(Number(cur.patrimonio||0) + sign*Number(value||0)));
  const { error:e1 } = await sb.from(T_POOL_CLIENTS).update({ patrimonio:novoPat, updated_at:new Date().toISOString() }).eq('user_id', userId);
  if (e1) throw e1;
  const { error:e2 } = await sb.from(T_POOL_LEDGER).insert({ user_id:userId, date:dateISO, type, amount:round4(sign*value), meta:{} });
  if (e2) throw e2;
}

// ---- Lançamento MANUAL para o Pool ----
async function poolAddOperation(){
  const d=document.getElementById('pool-date')?.value || todayISO();
  const op=(document.getElementById('pool-op')?.value || '').trim();
  const pnl=parseNumber(document.getElementById('pool-pnl')?.value);
  if (!op || pnl==null){ setMsg('pool-msg','Preencha operação e PnL.','err'); return; }
  try{
    await poolApplyOperation({ dateISO:new Date(d).toISOString(), operacao:op, pnlTotal:pnl });
    setMsg('pool-msg','Operação lançada no Pool.','ok');
    const opEl=document.getElementById('pool-op');
    const pnlEl=document.getElementById('pool-pnl');
    if (opEl) opEl.value='';
    if (pnlEl) pnlEl.value='';
  }catch(e){ console.error(e); setMsg('pool-msg','Erro ao lançar no Pool.','err'); }
}

// ---- Rateio de operação (inclui Presser como participante 100%) ----
async function poolApplyOperation({ dateISO, operacao, pnlTotal }){
  const { data: pcRaw, error } = await sb.from(T_POOL_CLIENTS).select('user_id,patrimonio,split_client_pct,split_presser_pct');
  if (error){ if (safeTableError(error)) return; throw error; }
  const pc = dedupeByUserId(pcRaw);

  const { data: opsAll } = await sb.from(T_POOL_OPS).select('repasse_presser');
  const presserPat = (opsAll||[]).reduce((s,r)=> s + Number(r.repasse_presser||0), 0);

  if (!pc.length && presserPat<=0) return;

  const clientsTotal = pc.reduce((s,r)=> s + Number(r.patrimonio||0), 0);
  const poolTotal = clientsTotal + Math.max(0, presserPat);
  if (poolTotal <= 0) return;

  const isGain = pnlTotal >= 0;

  let presserFee = 0;
  let presserCapShare = 0;
  let distributedToClients = 0;

  const updates = [];
  const ledgers = [];

  pc.forEach(r=>{
    const weight = Number(r.patrimonio||0) / poolTotal;
    if (isGain){
      const share = pnlTotal * weight;
      const sc = Number(r.split_client_pct ?? 50);
      const sp = Number(r.split_presser_pct ?? 50);
      const clientGain = round4(share * (sc/100));
      const fee        = round4(share * (sp/100));
      presserFee = round4(presserFee + fee);
      distributedToClients = round4(distributedToClients + clientGain);
      const novo = round4(Number(r.patrimonio||0) + clientGain);
      updates.push({ user_id:r.user_id, patrimonio:novo });
      ledgers.push({ user_id:r.user_id, date:dateISO, type:'pnl_pos', amount:clientGain, meta:{ operacao }});
    } else {
      const loss = round4(pnlTotal * weight);
      const novo = Math.max(0, round4(Number(r.patrimonio||0) + loss));
      updates.push({ user_id:r.user_id, patrimonio:novo });
      ledgers.push({ user_id:r.user_id, date:dateISO, type:'pnl_neg', amount:loss, meta:{ operacao }});
    }
  });

  const presserWeight = Math.max(0, presserPat) / poolTotal;
  presserCapShare = round4(pnlTotal * presserWeight);

  for (const u of updates){
    const { error:eU } = await sb.from(T_POOL_CLIENTS).update({ patrimonio:u.patrimonio, updated_at:new Date().toISOString() }).eq('user_id', u.user_id);
    if (eU) throw eU;
  }
  if (ledgers.length){
    const { error:eL } = await sb.from(T_POOL_LEDGER).insert(ledgers);
    if (eL) throw eL;
  }

  const repassePresser = round4((isGain ? presserFee : 0) + presserCapShare);

  const { error:eO } = await sb.from(T_POOL_OPS).insert({
    date: dateISO,
    operacao,
    pnl_total: round4(pnlTotal),
    repasse_presser: repassePresser,
    distribuido_clientes: isGain ? round4(distributedToClients) : round4(pnlTotal)
  });
  if (eO) throw eO;

  await poolLoadSummaryAndList().catch(()=>{});
  await poolLoadHistory().catch(()=>{});
}

// ---- Excluir operação do histórico ----
async function poolDeleteOperation(opId){
  if (!opId) return;
  if (!confirm('Deseja excluir esta operação do histórico do Pool?')) return;
  const { error } = await sb.from(T_POOL_OPS).delete().eq('id', opId);
  if (error){ alert('Erro ao excluir operação do pool.'); return; }
  await poolLoadHistory(); alert('Operação removida do histórico.');
}

// ---- Histórico do pool ----
async function poolLoadHistory(){
  const mySeq=++poolHistSeq;
  const tbody=document.getElementById('pool-tbody-history');
  const msg=document.getElementById('pool-msg-history'); if (!tbody) return;
  if (msg) msg.textContent='';
  const { data, error } = await sb.from(T_POOL_OPS).select('id,date,operacao,pnl_total,repasse_presser,distribuido_clientes').order('date',{ascending:false}).limit(100);
  if (mySeq!==poolHistSeq) return;
  if (error){
    if (safeTableError(error)){ if (msg) msg.textContent='Histórico indisponível.'; tbody.innerHTML=''; return; }
    console.error(error); if (msg) msg.textContent='Erro ao carregar histórico do pool.'; tbody.innerHTML=''; return;
  }
  tbody.innerHTML='';
  if (!data?.length){ if (msg) msg.textContent='Sem operações rateadas.'; return; }
  data.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${fmtDate(r.date)}</td>
      <td>${r.operacao||'-'}</td>
      <td style="font-weight:600;color:${Number(r.pnl_total)>=0?'#22c55e':'#ef4444'}">${fmtUSDT4(r.pnl_total)}</td>
      <td>${fmtUSDT4(r.repasse_presser||0)}</td>
      <td>${fmtUSDT4(r.distribuido_clientes||0)}</td>
      <td><button class="link small danger" data-del-op="${r.id}">Excluir</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-del-op]').forEach(btn=> btn.addEventListener('click',()=> poolDeleteOperation(btn.dataset.delOp)));
}

// ---- Inicializa a aba Clientes (Pool) ----
function poolBindUI(){
  const addBtn=document.getElementById('pool-add-client'); if (addBtn) addBtn.addEventListener('click', poolAddOrUpdateClient);
  const mOk=document.getElementById('pool-modal-confirm'); const mNo=document.getElementById('pool-modal-cancel');
  if (mOk) mOk.addEventListener('click', poolModalConfirm);
  if (mNo) mNo.addEventListener('click', poolModalCancel);
  const poolBtn=document.getElementById('pool-add-op'); if (poolBtn) poolBtn.addEventListener('click', poolAddOperation);
}
async function poolInit(){ await poolLoadUserSelect(); await poolLoadSummaryAndList(); await poolLoadHistory(); }

/* =========================================================================
   ================================  INIT  =================================
   ========================================================================= */
(async ()=>{
  currentUser = await requireAdmin(); if(!currentUser) return;

  const btnLogout=document.getElementById('logout');
  if (btnLogout){
    btnLogout.addEventListener('click', async()=>{
      await sb.auth.signOut();
      window.location.href='index.html';
    });
  }

  // ---- ABA OPERAÇÕES ----
  const refBtn=document.getElementById('refresh-users');
  const srcInp=document.getElementById('search');
  const selUsr=document.getElementById('sel-user');
  if (refBtn) refBtn.addEventListener('click', ()=> loadUsers(srcInp?.value||''));
  if (srcInp) srcInp.addEventListener('input', e=> loadUsers(e.target.value));
  if (selUsr) selUsr.addEventListener('change', e=>{
    selectedUserId=e.target.value||null;
    updateSelectedInfo();
    loadClientData();
  });

  const bSave=document.getElementById('save-metrics');
  const bTrade=document.getElementById('add-trade');
  const bDep=document.getElementById('add-dep');
  const bSaq=document.getElementById('add-saq');
  if (bSave) bSave.addEventListener('click', saveMetrics);
  if (bTrade) bTrade.addEventListener('click', addTrade);
  if (bDep) bDep.addEventListener('click', addDeposit);
  if (bSaq) bSaq.addEventListener('click', addWithdrawal);

  ['trade-date','dep-date','saq-date','pool-modal-date','pool-date'].forEach(id=>{
    const el=document.getElementById(id); if (el && !el.value) el.value=todayISO();
  });

  await loadUsers();

  // ---- ABA CLIENTES (POOL) ----
  poolBindUI();
  document.querySelectorAll('.side-link').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if (btn.dataset.tab==='clientes'){
        poolInit().catch(e=>console.warn('poolInit:', e?.message||e));
      }
    });
  });
  const panelClientes=document.getElementById('tab-clientes');
  if (panelClientes && panelClientes.classList.contains('is-active')){
    poolInit().catch(()=>{});
  }
})();
