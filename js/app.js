const KEY = "caderno-acessos-web-v1";
let aba = "equipe";
let itens = [];
let edit = null;

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function addDias(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function statusDe(it) {
  if (it.arquivado_em) return "Arquivado";
  if (!it.ciclo || it.ciclo === "Nunca") return "Sem expiração";
  if (!it.ultima) return "Ativo";
  const dias = Math.round((new Date(addDias(it.ultima, Number(it.ciclo)) + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 86400000);
  if (dias < 0) return "Vencido";
  if (dias <= 7) return "Vencendo";
  return "Ativo";
}
function rotulo(it) {
  const st = statusDe(it);
  if (st === "Arquivado" || st === "Sem expiração" || st === "Ativo" && (!it.ultima || it.ciclo === "Nunca")) return st === "Sem expiração" ? "Não expira" : st;
  if (!it.ultima || it.ciclo === "Nunca") return st;
  const dias = Math.round((new Date(addDias(it.ultima, Number(it.ciclo)) + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 86400000);
  if (dias < 0) return "Vencido há " + Math.abs(dias) + " dia(s)";
  return "Vence em " + dias + " dias";
}
function exemplos() {
  // Dados 100% fictícios para demonstração (ids s1..s11).
  const c = (o) => Object.assign({ horario: "", escalonamento: "", escalonamentos: [], obs: "", arquivado_em: null }, o);
  // v1.9.2: um único card de exemplo, "Individual" para nunca ir ao arquivo da equipe.
  return [
    c({ id: "s12", titulo: "Portal Exemplo (apague-me)", aplicacao: "Sistema Exemplo", cliente: "Empresa Fictícia", categoria: "Externo", visibilidade: "Individual", url: "https://portal.exemplo.example", usuario: "meu.usuario", senha: "exemplo123", ciclo: "90", ultima: addDias(hoje(), -10), horario: "Seg–Sex 08–18",
      escalonamento: "N1 portal · N2 0800 000 0001",
      escalonamentos: [
        { nivel: 1, canal: "portal", valor: "https://portal.exemplo.example/chamados", nome: "Service Desk", horario: "Seg–Sex 08–18", obs: "Abrir chamado no portal" },
        { nivel: 2, canal: "telefone", valor: "0800 000 0001", nome: "Suporte N2", horario: "24x7", obs: "" }
      ], obs: "Card fictício de exemplo. Pode apagar." })
  ];
}
function load() {
  try { itens = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { itens = []; }
  if (!Array.isArray(itens)) itens = [];
  const antes = itens.length;
  // Remove exemplos de versões anteriores (só se ainda estiverem com a senha de exemplo original).
  itens = itens.filter((it) => !(["j1", "j2", "a1", "f1", "f2", "f3"].includes(it.id) && it.senha === "exemplo"));
  const removeuAntigos = itens.length < antes;
  if (localStorage.getItem(KEY) === null || removeuAntigos) {
    const ids = new Set(itens.map((it) => it.id));
    exemplos().forEach((it) => { if (!ids.has(it.id)) itens.push(it); });
  }
  // Exemplos novos entram uma única vez em quem já tem cards (se apagar, não volta).
  let entregues = [];
  try { entregues = JSON.parse(localStorage.getItem(KEY + "_exemplos") || "[]"); } catch (e) { entregues = []; }
  let mudou = removeuAntigos;
  exemplos().forEach((it) => {
    if (!entregues.includes(it.id)) {
      // v1.9.2: quem já usa o app não recebe o novo exemplo (só marca como entregue).
      entregues.push(it.id);
    }
  });
  localStorage.setItem(KEY + "_exemplos", JSON.stringify(entregues));
  itens.forEach((it) => {
    if (!Array.isArray(it.escalonamentos)) it.escalonamentos = [];
    if (!it.escalonamentos.length && it.escalonamento) {
      const parsed = parseEscalonamentoTexto(it.escalonamento);
      if (parsed.length) { it.escalonamentos = parsed; mudou = true; }
    }
  });
  // v1.4: enriquece exemplos fictícios que ainda estão com a senha de demo e sem níveis estruturados.
  const demoSenhas = new Set(["fornecedor123", "nuvem123", "exemplo321"]);
  const porId = Object.fromEntries(exemplos().map((e) => [e.id, e]));
  itens.forEach((it) => {
    const ex = porId[it.id];
    if (!ex || !ex.escalonamentos || !ex.escalonamentos.length) return;
    if (!demoSenhas.has(it.senha)) return;
    if (it.escalonamentos && it.escalonamentos.length) return;
    it.escalonamentos = ex.escalonamentos.map((n) => Object.assign({}, n));
    if (!it.escalonamento) it.escalonamento = ex.escalonamento || resumoEscalonamentos(it.escalonamentos);
    mudou = true;
  });
  if (mudou) localStorage.setItem(KEY, JSON.stringify(itens));
  if (window.CadernoSync && !syncMeta().marcas) carimbarMudancas();
}
function save() {
  if (window.CadernoSync) carimbarMudancas();
  registrarMeus();
  localStorage.setItem(KEY, JSON.stringify(itens));
  render();
  if (window.CadernoSync) agendarSync();
}

/* ---------- Ícones SVG inline (funcionam offline) ---------- */
const IC = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.3L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.3L20 16M20 20v-4h-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6M9 10.5h6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
};
function svg(nome, tam) {
  return '<svg class="ic" viewBox="0 0 24 24" width="' + (tam || 18) + '" height="' + (tam || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[nome] || "") + "</svg>";
}
function aplicarIcones(raiz) {
  (raiz || document).querySelectorAll("[data-ic]").forEach((n) => {
    if (n.dataset.icOk) return;
    n.insertAdjacentHTML("afterbegin", svg(n.dataset.ic, n.classList.contains("fab") ? 26 : 20));
    n.dataset.icOk = "1";
  });
}
function setOlho(btn, ver) {
  if (!btn) return;
  btn.innerHTML = svg(ver ? "eyeOff" : "eye", 20);
  btn.setAttribute("aria-label", ver ? "Ocultar senha" : "Mostrar senha");
  btn.title = btn.getAttribute("aria-label");
}
function ligarOlho(btn) {
  if (!btn || btn.dataset.olhoOk) return;
  btn.dataset.olhoOk = "1";
  btn.type = "button";
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    const id = btn.dataset.alvo;
    const inp = id ? document.getElementById(id) : btn.closest(".senha-campo") && btn.closest(".senha-campo").querySelector("input");
    if (!inp) return;
    const ver = inp.type === "password";
    inp.type = ver ? "text" : "password";
    setOlho(btn, ver);
  });
}
function resetarOlhos(ids) {
  ids.forEach((id) => {
    const inp = document.getElementById(id);
    if (inp) inp.type = "password";
    const btn = document.querySelector('.olho[data-alvo="' + id + '"]');
    setOlho(btn, false);
  });
}


/* ---------- Helpers ---------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function btn(cls, icone, texto, fn, titulo, dica) {
  const b = el("button", cls);
  b.type = "button";
  if (icone) b.insertAdjacentHTML("beforeend", svg(icone, 18));
  if (texto) b.appendChild(el("span", "", texto));
  if (titulo) { b.title = titulo; b.setAttribute("aria-label", titulo); }
  if (dica) b.title = dica;
  b.addEventListener("click", (ev) => { ev.stopPropagation(); fn(ev); });
  return b;
}
let toastTimer = null;
function toast(msg, acao) {
  const t = document.getElementById("toast");
  t.innerHTML = "";
  t.appendChild(el("span", "", msg));
  t.classList.toggle("com-acao", !!acao);
  if (acao) {
    const b = el("button", "toast-acao", acao.texto);
    b.type = "button";
    b.addEventListener("click", (ev) => { ev.stopPropagation(); t.classList.remove("on"); clearTimeout(toastTimer); acao.fn(); });
    t.appendChild(b);
  }
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), acao ? (acao.ms || 6000) : 2200);
}

/* ---------- Diálogo no visual do app (substitui alert/confirm) ---------- */
function dialogo(op) {
  return new Promise((resolve) => {
    const box = $("dlg");
    $("dlgTitulo").textContent = op.titulo || "";
    $("dlgTexto").textContent = op.texto || "";
    $("dlgTexto").hidden = !op.texto;
    const ok = $("dlgOk"), cancel = $("dlgCancelar");
    ok.textContent = op.ok || "OK";
    ok.className = "btn " + (op.perigo ? "perigo" : "pri");
    cancel.hidden = op.cancelar === false;
    cancel.textContent = op.cancelar || "Cancelar";
    function fim(v) {
      ok.onclick = cancel.onclick = box.onclick = null;
      document.removeEventListener("keydown", tecla, true);
      fecharSheet("dlg");
      resolve(v);
    }
    function tecla(ev) { if (ev.key === "Escape") { ev.stopPropagation(); fim(false); } }
    ok.onclick = () => fim(true);
    cancel.onclick = () => fim(false);
    box.onclick = (ev) => { if (cliqueNoFundo(ev, box)) fim(false); };
    document.addEventListener("keydown", tecla, true);
    abrirSheet("dlg");
    setTimeout(() => (op.cancelar === false ? ok : cancel).focus(), 30);
  });
}
function aviso(titulo, texto) { return dialogo({ titulo: titulo, texto: texto, ok: "OK", cancelar: false }); }

/* ---------- Excluir (só arquivados) com desfazer ---------- */
function nomeDe(it) { return it.titulo || it.aplicacao || "este acesso"; }
// v1.9.6: a sincronização em segundo plano troca os objetos dos cards da Equipe; sempre busca o card atual pelo id.
function atual(it) { return it ? (itens.find((x) => x.id === it.id) || null) : null; }
async function excluir(lista) {
  lista = lista.map(atual).filter((it) => it && it.arquivado_em);
  if (!lista.length) return false;
  const sim = await dialogo({
    titulo: lista.length === 1 ? "Excluir " + nomeDe(lista[0]) + " de vez?" : "Excluir " + lista.length + " acessos de vez?",
    texto: "Essa ação não pode ser desfeita.",
    ok: "Excluir", cancelar: "Cancelar", perigo: true
  });
  if (!sim) return false;
  const removidos = [];
  lista.forEach((it) => { const i = itens.findIndex((x) => x.id === it.id); if (i >= 0) removidos.push({ i: i, it: itens[i] }); });
  removidos.sort((a, b) => b.i - a.i).forEach((r) => itens.splice(r.i, 1));
  sairSelecao(false);
  save();
  toast(removidos.length === 1 ? "Excluído" : removidos.length + " excluídos", { texto: "Desfazer", ms: 6000, fn: () => {
    removidos.sort((a, b) => a.i - b.i).forEach((r) => { if (!itens.some((x) => x.id === r.it.id)) itens.splice(Math.min(r.i, itens.length), 0, r.it); });
    save();
    toast("Restaurado");
  } });
  return true;
}

/* ---------- Seleção múltipla (só na aba Arquivo) ---------- */
let selecao = null;
let ignorarClique = false;
// Um novo toque/clique começa: descarta o "engolir clique" do long-press anterior (o DOM pode ter sido redesenhado).
document.addEventListener("pointerdown", () => { ignorarClique = false; }, true);
function entrarSelecao(id) {
  if (aba !== "arquivo") return;
  if (!selecao) selecao = new Set();
  selecao.add(id);
  render();
}
function alternarSelecao(id) {
  if (!selecao) return;
  if (selecao.has(id)) selecao.delete(id); else selecao.add(id);
  if (!selecao.size) { sairSelecao(); return; }
  render();
}
function sairSelecao(rerender) {
  selecao = null;
  if (rerender !== false) render();
}
function selecionados() { return selecao ? itens.filter((it) => selecao.has(it.id)) : []; }
function ligarPressao(c, it) {
  let timer = null, x0 = 0, y0 = 0;
  const cancelar = () => { clearTimeout(timer); timer = null; };
  c.addEventListener("pointerdown", (ev) => {
    if (aba !== "arquivo" || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    x0 = ev.clientX; y0 = ev.clientY;
    cancelar();
    timer = setTimeout(() => { timer = null; ignorarClique = true; entrarSelecao(it.id); if (navigator.vibrate) navigator.vibrate(30); }, 500);
  });
  c.addEventListener("pointermove", (ev) => { if (timer && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) cancelar(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => c.addEventListener(t, cancelar));
  c.addEventListener("contextmenu", (ev) => {
    if (aba !== "arquivo") return;
    ev.preventDefault();
    cancelar();
    if (!selecao || !selecao.has(it.id)) entrarSelecao(it.id);
  });
  c.addEventListener("click", (ev) => {
    if (ignorarClique) { ignorarClique = false; ev.preventDefault(); ev.stopPropagation(); return; }
    if (selecao && aba === "arquivo") { ev.preventDefault(); ev.stopPropagation(); alternarSelecao(it.id); }
  }, true);
}
function atualizarBarraSelecao() {
  const bar = $("selBar");
  const on = !!(selecao && aba === "arquivo");
  bar.hidden = !on;
  document.body.classList.toggle("selecionando", on);
  if (on) $("selQtd").textContent = selecao.size + (selecao.size === 1 ? " selecionado" : " selecionados");
}

/* ---------- Temas ---------- */
const TEMAS = { claro: { nome: "Claro", cor: "#1B365D" }, escuro: { nome: "Escuro", cor: "#0B1626" }, suave: { nome: "Suave", cor: "#2C4766" } };
const TEMA_KEY = "caderno-tema";
function temaAtual() { const t = localStorage.getItem(TEMA_KEY); return TEMAS[t] ? t : "claro"; }
function aplicarTema(t) {
  if (!TEMAS[t]) t = "claro";
  document.documentElement.setAttribute("data-tema", t);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", TEMAS[t].cor);
  const dr = document.querySelector('.dr-item[data-acao="tema"] .dr-tema');
  if (dr) dr.textContent = TEMAS[t].nome;
}
function definirTema(t) {
  localStorage.setItem(TEMA_KEY, t);
  aplicarTema(t);
  if (aba === "mais") render();
}
function copiar(texto, rotuloMsg) {
  if (!texto) { toast("Nada para copiar"); return; }
  const rot = rotuloMsg || "Senha";
  const ok = () => {
    if (rot === "Senha") { agendarLimparClipboard(texto); toast("Senha copiada · a área de transferência será limpa em " + (LIMPAR_CLIP_MS / 1000) + " s"); }
    else toast(rot + " copiada");
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(ok).catch(() => fallbackCopiar(texto) ? ok() : toast("Não foi possível copiar"));
  } else if (fallbackCopiar(texto)) ok();
  else toast("Não foi possível copiar");
}
const OCULTAR_MS = 10000;
const LIMPAR_CLIP_MS = 30000;
let clipTimer = null;
function agendarLimparClipboard(valor) {
  clearTimeout(clipTimer);
  clipTimer = setTimeout(() => limparClipboard(valor), LIMPAR_CLIP_MS);
}
async function limparClipboard(valor) {
  clipTimer = null;
  const cb = navigator.clipboard;
  try {
    if (cb && cb.readText) {
      const atual = await cb.readText();
      if (atual !== valor) return; // usuário já copiou outra coisa
    }
  } catch (e) { /* leitura não permitida: limpa mesmo assim */ }
  try {
    if (cb && cb.writeText) { await cb.writeText(""); return; }
  } catch (e) { /* sem foco/permissão */ }
  fallbackCopiar(" ");
}
function fallbackCopiar(texto) {
  const ta = document.createElement("textarea");
  ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}
/* Só http/https (bloqueia javascript:, data: etc. vindos de JSON/Excel importado) */
function urlSegura(url) {
  const v = String(url || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[^:\/]+:\d+(\/|$)/.test(v)) return "";
  return "https://" + v;
}
function abrirUrl(url) {
  if (!url) { toast("Card sem URL"); return; }
  const u = urlSegura(url);
  if (!u) { toast("URL inválida (use http:// ou https://)"); return; }
  window.open(u, "_blank", "noopener");
}
function diasRestantes(it) {
  if (!it.ultima || !it.ciclo || it.ciclo === "Nunca") return null;
  return Math.round((new Date(addDias(it.ultima, Number(it.ciclo)) + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 86400000);
}
const CORES = ["#0F6B8A", "#1B5FAD", "#1B365D", "#5B4BB7", "#0E7C5A", "#B4530A", "#9D2B6B", "#2F6F73"];
function corDe(it) {
  const s = (it.aplicacao || it.titulo || "") + "|" + (it.categoria || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
}
const MASCARA = "••••••••••";


/* ---------- Escalonamento ---------- */
const CANAIS_ESC = [
  { id: "portal", rotulo: "Portal" },
  { id: "email", rotulo: "E-mail" },
  { id: "telefone", rotulo: "Telefone" },
  { id: "outro", rotulo: "Outro" }
];
function canalRotulo(c) {
  const hit = CANAIS_ESC.find((x) => x.id === c);
  return hit ? hit.rotulo : (c || "Outro");
}
function nivelEscVazio(n) {
  return { nivel: n || 1, canal: "email", valor: "", nome: "", horario: "", obs: "" };
}
function limparNivelEsc(raw) {
  if (!raw || typeof raw !== "object") return null;
  const canal = ["portal", "email", "telefone", "outro"].includes(raw.canal) ? raw.canal : "outro";
  const nivel = Number(raw.nivel);
  return {
    nivel: Number.isFinite(nivel) && nivel > 0 ? Math.floor(nivel) : 1,
    canal: canal,
    valor: String(raw.valor || "").trim(),
    nome: String(raw.nome || "").trim(),
    horario: String(raw.horario || "").trim(),
    obs: String(raw.obs || "").trim()
  };
}
function resumoEscalonamentos(lista) {
  if (!lista || !lista.length) return "";
  return lista.map((n) => {
    const ped = ["N" + n.nivel, canalRotulo(n.canal)];
    if (n.nome) ped.push(n.nome);
    if (n.valor) ped.push(n.valor);
    return ped.join(" · ");
  }).join(" | ");
}
function parseEscalonamentoTexto(texto) {
  const t = String(texto || "").replace(/\u200b/g, "").trim();
  if (!t) return [];
  const linhas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const emailRe = /[\w.+-]+@[\w.-]+\.\w+/g;
  const phoneRe = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}|\b0800[\s.-]?\d{2,4}[\s.-]?\d{3,5}\b/g;
  const urlRe = /https?:\/\/[^\s)\]>]+/gi;
  const niveis = [];
  let atual = null;
  function flush() {
    if (!atual) return;
    if (!atual.valor && !atual.nome && !atual.obs) { atual = null; return; }
    if (!atual.valor && atual.obs) {
      const urls = atual.obs.match(urlRe);
      const emails = atual.obs.match(emailRe);
      const phones = atual.obs.match(phoneRe);
      if (urls && urls[0]) { atual.valor = urls[0]; atual.canal = "portal"; }
      else if (emails && emails[0]) { atual.valor = emails[0]; atual.canal = "email"; }
      else if (phones && phones[0]) { atual.valor = phones[0]; atual.canal = "telefone"; }
    }
    niveis.push(atual);
    atual = null;
  }
  function novoNivel(num, resto) {
    flush();
    atual = nivelEscVazio(num);
    const urls = resto.match(urlRe);
    const emails = resto.match(emailRe);
    const phones = resto.match(phoneRe);
    if (urls && urls[0]) { atual.canal = "portal"; atual.valor = urls[0]; }
    else if (emails && emails[0]) { atual.canal = "email"; atual.valor = emails[0]; }
    else if (phones && phones[0]) { atual.canal = "telefone"; atual.valor = phones[0]; }
    let nome = resto
      .replace(urlRe, " ")
      .replace(emailRe, " ")
      .replace(phoneRe, " ")
      .replace(/[-–—|:]+/g, " ")
      .replace(/\(\s*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    nome = nome.replace(/^(abrir chamado|ligar|enviar|contato|suporte|help\s*desk|plant[aã]o)\b[\s-]*/i, "").trim();
    if (nome && nome.length <= 60) atual.nome = nome;
    atual.obs = resto.trim();
  }
  if (!linhas.length) return [];
  linhas.forEach((line) => {
    const m = line.match(/^(?:n[ií]vel|escalonamento)\s*-?\s*(\d+)\s*[-–—:]?\s*(.*)$/i);
    if (m) { novoNivel(Number(m[1]), m[2] || ""); return; }
    if (!atual) {
      // sem marcador de nível: cria sequência
      novoNivel(niveis.length + 1, line);
      return;
    }
    const urls = line.match(urlRe);
    const emails = line.match(emailRe);
    const phones = line.match(phoneRe);
    if (!atual.valor) {
      if (urls && urls[0]) { atual.canal = "portal"; atual.valor = urls[0]; }
      else if (emails && emails[0]) { atual.canal = "email"; atual.valor = emails[0]; }
      else if (phones && phones[0]) { atual.canal = "telefone"; atual.valor = phones[0]; }
    } else if (emails && emails[0] && atual.canal !== "email") {
      // linha extra com outro contato → novo nível
      novoNivel(niveis.length + (atual ? 1 : 0) + 1, line);
      return;
    }
    if (!atual.nome) {
      let nome = line.replace(urlRe, " ").replace(emailRe, " ").replace(phoneRe, " ").replace(/[-–—|:()]+/g, " ").replace(/\s+/g, " ").trim();
      if (nome && nome.length <= 60) atual.nome = nome;
    }
    atual.obs = (atual.obs ? atual.obs + " | " : "") + line;
  });
  flush();
  // se parser gerou 1 nível genérico sem canal útil, ainda retorna
  return niveis.map((n, i) => { n.nivel = n.nivel || (i + 1); return limparNivelEsc(n); }).filter(Boolean);
}
function niveisDe(it) {
  if (!it) return [];
  if (Array.isArray(it.escalonamentos) && it.escalonamentos.length) {
    return it.escalonamentos.map(limparNivelEsc).filter(Boolean).sort((a, b) => a.nivel - b.nivel);
  }
  return parseEscalonamentoTexto(it.escalonamento);
}
function hrefEsc(nivel) {
  const v = (nivel.valor || "").trim();
  if (!v) return "";
  if (nivel.canal === "email" || /^[\w.+-]+@[\w.-]+\.\w+$/.test(v)) return "mailto:" + v;
  if (nivel.canal === "telefone" || /^[\d\s()+.-]{8,}$/.test(v)) return "tel:" + v.replace(/[^\d+]/g, "");
  if (nivel.canal === "portal" || /^https?:\/\//i.test(v) || /\./.test(v)) return urlSegura(v);
  return "";
}

/* ---------- Lista ---------- */
function visiveis() {
  const q = (document.getElementById("busca").value || "").trim().toLowerCase();
  return itens.filter((it) => {
    const arq = !!it.arquivado_em;
    if (aba === "equipe" && (it.visibilidade !== "Equipe" || arq)) return false;
    if (aba === "meu" && (it.visibilidade !== "Individual" || arq)) return false;
    if (aba === "vencendo" && (arq || ["Vencendo", "Vencido"].indexOf(statusDe(it)) < 0)) return false;
    if (aba === "arquivo" && !arq) return false;
    if (aba === "mais" || aba === "gerador") return false;
    const blob = [it.titulo, it.aplicacao, it.cliente, it.usuario, it.url, it.categoria, it.visibilidade, it.escalonamento, resumoEscalonamentos(niveisDe(it))].join(" ").toLowerCase();
    return !q || blob.indexOf(q) >= 0;
  }).sort((a, b) => String(a.aplicacao || a.titulo || "").localeCompare(String(b.aplicacao || b.titulo || "")) || String(a.cliente || "").localeCompare(String(b.cliente || "")) || String(a.titulo || "").localeCompare(String(b.titulo || "")));
}
function render() {
  const box = document.getElementById("lista");
  box.innerHTML = "";
  fecharMenus();
  if (aba !== "arquivo") selecao = null;
  if (selecao) { const ids = new Set(itens.map((x) => x.id)); selecao.forEach((id) => { if (!ids.has(id)) selecao.delete(id); }); if (!selecao.size) selecao = null; }
  atualizarBarraSelecao();
  box.classList.toggle("modo-sel", !!selecao);
  const nVenc = itens.filter((it) => !it.arquivado_em && ["Vencendo", "Vencido"].indexOf(statusDe(it)) >= 0).length;
  document.getElementById("contVenc").textContent = nVenc ? String(nVenc) : "";
  const painel = aba === "mais" || aba === "gerador";
  document.getElementById("buscaWrap").classList.toggle("oculto", painel);
  document.getElementById("novo").classList.toggle("oculto", painel);
  box.classList.toggle("mais", painel);
  if (aba === "mais") { renderMais(box); return; }
  if (aba === "gerador") { renderGerador(box); return; }
  const list = visiveis();
  if (!list.length) {
    box.appendChild(el("p", "vazio", document.getElementById("busca").value ? "Nenhum acesso encontrado para essa busca." : "Nenhum card nesta aba."));
    return;
  }
  const grupos = [];
  list.forEach((it) => {
    const nome = it.aplicacao || it.titulo || "Sem aplicação";
    let g = grupos.find((x) => x.nome === nome);
    if (!g) { g = { nome: nome, itens: [] }; grupos.push(g); }
    g.itens.push(it);
  });
  grupos.forEach((g) => {
    const sec = el("section", "grupo");
    const h = el("h2", "grupo-topo");
    h.insertAdjacentHTML("beforeend", svg("folder", 20));
    h.appendChild(el("span", "", g.nome));
    if (g.itens.length > 1) h.appendChild(el("span", "grupo-qtd", g.itens.length + " acessos"));
    sec.appendChild(h);
    g.itens.forEach((it) => sec.appendChild(cardDe(it)));
    box.appendChild(sec);
  });
}
function statusBadge(it) {
  const st = statusDe(it);
  const d = diasRestantes(it);
  if (st === "Arquivado") return el("span", "st st-arq", "Arquivado");
  if (st === "Vencido") { const b = el("span", "st st-vencido"); b.insertAdjacentHTML("beforeend", svg("alert", 14)); b.appendChild(el("span", "", "Vencido")); b.title = "Vencido há " + Math.abs(d) + " dia(s)"; return b; }
  if (st === "Vencendo") { const b = el("span", "st st-vencendo"); b.insertAdjacentHTML("beforeend", svg("clock", 14)); b.appendChild(el("span", "", "Vencendo")); b.title = "Vence em " + d + " dia(s)"; return b; }
  if (st === "Sem expiração") return el("span", "st st-ok", "Não expira");
  const b = el("span", "st st-ok"); b.insertAdjacentHTML("beforeend", svg("check", 14)); b.appendChild(el("span", "", "OK")); return b;
}
function linhaSecreta(rotulo, valor, card, tipo) {
  const row = el("div", "linha");
  row.appendChild(el("span", "linha-rot", rotulo));
  const val = el("span", "linha-val secreto", valor ? MASCARA : "—");
  val.dataset.tipo = tipo;
  row.appendChild(val);
  if (valor) {
    const olho = btn("olho", "eye", "", () => alternar(), "Mostrar " + rotulo.toLowerCase());
    function alternar(forcar) {
      const ver = forcar != null ? forcar : !val.classList.contains("aberto");
      val.classList.toggle("aberto", ver);
      val.textContent = ver ? valor : MASCARA;
      olho.innerHTML = svg(ver ? "eyeOff" : "eye", 18);
      olho.setAttribute("aria-label", (ver ? "Ocultar " : "Mostrar ") + rotulo.toLowerCase());
      olho.title = olho.getAttribute("aria-label");
      clearTimeout(alternar._t);
      if (ver) alternar._t = setTimeout(() => { if (val.classList.contains("aberto")) alternar(false); }, OCULTAR_MS);
    }
    row.appendChild(olho);
    card._alternadores = (card._alternadores || []).concat([alternar]);
  } else {
    row.appendChild(el("span", "olho-vazio"));
  }
  return row;
}
function cardDe(it) {
  const st = statusDe(it);
  const c = el("article", "card c-" + ({ Vencendo: "vencendo", Vencido: "vencido", Arquivado: "arq" }[st] || "ok"));
  c.dataset.id = it.id;
  if (aba === "arquivo") {
    ligarPressao(c, it);
    if (selecao) {
      const marcado = selecao.has(it.id);
      c.classList.toggle("selecionado", marcado);
      c.setAttribute("aria-selected", marcado ? "true" : "false");
      const chk = el("span", "sel-check");
      if (marcado) chk.innerHTML = svg("check", 16);
      c.appendChild(chk);
    }
  }
  const topo = el("div", "card-topo");
  const av = el("span", "avatar");
  av.style.background = corDe(it);
  av.innerHTML = svg(it.categoria === "Externo" ? "globe" : "building", 22);
  topo.appendChild(av);
  const tt = el("div", "card-tit");
  tt.appendChild(el("h3", "", it.titulo || it.aplicacao || "(sem título)"));
  const ind = it.visibilidade === "Individual";
  tt.appendChild(el("div", "card-sub", (ind ? "Acesso individual" : "Acesso compartilhado") + (it.cliente ? " · " + it.cliente : "")));
  const tags = el("div", "tags");
  const tv = el("span", "tag " + (ind ? "tag-ind" : "tag-eq"));
  tv.insertAdjacentHTML("beforeend", svg(ind ? "user" : "users", 13));
  tv.appendChild(el("span", "", ind ? "Individual" : "Equipe"));
  tags.appendChild(tv);
  tags.appendChild(el("span", "tag " + (it.categoria === "Externo" ? "tag-ext" : "tag-int"), it.categoria || "Interno"));
  tt.appendChild(tags);
  topo.appendChild(tt);
  const dir = el("div", "card-dir");
  dir.appendChild(statusBadge(it));
  dir.appendChild(btn("ico-mini mais-btn", "more", "", (ev) => abrirMenuCard(it, ev.currentTarget), "Mais ações"));
  topo.appendChild(dir);
  c.appendChild(topo);

  const linhas = el("div", "linhas");
  linhas.appendChild(linhaSecreta("Usuário", it.usuario, c, "usuario"));
  linhas.appendChild(linhaSecreta("Senha", it.senha, c, "senha"));
  const lu = el("div", "linha");
  lu.appendChild(el("span", "linha-rot", "URL"));
  if (it.url) {
    const a = el("a", "linha-val url", it.url.replace(/^https?:\/\//, ""));
    const hu = urlSegura(it.url);
    if (hu) a.href = hu;
    a.target = "_blank"; a.rel = "noopener";
    lu.appendChild(a);
    lu.appendChild(btn("olho", "external", "", () => abrirUrl(it.url), "Abrir URL"));
  } else { lu.appendChild(el("span", "linha-val", "—")); lu.appendChild(el("span", "olho-vazio")); }
  linhas.appendChild(lu);
  const d = diasRestantes(it);
  let info = it.arquivado_em ? "Arquivado em " + it.arquivado_em : (it.ciclo === "Nunca" || !it.ciclo) ? "Ciclo: não expira" : "Ciclo " + it.ciclo + " dias · " + (d < 0 ? "vencido há " + Math.abs(d) + " dia(s)" : "vence em " + d + " dia(s)");
  if (ind && !it.senha && !it.usuario && !it.modeloId) info += " · usuário/senha não compartilhados";
  linhas.appendChild(el("div", "card-info", info));
  if (ind && it.modeloId && !it.usuario && !it.senha) {
    const h = el("div", "mod-hint");
    h.appendChild(el("strong", "", "✏️ Preencha seu login e senha"));
    h.appendChild(el("small", "", "Adicionado do card compartilhado por " + (it.modeloPor || "alguém da equipe")));
    h.appendChild(btn("btn pequeno", "edit", "Editar e preencher", () => abrirFicha(it)));
    linhas.appendChild(h);
  }
  c.appendChild(linhas);

  const niveis = niveisDe(it);
  if (niveis.length || (it.escalonamento && String(it.escalonamento).trim())) {
    const esc = el("div", "esc-bloco");
    const tog = el("button", "esc-toggle");
    tog.type = "button";
    tog.title = "Ver ou esconder os contatos de escalonamento";
    tog.insertAdjacentHTML("beforeend", svg("users", 16));
    tog.appendChild(el("span", "", "Escalonamento" + (niveis.length ? " (" + niveis.length + ")" : "")));
    const chev = el("span", "esc-chev");
    chev.innerHTML = svg("plus", 16);
    tog.appendChild(chev);
    const corpo = el("div", "esc-corpo");
    if (niveis.length) {
      niveis.forEach((nv) => {
        const item = el("div", "esc-item");
        const topoN = el("div", "esc-item-topo");
        topoN.appendChild(el("span", "esc-nivel", "N" + nv.nivel));
        topoN.appendChild(el("span", "esc-canal", canalRotulo(nv.canal)));
        item.appendChild(topoN);
        if (nv.nome) item.appendChild(el("div", "esc-nome", nv.nome));
        const val = el("div", "esc-valor");
        const href = hrefEsc(nv);
        if (href && nv.valor) {
          const a = el("a", "", nv.valor);
          a.href = href;
          if (href.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; }
          val.appendChild(a);
        } else {
          val.textContent = nv.valor || "—";
        }
        item.appendChild(val);
        const meta = [nv.horario, nv.obs].filter(Boolean).join(" · ");
        if (meta) item.appendChild(el("div", "esc-meta", meta));
        corpo.appendChild(item);
      });
    } else {
      corpo.appendChild(el("div", "esc-vazio", it.escalonamento));
    }
    tog.addEventListener("click", (ev) => {
      ev.stopPropagation();
      esc.classList.toggle("aberto");
      chev.innerHTML = svg(esc.classList.contains("aberto") ? "x" : "plus", 16);
    });
    esc.appendChild(tog);
    esc.appendChild(corpo);
    c.appendChild(esc);
  }

  const acoes = el("div", "acoes");
  const bMostrar = btn("acao", "eye", "Mostrar", () => {
    const abrir = !c.classList.contains("revelado");
    c.classList.toggle("revelado", abrir);
    (c._alternadores || []).forEach((f) => f(abrir));
    bMostrar.querySelector("span").textContent = abrir ? "Ocultar" : "Mostrar";
    bMostrar.title = abrir ? "Ocultar usuário e senha" : "Mostrar usuário e senha";
    bMostrar.querySelector("svg").outerHTML = svg(abrir ? "eyeOff" : "eye", 18);
    clearTimeout(c._ocultarT);
    if (abrir) {
      c._ocultarT = setTimeout(() => { if (c.classList.contains("revelado")) bMostrar.click(); }, OCULTAR_MS);
      toast("A senha será ocultada em " + (OCULTAR_MS / 1000) + " s");
    }
  }, null, "Mostrar usuário e senha");
  if (!it.senha && !it.usuario) bMostrar.disabled = true;
  acoes.appendChild(bMostrar);
  const bCop = btn("acao", "copy", "Copiar", () => copiar(it.senha, "Senha"), null, "Copiar a senha");
  if (!it.senha) bCop.disabled = true;
  acoes.appendChild(bCop);
  const bAb = btn("acao", "external", "Abrir", () => abrirUrl(it.url), null, "Abrir a URL em nova aba");
  if (!it.url) bAb.disabled = true;
  acoes.appendChild(bAb);
  c.appendChild(acoes);
  if (ind && !it.arquivado_em && aba !== "arquivo") {
    if (it.modeloDono) c.appendChild(el("div", "mod-compartilhado", "Compartilhado com a equipe (sem login e senha)"));
    else c.appendChild(btn("btn mod-share", "share", "Compartilhar meu card", () => compartilharMeuCard(it), null, "Envia nome, link, sistema, escalonamento e observações para a equipe, sem login e senha"));
  }
  return c;
}
function fecharMenus() { document.querySelectorAll(".menu-card").forEach((m) => m.remove()); }
function abrirMenuCard(it, ancora) {
  const jaAberto = ancora.parentNode.querySelector(".menu-card");
  fecharMenus();
  if (jaAberto) return;
  const m = el("div", "menu-card");
  m.setAttribute("role", "menu");
  const id = it.id;
  const cur = (fn) => () => { fecharMenus(); const c = atual({ id: id }); if (!c) { toast("Este card não existe mais"); render(); return; } fn(c); };
  m.appendChild(btn("mi", "edit", "Editar", cur((c) => abrirFicha(c)), null, "Editar este acesso"));
  m.appendChild(btn("mi", "copy", "Copiar usuário", cur((c) => copiar(c.usuario, "Usuário"))));
  if (it.visibilidade === "Individual" && !it.arquivado_em) {
    if (it.modeloDono) m.appendChild(btn("mi", "x", "Parar de compartilhar", () => { fecharMenus(); pararCompartilhar(atual(it) || it); }));
    else m.appendChild(btn("mi", "share", "Compartilhar meu card", cur((c) => compartilharMeuCard(c))));
  }
  if (it.arquivado_em) {
    m.appendChild(btn("mi ok", "restore", "Reativar", cur((c) => { c.arquivado_em = null; save(); toast("Card reativado"); })));
    m.appendChild(btn("mi warn", "trash", "Excluir", cur((c) => excluir([c]))));
  }
  else m.appendChild(btn("mi warn", "archive", "Arquivar", cur((c) => { c.arquivado_em = hoje(); save(); toast("Card arquivado"); })));
  ancora.parentNode.appendChild(m);
}
document.addEventListener("click", (ev) => { if (!ev.target.closest(".menu-card")) fecharMenus(); });

/* ---------- Aba Mais ---------- */
/* ---------- Gerador de senhas ---------- */
const GEN_KEY = "caderno-acessos-gerador";
const GEN_PAD = { modo: "aleatoria", tam: 16, mai: true, min: true, num: true, sim: true, parecidos: true };
const GEN_SETS = { mai: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", min: "abcdefghijklmnopqrstuvwxyz", num: "0123456789", sim: "!@#$%&*?-_=+.:;" };
const PARECIDOS = /[O0oIl1|]/g;
function genOpcoes() {
  try { return Object.assign({}, GEN_PAD, JSON.parse(localStorage.getItem(GEN_KEY) || "{}")); } catch (e) { return Object.assign({}, GEN_PAD); }
}
function genSalvar(o) { const c = Object.assign({}, o); delete c.palavra; localStorage.setItem(GEN_KEY, JSON.stringify(c)); }
function rnd(n) {
  const lim = Math.floor(0x100000000 / n) * n; const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= lim);
  return a[0] % n;
}
function escolher(str) { return str[rnd(str.length)]; }
function embaralhar(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
function genConjuntos(o) {
  return ["mai", "min", "num", "sim"].filter((k) => o[k]).map((k) => o.parecidos ? GEN_SETS[k].replace(PARECIDOS, "") : GEN_SETS[k]);
}
function gerarAleatoria(o) {
  const sets = genConjuntos(o.mai || o.min || o.num || o.sim ? o : Object.assign({}, o, { min: true }));
  const tam = Math.max(sets.length, Math.min(64, (o.tam | 0) || 16));
  const todos = sets.join("");
  const out = sets.map(escolher);
  while (out.length < tam) out.push(escolher(todos));
  return embaralhar(out).join("");
}
const LEET = { a: "4@", e: "3", i: "1!", o: "0", s: "5$", t: "7", g: "9", b: "8", l: "1", z: "2" };
function gerarDePalavra(o) {
  const base = String(o.palavra || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  if (!base) return "";
  const w = base.split("").map((ch) => {
    const lc = ch.toLowerCase();
    if (LEET[lc] && rnd(100) < 45) return escolher(LEET[lc]);
    return rnd(2) ? ch.toUpperCase() : lc;
  });
  const extra = GEN_SETS.num + GEN_SETS.sim + GEN_SETS.mai;
  const alvo = Math.max((o.tam | 0) || 16, w.length + 4);
  const meio = 1 + rnd(2);
  for (let i = 0; i < meio; i++) w.splice(1 + rnd(Math.max(1, w.length - 1)), 0, escolher(extra));
  while (w.length < alvo) { if (rnd(3) === 0) w.unshift(escolher(extra)); else w.push(escolher(extra)); }
  let s = w.join("");
  if (o.parecidos) s = s.replace(PARECIDOS, () => escolher("23456789"));
  if (!/[A-Z]/.test(s)) s += escolher("ABCDEFGHJKMNPQRSTUVWXYZ");
  if (!/\d/.test(s)) s += escolher("23456789");
  if (!/[^A-Za-z0-9]/.test(s)) s += escolher(GEN_SETS.sim);
  return s;
}
function gerarSenha(o) { o = o || genOpcoes(); return o.modo === "palavra" ? gerarDePalavra(o) : gerarAleatoria(o); }
function forcaSenha(s) {
  if (!s) return { n: 0, rot: "—" };
  let pool = 0;
  if (/[a-z]/.test(s)) pool += 26;
  if (/[A-Z]/.test(s)) pool += 26;
  if (/\d/.test(s)) pool += 10;
  if (/[^A-Za-z0-9]/.test(s)) pool += 15;
  const bits = s.length * Math.log2(pool || 1);
  if (bits < 40) return { n: 1, rot: "Fraca" };
  if (bits < 60) return { n: 2, rot: "Média" };
  if (bits < 80) return { n: 3, rot: "Forte" };
  return { n: 4, rot: "Muito forte" };
}
let genAtual = "";
let genPalavra = "";
function renderGerador(box) {
  const o = genOpcoes(); o.palavra = genPalavra;
  const c = el("article", "card painel-mais gerador");
  c.appendChild(el("h3", "", "Gerador de senhas"));
  c.appendChild(el("p", "meta", "Gera senhas fortes neste aparelho, sem internet. Só as opções ficam salvas."));
  const modos = el("div", "acoes-mais gen-modos");
  const corpo = el("div", "gen-corpo");
  const val = el("code", "gen-valor", "");
  const barra = el("div", "gen-forca"); const fill = el("span", "gen-forca-fill"); barra.appendChild(fill);
  const rot = el("span", "gen-forca-rot", "");
  const mostrar = (s) => { genAtual = s; val.textContent = s || "Digite uma palavra base"; const f = forcaSenha(s); fill.className = "gen-forca-fill f" + f.n; rot.textContent = "Força: " + f.rot; };
  const atualizar = () => { genSalvar(o); mostrar(gerarSenha(o)); };
  const desenhar = () => {
    modos.textContent = ""; corpo.textContent = "";
    [["aleatoria", "Aleatória"], ["palavra", "A partir de uma palavra"]].forEach(([k, t]) => {
      const b = btn("btn tema-op" + (o.modo === k ? " on" : ""), null, t, () => { o.modo = k; desenhar(); atualizar(); });
      b.setAttribute("aria-pressed", o.modo === k ? "true" : "false"); modos.appendChild(b);
    });
    if (o.modo === "palavra") {
      const lab = el("label", "gen-lab", "Palavra base");
      const inp = el("input"); inp.type = "text"; inp.id = "genPalavra"; inp.value = genPalavra; inp.placeholder = "Ex.: girassol"; inp.autocomplete = "off"; inp.spellcheck = false;
      inp.addEventListener("input", () => { genPalavra = o.palavra = inp.value; atualizar(); });
      lab.appendChild(inp); corpo.appendChild(lab);
      corpo.appendChild(el("p", "hint", "Troca algumas letras por números/símbolos, mistura maiúsculas e acrescenta caracteres aleatórios. Cada “Gerar” cria uma variação."));
    }
    const lt = el("label", "gen-lab");
    const tTxt = el("span", "", "Tamanho: " + o.tam);
    const sl = el("input"); sl.type = "range"; sl.id = "genTam"; sl.min = "8"; sl.max = "40"; sl.value = String(o.tam);
    sl.addEventListener("input", () => { o.tam = +sl.value; tTxt.textContent = "Tamanho: " + o.tam; atualizar(); });
    lt.appendChild(tTxt); lt.appendChild(sl); corpo.appendChild(lt);
    const tg = el("div", "gen-toggles");
    const opts = o.modo === "palavra" ? [["parecidos", "Evitar parecidos (O 0 l 1 I)"]] :
      [["mai", "Maiúsculas"], ["min", "Minúsculas"], ["num", "Números"], ["sim", "Símbolos"], ["parecidos", "Evitar parecidos (O 0 l 1 I)"]];
    opts.forEach(([k, t]) => {
      const l = el("label", "gen-chk"); const cb = el("input"); cb.type = "checkbox"; cb.dataset.op = k; cb.checked = !!o[k];
      cb.addEventListener("change", () => {
        o[k] = cb.checked;
        if (!o.mai && !o.min && !o.num && !o.sim) { o[k] = true; cb.checked = true; toast("Deixe pelo menos um tipo marcado"); }
        atualizar();
      });
      l.appendChild(cb); l.appendChild(el("span", "", t)); tg.appendChild(l);
    });
    corpo.appendChild(tg);
  };
  c.appendChild(modos); c.appendChild(corpo);
  const saida = el("div", "gen-saida"); saida.appendChild(val); c.appendChild(saida);
  const fr = el("div", "gen-forca-linha"); fr.appendChild(barra); fr.appendChild(rot); c.appendChild(fr);
  const ac = el("div", "acoes-mais");
  ac.appendChild(btn("btn pri", "refresh", "Gerar", atualizar));
  ac.appendChild(btn("btn", "copy", "Copiar", () => copiar(genAtual, "Senha")));
  c.appendChild(ac);
  box.appendChild(c);
  desenhar(); atualizar();
}

/* ---------- Arquivo da equipe (sincronização via pasta do OneDrive) ---------- */
const AUTOR_KEY = "caderno-acessos-autor";
const SYNC_META_KEY = "caderno-acessos-sync-meta";
const REMOVIDOS_KEY = "caderno-acessos-removidos";
const HIST_KEY = "caderno-acessos-historico";
const SYNC_ARQUIVO = "caderno-equipe.json";
const LOGERR_KEY = "caderno-acessos-log-erros";
const MIGRAR_KEY = "caderno-acessos-aviso-pasta";
const MODELOS_KEY = "caderno-acessos-modelos";
const MEUS_MODELOS_KEY = "caderno-acessos-meus-modelos";
const MODELOS_DEC_KEY = "caderno-acessos-modelos-decisoes";
let modelosPendentesEnvio = false;
// Adaptadores trocáveis (no futuro, um servidor pode entrar no lugar)
const syncPasta = window.CadernoSync ? CadernoSync.AdaptadorPasta() : null;
const syncArquivo = window.CadernoSync ? CadernoSync.AdaptadorArquivo() : null;
const syncFila = window.CadernoSync ? CadernoSync.Fila() : null;
const syncEstado = { suportado: false, pastaSuportada: false, vinculado: false, modo: "", nome: "", pendente: false, rodando: false, agendado: false, acoes: [] };
let syncAtivo = null;
function adaptador() { return window.__syncAdaptadorTeste || syncAtivo; }
function autor() { return (localStorage.getItem(AUTOR_KEY) || "").trim(); }
function lerJSON(k, pad) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? pad : v; } catch (e) { return pad; } }
function syncMeta() { return lerJSON(SYNC_META_KEY, { ultimaSync: "", marcas: null }); }
function gravarMeta(m) { localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); }
function removidosLocais() { return lerJSON(REMOVIDOS_KEY, []); }
/* Mesma regra do JSON da equipe: só cards de Equipe; Individuais nunca saem. */
function compartilhado(it) { return !!it && it.visibilidade !== "Individual"; }
function itemParaEquipe(it) { const c = semSegredoIndividual(it); const n = window.CadernoSync && CadernoSync.normalizarCard ? CadernoSync.normalizarCard(c) : c; return n && n.id ? n : c; }
function marcaDe(it) { return window.CadernoSync ? CadernoSync.semMeta(it) : JSON.stringify(it); }
/* Chamada a cada save(): carimba updatedAt/updatedBy nos cards de equipe alterados e cria tombstones das exclusões. */
function carimbarMudancas() {
  const meta = syncMeta();
  const novas = {};
  itens.filter(compartilhado).forEach((it) => { novas[it.id] = marcaDe(it); });
  if (!meta.marcas) { meta.marcas = novas; gravarMeta(meta); return false; }
  const agora = new Date().toISOString(); const quem = autor();
  let mudou = false;
  itens.filter(compartilhado).forEach((it) => {
    if (meta.marcas[it.id] !== novas[it.id]) {
      const antes = meta.marcas[it.id] ? JSON.parse(meta.marcas[it.id]) : null;
      registrarAcao(!antes ? "novo card" : (!antes.arquivado_em && it.arquivado_em) ? "arquivar" : (antes.arquivado_em && !it.arquivado_em) ? "reativar" : antes.senha !== it.senha ? "atualizar senha" : "salvar", nomeDe(it));
      histAcao(tipoMudanca(antes, it), it, "Equipe", "c-" + it.id + "-" + agora, agora);
      it.updatedAt = agora; it.updatedBy = quem; mudou = true;
    }
  });
  let rem = removidosLocais();
  Object.keys(meta.marcas).forEach((id) => {
    if (!(id in novas)) {
      const antigo = itens.find((x) => x.id === id);
      rem = rem.filter((t) => t.id !== id);
      let titulo = antigo ? nomeDe(antigo) : ""; try { if (!titulo) titulo = nomeDe(JSON.parse(meta.marcas[id])); } catch (e) {}
      registrarAcao("excluir", titulo);
      histAcao("excluido", { titulo: titulo }, "Equipe", "x-" + id + "-" + agora, agora);
      rem.push({ id: id, deletedAt: agora, deletedBy: quem, titulo: titulo });
      mudou = true;
    }
  });
  const antes = rem.length;
  rem = rem.filter((t) => !(t.id in novas) || CadernoSync.ts(t.deletedAt) >= CadernoSync.ts((itens.find((x) => x.id === t.id) || {}).updatedAt));
  if (rem.length !== antes) mudou = true;
  localStorage.setItem(REMOVIDOS_KEY, JSON.stringify(rem));
  itens.filter(compartilhado).forEach((it) => { novas[it.id] = marcaDe(it); });
  meta.marcas = novas; gravarMeta(meta);
  if (atualizarMeusModelos()) mudou = true;
  return mudou;
}
function dataHoraBR(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}
function horaBR(iso) { const d = new Date(iso); return isNaN(d) ? "" : String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function textoMudanca(m) {
  const nome = nomeDe(m.item);
  const acao = { novo: "adicionado", atualizado: "atualizado", removido: "excluído" }[m.tipo] || "alterado";
  return "Fornecedor " + nome + " " + acao + (m.por ? " por " + m.por : "") + (m.em && CadernoSync.ts(m.em) ? " em " + dataHoraBR(m.em) : "");
}
function registrarHistorico(textos) {
  if (!textos.length) return;
  const h = lerJSON(HIST_KEY, []);
  const agora = new Date().toISOString();
  textos.forEach((t) => h.unshift({ em: agora, texto: t }));
  localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 60))); // formato antigo mantido (volta para a v1.9.6)
}
/* ---------- v1.9.7: Histórico estruturado { id, tipo, card, quem, quando, escopo } ----------
 * Ações da Equipe viajam no arquivo da equipe (cifrado quando protegido), juntadas pelo id, últimas 100.
 * Ações dos cards Meus ficam só neste aparelho. Nunca guarda senhas, só o nome do card e o tipo da ação. */
const HIST2_KEY = "caderno-acessos-historico-v2";
const APARELHO_KEY = "caderno-acessos-aparelho";
const PRIMEIRO_KEY = "caderno-acessos-primeiro-acesso";
let histLote = null; // importação: um registro só, em vez de um por card
function idAparelho() {
  let v = localStorage.getItem(APARELHO_KEY);
  if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem(APARELHO_KEY, v); }
  return v;
}
function lerHist() { return window.CadernoSync ? CadernoSync.limparHistorico(lerJSON(HIST2_KEY, [])) : []; }
function gravarHist(l) { localStorage.setItem(HIST2_KEY, JSON.stringify(window.CadernoSync ? CadernoSync.mesclarHistorico([l], 100) : l.slice(0, 100))); }
function addHist(e) {
  const o = Object.assign({ id: "h-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), card: "", quem: autor(), quando: new Date().toISOString(), escopo: "Equipe" }, e);
  const l = lerHist().filter((x) => x.id !== o.id); l.unshift(o); gravarHist(l);
}
function tipoMudanca(antes, it) {
  if (!antes) return "adicionado";
  if (!antes.arquivado_em && it.arquivado_em) return "arquivado";
  if (antes.arquivado_em && !it.arquivado_em) return "reativado";
  if ((antes.senha || "") !== (it.senha || "")) return "senha";
  if (!antes.modeloDono && it.modeloDono) return "compartilhado";
  if (antes.modeloDono && !it.modeloDono) return "parou";
  return "editado";
}
function histAcao(tipo, it, escopo, id, quando) {
  if (histLote) { histLote.n++; return; }
  addHist({ id: id, tipo: tipo, card: String(nomeDe(it || {}) || "").slice(0, 200), escopo: escopo, quando: quando || new Date().toISOString() });
}
/* Cards Meus (Individuais): compara com a última foto em memória a cada save(). */
let fotoMeus = null;
function fotoIndividuais() { const m = new Map(); itens.filter((x) => !compartilhado(x)).forEach((x) => m.set(x.id, JSON.stringify(x))); return m; }
function registrarMeus() {
  const nova = fotoIndividuais();
  if (fotoMeus) {
    const agora = new Date().toISOString();
    nova.forEach((j, id) => {
      const a = fotoMeus.get(id); if (a === j) return;
      const antes = a ? JSON.parse(a) : null, it = JSON.parse(j);
      histAcao(tipoMudanca(antes, it), it, "Meu", "i-" + id + "-" + agora, agora);
    });
    fotoMeus.forEach((j, id) => { if (!nova.has(id) && !itens.some((x) => x.id === id)) histAcao("excluido", JSON.parse(j), "Meu", "ix-" + id + "-" + agora, agora); });
  }
  fotoMeus = nova;
}
/* Entradas vindas da sincronização (mudanças de outros analistas). Mesmo id da entrada criada por quem fez: não duplica. */
function histDeMudanca(m) {
  const it = m.item || {};
  const tipo = m.tipo === "novo" ? "adicionado" : m.tipo === "removido" ? "excluido" : "editado";
  return { id: (m.tipo === "removido" ? "x-" : "c-") + it.id + "-" + (m.em || ""), tipo: tipo, card: String(nomeDe(it)).slice(0, 200), quem: m.por || "", quando: m.em || new Date().toISOString(), escopo: "Equipe" };
}
/* Migração única do histórico antigo (só texto) para o novo formato. */
function migrarHistorico() {
  if (localStorage.getItem(HIST2_KEY) != null) return;
  const velho = lerJSON(HIST_KEY, []);
  const l = (Array.isArray(velho) ? velho : []).filter((x) => x && x.texto).map((x, i) => ({ id: "v-" + i + "-" + String(x.em || ""), tipo: "texto", texto: String(x.texto).slice(0, 300), card: "", quem: "", quando: String(x.em || ""), escopo: "Equipe", local: true }));
  gravarHist(l);
  if (syncMeta().ultimaSync) localStorage.setItem(PRIMEIRO_KEY, "migrado"); // quem já usava não ganha "Primeiro acesso" falso
}
function registrarAcao(acao, card) { syncEstado.acoes.push({ acao: acao, card: card }); if (syncEstado.acoes.length > 20) syncEstado.acoes.shift(); }
function descreverErro(e) {
  const n = e && e.name;
  if (n === "NotAllowedError" || n === "SecurityError") return "Sem permissão para a pasta/arquivo da equipe. Clique em Sincronizar e escolha “Permitir”.";
  if (n === "NotFoundError") return "O arquivo da equipe não foi encontrado (pasta movida ou renomeada). Vincule de novo em Mais.";
  if (n === "VerificacaoFalhou") return "Outra pessoa gravou ao mesmo tempo. Tentei de novo e não consegui; clique em Sincronizar em instantes.";
  if (n === "SyntaxError") return "O arquivo da equipe está incompleto (o OneDrive ainda está baixando). Aguarde e clique em Sincronizar.";
  if (n === "NotReadableError" || n === "NoModificationAllowedError" || n === "InvalidStateError" || n === "InvalidModificationError") return "O arquivo da equipe está em uso pelo OneDrive. Aguarde alguns segundos e clique em Sincronizar.";
  return "Não foi possível sincronizar agora" + (e && e.message ? " (" + e.message + ")" : "") + ".";
}
/* Log de erros: no aparelho (Mais → Log de erros) e, com a pasta vinculada, em caderno-equipe-log.csv. Nunca inclui senhas. */
async function registrarErro(acao, card, e, a) {
  const campos = [new Date().toISOString(), autor() || "(sem nome)", acao, card || "", ((e && e.name) || "Erro") + ": " + String((e && e.message) || "").slice(0, 200)];
  const l = lerJSON(LOGERR_KEY, []); l.unshift(campos); localStorage.setItem(LOGERR_KEY, JSON.stringify(l.slice(0, 100)));
  const linha = [new Date().toLocaleString("pt-BR")].concat(campos.slice(1));
  try { if (a && a.registrarLog) await CadernoSync.comRetentativa(() => a.registrarLog(linha), { tentativas: 3, atrasos: [400, 900] }); } catch (x) { /* log em arquivo é melhor esforço */ }
}
async function escolherAdaptador() {
  if (window.__syncAdaptadorTeste) return window.__syncAdaptadorTeste;
  if (syncPasta && syncPasta.suportado() && await syncPasta.vinculado()) return syncPasta;
  if (syncArquivo && syncArquivo.suportado() && await syncArquivo.vinculado()) return syncArquivo;
  return null;
}
async function atualizarEstadoSync() {
  syncEstado.pastaSuportada = !!(syncPasta && syncPasta.suportado()) || !!(window.__syncAdaptadorTeste && window.__syncAdaptadorTeste.modo === "pasta");
  syncEstado.suportado = syncEstado.pastaSuportada || !!(syncArquivo && syncArquivo.suportado()) || !!window.__syncAdaptadorTeste;
  syncAtivo = await escolherAdaptador();
  const a = adaptador();
  syncEstado.vinculado = !!(a && await a.vinculado());
  syncEstado.modo = syncEstado.vinculado ? a.modo : "";
  syncEstado.nome = syncEstado.vinculado ? await a.nome() : "";
  desenharBotaoSync();
}
function desenharBotaoSync() {
  const b = $("btnSync"); if (!b) return;
  b.hidden = !syncEstado.vinculado;
  const ult = syncMeta().ultimaSync;
  $("syncInfo").textContent = syncEstado.rodando ? "Sincronizando…" : syncEstado.pendente ? "Clique para sincronizar" : ult ? "Última sincronização " + horaBR(ult) : "Ainda não sincronizado";
  b.classList.toggle("pendente", syncEstado.pendente);
  b.title = syncEstado.nome ? "Sincronizar com " + syncEstado.nome : "Sincronizar";
}
let syncTimer = null;
/* Várias gravações seguidas viram uma só (espera 1,5 s sem novas alterações). */
function agendarSync() {
  if (!syncEstado.vinculado) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sincronizar(false), 1500);
}
/* Tudo passa pela fila: nunca duas sincronizações ao mesmo tempo nesta aba. Pedidos repetidos enquanto uma roda viram um só. */
function sincronizar(interativo) {
  if (!window.CadernoSync) return Promise.resolve(false);
  if (syncEstado.agendado && !interativo) return syncEstado.agendado;
  const p = syncFila.rodar(() => { syncEstado.agendado = null; return sincronizarAgora(interativo); });
  syncEstado.agendado = p;
  return p;
}
async function sincronizarAgora(interativo) {
  const a = adaptador();
  if (!a || !syncEstado.vinculado || document.body.classList.contains("travado")) return false;
  syncEstado.rodando = true; desenharBotaoSync();
  const acoes = syncEstado.acoes.splice(0);
  try {
    if (!(await a.permissao(!!interativo))) {
      syncEstado.pendente = true; syncEstado.acoes = acoes.concat(syncEstado.acoes);
      if (interativo) toast("Sem permissão para a pasta da equipe. Clique em Sincronizar e escolha “Permitir”.");
      return false;
    }
    let copiasMescladas = [], copiasFechadas = [], invalidos = [];
    let resultado = null;
    // ler → mesclar (principal + cópias de conflito) → gravar → reler para verificar. Repete se o arquivo estiver ocupado.
    await CadernoSync.comRetentativa(async () => {
      const bruto = await a.ler();
      const remoto0 = await abrirDocEquipe(bruto, false); // v1.9.5: decifra se protegido (pede a senha da equipe uma vez por aparelho)
      if (remoto0 && !CadernoSync.docValido(remoto0)) { const e = new Error("O arquivo vinculado não é um arquivo da equipe do Caderno."); e.name = "ArquivoInvalido"; throw e; }
      // v1.9.7: cada card do arquivo é conferido e limpo; o que estiver estragado é ignorado e vai para o log (não trava o app)
      invalidos = [];
      const lr = remoto0 ? CadernoSync.limparDoc(remoto0) : { doc: null, invalidos: [] };
      const remoto = lr.doc; lr.invalidos.forEach((x) => invalidos.push({ origem: SYNC_ARQUIVO, x: x }));
      const copias = [];
      for (const c of await a.lerCopias()) {
        if (!c.doc) continue;
        try { const d = await abrirDocEquipe(c.doc, true); if (CadernoSync.docValido(d)) { const lc = CadernoSync.limparDoc(d); lc.invalidos.forEach((x) => invalidos.push({ origem: c.nome, x: x })); copias.push({ nome: c.nome, doc: lc.doc }); } }
        catch (e) { copiasFechadas.push(c.nome); } // cópia cifrada com uma senha que este aparelho não conhece: fica na pasta
      }
      if (!localStorage.getItem(PRIMEIRO_KEY) && autor()) addHist({ id: "pa-" + idAparelho(), tipo: "primeiro", card: "", escopo: "Equipe" });
      carimbarMudancas();
      const meta = syncMeta();
      let base = { itens: itens.filter(compartilhado).map(itemParaEquipe), removidos: removidosLocais() };
      let r = CadernoSync.mesclar(base, remoto, meta.ultimaSync, chaveCard);
      const mud = r.mudancasRemotas.slice(), conf = r.conflitos.slice();
      let localMudou = r.localMudou, precisa = r.remotoPrecisa || !remoto || !!seEstado.pendente || precisaCifrar(bruto);
      // v1.9.4: modelos (cards Individuais compartilhados, sem login/senha). O cache local repõe o que um app antigo (v1.9.3) tenha apagado ao gravar.
      let rm = CadernoSync.mesclar(modelosLocais(), CadernoSync.modelosDoDoc(remoto) || { itens: [], removidos: [] }, "", null);
      if (rm.remotoPrecisa) precisa = true;
      copias.forEach((c) => {
        const r2 = CadernoSync.mesclar({ itens: r.itens, removidos: r.removidos }, c.doc, meta.ultimaSync, chaveCard);
        r2.mudancasRemotas.forEach((m) => mud.push(m)); r2.conflitos.forEach((x) => conf.push(x));
        localMudou = localMudou || r2.localMudou; precisa = true; r = r2;
        rm = CadernoSync.mesclar({ itens: rm.itens, removidos: rm.removidos }, CadernoSync.modelosDoDoc(c.doc), "", null);
      });
      copiasFechadas = copiasFechadas.filter((n, i, l) => l.indexOf(n) === i);
      // v1.9.7: histórico da Equipe viaja no arquivo; primeiro o que veio do arquivo (vence pelo id), depois o deste aparelho e o deduzido das mudanças
      const histLocal = lerHist();
      const histEq = CadernoSync.mesclarHistorico([remoto ? remoto.historico : [], ...copias.map((c) => c.doc.historico), histLocal.filter((e) => e.escopo === "Equipe" && !e.local), mud.map(histDeMudanca)], CadernoSync.HIST_MAX);
      const idsRem = new Set(((remoto && remoto.historico) || []).map((e) => e.id));
      if (histEq.some((e) => !idsRem.has(e.id))) precisa = true;
      if (precisa) await a.gravar(await fecharDocEquipe(CadernoSync.montarDoc(r.itens, r.removidos, autor(), compartilhado, { modelos: rm.itens, modelosRemovidos: rm.removidos, historico: histEq }), bruto));
      resultado = { r: r, mud: mud, conf: conf, localMudou: localMudou, rm: rm, histEq: histEq };
      copiasMescladas = copias.map((c) => c.nome);
    }, { aoFalhar: () => { syncEstado.pendente = true; desenharBotaoSync(); } });
    await concluirSenhaPendente(a);
    gravarHist(CadernoSync.mesclarHistorico([resultado.histEq, lerHist()], 100));
    if (!localStorage.getItem(PRIMEIRO_KEY) && autor()) localStorage.setItem(PRIMEIRO_KEY, new Date().toISOString());
    for (const v of invalidos.slice(0, 20)) await registrarErro("ignorar card inválido", (v.x.titulo ? v.x.titulo + " " : "") + "(posição " + (v.x.pos + 1) + " em " + v.origem + ")", { name: "CardInvalido", message: "card com formato errado foi ignorado e não foi aplicado" }, a);
    for (const nome of copiasFechadas) await registrarErro("juntar cópia de conflito", nome, { name: "SenhaEquipe", message: "cópia protegida com outra senha da equipe; ficou na pasta" }, a);
    gravarModelosLocais({ itens: resultado.rm.itens.map(CadernoSync.limparModelo), removidos: resultado.rm.removidos });
    aplicarResultado(resultado.r);
    // só apaga as cópias depois da gravação verificada do arquivo principal
    for (const nome of copiasMescladas) {
      try { await CadernoSync.comRetentativa(() => a.apagarCopia(nome), { tentativas: 3, atrasos: [500, 1500] }); registrarHistorico(["Cópia de conflito " + nome + " juntada ao arquivo da equipe e apagada"]); addHist({ tipo: "copia", card: nome, quem: "", escopo: "Equipe", local: true }); }
      catch (e) { await registrarErro("apagar cópia de conflito", nome, e, a); }
    }
    syncEstado.pendente = false;
    const textos = resultado.mud.map(textoMudanca);
    resultado.conf.forEach((c) => textos.push("Conflito em " + nomeDe(c.remoto) + ": você e " + (c.remoto.updatedBy || "outra pessoa") + " alteraram desde a última sincronização. Ficou a versão mais recente" + (CadernoSync.ts(c.remoto.updatedAt) >= CadernoSync.ts(c.local.updatedAt) ? " (de " + (c.remoto.updatedBy || "outra pessoa") + ")." : " (a sua).")));
    registrarHistorico(textos);
    resultado.conf.forEach((c, i) => addHist({ tipo: "conflito", card: String(nomeDe(c.remoto)).slice(0, 200), quem: c.remoto.updatedBy || "", escopo: "Equipe", local: true, texto: textos[resultado.mud.length + i] }));
    renderAposSync(); // v1.9.6: sempre redesenha (os objetos dos cards da Equipe foram trocados)
    if (resultado.conf.length) toast(textos[textos.length - 1]);
    else if (copiasMescladas.length) toast(copiasMescladas.length + (copiasMescladas.length === 1 ? " cópia de conflito do OneDrive juntada" : " cópias de conflito do OneDrive juntadas") + " ao arquivo da equipe");
    else if (textos.length === 1) toast(textos[0]);
    else if (textos.length > 1) toast(textos.length + " alterações da equipe recebidas (veja o Histórico em Mais)");
    else if (interativo) toast("Arquivo da equipe sincronizado");
    setTimeout(() => verificarModelos(false), 0);
    return true;
  } catch (e) {
    syncEstado.pendente = true;
    syncEstado.acoes = acoes.concat(syncEstado.acoes);
    if (e && e.name === "SenhaEquipeNecessaria") {
      seEstado.protegido = true; seEstado.precisaSenha = true; seEstado.env = e.env;
      if (interativo || !seEstado.dispensado) setTimeout(() => pedirSenhaEquipe(e.env), 0);
      if (aba === "mais") render();
      return false;
    }
    const msg = e && e.name === "ArquivoInvalido" ? e.message : descreverErro(e);
    const ult = acoes[acoes.length - 1];
    await registrarErro(ult ? ult.acao : "sincronizar", acoes.map((x) => x.card).filter(Boolean).slice(-5).join(", "), e, a);
    toast(msg + " Suas alterações estão salvas neste aparelho.");
    return false;
  } finally {
    syncEstado.rodando = false; desenharBotaoSync();
  }
}
// Redesenha sem atrapalhar: com ficha/diálogo aberto ou digitando, espera fechar; mantém a rolagem.
let renderPendente = false;
function podeRenderAgora() {
  if (document.querySelector(".sheet.on, .drawer.on, .menu-card")) return false;
  const a = document.activeElement;
  if (a && a.closest && a.closest("main") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  return true;
}
function renderAposSync() {
  if (!podeRenderAgora()) { renderPendente = true; return; }
  renderPendente = false;
  const y = window.scrollY; render(); if (window.scrollY !== y) window.scrollTo(0, y);
}
function renderSePendente() { if (renderPendente) setTimeout(renderAposSync, 0); }
document.addEventListener("click", () => { if (renderPendente) setTimeout(renderSePendente, 50); });
function aplicarResultado(r0) {
  // Alterações feitas enquanto o arquivo era gravado não se perdem: mescla de novo o que está na tela com o que foi gravado.
  carimbarMudancas();
  const r = CadernoSync.mesclar({ itens: itens.filter(compartilhado).map(itemParaEquipe), removidos: removidosLocais() }, { tipo: CadernoSync.TIPO, itens: r0.itens, removidos: r0.removidos }, "", chaveCard);
  if ((r.remotoPrecisa || modelosPendentesEnvio) && syncMeta().ultimaSync) setTimeout(agendarSync, 0);
  modelosPendentesEnvio = false;
  // Individuais ficam intactos; cards de equipe passam a ser os do merge
  const porId = new Map(r.itens.map((it) => [it.id, it]));
  const locaisPorId = new Map(itens.map((it) => [it.id, it]));
  const novaLista = [];
  itens.forEach((it) => {
    if (!compartilhado(it)) { if (!porId.has(it.id)) novaLista.push(it); return; }
    if (porId.has(it.id)) { novaLista.push(porId.get(it.id)); porId.delete(it.id); }
  });
  porId.forEach((it) => { const l = locaisPorId.get(it.id); novaLista.push(l && !compartilhado(l) ? l : it); });
  itens = novaLista;
  localStorage.setItem(KEY, JSON.stringify(itens));
  localStorage.setItem(REMOVIDOS_KEY, JSON.stringify(r.removidos));
  const marcas = {}; itens.filter(compartilhado).forEach((it) => { marcas[it.id] = marcaDe(it); });
  gravarMeta({ ultimaSync: new Date().toISOString(), marcas: marcas });
  fotoMeus = fotoIndividuais();
}
/* ---------- v1.9.5: senha da equipe no arquivo caderno-equipe.json (ver js/cripto-equipe.js) ---------- */
const SE_KEY = "caderno-acessos-senha-equipe";        // { atual: salt, por, em, acao } — nunca a senha
const SE_OLHO_KEY = "caderno-acessos-senha-equipe-olho"; // senha da equipe cifrada pela senha de login (botão "Ver")
const WRAP_SALT_KEY = "caderno-acessos-olho-salt";
const seEstado = { protegido: !!lerJSON(SE_KEY, {}).atual, precisaSenha: false, env: null, pendente: null, dispensado: false, abrindo: false };
let chaveLoginSessao = null;
function lerSE() { return lerJSON(SE_KEY, {}); }
function wrapSalt() { let s = localStorage.getItem(WRAP_SALT_KEY); if (!s) { s = CadernoCripto.b64(CadernoCripto.aleatorio(16)); localStorage.setItem(WRAP_SALT_KEY, s); } return s; }
function lembrarChaveLogin(senha) { if (window.CadernoCripto) CadernoCripto.chaveDeLogin(senha, wrapSalt()).then((k) => { chaveLoginSessao = k; }).catch(() => {}); }
async function guardarOlho(senhaEquipe, salt, chaveLogin) {
  if (!chaveLogin) return;
  const o = await CadernoCripto.embrulhar(chaveLogin, salt, senhaEquipe);
  localStorage.setItem(SE_OLHO_KEY, JSON.stringify({ salt: salt, iv: o.iv, ct: o.ct }));
}
async function reembrulharOlho(antiga, nova) {
  const rec = lerJSON(SE_OLHO_KEY, null);
  try {
    const kNova = await CadernoCripto.chaveDeLogin(nova, wrapSalt()); chaveLoginSessao = kNova;
    if (!rec) return;
    const senha = await CadernoCripto.desembrulhar(await CadernoCripto.chaveDeLogin(antiga, wrapSalt()), rec.salt, rec);
    await guardarOlho(senha, rec.salt, kNova);
  } catch (e) { localStorage.removeItem(SE_OLHO_KEY); }
}
function erroSE(nome, env) { const e = new Error("O arquivo da equipe está protegido com a senha da equipe."); e.name = nome; e.env = env; return e; }
async function abrirDocEquipe(d, copia) {
  if (!window.CadernoCripto || !CadernoCripto.ehProtegido(d)) return d;
  const reg = await CadernoCripto.chaveGuardada(d.kdf.salt);
  if (!reg || !(await CadernoCripto.conferirChave(d, reg.chave))) throw erroSE(copia ? "SenhaEquipeCopia" : "SenhaEquipeNecessaria", d);
  const doc = await CadernoCripto.abrir(d, reg.chave);
  if (!copia) {
    seEstado.protegido = true; seEstado.precisaSenha = false;
    const se = lerSE();
    if (se.atual !== d.kdf.salt && !(se.atual && CadernoSync.ts(se.em) > CadernoSync.ts(d.senha_em) && await CadernoCripto.chaveGuardada(se.atual)))
      localStorage.setItem(SE_KEY, JSON.stringify({ atual: d.kdf.salt, por: d.senha_por || "", em: d.senha_em || "", acao: d.senha_acao || "" }));
  }
  return doc;
}
/* Protegido se: ativando/trocando agora, o arquivo já vinha protegido, ou este aparelho sabe que a equipe usa senha (arquivo recriado sem senha volta a ser protegido). */
function precisaCifrar(bruto) { const se = lerSE(); return !!(se.atual && bruto && !CadernoCripto.ehProtegido(bruto)); }
async function fecharDocEquipe(doc, bruto) {
  if (!window.CadernoCripto) return doc;
  const p = seEstado.pendente;
  if (p) return CadernoCripto.fechar(doc, p, p.info);
  const se = lerSE();
  if (!se.atual) return doc;
  const reg = await CadernoCripto.chaveGuardada(se.atual);
  if (!reg) { if (CadernoCripto.ehProtegido(bruto)) throw erroSE("SenhaEquipeNecessaria", bruto); return doc; }
  return CadernoCripto.fechar(doc, { salt: se.atual, iter: reg.iter, chave: reg.chave, verif: reg.verif }, { por: se.por, em: se.em, acao: se.acao });
}
async function concluirSenhaPendente(a) {
  const p = seEstado.pendente; if (!p) return;
  seEstado.pendente = null; seEstado.protegido = true; seEstado.precisaSenha = false;
  localStorage.setItem(SE_KEY, JSON.stringify({ atual: p.salt, por: p.info.por, em: p.info.em, acao: p.info.acao }));
  const txt = (p.info.acao === "ativada" ? "Arquivo da equipe protegido com senha da equipe por " : "Senha da equipe trocada por ") + p.info.por + " em " + dataHoraBR(p.info.em);
  registrarHistorico([txt]);
  try { addHist({ id: "se-" + p.salt, tipo: p.info.acao === "ativada" ? "se-ativada" : "se-trocada", card: "Arquivo da equipe", quem: p.info.por, quando: p.info.em, escopo: "Equipe" }); if (aba === "mais") render(); } catch (e) {}
  try { if (a && a.registrarLog) await a.registrarLog([new Date().toLocaleString("pt-BR"), p.info.por, p.info.acao === "ativada" ? "senha da equipe ativada" : "senha da equipe trocada", "", ""]); } catch (e) {}
}
function textoSenhaEquipe() {
  const se = lerSE();
  if (seEstado.precisaSenha) return " 🔒 Arquivo protegido com senha da equipe: digite a senha da equipe para sincronizar.";
  if (seEstado.protegido) return " 🔒 Protegido com senha da equipe" + (se.por ? " · senha " + (se.acao === "ativada" ? "criada" : "alterada") + " por " + se.por + (se.em ? " em " + dataHoraBR(se.em) : "") : "") + ". Fora do app o arquivo fica ilegível.";
  return " Sem senha da equipe: quem abrir a pasta consegue ler os cards da Equipe.";
}
function botoesSenhaEquipe() {
  if (!window.CadernoCripto || !(window.crypto && crypto.subtle)) return [];
  if (seEstado.precisaSenha) return [btn("btn pri", "lock", "Digitar senha da equipe", () => pedirSenhaEquipe(seEstado.env))];
  if (!seEstado.protegido) return [btn("btn", "lock", "Proteger arquivo com senha da equipe", () => abrirProtegerEquipe(false))];
  const out = [btn("btn", "key", "Trocar senha da equipe", () => abrirProtegerEquipe(true))];
  const olho = lerJSON(SE_OLHO_KEY, null);
  if (olho && olho.salt === lerSE().atual) out.push(btn("btn", "eye", "Ver senha da equipe", verSenhaEquipe));
  return out;
}
function campoSenha(box, id, rot, auto) {
  const l = el("label", "se-campo"); l.appendChild(el("span", "", rot));
  const i = el("input"); i.type = "password"; i.id = id; i.autocomplete = auto || "off"; i.spellcheck = false;
  l.appendChild(i); box.appendChild(l); return i;
}
function abrirProtegerEquipe(trocar) {
  if (!exigirNome()) return;
  return janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", trocar ? "Trocar senha da equipe" : "Proteger arquivo com senha da equipe"));
    box.appendChild(el("p", "meta", trocar ? "O arquivo é cifrado de novo com a senha nova. Cada analista vai digitar a senha nova uma vez. Passe a senha nova só para quem continua na equipe." : "O caderno-equipe.json passa a ficar ilegível fora do app. Cada analista digita esta senha uma vez por aparelho. A senha não fica gravada no arquivo: se a equipe inteira esquecer, o arquivo não abre (os cards continuam nos aparelhos)."));
    const s1 = campoSenha(box, "seNova", trocar ? "Nova senha da equipe" : "Senha da equipe", "new-password");
    const s2 = campoSenha(box, "seConf", "Digite de novo", "new-password");
    const ger = botaoDlg("", "Gerar frase fácil de lembrar", () => { const f = CadernoCripto.frase(); s1.value = s2.value = f; s1.type = s2.type = "text"; validar(); });
    box.appendChild(ger);
    const lg = campoSenha(box, "seLogin", "Sua senha de login (confirma que é você)", "current-password");
    const av = el("p", "se-aviso"); const er = el("p", "se-erro"); box.appendChild(av); box.appendChild(er);
    function validar() { const r = CadernoCripto.avaliar(s1.value); av.textContent = s1.value ? (r.ok ? r.aviso : r.msg) : "Dica: 3 ou 4 palavras e um número, como “cafe-azul-mesa-27”. Evite só números ou datas."; }
    s1.addEventListener("input", validar); validar();
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", trocar ? "Trocar senha" : "Ativar", async () => {
      er.textContent = "";
      const r = CadernoCripto.avaliar(s1.value);
      if (!r.ok) { er.textContent = r.msg; s1.focus(); return; }
      if (s1.value !== s2.value) { er.textContent = "As duas senhas não são iguais."; s2.focus(); return; }
      ok.disabled = true;
      try {
        if (!(await conferirSenha(lg.value))) { er.textContent = "Senha de login incorreta."; lg.select(); return; }
        if (trocar && seEstado.precisaSenha) { er.textContent = "Desbloqueie o arquivo com a senha atual da equipe antes de trocar."; return; }
        const k = await CadernoCripto.novaChave(s1.value);
        await CadernoCripto.guardarChave(k.salt, { chave: k.chave, iter: k.iter, verif: k.verif });
        const kl = await CadernoCripto.chaveDeLogin(lg.value, wrapSalt()); chaveLoginSessao = kl;
        await guardarOlho(s1.value, k.salt, kl);
        k.info = { por: autor(), em: new Date().toISOString(), acao: trocar ? "trocada" : "ativada" };
        seEstado.pendente = k;
        s1.value = s2.value = lg.value = "";
        fim(true);
        const feito = await sincronizar(true);
        if (feito && !seEstado.pendente) toast(trocar ? "Senha da equipe trocada. Passe a senha nova para a equipe." : "Arquivo da equipe protegido com a senha da equipe");
        else toast("A senha da equipe será aplicada na próxima sincronização.");
        render();
      } catch (e) { er.textContent = "Não foi possível aplicar a senha (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
    bb.appendChild(ok); box.appendChild(bb);
  });
}
async function pedirSenhaEquipe(env) {
  if (!env || seEstado.abrindo || document.body.classList.contains("travado")) return;
  seEstado.abrindo = true;
  const desbloqueou = await janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", "Arquivo da equipe protegido"));
    box.appendChild(el("p", "meta", (lerSE().atual ? "A senha da equipe foi trocada" + (env.senha_por ? " por " + env.senha_por : "") + ". " : "") + "Digite a senha da equipe passada pelo gestor. Você só faz isso uma vez neste aparelho."));
    const s = campoSenha(box, "seSenha", "Senha da equipe", "off");
    const er = el("p", "se-erro"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Agora não", () => { seEstado.dispensado = true; fim(false); }));
    const ok = botaoDlg("pri", "Desbloquear", async () => {
      er.textContent = ""; ok.disabled = true;
      try {
        const chave = await CadernoCripto.abrirComSenha(env, s.value);
        await CadernoCripto.guardarChave(env.kdf.salt, { chave: chave, iter: env.kdf.iter, verif: env.verif });
        if (chaveLoginSessao) await guardarOlho(s.value, env.kdf.salt, chaveLoginSessao);
        localStorage.setItem(SE_KEY, JSON.stringify({ atual: env.kdf.salt, por: env.senha_por || "", em: env.senha_em || "", acao: env.senha_acao || "" }));
        if (env.senha_por) addHist({ id: "se-" + env.kdf.salt, tipo: env.senha_acao === "ativada" ? "se-ativada" : "se-trocada", card: "Arquivo da equipe", quem: env.senha_por, quando: env.senha_em || new Date().toISOString(), escopo: "Equipe" });
        if (env.senha_por) registrarHistorico([(env.senha_acao === "ativada" ? "Arquivo da equipe protegido com senha da equipe por " : "Senha da equipe trocada por ") + env.senha_por + (env.senha_em ? " em " + dataHoraBR(env.senha_em) : "")]);
        s.value = ""; fim(true);
      } catch (e) { er.textContent = e && e.name === "SenhaEquipeIncorreta" ? "Senha da equipe incorreta. Confira com o gestor." : "Não foi possível conferir a senha (" + ((e && e.name) || "erro") + ")."; s.select(); }
      finally { ok.disabled = false; }
    });
    s.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ok.click(); });
    bb.appendChild(ok); box.appendChild(bb);
    setTimeout(() => s.focus(), 60);
  });
  seEstado.abrindo = false;
  if (desbloqueou) { seEstado.precisaSenha = false; seEstado.dispensado = false; await sincronizar(true); toast("Arquivo da equipe desbloqueado neste aparelho"); }
  if (aba === "mais") render();
}
function verSenhaEquipe() {
  let timer = null;
  return janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", "Ver senha da equipe"));
    box.appendChild(el("p", "meta", "Confirme sua senha de login. A senha da equipe aparece por 10 segundos."));
    const lg = campoSenha(box, "seVerLogin", "Sua senha de login", "current-password");
    const er = el("p", "se-erro"); box.appendChild(er);
    const out = el("div", "se-mostra"); out.hidden = true; box.appendChild(out);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Fechar", () => { clearInterval(timer); fim(false); }));
    const ok = botaoDlg("pri", "Mostrar", async () => {
      er.textContent = ""; ok.disabled = true;
      try {
        if (!(await conferirSenha(lg.value))) { er.textContent = "Senha de login incorreta."; lg.select(); return; }
        const rec = lerJSON(SE_OLHO_KEY, null);
        const senha = await CadernoCripto.desembrulhar(await CadernoCripto.chaveDeLogin(lg.value, wrapSalt()), rec.salt, rec);
        lg.value = "";
        let n = 10; out.hidden = false; out.textContent = "";
        const code = el("code", "se-senha", senha); const cnt = el("small", "", " some em " + n + " s"); out.appendChild(code); out.appendChild(cnt);
        timer = setInterval(() => { n--; cnt.textContent = " some em " + n + " s"; if (n <= 0) { clearInterval(timer); out.textContent = ""; out.hidden = true; fim(true); } }, 1000);
      } catch (e) { er.textContent = "Não foi possível mostrar a senha neste aparelho."; }
      finally { ok.disabled = false; }
    });
    lg.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ok.click(); });
    bb.appendChild(ok); box.appendChild(bb);
    setTimeout(() => lg.focus(), 60);
  });
}

/* ---------- v1.9.4: "Compartilhar meu card" (modelos sem login/senha) ---------- */
// Cache local dos modelos da equipe: repõe o que um app antigo apague ao gravar o arquivo.
function modelosLocais() { const m = lerJSON(MODELOS_KEY, null); return { itens: (m && m.itens) || [], removidos: (m && m.removidos) || [] }; }
function gravarModelosLocais(m) { localStorage.setItem(MODELOS_KEY, JSON.stringify({ itens: m.itens, removidos: m.removidos })); }
function meusModelos() { return lerJSON(MEUS_MODELOS_KEY, []); }
function decisoesModelos() { return lerJSON(MODELOS_DEC_KEY, {}); }
function gravarDecisoes(d) { localStorage.setItem(MODELOS_DEC_KEY, JSON.stringify(d)); }
function modelosAtivos() { const m = modelosLocais(); const rem = new Set(m.removidos.map((t) => t.id)); return m.itens.filter((x) => !rem.has(x.id) || CadernoSync.ts(x.updatedAt) > CadernoSync.ts((m.removidos.find((t) => t.id === x.id) || {}).deletedAt)); }
/* Só nome, link, sistema, escalonamento e observações. Nunca login nem senha. */
function conteudoModelo(card) {
  return CadernoSync.limparModelo({ nome: card.titulo || card.aplicacao || "", url: card.url || "", sistema: card.aplicacao || "", escalonamento: card.escalonamento || "",
    escalonamentos: niveisDe(card).map((n) => ({ nivel: n.nivel, canal: n.canal, nome: n.nome, valor: n.valor, horario: n.horario, obs: n.obs })), obs: card.obs || "" });
}
function mesmoConteudo(a, b) { const k = ["nome", "url", "sistema", "escalonamento", "escalonamentos", "obs"]; return k.every((c) => JSON.stringify(a[c] == null ? "" : a[c]) === JSON.stringify(b[c] == null ? "" : b[c])); }
/* Chamada em carimbarMudancas(): o dono atualiza o modelo quando edita o card; card excluído vira tombstone. */
function atualizarMeusModelos() {
  if (!window.CadernoSync) return false;
  const meus = meusModelos(); if (!meus.length) return false;
  const m = modelosLocais(); const agora = new Date().toISOString(); const quem = autor();
  let mudou = false; const ficam = [];
  meus.forEach((tid) => {
    const card = itens.find((c) => c.modeloDono === tid);
    const i = m.itens.findIndex((x) => x.id === tid);
    if (!card || card.visibilidade !== "Individual") {
      if (i >= 0) { m.removidos = m.removidos.filter((t) => t.id !== tid); m.removidos.push({ id: tid, deletedAt: agora, deletedBy: quem, titulo: m.itens[i].nome || "" }); m.itens.splice(i, 1); mudou = true; }
      if (card) delete card.modeloDono;
      return;
    }
    ficam.push(tid);
    if (i < 0) return;
    const novo = conteudoModelo(card);
    if (!mesmoConteudo(novo, m.itens[i])) { m.itens[i] = Object.assign({}, m.itens[i], novo, { id: tid, updatedAt: agora, updatedBy: quem }); mudou = true; }
  });
  localStorage.setItem(MEUS_MODELOS_KEY, JSON.stringify(ficam));
  if (mudou) { gravarModelosLocais(m); modelosPendentesEnvio = true; }
  return mudou;
}
function normTxt(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
function normUrl(u) { return String(u || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[/#?]+$/, ""); }
/* v1.9.8: aviso de duplicado SÓ quando o link é exatamente igual (depois de normUrl). Nome não conta; link vazio nunca é duplicado. */
function mesmoLink(a, b) { const u = normUrl(a); return !!u && u === normUrl(b); }
function parecidos(card, tidProprio) {
  const out = [];
  if (!normUrl(card.url)) return out;
  modelosAtivos().forEach((m) => { if (m.id === tidProprio) return; if (mesmoLink(card.url, m.url)) out.push({ tipo: "modelo", nome: m.nome, motivo: "Mesmo link", por: m.sharedBy, dados: m }); });
  itens.filter((c) => compartilhado(c) && !c.arquivado_em).forEach((c) => { if (mesmoLink(card.url, c.url)) out.push({ tipo: "equipe", nome: nomeDe(c), motivo: "Mesmo link", por: "", dados: Object.assign({ id: c.id }, conteudoModelo(c)) }); });
  return out;
}
/* Cards ativos (não arquivados) com o mesmo link, separados em Meus (Individual) e Equipe. "ignorarId" evita comparar o card com ele mesmo. */
function cardsMesmoLink(url, ignorarId) {
  const r = { meus: [], equipe: [] };
  if (!normUrl(url)) return r;
  itens.forEach((c) => { if (c.id === ignorarId || c.arquivado_em || !mesmoLink(url, c.url)) return; (compartilhado(c) ? r.equipe : r.meus).push(c); });
  return r;
}
/* Janela própria (empilha sobre o diálogo padrão). */
function janela(id, montar) {
  return new Promise((ok) => {
    const w = $(id); const box = w.querySelector(".dlg"); box.textContent = ""; box.className = "dlg dlg-mod";
    let feito = false;
    const fim = (v) => { if (feito) return; feito = true; w.removeEventListener("keydown", esc); fecharSheet(id); ok(v); };
    const esc = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); fim(false); } };
    w.addEventListener("keydown", esc);
    montar(box, fim);
    aplicarIcones(box);
    abrirSheet(id);
    setTimeout(() => { const f = box.querySelector(".btn.pri:not(:disabled)") || box.querySelector("button:not(:disabled)"); if (f) f.focus(); }, 40); // v1.9.8: nunca foca botão desativado (o Esc continua funcionando)
  });
}
function botaoDlg(cls, texto, fn) { const b = el("button", "btn" + (cls ? " " + cls : ""), texto); b.type = "button"; b.addEventListener("click", fn); return b; }
function verModelo(d, origem) {
  return janela("dlgVer", (box, fim) => {
    box.appendChild(el("h3", "", d.nome || "(sem nome)"));
    box.appendChild(el("p", "meta", origem));
    const lin = (r, v) => { const x = el("div", "mod-linha"); x.appendChild(el("b", "", r)); x.appendChild(el("span", v ? "" : "vz", v || "—")); box.appendChild(x); };
    lin("Link", d.url); lin("Sistema", d.sistema);
    lin("Escalonamento", (d.escalonamentos && d.escalonamentos.length) ? resumoEscalonamentos(d.escalonamentos) : d.escalonamento);
    lin("Observações", d.obs);
    const bb = el("div", "dlg-botoes"); bb.appendChild(botaoDlg("pri", "Voltar", () => fim(true))); box.appendChild(bb);
  });
}
async function compartilharMeuCard(card) {
  if (!card || card.visibilidade !== "Individual") return;
  if (!syncEstado.vinculado) { toast("Para compartilhar, vincule a pasta da equipe em Mais › Arquivo da equipe."); return; }
  if (!autor()) { toast("Salve seu nome em Mais › Arquivo da equipe antes de compartilhar."); return; }
  const tid = card.modeloDono || ("m-" + card.id);
  const par = parecidos(card, tid);
  if (par.length) {
    const seguir = await janela("dlgMod", (box, fim) => {
      box.appendChild(el("h3", "", "⚠️ Já existe um card com esse link"));
      box.appendChild(el("p", "", par.length === 1 ? "Este link já está na equipe:" : "Este link já está na equipe em " + par.length + " cards:"));
      par.forEach((p) => {
        const it = el("div", "mod-item");
        const t = el("div", "mod-txt"); t.appendChild(el("strong", "", p.nome));
        t.appendChild(el("small", "", p.motivo + (p.dados.url ? ": " + p.dados.url : "") + " · " + (p.tipo === "modelo" ? "compartilhado por " + (p.por || "alguém da equipe") : "card da Equipe")));
        it.appendChild(t);
        it.appendChild(botaoDlg("pequeno", "Ver modelo", () => verModelo(p.dados, p.tipo === "modelo" ? "Compartilhado por " + (p.por || "alguém da equipe") : "Card da Equipe")));
        box.appendChild(it);
      });
      const bb = el("div", "dlg-botoes");
      bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
      bb.appendChild(botaoDlg("pri", "Compartilhar mesmo assim", () => fim(true)));
      box.appendChild(bb);
      box.appendChild(el("p", "mod-nota", "Nada é bloqueado: você decide. Aviso só quando o link é exatamente igual."));
    });
    if (!seguir) return;
  }
  const ok = await janela("dlgMod", (box, fim) => {
    box.appendChild(el("h3", "", "Compartilhar meu card?"));
    const a = el("p", "mod-ok"); a.appendChild(el("b", "", "✅ Vai para a equipe: ")); a.appendChild(document.createTextNode("nome, link, sistema, escalonamento e observações.")); box.appendChild(a);
    const b = el("p", "mod-no"); b.appendChild(el("b", "", "🔒 Não vai: ")); b.appendChild(document.createTextNode("login e senha.")); box.appendChild(b);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    bb.appendChild(botaoDlg("pri", "Compartilhar", () => fim(true)));
    box.appendChild(bb);
  });
  if (!ok) return;
  const agora = new Date().toISOString();
  const m = modelosLocais();
  const antigo = m.itens.find((x) => x.id === tid);
  const novo = Object.assign({ id: tid, sharedBy: autor(), createdAt: (antigo && antigo.createdAt) || agora }, conteudoModelo(card), { updatedAt: agora, updatedBy: autor() });
  m.itens = m.itens.filter((x) => x.id !== tid).concat([CadernoSync.limparModelo(novo)]);
  m.removidos = m.removidos.filter((t) => t.id !== tid);
  gravarModelosLocais(m);
  const meus = meusModelos(); if (meus.indexOf(tid) < 0) meus.push(tid); localStorage.setItem(MEUS_MODELOS_KEY, JSON.stringify(meus));
  (atual(card) || card).modeloDono = tid;
  save();
  await sincronizar(true);
  toast("Card compartilhado com a equipe (sem login e senha)");
}
async function pararCompartilhar(card) {
  const ok = await dialogo({ titulo: "Parar de compartilhar?", texto: "O modelo sai do arquivo da equipe. Quem já adicionou continua com o card dele.", ok: "Parar de compartilhar", cancelar: "Cancelar" });
  if (!ok) return;
  card = atual(card) || card;
  delete card.modeloDono; // atualizarMeusModelos() cria o tombstone
  save();
  toast("Card não é mais compartilhado");
}
function cardDoModelo(mod) { return itens.find((c) => c.modeloId === mod.id); }
/* Modelos que ainda não decidi (nem adicionei, nem ignorei) e que não são meus. */
function modelosNovos(incluirIgnorados) {
  const meus = new Set(meusModelos()), dec = decisoesModelos();
  return modelosAtivos().filter((m) => !meus.has(m.id) && !cardDoModelo(m) && !itens.some((c) => c.modeloDono === m.id) && (!dec[m.id] || (incluirIgnorados && dec[m.id].acao === "ignorado")));
}
function modelosComAtualizacao() {
  const dec = decisoesModelos();
  return modelosAtivos().map((m) => ({ m: m, c: cardDoModelo(m) })).filter((x) => x.c && CadernoSync.ts(x.m.updatedAt) > CadernoSync.ts(x.c.modeloVersao) &&
    (!dec[x.m.id] || dec[x.m.id].atualizacaoIgnorada !== x.m.updatedAt) &&
    (x.c.url || "") + JSON.stringify(niveisDe(x.c)) + (x.c.escalonamento || "") + (x.c.obs || "") !== (x.m.url || "") + JSON.stringify((x.m.escalonamentos || []).map(limparNivelEsc).filter(Boolean)) + (x.m.escalonamento || "") + (x.m.obs || ""));
}
function adicionarModelos(lista) {
  lista.forEach((m) => {
    itens.push({ id: Math.random().toString(16).slice(2, 10), titulo: m.nome || m.sistema || "", aplicacao: m.sistema || m.nome || "", cliente: "", categoria: "Interno", visibilidade: "Individual",
      url: m.url || "", usuario: "", senha: "", ciclo: "90", ultima: hoje(), horario: "", escalonamento: m.escalonamento || "",
      escalonamentos: (m.escalonamentos || []).map((n) => Object.assign({}, n)), obs: m.obs || "", modeloId: m.id, modeloVersao: m.updatedAt || "", modeloPor: m.sharedBy || "" });
  });
}
let modelosAberto = false;
/* v1.9.8: o botão em Mais sempre abre a tela "Cards compartilhados"; depois da sincronização ela abre sozinha só se chegou card novo. */
async function verificarModelos(manual) {
  if (!window.CadernoSync || modelosAberto || document.body.classList.contains("travado") || trocaObrigatoria) return;
  if (!manual && document.querySelector(".sheet.on")) return;
  modelosAberto = true;
  try {
    if (manual || modelosNovos(false).length) await telaCompartilhados(!!manual);
    const atu = modelosComAtualizacao();
    if (atu.length) await atualizarModelosRecebidos(atu);
  } finally { modelosAberto = false; }
}
function listaMarcavel(box, lista, sub) {
  const marc = new Map();
  lista.forEach((x) => {
    const lab = el("label", "mod-item mod-chk");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = true; marc.set(x, cb);
    lab.appendChild(cb);
    const t = el("span", "mod-txt"); t.appendChild(el("strong", "", x.nome || (x.m && x.m.nome) || "")); t.appendChild(el("small", "", sub(x)));
    lab.appendChild(t); box.appendChild(lab);
  });
  return marc;
}
/* ---------- v1.9.8: tela "Cards compartilhados" (busca, selos de link igual, abas) ---------- */
// Normaliza texto guardando, para cada caractere do resultado, a posição no texto original (para destacar o trecho achado).
function normComMapa(s) {
  s = String(s || ""); let t = ""; const mapa = [];
  for (let i = 0; i < s.length; i++) { const n = s[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); for (let j = 0; j < n.length; j++) { t += n[j]; mapa.push(i); } }
  return { t: t, mapa: mapa };
}
function trechoAchado(texto, q) {
  if (!q) return null; const m = normComMapa(texto); const k = m.t.indexOf(q);
  if (k < 0) return null; return [m.mapa[k], m.mapa[k + q.length - 1] + 1];
}
function textoDestacado(texto, q) {
  const f = document.createDocumentFragment(); texto = String(texto || ""); const r = trechoAchado(texto, q);
  if (!r) { f.appendChild(document.createTextNode(texto)); return f; }
  f.appendChild(document.createTextNode(texto.slice(0, r[0]))); f.appendChild(el("mark", "rc-mk", texto.slice(r[0], r[1]))); f.appendChild(document.createTextNode(texto.slice(r[1])));
  return f;
}
// Procura nos cards locais ativos (Meus e Equipe) por nome, título, aplicação ou link. Nunca usa login nem senha.
function buscarCardsLocais(consulta) {
  const q = normTxt(consulta), qu = normUrl(consulta), r = { meus: [], equipe: [] };
  if (!q) return r;
  itens.forEach((c) => {
    if (c.arquivado_em) return;
    const campos = [c.titulo, c.aplicacao, c.url];
    const achou = campos.some((v) => normTxt(v).indexOf(q) >= 0) || (qu && normUrl(c.url).indexOf(qu) >= 0);
    if (achou) (compartilhado(c) ? r.equipe : r.meus).push(c);
  });
  return r;
}
function selosModelo(m) {
  const r = cardsMesmoLink(m.url, null);
  r.meus = r.meus.filter((c) => c.modeloId !== m.id);
  return r;
}
function nomesLista(l) { return nomeDe(l[0]) + (l.length > 1 ? " (+" + (l.length - 1) + ")" : ""); }
function telaCompartilhados(manual) {
  const dec = decisoesModelos();
  const novos = modelosNovos(true);
  const meus = new Set(meusModelos());
  const info = new Map(); const marc = new Map();
  novos.forEach((m) => {
    const s = selosModelo(m);
    const ignoradoAntes = !!(dec[m.id] && dec[m.id].acao === "ignorado");
    info.set(m, s);
    marc.set(m, !s.meus.length && !s.equipe.length && (manual || !ignoradoAntes));
  });
  const verCard = (c, origem) => verModelo(conteudoModelo(c), origem + " · login e senha não aparecem aqui");
  return janela("dlgMod", (box, fim) => {
    box.classList.add("mod-receber", "rc");
    box.appendChild(el("h3", "", "📥 Cards compartilhados"));
    box.appendChild(el("p", "meta rc-sub", "Login e senha vêm em branco: você preenche os seus."));
    // Busca
    const lab = el("label", "rc-busca");
    lab.appendChild(el("span", "rc-busca-ph", "🔎 Procurar nos meus cards e nos da Equipe (nome ou link)"));
    const inp = el("input"); inp.type = "search"; inp.id = "rcBusca"; inp.autocomplete = "off"; inp.spellcheck = false; inp.setAttribute("aria-label", "Procurar nos meus cards e nos da Equipe (nome ou link)");
    lab.appendChild(inp); box.appendChild(lab);
    const res = el("div", "rc-res"); res.id = "rcRes"; res.hidden = true; box.appendChild(res);
    const MAX = 5;
    const grupo = (rotulo, lista, q, ehMeu) => {
      const g = el("div", "rc-res-g"); g.appendChild(el("b", "", rotulo + ": "));
      if (!lista.length) { g.appendChild(el("span", "rc-nada", "nenhum")); return g; }
      lista.slice(0, MAX).forEach((c) => {
        const it = el("div", "rc-res-it");
        it.appendChild(textoDestacado(nomeDe(c), q));
        if (c.url) { it.appendChild(document.createTextNode(" · ")); const u = el("span", "rc-res-url"); u.appendChild(textoDestacado(c.url, q)); it.appendChild(u); }
        g.appendChild(it);
      });
      if (lista.length > MAX) g.appendChild(el("div", "rc-mais", "+ " + (lista.length - MAX) + " outro(s). Refine a busca."));
      return g;
    };
    const buscar = () => {
      const q = normTxt(inp.value); res.textContent = "";
      if (!q) { res.hidden = true; return; }
      const r = buscarCardsLocais(inp.value);
      res.appendChild(grupo("Meus", r.meus, q, true)); res.appendChild(grupo("Equipe", r.equipe, q, false));
      res.hidden = false;
    };
    inp.addEventListener("input", buscar);
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ev.preventDefault(); });
    // Abas
    const abasEl = el("div", "rc-abas"); abasEl.setAttribute("role", "tablist"); box.appendChild(abasEl);
    const corpo = el("div", "rc-corpo"); box.appendChild(corpo);
    let abaAtual = "add";
    const jaAdicionados = () => modelosAtivos().filter((m) => !meus.has(m.id) && cardDoModelo(m) && !itens.some((c) => c.modeloDono === m.id));
    const queCompartilhei = () => { const at = new Set(modelosAtivos().map((m) => m.id)); return meusModelos().map((tid) => ({ tid: tid, card: itens.find((c) => c.modeloDono === tid), m: modelosAtivos().find((x) => x.id === tid) })).filter((x) => x.card && at.has(x.tid)); };
    const vazio = (t) => corpo.appendChild(el("p", "rc-vazio", t));
    const desenharAdd = () => {
      if (!novos.length) { vazio("Nada novo para adicionar. Quando alguém da equipe compartilhar um card, ele aparece aqui."); return; }
      novos.forEach((m) => {
        const s = info.get(m);
        const item = el("div", "mod-item mod-chk rc-item");
        const cb = el("input"); cb.type = "checkbox"; cb.checked = marc.get(m); cb.id = "rc-" + m.id; cb.setAttribute("aria-label", "Selecionar " + (m.nome || ""));
        cb.addEventListener("change", () => { marc.set(m, cb.checked); conta(); });
        item.appendChild(cb);
        const t = el("div", "mod-txt");
        const l1 = el("label", "rc-l1"); l1.htmlFor = cb.id; l1.appendChild(el("span", "rc-nm", m.nome || m.sistema || "(sem nome)")); l1.appendChild(el("span", "rc-por", " · por " + (m.sharedBy || "alguém da equipe")));
        t.appendChild(l1);
        t.appendChild(el("div", "rc-lk", m.url || "sem link"));
        if (!s.meus.length && !s.equipe.length) t.appendChild(el("div", "rc-selo s-ok", "🟢 Novo: você não tem nada parecido"));
        if (s.meus.length) { const d = el("div", "rc-selo s-ylw"); d.appendChild(el("span", "", "🟡 Você já tem esse link em Meus: " + nomesLista(s.meus))); d.appendChild(botaoDlg("pequeno", "Ver meu card", () => verCard(s.meus[0], "Meus (card Individual)"))); t.appendChild(d); }
        if (s.equipe.length) { const d = el("div", "rc-selo s-inf"); d.appendChild(el("span", "", "🔵 Já é card da Equipe: " + nomesLista(s.equipe))); d.appendChild(botaoDlg("pequeno", "Ver card da Equipe", () => verCard(s.equipe[0], "Card da Equipe"))); t.appendChild(d); }
        item.appendChild(t); corpo.appendChild(item);
      });
    };
    const desenharJa = () => {
      const l = jaAdicionados();
      if (!l.length) { vazio("Nenhum card compartilhado adicionado ainda."); return; }
      l.forEach((m) => {
        const c = cardDoModelo(m); const ln = el("div", "rc-ln");
        const d = el("div", ""); d.appendChild(document.createTextNode(m.nome || "")); d.appendChild(el("small", "", " (por " + (m.sharedBy || "alguém da equipe") + ")"));
        ln.appendChild(d); ln.appendChild(el("small", "", c && compartilhado(c) ? "já está na Equipe" : (c && c.arquivado_em ? "arquivado em Meus" : "já está em Meus")));
        corpo.appendChild(ln);
      });
    };
    const desenharMeus = () => {
      const l = queCompartilhei();
      if (!l.length) { vazio("Você ainda não compartilhou nenhum card. Use “Compartilhar meu card” num card de Meus."); return; }
      l.forEach((x) => {
        const ln = el("div", "rc-ln"); ln.appendChild(el("div", "", nomeDe(x.card)));
        ln.appendChild(botaoDlg("pequeno", "Parar de compartilhar", async () => { await pararCompartilhar(x.card); desenhar(); }));
        corpo.appendChild(ln);
      });
    };
    const desenhar = () => {
      const abas = [["add", "Para adicionar (" + novos.length + ")"], ["ja", "Já adicionados (" + jaAdicionados().length + ")"], ["meus", "Que eu compartilhei (" + queCompartilhei().length + ")"]];
      abasEl.textContent = "";
      abas.forEach(([k, txt]) => { const b = el("button", "rc-aba" + (k === abaAtual ? " on" : ""), txt); b.type = "button"; b.dataset.rcAba = k; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", k === abaAtual ? "true" : "false"); b.addEventListener("click", () => { abaAtual = k; desenhar(); }); abasEl.appendChild(b); });
      corpo.textContent = "";
      if (abaAtual === "add") desenharAdd(); else if (abaAtual === "ja") desenharJa(); else desenharMeus();
      aplicarIcones(corpo);
    };
    // Rodapé
    const bb = el("div", "rc-rod");
    const bSel = botaoDlg("pri", "", () => fim({ add: novos.filter((m) => marc.get(m)) }));
    bSel.id = "rcAdicionar";
    const bIgn = botaoDlg("", "Ignorar", () => fim({ add: [] })); bIgn.id = "rcIgnorar";
    const bFec = botaoDlg("", "Fechar", () => fim(false)); bFec.id = "rcFechar";
    function conta() { const n = novos.filter((m) => marc.get(m)).length; bSel.textContent = "Adicionar selecionados (" + n + ")"; bSel.disabled = !n; bIgn.disabled = !novos.length; }
    bb.appendChild(bSel); bb.appendChild(bIgn); bb.appendChild(bFec);
    desenhar(); conta();
    box.appendChild(bb);
    box.appendChild(el("p", "rc-nota", "Nada é bloqueado: você decide. Aviso só quando o link é exatamente igual."));
  }).then((r) => {
    if (!r) return; // fechou sem decidir: pergunta de novo na próxima vez
    const d = decisoesModelos(); const agora = new Date().toISOString();
    novos.forEach((m) => { d[m.id] = { acao: r.add.indexOf(m) >= 0 ? "adicionado" : "ignorado", em: agora }; });
    gravarDecisoes(d);
    if (r.add.length) { adicionarModelos(r.add); save(); toast(r.add.length + (r.add.length === 1 ? " card adicionado em Meus. Preencha seu login e senha." : " cards adicionados em Meus. Preencha seu login e senha.")); }
    else toast("Cards compartilhados ignorados. Você pode vê-los de novo em Mais.");
  });
}
async function atualizarModelosRecebidos(lista) {
  const dec = decisoesModelos();
  const r = await janela("dlgMod", (box, fim) => {
    box.appendChild(el("h3", "", lista.length === 1 ? "1 card compartilhado foi atualizado" : lista.length + " cards compartilhados foram atualizados"));
    box.appendChild(el("p", "meta", "Atualiza link, escalonamento e observações. Seu login e sua senha continuam como estão."));
    const marc = listaMarcavel(box, lista, (x) => "por " + (x.m.updatedBy || x.m.sharedBy || "alguém da equipe") + " · " + dataHoraBR(x.m.updatedAt));
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Agora não", () => fim({ sel: [] })));
    bb.appendChild(botaoDlg("pri", "Atualizar selecionados", () => fim({ sel: lista.filter((x) => marc.get(x).checked) })));
    box.appendChild(bb);
  });
  if (!r) return;
  lista.forEach((x) => {
    if (r.sel.indexOf(x) >= 0) {
      Object.assign(x.c, { url: x.m.url || "", escalonamento: x.m.escalonamento || "", escalonamentos: (x.m.escalonamentos || []).map((n) => Object.assign({}, n)), obs: x.m.obs || "", modeloVersao: x.m.updatedAt });
    } else { dec[x.m.id] = Object.assign({ acao: "adicionado" }, dec[x.m.id], { atualizacaoIgnorada: x.m.updatedAt }); }
  });
  gravarDecisoes(dec);
  if (r.sel.length) { save(); toast(r.sel.length === 1 ? "Card atualizado (login e senha mantidos)" : r.sel.length + " cards atualizados (login e senha mantidos)"); }
}
function blocoModelos(box) {
  if (!syncEstado.vinculado) return;
  const ativos = modelosAtivos(), meus = new Set(meusModelos());
  const daEquipe = ativos.filter((m) => !meus.has(m.id));
  const disp = modelosNovos(true).length;
  const c = el("article", "card painel-mais");
  c.appendChild(el("h3", "", "Cards compartilhados"));
  c.appendChild(el("p", "meta", "Você compartilha " + meus.size + " · a equipe compartilha " + daEquipe.length + (disp ? " · " + disp + " ainda não adicionado(s)" : "") + ". Use “Compartilhar meu card” num card Individual: vão nome, link, sistema, escalonamento e observações, nunca login e senha."));
  const row = el("div", "acoes-mais");
  row.appendChild(btn("btn", "users", "Ver cards compartilhados", () => verificarModelos(true)));
  c.appendChild(row);
  box.appendChild(c);
}
function exigirNome() {
  if (autor()) return true;
  toast("Informe seu nome antes (ele aparece nas alterações para a equipe)");
  const i = $("syncNome"); if (i) i.focus();
  return false;
}
function carimbarSemData() {
  const agora = new Date().toISOString();
  itens.filter(compartilhado).forEach((it) => { if (!it.updatedAt) { it.updatedAt = agora; it.updatedBy = autor(); } });
  localStorage.setItem(KEY, JSON.stringify(itens));
  const meta = syncMeta(); meta.ultimaSync = ""; gravarMeta(meta);
}
async function vincularPasta() {
  if (!exigirNome()) return;
  try {
    const a = window.__syncAdaptadorTeste || syncPasta;
    await a.vincular();
    if (!window.__syncAdaptadorTeste && syncArquivo && await syncArquivo.vinculado()) await syncArquivo.desvincular(); // migra do modo arquivo
    localStorage.setItem(MIGRAR_KEY, "1");
    carimbarSemData();
    await atualizarEstadoSync();
    const ok = await sincronizar(true);
    if (ok) toast("Pasta da equipe vinculada: " + syncEstado.nome);
  } catch (e) { if (!e || e.name !== "AbortError") toast("Não foi possível vincular a pasta (" + ((e && e.name) || "erro") + ")."); }
  if (aba === "mais") render();
}
async function criarArquivoEquipe() {
  if (!exigirNome()) return;
  try {
    await syncArquivo.criar(SYNC_ARQUIVO);
    carimbarSemData();
    await atualizarEstadoSync();
    await sincronizar(true);
  } catch (e) { if (!e || e.name !== "AbortError") toast("Não foi possível criar o arquivo."); }
  if (aba === "mais") render();
}
async function usarArquivoEquipe() {
  if (!exigirNome()) return;
  try {
    await syncArquivo.abrir();
    const meta = syncMeta(); meta.ultimaSync = ""; gravarMeta(meta);
    await atualizarEstadoSync();
    await sincronizar(true);
  } catch (e) { if (!e || e.name !== "AbortError") toast("Não foi possível abrir o arquivo."); }
  if (aba === "mais") render();
}
async function desvincularArquivo() {
  const ok = await dialogo({ titulo: "Desvincular a pasta/arquivo da equipe?", texto: "Os cards continuam neste aparelho. Nada é apagado na pasta.", ok: "Desvincular", cancelar: "Cancelar" });
  if (!ok) return;
  const a = adaptador(); if (a) await a.desvincular();
  syncEstado.pendente = false;
  await atualizarEstadoSync();
  render();
  toast("Desvinculado");
}
/* v1.9 → v1.9.1: quem só tinha o ARQUIVO vinculado recebe, uma vez, o convite para vincular a PASTA. */
async function sugerirPasta() {
  if (!syncEstado.vinculado || syncEstado.modo !== "arquivo" || !syncEstado.pastaSuportada || localStorage.getItem(MIGRAR_KEY)) return;
  localStorage.setItem(MIGRAR_KEY, "1");
  const ok = await dialogo({ titulo: "Vincular a pasta da equipe", texto: "Para evitar as cópias de conflito do OneDrive (caderno-equipe-NOMEDOPC.json), vincule a PASTA json-caderno-acessos em vez de só o arquivo. O Caderno passa a juntar essas cópias sozinho e a gravar um log de erros na pasta.", ok: "Vincular a pasta", cancelar: "Agora não" });
  if (ok) vincularPasta();
}
function blocoArquivoEquipe(box, bloco) {
  if (!syncEstado.suportado) {
    bloco("Arquivo da equipe", "Este navegador não permite usar a pasta sincronizada (comum no celular e no Firefox). Continue usando Exportar/Importar JSON normalmente.", []);
    return;
  }
  const nome = el("input"); nome.type = "text"; nome.id = "syncNome"; nome.placeholder = "Seu nome"; nome.value = autor(); nome.maxLength = 40; nome.autocomplete = "name";
  const salvarNome = btn("btn", "check", "Salvar nome", () => {
    const v = nome.value.trim(); if (!v) { toast("Digite seu nome"); return; }
    localStorage.setItem(AUTOR_KEY, v); toast("Nome salvo"); render();
  });
  const linhaNome = el("div", "sync-nome"); linhaNome.appendChild(nome); linhaNome.appendChild(salvarNome);
  let botoes;
  if (syncEstado.vinculado) {
    botoes = [btn("btn pri", "refresh", "Sincronizar agora", () => sincronizar(true))];
    if (syncEstado.modo === "arquivo" && syncEstado.pastaSuportada) botoes.push(btn("btn", "folder", "Vincular a pasta da equipe", vincularPasta));
    botoesSenhaEquipe().forEach((b) => botoes.push(b));
    botoes.push(btn("btn", "x", "Desvincular", desvincularArquivo));
  } else if (syncEstado.pastaSuportada) {
    botoes = [btn("btn pri", "folder", "Vincular a pasta da equipe", vincularPasta)];
  } else {
    botoes = [btn("btn pri", "download", "Criar arquivo da equipe", criarArquivoEquipe), btn("btn", "upload", "Usar arquivo existente", usarArquivoEquipe)];
  }
  const ult = syncMeta().ultimaSync;
  bloco("Arquivo da equipe", syncEstado.vinculado
    ? (syncEstado.modo === "pasta" ? "Pasta vinculada: " : "Arquivo vinculado: ") + syncEstado.nome + (ult ? " · Última sincronização " + dataHoraBR(ult) : "") + "." + (syncEstado.modo === "arquivo" && syncEstado.pastaSuportada ? " Recomendado: vincule a pasta para juntar as cópias de conflito do OneDrive." : "") + " Só cards de Equipe vão para o arquivo; cards Individuais e suas senhas nunca saem deste aparelho." + textoSenhaEquipe()
    : syncEstado.pastaSuportada
      ? "Escolha a pasta do OneDrive da equipe (json-caderno-acessos). O Caderno usa o arquivo caderno-equipe.json (cria se não existir), junta as cópias de conflito do OneDrive e grava um log de erros na pasta. Só cards de Equipe vão para o arquivo."
      : "Use um arquivo na pasta do OneDrive (ex.: json-caderno-acessos). Uma pessoa cria o arquivo; as outras usam o arquivo existente. Só cards de Equipe vão para o arquivo.",
    [linhaNome].concat(botoes));
  blocoHistorico(box);
  const le = lerJSON(LOGERR_KEY, []);
  const c2 = el("article", "card painel-mais historico log-erros");
  c2.appendChild(el("h3", "", "Log de erros"));
  if (!le.length) c2.appendChild(el("p", "meta", "Nenhum erro de sincronização registrado neste aparelho."));
  else {
    c2.appendChild(el("p", "meta", syncEstado.modo === "pasta" ? "Também gravado em caderno-equipe-log.csv na pasta da equipe. Não inclui senhas." : "Não inclui senhas."));
    const ul = el("ul", "hist-lista");
    le.slice(0, 20).forEach((x) => { const li = el("li"); li.appendChild(el("span", "hist-quando", dataHoraBR(x[0]))); li.appendChild(el("span", "", x[1] + " · " + x[2] + (x[3] ? " · " + x[3] : "") + " — " + x[4])); ul.appendChild(li); });
    c2.appendChild(ul);
    const row = el("div", "acoes-mais");
    row.appendChild(btn("btn", "trash", "Limpar log deste aparelho", () => { localStorage.removeItem(LOGERR_KEY); render(); }));
    c2.appendChild(row);
  }
  box.appendChild(c2);
}
/* v1.9.7: Histórico com ícone, ação, card, quem, quando e etiqueta Equipe/Meu. */
const HIST_ROT = {
  adicionado: ["➕", "Card adicionado"], editado: ["✏️", "Card editado"], senha: ["🔑", "Senha alterada"], arquivado: ["📦", "Card arquivado"],
  reativado: ["♻️", "Card reativado"], excluido: ["🗑️", "Card excluído"], compartilhado: ["📤", "Card compartilhado"], parou: ["🚫", "Parou de compartilhar"],
  importado: ["📥", "Importação"], "se-ativada": ["🛡️", "Arquivo protegido com senha da equipe"], "se-trocada": ["🛡️", "Senha da equipe trocada"],
  primeiro: ["👋", "Primeiro acesso"], conflito: ["⚠️", "Conflito resolvido"], copia: ["🔀", "Cópia de conflito juntada"], texto: ["🕘", ""]
};
let histFiltro = "todos";
function blocoHistorico(box) {
  const todos = lerHist();
  const c = el("article", "card painel-mais historico hist2");
  c.appendChild(el("h3", "", "Histórico"));
  c.appendChild(el("p", "meta", "Mostrando as últimas 100 ações"));
  const chips = el("div", "hist-chips");
  [["todos", "Todos"], ["Equipe", "Equipe"], ["Meu", "Meus"]].forEach(([k, t]) => {
    const b = btn("hist-chip" + (histFiltro === k ? " on" : ""), null, t, () => { histFiltro = k; render(); });
    b.dataset.filtro = k; b.setAttribute("aria-pressed", histFiltro === k ? "true" : "false"); chips.appendChild(b);
  });
  c.appendChild(chips);
  const l = todos.filter((e) => histFiltro === "todos" || e.escopo === histFiltro).slice(0, 100);
  if (!l.length) c.appendChild(el("p", "meta", "Nenhuma ação registrada ainda."));
  else {
    const ul = el("ul", "hist2-lista");
    l.forEach((e) => {
      const r = HIST_ROT[e.tipo] || HIST_ROT.texto;
      const li = el("li", "hist2-it"); li.dataset.tipo = e.tipo;
      li.appendChild(el("span", "hist2-ic", r[0]));
      const tx = el("div", "hist2-tx");
      if (e.tipo === "texto") tx.appendChild(el("b", "", e.texto || ""));
      else if (e.tipo === "primeiro") tx.appendChild(el("b", "", "Primeiro acesso de " + (e.quem || "analista")));
      else { tx.appendChild(el("b", "", r[1])); if (e.card) { tx.appendChild(document.createTextNode(" · ")); tx.appendChild(el("span", "hist2-card", e.card)); } }
      tx.appendChild(el("div", "hist2-sub", (e.quem && e.tipo !== "primeiro" ? "por " + e.quem + " · " : "") + dataHoraBR(e.quando)));
      li.appendChild(tx);
      li.appendChild(el("span", "hist2-tag " + (e.escopo === "Meu" ? "meu" : "equipe"), e.escopo === "Meu" ? "Meu" : "Equipe"));
      ul.appendChild(li);
    });
    c.appendChild(ul);
  }
  c.appendChild(el("div", "hist2-nota", "🔒 O histórico nunca mostra senhas, só que foram alteradas. Ações da Equipe viajam no arquivo da equipe (protegido, se houver senha da equipe); as dos cards Meus ficam só neste aparelho."));
  box.appendChild(c);
}
function renderMais(box) {
  const bloco = (titulo, texto, botoes) => {
    const c = el("article", "card painel-mais");
    c.appendChild(el("h3", "", titulo));
    c.appendChild(el("p", "meta", texto));
    const row = el("div", "acoes-mais");
    botoes.forEach((b) => row.appendChild(b));
    c.appendChild(row);
    box.appendChild(c);
  };
  const tema = temaAtual();
  const bt = Object.keys(TEMAS).map((k) => {
    const b = btn("btn tema-op" + (k === tema ? " on" : ""), null, TEMAS[k].nome, () => definirTema(k));
    b.dataset.tema = k;
    b.setAttribute("aria-pressed", k === tema ? "true" : "false");
    b.insertAdjacentHTML("afterbegin", '<span class="amostra amostra-' + String(k).replace(/[^\w-]/g, "") + '"></span>');
    return b;
  });
  blocoNovidades(box);
  bloco("Tema", "Aparência só deste aparelho. Vale também para a tela de login.", bt);
  blocoArquivoEquipe(box, bloco);
  blocoModelos(box);
  bloco("Compartilhar com a equipe", "Gera o JSON para os outros analistas. Cards Individuais vão sem usuário e sem senha (só título, aplicação, cliente, URL etc.).",
    [btn("btn pri", "download", "Exportar JSON", exportarEquipe)]);
  bloco("Backup pessoal (inclui minhas senhas)", "Arquivo completo, com os usuários e senhas dos seus acessos Individuais. Use só para levar para outro aparelho seu. Não compartilhe.",
    [btn("btn", "lock", "Backup pessoal (inclui minhas senhas)", backupPessoal)]);
  bloco("Importar", "Junta os cards do arquivo com os deste aparelho (pelo id). Cards que só existem aqui continuam. Usuário e senha que você já tem não são apagados por um arquivo que veio sem eles.",
    [btn("btn", "upload", "Importar JSON", () => document.getElementById("imp").click()),
     btn("btn", "table", "Importar planilha Excel", escolherPlanilha)]);
  bloco("Planilha Excel", "“Excel para importar”: formato simples em abas (externos, internos, arquivados e escalonamento), para subir em “Importar planilha”. “Excel para consulta”: com navegação e escalonamento em blocos, somente leitura. Senhas individuais saem em branco.",
    [btn("btn", "table", "Excel para importar", exportarExcelImportar, null, "Formato simples para importar no app"),
     btn("btn", "book", "Excel para consulta", exportarExcelConsulta, null, "Com navegação e escalonamento, somente leitura")]);
  const minAtual = minutosBloqueio();
  const bb = BLOQ_OPCOES.map((n) => {
    const b = btn("btn tema-op" + (n === minAtual ? " on" : ""), null, n ? n + " min" : "Nunca", () => definirBloqueio(n));
    b.setAttribute("aria-pressed", n === minAtual ? "true" : "false");
    return b;
  });
  bloco("Bloqueio automático", "Volta para a tela de login depois de um tempo sem uso. Vale só para este aparelho.", bb);
  bloco("Senha deste aparelho", "Altera a senha de acesso salva só neste navegador. Outros aparelhos continuam com a senha padrão até alguém trocar lá também.",
    [btn("btn", "lock", "Trocar senha", abrirTrocaSenha)]);
  bloco("Offline e instalação", "Abra o link no Chrome uma vez com internet (fora da VPN) e use “Instalar app”. Depois funciona sem internet; quando houver internet, a versão nova chega sozinha.",
    [btn("btn", "logout", "Sair (bloquear)", sair)]);
}

/* ---------- v1.9.3+: Novidades (texto vai junto com o app; mais recente primeiro) ---------- */
const APP_VERSAO = "1.9.8";
const NOVIDADES_VISTA = "caderno-novidades-vista";
const NOVIDADES = [
  { v: "1.9.8", data: "18/10/2026", itens: ["Nova tela “Cards compartilhados” em Mais: procure nos seus cards e nos da Equipe e veja o que é novo, o que já foi adicionado e o que você compartilhou.", "Selos mostram se o link do card recebido já existe em Meus ou na Equipe.", "Aviso de card repetido só quando o link é exatamente igual, também ao criar ou editar um card. Nada é bloqueado."] },
  { v: "1.9.7", data: "16/10/2026", itens: ["Histórico em Mais mostra as últimas 100 ações: quem adicionou, editou, arquivou ou excluiu cards.", "O card não fecha mais sozinho ao clicar fora: o app pergunta antes de descartar.", "Importação mais segura, com prévia antes de aplicar."] },
  { v: "1.9.6", data: "15/10/2026", itens: ["Corrigido: cards da Equipe arquivados agora podem ser excluídos normalmente.", "Transições mais suaves ao salvar, excluir, entrar e pesquisar."] },
  { v: "1.9.5", data: "15/10/2026", itens: ["O arquivo da equipe pode ser protegido com uma senha da equipe: fora do app ele fica ilegível.", "Cada analista digita a senha da equipe só uma vez por aparelho.", "O gestor pode trocar a senha da equipe e ver a senha atual depois de confirmar a própria senha de login."], fazer: "Quando o app pedir, digite a senha da equipe passada pelo gestor." },
  { v: "1.9.4", data: "15/10/2026", itens: ["Novo botão “Compartilhar meu card”: envia link e escalonamento para a equipe, sem login e senha.", "Quem recebe escolhe adicionar ou ignorar e só preenche a própria senha.", "Sobre (i) com explicação do app e regras de uso."] },
  { v: "1.9.3", data: "14/10/2026", itens: ["Agora, sempre que o app for atualizado, aparece esta tela uma vez com as novidades.", "Em Mais, a lista “Últimas novidades” guarda o que mudou nas versões recentes."] },
  { v: "1.9.2", data: "14/10/2026", itens: ["Novos analistas começam com apenas 1 card de exemplo, que pode ser apagado.", "A exportação e importação do Excel usam só arquivos do próprio app, sem depender da internet."] },
  { v: "1.9.1", data: "14/10/2026", itens: ["Corrige as cópias duplicadas que apareciam na sincronização.", "Agora você vincula a pasta inteira da equipe, e não um arquivo só.", "Novo “Log de erros” em Mais para ver falhas de sincronização."], fazer: "Vincule a pasta da equipe uma vez, em Mais › Arquivo da equipe." },
  { v: "1.9", data: "13/10/2026", itens: ["Os cards da Equipe passam a ser sincronizados entre os analistas por uma pasta compartilhada.", "Cards Individuais continuam só no seu aparelho."] }
];
function novidadesItens(n, box) {
  const ul = el("ul", "");
  n.itens.forEach((t) => ul.appendChild(el("li", "", t)));
  box.appendChild(ul);
  if (n.fazer) {
    const f = el("div", "nv-f");
    f.appendChild(el("b", "", "O que fazer: "));
    f.appendChild(document.createTextNode(n.fazer));
    box.appendChild(f);
  }
}
function blocoNovidades(box) {
  const c = el("article", "card painel-mais nv-lista");
  c.appendChild(el("h3", "", "Últimas novidades"));
  NOVIDADES.slice(0, 5).forEach((n, i) => {
    const d = el("div", "nv-l");
    const t = el("div", "nv-v", "v" + n.v + " ");
    t.appendChild(el("small", "", "· " + n.data));
    if (i === 0) t.appendChild(el("span", "nv-novo", "novo"));
    d.appendChild(t);
    novidadesItens(n, d);
    c.appendChild(d);
  });
  box.appendChild(c);
}
function mostrarNovidadesSePendente() {
  let vista = null;
  try { vista = localStorage.getItem(NOVIDADES_VISTA); } catch (e) {}
  if (vista === APP_VERSAO) return;
  if (trocaObrigatoria || document.body.classList.contains("travado")) return;
  if ($("dlgInstalar").classList.contains("on") || $("dlgSenha").classList.contains("on")) return;
  const n = NOVIDADES[0];
  $("nvTitulo").textContent = "Novidades da v" + n.v;
  $("nvData").textContent = n.data;
  const corpo = $("nvCorpo");
  corpo.textContent = "";
  novidadesItens(n, corpo);
  try { localStorage.setItem(NOVIDADES_VISTA, APP_VERSAO); } catch (e) {}
  abrirSheet("dlgNovidades");
  setTimeout(() => $("nvEntendi").focus(), 40);
}

/* ---------- Exportar / importar ---------- */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function semSegredoIndividual(it) {
  if (it.visibilidade !== "Individual") return Object.assign({}, it);
  const c = Object.assign({}, it);
  c.usuario = "";
  c.senha = "";
  return c;
}
function exportarEquipe() {
  download("caderno-acessos-equipe-" + hoje() + ".json", JSON.stringify({ versao: "web-2", tipo: "equipe", gerado_em: hoje(), itens: itens.map(semSegredoIndividual) }, null, 2), "application/json");
  toast("JSON da equipe exportado (sem senhas individuais)");
}
function backupPessoal() {
  download("caderno-acessos-backup-pessoal-" + hoje() + ".json", JSON.stringify({ versao: "web-2", tipo: "backup-pessoal", gerado_em: hoje(), itens: itens }, null, 2), "application/json");
  toast("Backup pessoal exportado");
}
/* v1.9.7: todo card importado passa por CadernoSync.normalizarCard (lista branca, só texto, limites). "alvo" permite simular (prévia). */
function idDaChave(chave) { let h = 2166136261; for (let k = 0; k < chave.length; k++) { h ^= chave.charCodeAt(k); h = Math.imul(h, 16777619); } return "imp-" + (h >>> 0).toString(16).padStart(8, "0"); }
function prepararImportacao(lista) {
  const ok = [], invalidos = [];
  lista.forEach((raw, pos) => {
    const inc = window.CadernoSync ? CadernoSync.normalizarCard(raw) : null;
    if (!inc) { invalidos.push(pos); return; }
    if (!inc.id) { const k = chaveCard(inc); if (!k) { invalidos.push(pos); return; } inc.id = idDaChave(k); }
    if (!inc.titulo && !inc.aplicacao) { invalidos.push(pos); return; }
    if (!inc.escalonamentos) inc.escalonamentos = [];
    ok.push(inc);
  });
  return { itens: ok, invalidos: invalidos };
}
function mesclar(lista, alvo) {
  alvo = alvo || itens;
  let novos = 0, atualizados = 0, duplicados = 0;
  const links = new Map(); alvo.forEach((x) => { const u = normUrl(x.url); if (u) links.set(u, (links.get(u) || 0) + 1); });
  lista.forEach((inc) => {
    if (!inc || typeof inc !== "object" || !inc.id) return;
    const i = alvo.findIndex((x) => x.id === inc.id);
    if (i < 0) {
      // também evita duplicar por fornecedor+aplicação se id diferente
      const chave = chaveCard(inc);
      const j = chave ? alvo.findIndex((x) => chaveCard(x) === chave) : -1;
      if (j >= 0) {
        const atual = alvo[j];
        const junto = Object.assign({}, atual, inc, { id: atual.id });
        ["usuario", "senha"].forEach((k) => { if (!inc[k] && atual[k]) junto[k] = atual[k]; });
        if ((!inc.escalonamentos || !inc.escalonamentos.length) && atual.escalonamentos && atual.escalonamentos.length) junto.escalonamentos = atual.escalonamentos;
        alvo[j] = junto;
        atualizados++;
        return;
      }
      const u = normUrl(inc.url);
      if (u && links.get(u)) duplicados++;
      if (u) links.set(u, (links.get(u) || 0) + 1);
      alvo.push(inc); novos++; return;
    }
    const atual = alvo[i];
    const junto = Object.assign({}, atual, inc);
    ["usuario", "senha"].forEach((k) => { if (!inc[k] && atual[k]) junto[k] = atual[k]; });
    if ((!inc.escalonamentos || !inc.escalonamentos.length) && atual.escalonamentos && atual.escalonamentos.length) junto.escalonamentos = atual.escalonamentos;
    alvo[i] = junto;
    atualizados++;
  });
  return { novos: novos, atualizados: atualizados, duplicados: duplicados };
}
const IMPORT_MAX_BYTES = 5 * 1024 * 1024, IMPORT_MAX_CARDS = 2000;
/* Prévia antes de aplicar: X novos, Y atualizados, Z possíveis duplicados (mesmo link). */
async function importarComPrevia(listaBruta, titulo) {
  if (listaBruta.length > IMPORT_MAX_CARDS) { aviso("Arquivo grande demais", "O arquivo tem " + listaBruta.length + " cards. O limite é " + IMPORT_MAX_CARDS + " por importação. Nada foi importado."); return false; }
  const prep = prepararImportacao(listaBruta);
  if (!prep.itens.length) { aviso("Nada importado", "Nenhum card válido no arquivo" + (prep.invalidos.length ? " (" + prep.invalidos.length + " ignorado(s) por formato errado)" : "") + "."); return false; }
  const sim = mesclar(prep.itens.map((x) => Object.assign({}, x)), itens.map((x) => Object.assign({}, x)));
  const ok = await dialogo({
    titulo: titulo || "Importar cards?",
    texto: sim.novos + " novo(s), " + sim.atualizados + " atualizado(s), " + sim.duplicados + " possível(is) duplicado(s) (mesmo link)." + (prep.invalidos.length ? " " + prep.invalidos.length + " card(s) com formato errado serão ignorados." : "") + " Usuário e senha que você já tem não são apagados.",
    ok: "Importar", cancelar: "Cancelar"
  });
  if (!ok) { toast("Importação cancelada"); return false; }
  histLote = { n: 0 };
  let res;
  try { res = mesclar(prep.itens); save(); }
  finally { histLote = null; }
  addHist({ tipo: "importado", card: res.novos + " novo(s), " + res.atualizados + " atualizado(s)", escopo: "Meu", local: true });
  fotoMeus = fotoIndividuais();
  if (aba === "mais") render();
  toast("Importação concluída: " + res.novos + " novo(s), " + res.atualizados + " atualizado(s). Total: " + itens.length + " card(s).");
  return true;
}
function chaveCard(it) {
  const a = String(it.aplicacao || "").trim().toLowerCase();
  const f = String(it.cliente || it.titulo || "").trim().toLowerCase();
  const t = String(it.titulo || "").trim().toLowerCase();
  if (!a && !f && !t) return "";
  return a + "|" + f + "|" + t;
}
function importarJson(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  if (f.size > IMPORT_MAX_BYTES) { aviso("Arquivo grande demais", "O limite é 5 MB por importação. Nada foi importado."); ev.target.value = ""; return; }
  const r = new FileReader();
  r.onload = async () => {
    ev.target.value = "";
    let data;
    try { data = JSON.parse(r.result); } catch (e) { aviso("Arquivo inválido", "Esse arquivo não é um JSON do Caderno de Acessos."); return; }
    const lista = Array.isArray(data) ? data : (data && typeof data === "object" && Array.isArray(data.itens)) ? data.itens : null;
    if (!lista) { aviso("Arquivo inválido", "Formato não reconhecido: o JSON precisa ser uma lista de cards ou ter a lista em “itens”. Nada foi importado."); return; }
    try { await importarComPrevia(lista, "Importar JSON?"); }
    catch (e) { aviso("Falha na importação", "Não foi possível importar esse arquivo. Nada foi alterado."); }
  };
  r.readAsText(f);
}
/* ---------- Bibliotecas de planilha (vendorizadas em js/vendor, funcionam offline) ---------- */
const libsCarregando = {};
function carregarScript(src, global) {
  if (window[global]) return Promise.resolve(window[global]);
  if (libsCarregando[src]) return libsCarregando[src];
  libsCarregando[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => window[global] ? resolve(window[global]) : reject(new Error(global + " indisponível"));
    s.onerror = () => { delete libsCarregando[src]; s.remove(); reject(new Error("Falha ao carregar " + src)); };
    document.head.appendChild(s);
  });
  return libsCarregando[src];
}
function carregarXlsxLib() {
  return carregarScript("js/vendor/xlsx.full.min.js", "XLSX");
}
function carregarExcelJS() { return carregarScript("js/vendor/exceljs.min.js", "ExcelJS"); }

/* ---------- Exportar Excel (v1.5): "para importar" (simples) e "para consulta" (navegável) ---------- */
const XL = { navy: "FF1B365D", ext: "FF2F6DB5", int: "FF1A8C86", ind: "FFDCEBFA", zebra: "FFF4F5F7", cinza: "FFD9D9D9", cinzaTx: "FF595959", sub: "FFDCE6F2", info: "FFEEF3F9", borda: "FFBFC4CC", branco: "FFFFFFFF", link: "FF2F6DB5" };
const XL_NIVEL = { 1: ["FFDCE6F2", "FF1B365D"], 2: ["FFB4C7E7", "FF1B365D"], 3: ["FF7F9CC9", "FFFFFFFF"], 4: ["FF4A6FA5", "FFFFFFFF"], 5: ["FF1B365D", "FFFFFFFF"] };
const XL_STATUS = { "OK": ["FFC6EFCE", "FF006100"], "Vencendo": ["FFFFEB9C", "FF9C5700"], "Vencido": ["FFFFC7CE", "FF9C0006"], "Não expira": ["FFE7E9EE", "FF44546A"], "Arquivado": ["FFD9D9D9", "FF595959"] };
// Colunas da planilha "para importar": 1 coluna = 1 campo do card (ida e volta).
const PLAN_COLS = [
  ["ID", "id", 12], ["Título", "titulo", 30], ["Aplicação", "aplicacao", 24], ["Cliente / operação", "cliente", 24],
  ["Categoria", "categoria", 11], ["Visibilidade", "visibilidade", 12], ["URL", "url", 38], ["Usuário", "usuario", 20],
  ["Senha", "senha", 16], ["Ciclo (dias)", "ciclo", 11], ["Última troca", "ultima", 13], ["Horário", "horario", 18],
  ["Escalonamento (resumo)", "escalonamento", 40], ["Observação", "obs", 36], ["Arquivado em", "arquivado_em", 13]
];
const PLAN_ESC_COLS = [["ID do card", 12], ["Fornecedor / Título", 30], ["Nível", 8], ["Canal", 11], ["Valor", 36], ["Nome", 24], ["Horário", 16], ["Obs", 36]];
const ABAS_PLAN = [
  { nome: "Fornecedores externos", sempre: true, filtro: (it) => !it.arquivado_em && it.categoria === "Externo" },
  { nome: "Ferramentas internas", sempre: true, filtro: (it) => !it.arquivado_em && it.categoria !== "Externo" },
  { nome: "Fornecedores arquivados", filtro: (it) => !!it.arquivado_em && it.categoria === "Externo" },
  { nome: "Ferramentas arquivadas", filtro: (it) => !!it.arquivado_em && it.categoria !== "Externo" }
];
function ordenarCards(lista) {
  return lista.slice().sort((a, b) => String(a.aplicacao || a.titulo || "").localeCompare(String(b.aplicacao || b.titulo || "")) || String(a.cliente || "").localeCompare(String(b.cliente || "")) || String(a.titulo || "").localeCompare(String(b.titulo || "")));
}
function abasPlanilha() {
  return ABAS_PLAN.map((a) => ({ nome: a.nome, sempre: !!a.sempre, arquivo: /arquivad/.test(a.nome), lista: ordenarCards(itens.filter(a.filtro)) }))
    .filter((a) => a.sempre || a.lista.length);
}
function dataBR(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : (iso || "");
}
function statusPlan(it) {
  const st = statusDe(it);
  return st === "Ativo" ? "OK" : st === "Sem expiração" ? "Não expira" : st;
}
function valorPlan(it, k) {
  const c = semSegredoIndividual(it);
  if (k === "escalonamento") return c.escalonamento || resumoEscalonamentos(niveisDe(it));
  if (k === "ultima" || k === "arquivado_em") return dataBR(c[k] || "");
  if (k === "ciclo") return /^\d+$/.test(String(c.ciclo || "")) ? Number(c.ciclo) : (c.ciclo || "Nunca");
  if (k === "categoria") return c.categoria === "Externo" ? "Externo" : "Interno";
  if (k === "visibilidade") return c.visibilidade === "Individual" ? "Individual" : "Equipe";
  return c[k] == null ? "" : String(c[k]);
}
function xlBorda() { const s = { style: "thin", color: { argb: XL.borda } }; return { top: s, left: s, bottom: s, right: s }; }
function xlFill(cor) { return { type: "pattern", pattern: "solid", fgColor: { argb: cor } }; }
function xlCabecalho(row, n) {
  for (let i = 1; i <= n; i++) {
    const c = row.getCell(i);
    c.fill = xlFill(XL.navy);
    c.font = { bold: true, color: { argb: XL.branco } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = xlBorda();
  }
  row.height = 30;
}
function xlLinkInterno(aba, ref, texto) {
  const alvo = "#'" + aba.replace(/'/g, "''") + "'!" + ref;
  return { formula: 'HYPERLINK("' + alvo.replace(/"/g, '""') + '","' + String(texto).replace(/"/g, '""') + '")', result: texto };
}
function xlUrl(v) { return /^[a-z]+:\/\//i.test(v) ? v : "https://" + v; }
async function baixarWorkbook(wb, nome) {
  const buf = await wb.xlsx.writeBuffer();
  download(nome, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function montarPlanilhaImportar(ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Caderno de Acessos";
  wb.created = new Date();
  const abas = abasPlanilha();
  abas.forEach((a) => {
    const ws = wb.addWorksheet(a.nome, { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: a.arquivo ? "FF8C8C8C" : (/Fornecedores/.test(a.nome) ? XL.ext : XL.int) } } });
    ws.columns = PLAN_COLS.map(([h, k, w]) => ({ header: h, key: k, width: w }));
    xlCabecalho(ws.getRow(1), PLAN_COLS.length);
    a.lista.forEach((it, i) => {
      const vals = {};
      PLAN_COLS.forEach(([, k]) => { vals[k] = valorPlan(it, k); });
      const row = ws.addRow(vals);
      for (let j = 1; j <= PLAN_COLS.length; j++) {
        const c = row.getCell(j);
        c.border = xlBorda();
        c.alignment = { vertical: "top", wrapText: true };
        if (a.arquivo) { c.fill = xlFill(XL.cinza); c.font = { color: { argb: XL.cinzaTx } }; }
        else if (i % 2) c.fill = xlFill(XL.zebra);
      }
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: a.lista.length + 1, column: PLAN_COLS.length } };
  });
  const we = wb.addWorksheet("Escalonamento", { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: XL.navy } } });
  we.columns = PLAN_ESC_COLS.map(([h, w]) => ({ header: h, width: w }));
  xlCabecalho(we.getRow(1), PLAN_ESC_COLS.length);
  let n = 0;
  abas.forEach((a) => a.lista.forEach((it) => {
    niveisDe(it).forEach((nv) => {
      const row = we.addRow([it.id, it.titulo || it.aplicacao || "", nv.nivel, canalRotulo(nv.canal), nv.valor, nv.nome, nv.horario, nv.obs]);
      for (let j = 1; j <= PLAN_ESC_COLS.length; j++) {
        const c = row.getCell(j);
        c.border = xlBorda();
        c.alignment = { vertical: "top", wrapText: true };
        if (n % 2) c.fill = xlFill(XL.zebra);
      }
      n++;
    });
  }));
  we.autoFilter = { from: { row: 1, column: 1 }, to: { row: n + 1, column: PLAN_ESC_COLS.length } };
  return wb;
}

function montarPlanilhaConsulta(ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Caderno de Acessos";
  wb.created = new Date();
  const abas = abasPlanilha();
  const COLS = [["Título", 30], ["Aplicação", 22], ["Cliente / operação", 24], ["Visibilidade", 12], ["URL", 38], ["Usuário", 18], ["Senha", 14], ["Ciclo", 9], ["Última troca", 13], ["Status", 12], ["Horário", 18], ["Observação", 34]];
  const PRIMEIRA = 3; // linha 1 = barra, linha 2 = cabeçalho
  const ESC_ATIVOS = "Escalonamento", ESC_ARQ = "Escalonamento arquivados";
  const colLetra = (n) => { let t = ""; while (n > 0) { const m = (n - 1) % 26; t = String.fromCharCode(65 + m) + t; n = Math.floor((n - 1) / 26); } return t; };
  // Posições: card -> (aba, linha, nº de colunas) para o "◀ Voltar ao card" marcar a linha inteira
  const pos = {};
  abas.forEach((a) => {
    const ncols = COLS.length + (a.arquivo ? 1 : 0) + 1;
    a.lista.forEach((it, i) => { pos[it.id] = { aba: a.nome, linha: PRIMEIRA + i, ref: "A" + (PRIMEIRA + i) + ":" + colLetra(ncols) + (PRIMEIRA + i) }; });
  });
  // Escalonamento separado: ativos na aba "Escalonamento", arquivados (fornecedores e ferramentas) em "Escalonamento arquivados"
  const comEsc = [];
  abas.forEach((a) => a.lista.forEach((it) => { const nv = niveisDe(it); if (nv.length) comEsc.push({ it: it, aba: a.nome, arquivo: a.arquivo, niveis: nv }); }));
  const escAtivos = comEsc.filter((e) => !e.arquivo), escArq = comEsc.filter((e) => e.arquivo);
  const IDX = 4; // cabeçalho do índice
  const ESC_NCOLS = 6;
  const blocoDe = {};
  [[ESC_ATIVOS, escAtivos], [ESC_ARQ, escArq]].forEach(([nomeAba, grupo]) => {
    let r = IDX + 1 + grupo.length + 2;
    grupo.forEach((e) => {
      e.linha = r;
      e.abaEsc = nomeAba;
      e.ref = "A" + r + ":" + colLetra(ESC_NCOLS) + (r + 2 + e.niveis.length); // bloco inteiro (título até o último nível)
      blocoDe[e.it.id] = { aba: nomeAba, ref: e.ref };
      r += 3 + e.niveis.length + 1;
    });
  });

  function topo(ws, titulo, ncols) {
    const c = ws.getCell("A1");
    c.value = xlLinkInterno("Leia-me", "A1", "◀ Voltar ao Leia-me");
    c.font = { bold: true, color: { argb: XL.branco } };
    c.fill = xlFill(XL.ext);
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = xlBorda();
    const t = ws.getCell(1, 2);
    t.value = titulo;
    t.font = { bold: true, size: 14, color: { argb: XL.navy } };
    t.alignment = { vertical: "middle" };
    ws.getRow(1).height = 28;
  }

  // Leia-me
  const lm = wb.addWorksheet("Leia-me", { properties: { tabColor: { argb: XL.navy } } });
  lm.getColumn(1).width = 30;
  lm.getColumn(2).width = 92;
  lm.getCell("A1").value = "Caderno de Acessos — Planilha para consulta";
  lm.getCell("A1").font = { bold: true, size: 18, color: { argb: XL.navy } };
  lm.getCell("A2").value = "Gerada em " + dataBR(hoje()) + " · somente leitura (para importar no app, use “Excel para importar”).";
  lm.getCell("A2").font = { italic: true, color: { argb: XL.cinzaTx } };
  let lr = 4;
  const secao = (t) => { const c = lm.getCell(lr, 1); c.value = t; c.font = { bold: true, size: 13, color: { argb: XL.navy } }; lr++; };
  const linha = (a, b, fundo, cor) => {
    const c1 = lm.getCell(lr, 1), c2 = lm.getCell(lr, 2);
    c1.value = a; c2.value = b;
    c1.border = c2.border = xlBorda();
    c1.alignment = { vertical: "top", wrapText: true };
    c2.alignment = { vertical: "top", wrapText: true };
    if (fundo) { c1.fill = xlFill(fundo); c1.font = { bold: true, color: { argb: cor || XL.branco } }; }
    else c1.font = { bold: true, color: { argb: XL.navy } };
    lr++;
    return c1;
  };
  secao("Navegação (clique no botão para abrir a aba)");
  const descAba = {
    "Fornecedores externos": "Fornecedores externos ativos (portais, brokers, telecom, CRM).",
    "Ferramentas internas": "Ferramentas e páginas internas ativas (a mesma ferramenta pode ter uma URL por operação).",
    "Fornecedores arquivados": "Fornecedores inativos, em cinza. O escalonamento continua guardado.",
    "Ferramentas arquivadas": "Ferramentas internas inativas, em cinza."
  };
  const navs = abas.map((a) => [a.nome, descAba[a.nome] + " (" + a.lista.length + " card" + (a.lista.length === 1 ? "" : "s") + ")"]);
  navs.splice(2, 0, [ESC_ATIVOS, "Contatos dos fornecedores e ferramentas ATIVOS, em blocos: nível, canal, nome, contato e horário, com índice no topo e “◀ Voltar ao card”."]);
  if (escArq.length) navs.splice(3, 0, [ESC_ARQ, "Contatos dos fornecedores e ferramentas ARQUIVADOS (em cinza), separados dos ativos, com índice próprio no topo."]);
  navs.forEach(([nome, desc]) => {
    const c = linha("", desc, XL.navy);
    c.value = xlLinkInterno(nome, "A1", "▶  " + nome);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    lm.getRow(lr - 1).height = 30;
  });
  lr++;
  secao("Como navegar");
  linha("◀ Voltar ao Leia-me", "Em todas as abas, a célula azul no canto superior esquerdo volta para esta página.");
  linha("Ver escalonamento ▶", "Na última coluna dos cards, leva direto ao bloco do fornecedor e já deixa a área inteira selecionada. Cards ativos vão para a aba Escalonamento; cards arquivados vão para “Escalonamento arquivados”" + (escArq.length ? "" : " (nesta exportação nenhum arquivado tem escalonamento, então essa aba não foi gerada)") + ". “sem escalonamento” = nada cadastrado.");
  linha("Índice", "Cada aba de escalonamento começa com um índice clicável dos fornecedores dela.");
  linha("◀ Voltar ao card", "No título de cada bloco de escalonamento, volta para a linha do card (na aba de origem) e marca a linha.");
  linha("E-mail / Telefone / Portal", "E-mails abrem o programa de e-mail; telefones usam tel: (discador/Teams, se configurado); portais abrem no navegador.");
  lr++;
  secao("Legenda de cores");
  linha("Individual", "Acesso pessoal do analista: usuário e senha saem em branco.", XL.ind, XL.navy);
  Object.keys(XL_STATUS).forEach((k) => linha(k, { "OK": "Senha dentro do ciclo de troca.", "Vencendo": "Faltam 7 dias ou menos para trocar.", "Vencido": "Ciclo de troca ultrapassado.", "Não expira": "Ciclo “Nunca”.", "Arquivado": "Card inativo (abas de arquivados)." }[k], XL_STATUS[k][0], XL_STATUS[k][1]));
  [1, 2, 3, 4, 5].forEach((n) => linha("Nível " + n, n === 1 ? "Primeiro contato (ex.: portal ou service desk)." : n === 5 ? "Último nível (ex.: gerência)." : "Nível " + n + " de escalonamento.", XL_NIVEL[n][0], XL_NIVEL[n][1]));
  lr++;
  secao("Regras");
  linha("Senhas", "Senhas individuais saem em branco. Só acessos da equipe levam usuário e senha.");
  linha("Somente leitura", "Esta planilha é para consultar e imprimir. Para levar cards para outro aparelho, use “Excel para importar” ou o JSON.");

  // Abas de cards
  function abaCards(a) {
    const ws = wb.addWorksheet(a.nome, { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }], properties: { tabColor: { argb: a.arquivo ? "FF8C8C8C" : (/Fornecedores/.test(a.nome) ? XL.ext : XL.int) } } });
    const cols = COLS.concat(a.arquivo ? [["Arquivado em", 13]] : []).concat([["Ver escalonamento", 20]]);
    cols.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
    topo(ws, a.nome + (a.arquivo ? " (inativos)" : ""), cols.length);
    const hr = ws.getRow(2);
    cols.forEach(([h], i) => { hr.getCell(i + 1).value = h; });
    xlCabecalho(hr, cols.length);
    a.lista.forEach((it, i) => {
      const ind = it.visibilidade === "Individual";
      const st = statusPlan(it);
      const vals = [it.titulo || it.aplicacao || "", it.aplicacao || "", it.cliente || "", ind ? "Individual" : "Equipe", it.url || "",
        ind ? "" : (it.usuario || ""), ind ? "" : (it.senha || ""), valorPlan(it, "ciclo"), dataBR(it.ultima || ""), st, it.horario || "", it.obs || ""];
      if (a.arquivo) vals.push(dataBR(it.arquivado_em || ""));
      const row = ws.getRow(PRIMEIRA + i);
      vals.forEach((v, j) => { row.getCell(j + 1).value = v; });
      for (let j = 1; j <= cols.length; j++) {
        const c = row.getCell(j);
        c.border = xlBorda();
        c.alignment = { vertical: "top", wrapText: true };
        if (a.arquivo) { c.fill = xlFill(XL.cinza); c.font = { color: { argb: XL.cinzaTx } }; }
        else if (i % 2) c.fill = xlFill(XL.zebra);
      }
      const cv = row.getCell(4);
      cv.alignment = { horizontal: "center", vertical: "top" };
      if (ind) { cv.fill = xlFill(XL.ind); cv.font = { bold: true, color: { argb: XL.navy } }; }
      if (ind) { [6, 7].forEach((j) => { row.getCell(j).value = "(individual)"; row.getCell(j).font = { italic: true, color: { argb: "FF808080" } }; }); }
      const cs = row.getCell(10);
      const cor = XL_STATUS[st] || XL_STATUS["OK"];
      cs.fill = xlFill(cor[0]); cs.font = { bold: true, color: { argb: cor[1] } }; cs.alignment = { horizontal: "center", vertical: "top" };
      [8, 9].forEach((j) => { row.getCell(j).alignment = { horizontal: "center", vertical: "top" }; });
      if (it.url) {
        const cu = row.getCell(5);
        cu.value = { text: it.url, hyperlink: xlUrl(it.url) };
        cu.font = { color: { argb: XL.link }, underline: true };
      }
      const ce = row.getCell(cols.length);
      ce.alignment = { horizontal: "center", vertical: "top" };
      if (blocoDe[it.id]) {
        ce.value = xlLinkInterno(blocoDe[it.id].aba, blocoDe[it.id].ref, "Ver escalonamento ▶");
        ce.font = { bold: true, color: { argb: XL.link }, underline: true };
      } else {
        ce.value = "sem escalonamento";
        ce.font = { italic: true, color: { argb: "FF808080" } };
      }
    });
    if (a.lista.length) ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: a.lista.length + 2, column: cols.length } };
    else { ws.getCell("A3").value = "Nenhum card nesta aba."; ws.getCell("A3").font = { italic: true, color: { argb: "FF808080" } }; }
  }
  abas.filter((a) => !a.arquivo).forEach(abaCards);

  // Escalonamento em blocos (uma aba para ativos, outra para arquivados)
  function abaEscalonamento(nomeAba, comEsc, arquivada) {
  const we = wb.addWorksheet(nomeAba, { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: arquivada ? "FF8C8C8C" : XL.navy } } });
  [10, 12, 26, 38, 18, 36].forEach((w, i) => { we.getColumn(i + 1).width = w; });
  topo(we, arquivada ? "Escalonamento dos arquivados (fornecedores e ferramentas inativos)" : "Escalonamento por fornecedor (ativos)", 6);
  we.getCell(IDX - 1, 1).value = comEsc.length ? "Índice (clique para ir ao bloco)" : "Nenhum card ativo com escalonamento cadastrado.";
  we.getCell(IDX - 1, 1).font = { bold: true, color: { argb: XL.navy } };
  if (comEsc.length) {
    const hi = we.getRow(IDX);
    ["Níveis", "Aba", "Fornecedor / Título", "Aplicação · Cliente"].forEach((h, i) => { hi.getCell(i + 1).value = h; });
    xlCabecalho(hi, 4);
    hi.height = 22;
  }
  comEsc.forEach((e, i) => {
    const row = we.getRow(IDX + 1 + i);
    row.getCell(1).value = e.niveis.length;
    row.getCell(2).value = e.aba;
    row.getCell(3).value = xlLinkInterno(nomeAba, e.ref, (e.it.titulo || e.it.aplicacao || "") + " ▶");
    row.getCell(4).value = [e.it.aplicacao, e.it.cliente].filter(Boolean).join(" · ");
    for (let j = 1; j <= 4; j++) { const c = row.getCell(j); c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true }; if (arquivada) c.fill = xlFill(XL.cinza); else if (i % 2) c.fill = xlFill(XL.zebra); }
    row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
    row.getCell(3).font = { bold: true, color: { argb: XL.link }, underline: true };
  });
  const SUBH = ["Nível", "Canal", "Nome", "Contato", "Horário", "Observação"];
  comEsc.forEach((e) => {
    const r0 = e.linha, it = e.it;
    we.mergeCells(r0, 1, r0, 4);
    const t = we.getCell(r0, 1);
    t.value = [it.titulo || it.aplicacao, it.cliente].filter(Boolean).join("  ·  ") + (e.arquivo ? "  ·  ARQUIVADO" : "");
    for (let k = 1; k <= 6; k++) { const c = we.getCell(r0, k); c.fill = xlFill(e.arquivo ? "FF595959" : XL.navy); c.border = xlBorda(); }
    t.font = { bold: true, size: 12, color: { argb: XL.branco } };
    t.alignment = { vertical: "middle" };
    we.mergeCells(r0, 5, r0, 6);
    const p = pos[it.id];
    const b = we.getCell(r0, 5);
    b.value = xlLinkInterno(p.aba, p.ref, "◀ Voltar ao card");
    b.font = { bold: true, color: { argb: XL.branco }, underline: true };
    b.alignment = { horizontal: "center", vertical: "middle" };
    we.getRow(r0).height = 26;
    we.mergeCells(r0 + 1, 1, r0 + 1, 6);
    const info = we.getCell(r0 + 1, 1);
    info.value = "Aba: " + p.aba + "   |   Horário de atendimento: " + (it.horario || "—") + "   |   URL: " + (it.url || "—");
    info.font = { italic: true, color: { argb: XL.navy } };
    info.fill = xlFill(e.arquivo ? "FFEDEDED" : XL.info);
    info.alignment = { vertical: "top", wrapText: true };
    const sh = we.getRow(r0 + 2);
    SUBH.forEach((h, k) => {
      const c = sh.getCell(k + 1);
      c.value = h; c.fill = xlFill(XL.sub); c.font = { bold: true, color: { argb: XL.navy } }; c.border = xlBorda(); c.alignment = { horizontal: "center", vertical: "middle" };
    });
    e.niveis.forEach((nv, i) => {
      const row = we.getRow(r0 + 3 + i);
      [nv.nivel, canalRotulo(nv.canal), nv.nome || "", nv.valor || "", nv.horario || "", nv.obs || ""].forEach((v, k) => {
        const c = row.getCell(k + 1);
        c.value = v; c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true };
        if (e.arquivo) c.fill = xlFill(XL.cinza);
        else if (i % 2) c.fill = xlFill(XL.zebra);
      });
      const cn = row.getCell(1), cor = XL_NIVEL[Math.min(5, Math.max(1, nv.nivel))];
      cn.fill = xlFill(cor[0]); cn.font = { bold: true, color: { argb: cor[1] } }; cn.alignment = { horizontal: "center", vertical: "top" };
      row.getCell(2).alignment = { horizontal: "center", vertical: "top" };
      const href = hrefEsc(nv);
      if (href && nv.valor) {
        const cc = row.getCell(4);
        cc.value = { text: nv.valor, hyperlink: href };
        cc.font = { color: { argb: XL.link }, underline: true };
      }
    });
  });
  }
  abaEscalonamento(ESC_ATIVOS, escAtivos, false);
  if (escArq.length) abaEscalonamento(ESC_ARQ, escArq, true);
  // Ordem das abas: Leia-me, ativos, Escalonamento, arquivados
  abas.filter((a) => a.arquivo).forEach(abaCards);
  // Impressão: paisagem, cabe na largura da página
  wb.worksheets.forEach((ws) => { ws.pageSetup = { orientation: ws.name === "Leia-me" ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }; });
  return wb;
}

async function exportarExcelImportar() {
  try {
    const ExcelJS = await carregarExcelJS();
    await baixarWorkbook(montarPlanilhaImportar(ExcelJS), "caderno-acessos-importar-" + hoje() + ".xlsx");
    toast("Excel para importar exportado (sem senhas individuais)");
  } catch (e) {
    aviso("Falha ao exportar", "Não foi possível gerar a planilha. Recarregue a página e tente de novo.");
  }
}
async function exportarExcelConsulta() {
  try {
    const ExcelJS = await carregarExcelJS();
    await baixarWorkbook(montarPlanilhaConsulta(ExcelJS), "caderno-acessos-consulta-" + hoje() + ".xlsx");
    toast("Excel para consulta exportado (sem senhas individuais)");
  } catch (e) {
    aviso("Falha ao exportar", "Não foi possível gerar a planilha. Recarregue a página e tente de novo.");
  }
}

/* ---------- Importar o formato do próprio Caderno (v1.5 "para importar" e Excel antigo do app) ---------- */
const PLAN_MAPA = {
  "id": "id", "titulo": "titulo", "aplicacao": "aplicacao", "cliente operacao": "cliente", "cliente": "cliente",
  "categoria": "categoria", "visibilidade": "visibilidade", "url": "url", "usuario": "usuario", "senha": "senha",
  "ciclo dias": "ciclo", "ciclo": "ciclo", "ultima troca": "ultima", "ultimatroca": "ultima", "horario": "horario",
  "escalonamento resumo": "escalonamento", "escalonamento": "escalonamento", "observacao": "obs", "obs": "obs",
  "arquivado em": "arquivado_em", "arquivado": "arquivado_em"
};
const PLAN_ESC_MAPA = { "id do card": "id", "nivel": "nivel", "canal": "canal", "valor": "valor", "contato": "valor", "nome": "nome", "horario": "horario", "obs": "obs", "observacao": "obs" };
function mapaCabecalho(row, mapa) {
  const col = {};
  (row || []).forEach((h, i) => { const k = mapa[normHeader(h)]; if (k && col[k] == null) col[k] = i; });
  return col;
}
function ehCabecalhoCards(col) { return col.titulo != null && (col.aplicacao != null || col.id != null); }
function ehCabecalhoEsc(col) { return col.id != null && col.nivel != null; }
function pad2(n) { return String(n).padStart(2, "0"); }
function dataIso(v, XLSX) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && XLSX && XLSX.SSF) {
    const p = XLSX.SSF.parse_date_code(v);
    if (p && p.y) return p.y + "-" + pad2(p.m) + "-" + pad2(p.d);
  }
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + "-" + pad2(m[2]) + "-" + pad2(m[1]);
  return s;
}
function canalDeTexto(t) {
  const n = normHeader(t);
  if (/mail/.test(n)) return "email";
  if (/tel|fone|phone|celular|whats/.test(n)) return "telefone";
  if (/portal|ticket|chamado|site|url/.test(n)) return "portal";
  return ["portal", "email", "telefone", "outro"].includes(String(t || "").trim()) ? String(t).trim() : "outro";
}
function cardsFormatoCaderno(workbook, XLSX) {
  const usadas = new Set();
  const cards = [];
  const escPorId = {};
  workbook.SheetNames.forEach((nomeAba) => {
    const ws = workbook.Sheets[nomeAba];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    const txt = (row, i) => (i == null || !row || row[i] == null) ? "" : (row[i] instanceof Date ? dataIso(row[i]) : String(row[i]).trim());
    let col = null, modo = null;
    rows.forEach((row) => {
      if (linhaVazia(row)) return;
      const cc = mapaCabecalho(row, PLAN_MAPA);
      if (ehCabecalhoCards(cc)) { col = cc; modo = "cards"; usadas.add(nomeAba); return; }
      const ce = mapaCabecalho(row, PLAN_ESC_MAPA);
      if (ehCabecalhoEsc(ce)) { col = ce; modo = "esc"; usadas.add(nomeAba); return; }
      if (!col) return;
      const preenchidas = row.filter((c) => c != null && String(c).trim() !== "").length;
      if (modo === "esc") {
        const id = txt(row, col.id);
        if (!id) return;
        const nv = limparNivelEsc({ nivel: txt(row, col.nivel), canal: canalDeTexto(txt(row, col.canal)), valor: txt(row, col.valor), nome: txt(row, col.nome), horario: txt(row, col.horario), obs: txt(row, col.obs) });
        if (nv && (nv.valor || nv.nome || nv.obs)) (escPorId[id] = escPorId[id] || []).push(nv);
        return;
      }
      if (preenchidas <= 1) return; // título de seção (ex.: Excel antigo do app)
      const o = {};
      Object.keys(col).forEach((k) => { o[k] = k === "ultima" || k === "arquivado_em" ? dataIso(row[col[k]], XLSX) : txt(row, col[k]); });
      if (!o.titulo && !o.aplicacao) return;
      ["usuario", "senha"].forEach((k) => { if (/^\(individual\)$/i.test(o[k] || "")) o[k] = ""; });
      const nAba = normHeader(nomeAba);
      const cat = normHeader(o.categoria);
      const categoria = /extern/.test(cat) ? "Externo" : /intern/.test(cat) ? "Interno" : (/fornecedor|extern/.test(nAba) ? "Externo" : "Interno");
      let ciclo = String(o.ciclo || "").trim();
      if (!ciclo || /nunca|nao expira/.test(normHeader(ciclo))) ciclo = "Nunca";
      else if (/^\d+(\.0+)?$/.test(ciclo)) ciclo = String(parseInt(ciclo, 10));
      const arq = o.arquivado_em || (/arquiv|antig/.test(nAba) ? hoje() : "");
      const card = {
        id: o.id || idEstavel([o.titulo, o.aplicacao, o.cliente, "planilha"]),
        titulo: o.titulo || o.aplicacao,
        aplicacao: o.aplicacao || o.titulo,
        cliente: o.cliente || "",
        categoria: categoria,
        visibilidade: /individual/i.test(o.visibilidade || "") ? "Individual" : "Equipe",
        url: o.url || "",
        usuario: o.usuario || "",
        senha: o.senha || "",
        ciclo: ciclo,
        ultima: o.ultima || "",
        horario: o.horario || "",
        escalonamento: o.escalonamento || "",
        escalonamentos: [],
        obs: o.obs || "",
        arquivado_em: arq || null
      };
      cards.push(card);
    });
  });
  cards.forEach((c) => {
    const nv = escPorId[c.id];
    if (nv && nv.length) {
      c.escalonamentos = nv.sort((a, b) => a.nivel - b.nivel);
      if (!c.escalonamento) c.escalonamento = resumoEscalonamentos(c.escalonamentos);
    } else if (c.escalonamento) {
      c.escalonamentos = parseEscalonamentoTexto(c.escalonamento);
    }
  });
  return { cards: cards, abasUsadas: usadas };
}

/* ---------- Importar planilha de suporte/brokers (formato v1.4) ---------- */
function normHeader(h) {
  return String(h || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function mapearColunas(headers) {
  const idx = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    if (!n) return;
    if (/tipo de servico|tipo servico/.test(n)) idx.tipo = i;
    else if (/^fornecedor$/.test(n)) idx.fornecedor = i;
    else if (/^aplicacao$|^aplicacao /.test(n) || n === "aplicacao") idx.aplicacao = i;
    else if (/sites? ?\/? ?operacoes|sites operacoes|cliente/.test(n)) idx.sites = i;
    else if (/service desk|servicedesk/.test(n)) idx.sd = i;
    else if (/^acesso$/.test(n)) idx.acesso = i;
    else if (/^contato$/.test(n)) idx.contato = i;
    else if (/escalation|escalonamento/.test(n)) idx.escalation = i;
    else if (/observacoes|^obs$/.test(n)) idx.obs = i;
    else if (/site validado/.test(n)) idx.siteValidado = i;
  });
  return idx;
}
function classificarAba(nome) {
  const n = normHeader(nome);
  if (/antig/.test(n)) return "antigos";
  if (/broker|whatsapp|sms/.test(n)) return "brokers";
  if (/suporte|tecnico/.test(n)) return "suporte";
  return "outro";
}
function celula(row, i) {
  if (i == null || i < 0 || !row) return "";
  const v = row[i];
  return v == null ? "" : String(v);
}
function detectarVisibilidade(acesso) {
  const a = String(acesso || "").toLowerCase();
  if (/individual/.test(a)) return "Individual";
  if (/compartilhad/.test(a)) return "Equipe";
  return "Equipe";
}
function extrairCredenciais(acesso) {
  // Só preenche se a própria coluna trouxer usuário/senha. Não inventa.
  const s = String(acesso || "");
  const out = { usuario: "", senha: "" };
  const um = s.match(/(?:user|usu[aá]rio)\s*[:：]\s*(\S+)/i);
  const sm = s.match(/(?:senha|password|pwd)\s*[:：]\s*(\S+)/i);
  if (um) out.usuario = um[1].trim();
  if (sm) out.senha = sm[1].trim();
  return out;
}
function extrairUrl(sd, contato) {
  const blob = [sd, contato].filter(Boolean).join("\n");
  const m = blob.match(/https?:\/\/[^\s)\]>]+/i);
  if (m) return m[0].replace(/[.,;]+$/, "");
  // e-mail puro no service desk → não é URL de portal
  return "";
}
function idEstavel(partes) {
  const s = partes.join("|").toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "xl-" + (h >>> 0).toString(16);
}
function linhaVazia(row) {
  return !row || !row.some((c) => c != null && String(c).trim() !== "");
}
function sheetTemVermelho(sheet, XLSX) {
  // SheetJS community build may not keep fonts; we rely on sheet name "Antigos" + optional !rows styles if present.
  return false;
}
function cardsDePlanilha(workbook, XLSX, pular) {
  const gerados = [];
  const vistos = new Set();
  const ordem = workbook.SheetNames.filter((n) => !(pular && pular.has(n))).sort((a, b) => {
    const rank = (n) => ({ brokers: 0, suporte: 1, antigos: 2, outro: 3 })[classificarAba(n)] ?? 3;
    return rank(a) - rank(b);
  });
  ordem.forEach((sheetName) => {
    const tipoAba = classificarAba(sheetName);
    const ws = workbook.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    if (!rows.length) return;
    const headers = rows[0].map((h) => String(h || ""));
    const col = mapearColunas(headers);
    if (col.fornecedor == null && col.aplicacao == null) return;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (linhaVazia(row)) continue;
      const fornecedor = celula(row, col.fornecedor).trim();
      const aplicacao = celula(row, col.aplicacao).trim() || fornecedor;
      if (!fornecedor && !aplicacao) continue;
      const sites = celula(row, col.sites).trim();
      const sd = celula(row, col.sd).trim();
      const acesso = celula(row, col.acesso).trim();
      const contato = celula(row, col.contato).trim();
      const escValid = celula(row, col.escalation).trim();
      const obs = celula(row, col.obs).trim();
      const tipoServ = celula(row, col.tipo).trim();
      const chave = (fornecedor + "|" + aplicacao).toLowerCase().replace(/\s+/g, " ").trim();
      if (vistos.has(chave)) continue; // dedupe Brokers > Suporte > Antigos
      vistos.add(chave);
      const niveis = parseEscalonamentoTexto([contato, escValid].filter(Boolean).join("\n"));
      const vis = detectarVisibilidade(acesso);
      const cred = extrairCredenciais(acesso);
      const url = extrairUrl(sd, contato);
      const blobInativo = (fornecedor + "\n" + aplicacao + "\n" + obs).toLowerCase();
      const arquivar = tipoAba === "antigos" || /\b(inativo|encerrado|desativad|contrato encerrado|legado|legacy)\b/.test(blobInativo);
      const titulo = (aplicacao || fornecedor) + (sites ? " · " + sites.split(/\n/)[0].slice(0, 40) : "");
      const obsParts = [];
      if (tipoServ) obsParts.push(tipoServ);
      if (obs) obsParts.push(obs);
      if (acesso && !cred.usuario && !/^(individual|compartilhad|-)$/i.test(acesso.split("\n")[0].trim())) {
        // guarda dica de canal de abertura sem senha
        const dica = acesso.split("\n")[0].trim();
        if (dica && dica.length < 120) obsParts.push("Acesso: " + dica);
      }
      const card = {
        id: idEstavel([fornecedor, aplicacao, "planilha"]),
        titulo: titulo.slice(0, 120),
        aplicacao: aplicacao || fornecedor,
        cliente: sites ? sites.replace(/\s+/g, " ").trim().slice(0, 160) : (fornecedor || ""),
        categoria: "Externo",
        visibilidade: vis,
        url: url,
        usuario: cred.usuario || "",
        senha: cred.senha || "",
        ciclo: "Nunca",
        ultima: hoje(),
        horario: "",
        escalonamento: resumoEscalonamentos(niveis) || contato.slice(0, 240),
        escalonamentos: niveis,
        obs: obsParts.join("\n\n").slice(0, 2000),
        arquivado_em: arquivar ? hoje() : null,
        origem_import: "planilha"
      };
      gerados.push(card);
    }
  });
  return gerados;
}
// Formato do Caderno (abas de cards + Escalonamento por ID) e, nas demais abas, o formato de suporte/brokers.
function cardsDeWorkbook(wb, XLSX) {
  const proprio = cardsFormatoCaderno(wb, XLSX);
  return proprio.cards.concat(cardsDePlanilha(wb, XLSX, proprio.abasUsadas));
}
async function importarPlanilha(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  if (f.size > IMPORT_MAX_BYTES) { aviso("Arquivo grande demais", "O limite é 5 MB por importação. Nada foi importado."); ev.target.value = ""; return; }
  try {
    toast("Lendo planilha…");
    const XLSX = await carregarXlsxLib();
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellStyles: true });
    const lista = cardsDeWorkbook(wb, XLSX);
    if (!lista.length) {
      aviso("Nada importado", "Não encontrei abas/colunas reconhecíveis (ID, Título, Aplicação… ou Fornecedor, Contato…).");
      return;
    }
    await importarComPrevia(lista, "Importar planilha?");
  } catch (e) {
    aviso("Falha na importação", "Não foi possível ler a planilha. Verifique se o arquivo é .xlsx ou .xls.");
  } finally {
    ev.target.value = "";
  }
}
function escolherPlanilha() { $("impXls").click(); }

/* ---------- Editor de escalonamento (formulário) ---------- */
let escDraft = [];
function renderEscEditor() {
  const box = $("escLista");
  if (!box) return;
  box.innerHTML = "";
  if (!escDraft.length) {
    box.appendChild(el("p", "esc-vazio", "Nenhum nível ainda. Toque em + Nível."));
    return;
  }
  escDraft.forEach((nv, idx) => {
    const row = el("div", "esc-row");
    row.dataset.idx = String(idx);

    const labN = el("span", "esc-lab", "Nível");
    const inpN = document.createElement("input");
    inpN.type = "number"; inpN.min = "1"; inpN.value = String(nv.nivel || idx + 1);
    inpN.addEventListener("input", () => { escDraft[idx].nivel = Number(inpN.value) || (idx + 1); });

    const labC = el("span", "esc-lab", "Canal");
    const selC = document.createElement("select");
    CANAIS_ESC.forEach((c) => { const o = el("option", "", c.rotulo); o.value = c.id; selC.appendChild(o); });
    selC.value = nv.canal || "email";
    selC.addEventListener("change", () => { escDraft[idx].canal = selC.value; });

    const labV = el("span", "esc-lab", "Valor");
    const inpV = document.createElement("input");
    inpV.type = "text"; inpV.placeholder = "URL, e-mail ou telefone";
    inpV.value = nv.valor || "";
    inpV.addEventListener("input", () => { escDraft[idx].valor = inpV.value; });

    const labNome = el("span", "esc-lab", "Nome");
    const inpNome = document.createElement("input");
    inpNome.type = "text"; inpNome.placeholder = "Contato / área";
    inpNome.value = nv.nome || "";
    inpNome.addEventListener("input", () => { escDraft[idx].nome = inpNome.value; });

    const labH = el("span", "esc-lab", "Horário");
    const inpH = document.createElement("input");
    inpH.type = "text"; inpH.placeholder = "Ex.: 24x7";
    inpH.value = nv.horario || "";
    inpH.addEventListener("input", () => { escDraft[idx].horario = inpH.value; });

    const labO = el("span", "esc-lab", "Obs.");
    const inpO = document.createElement("textarea");
    inpO.rows = 2; inpO.placeholder = "Observação do nível";
    inpO.value = nv.obs || "";
    inpO.addEventListener("input", () => { escDraft[idx].obs = inpO.value; });

    const acoes = el("div", "esc-row-acoes");
    acoes.appendChild(btn("btn pequeno", "trash", "Excluir", () => {
      escDraft.splice(idx, 1);
      escDraft.forEach((x, i) => { if (!x.nivel) x.nivel = i + 1; });
      renderEscEditor();
    }, null, "Excluir este nível de escalonamento"));

    // Cada par rótulo+campo fica num .esc-campo: no celular vira "display:contents" (layout de 2 colunas como antes);
    // em telas largas forma uma grade 2 por linha (Nível+Canal, Valor inteiro, Nome+Horário, Obs inteiro).
    const campo = (lab, inp, cls) => { const d = el("div", "esc-campo" + (cls ? " " + cls : "")); d.appendChild(lab); d.appendChild(inp); return d; };
    const uid = "esc" + idx + "-";
    [[labN, inpN, "n"], [labC, selC, "c"], [labV, inpV, "v"], [labNome, inpNome, "nome"], [labH, inpH, "h"], [labO, inpO, "o"]].forEach(([l, i, k]) => { i.id = uid + k; l.setAttribute("id", uid + k + "-lab"); i.setAttribute("aria-labelledby", uid + k + "-lab"); });
    row.appendChild(campo(labN, inpN, "esc-nivel-campo"));
    row.appendChild(campo(labC, selC));
    row.appendChild(campo(labV, inpV, "cheio"));
    row.appendChild(campo(labNome, inpNome));
    row.appendChild(campo(labH, inpH));
    row.appendChild(campo(labO, inpO, "cheio"));
    row.appendChild(acoes);
    box.appendChild(row);
  });
}
function lerEscDraft() {
  return escDraft.map((n, i) => limparNivelEsc(Object.assign({}, n, { nivel: n.nivel || i + 1 }))).filter((n) => n && (n.valor || n.nome || n.obs));
}

/* ---------- Formulário Novo / Editar ---------- */
const NOVO = "__novo__";
function preencherSelect(sel, valores, atual, rotuloNovo) {
  sel.innerHTML = "";
  const vazio = el("option", "", "Selecione...");
  vazio.value = "";
  sel.appendChild(vazio);
  valores.forEach((v) => { const o = el("option", "", v); o.value = v; sel.appendChild(o); });
  const n = el("option", "", rotuloNovo);
  n.value = NOVO;
  sel.appendChild(n);
  sel.value = atual && valores.includes(atual) ? atual : "";
}
function unicos(campo) {
  return Array.from(new Set(itens.map((it) => String(it[campo] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
function ligarNovo(sel, input) {
  const upd = () => { input.hidden = sel.value !== NOVO; if (!input.hidden) input.focus(); };
  sel.onchange = upd;
  input.hidden = true;
}
const $ = (id) => document.getElementById(id);
function abrirFicha(it) {
  fecharMenus();
  edit = it ? Object.assign({}, it) : { id: Math.random().toString(16).slice(2, 10), visibilidade: aba === "meu" ? "Individual" : "Equipe", categoria: "Interno", ciclo: "90", ultima: hoje() };
  $("fichaTitulo").textContent = it ? "Editar acesso" : "Novo acesso";
  $("fTitulo").value = edit.titulo || "";
  preencherSelect($("fAplicacao"), unicos("aplicacao"), edit.aplicacao, "+ Nova aplicação...");
  preencherSelect($("fCliente"), unicos("cliente"), edit.cliente, "+ Novo cliente / operação...");
  ligarNovo($("fAplicacao"), $("fAplicacaoNova"));
  ligarNovo($("fCliente"), $("fClienteNovo"));
  $("fAplicacaoNova").value = ""; $("fClienteNovo").value = "";
  $("fCategoria").value = edit.categoria === "Externo" ? "Externo" : "Interno";
  $("fVisibilidade").value = edit.visibilidade === "Individual" ? "Individual" : "Equipe";
  $("fUrl").value = edit.url || "";
  $("fUsuario").value = edit.usuario || "";
  $("fSenha").value = edit.senha || "";
  $("fSenha").type = "password";
  setOlho($("fOlho"), false);
  $("fCiclo").value = ["30", "60", "90", "Nunca"].includes(String(edit.ciclo)) ? String(edit.ciclo) : "90";
  $("fUltima").value = edit.ultima || "";
  $("fHorario").value = edit.horario || "";
  escDraft = niveisDe(edit).map((n) => Object.assign({}, n));
  if (!escDraft.length && edit.escalonamento) escDraft = parseEscalonamentoTexto(edit.escalonamento);
  renderEscEditor();
  $("fEscalonamento").value = edit.escalonamento || "";
  $("fObs").value = edit.obs || "";
  $("erroForm").textContent = "";
  $("avisoInd").hidden = $("fVisibilidade").value !== "Individual";
  abrirSheet("sheet");
  fichaFoto = fotoFicha();
  setTimeout(() => $("fTitulo").focus(), 50);
}
/* v1.9.7: a ficha não fecha sozinha. Foto do formulário ao abrir; fechar com alterações pergunta antes. */
let fichaFoto = null, perguntandoDescarte = false;
function fotoFicha() { return JSON.stringify([...$("ficha").querySelectorAll("input, select, textarea")].map((x) => x.type === "checkbox" ? x.checked : x.value).concat([JSON.stringify(escDraft)])); }
function fichaSuja() { return $("sheet").classList.contains("on") && fichaFoto != null && fotoFicha() !== fichaFoto; }
async function pedirFecharFicha() {
  if (perguntandoDescarte) return false;
  if (!fichaSuja()) { fichaFoto = null; fecharSheet("sheet"); return true; }
  perguntandoDescarte = true;
  try {
    const sim = await dialogo({ titulo: "Descartar alterações?", texto: "Você tem alterações não salvas neste card.", ok: "Descartar", cancelar: "Continuar editando", perigo: true });
    if (sim) { fichaFoto = null; fecharSheet("sheet"); return true; }
    return false;
  } finally { perguntandoDescarte = false; }
}
window.addEventListener("beforeunload", (ev) => { if (fichaSuja()) { ev.preventDefault(); ev.returnValue = ""; } });
$("fVisibilidade").addEventListener("change", () => { $("avisoInd").hidden = $("fVisibilidade").value !== "Individual"; });
$("fOlho").dataset.alvo = "fSenha";
ligarOlho($("fOlho"));
const escAddBtn = $("escAdd");
if (escAddBtn) escAddBtn.addEventListener("click", () => {
  escDraft.push(nivelEscVazio(escDraft.length + 1));
  renderEscEditor();
});
function lerFicha() {
  const valSel = (sel, nova) => sel.value === NOVO ? nova.value.trim() : sel.value;
  const o = Object.assign({}, edit, {
    titulo: $("fTitulo").value.trim(),
    aplicacao: valSel($("fAplicacao"), $("fAplicacaoNova")),
    cliente: valSel($("fCliente"), $("fClienteNovo")),
    categoria: $("fCategoria").value,
    visibilidade: $("fVisibilidade").value,
    url: $("fUrl").value.trim(),
    usuario: $("fUsuario").value.trim(),
    senha: $("fSenha").value,
    ciclo: $("fCiclo").value,
    ultima: $("fUltima").value,
    horario: $("fHorario").value.trim(),
    escalonamento: $("fEscalonamento").value.trim(),
    escalonamentos: lerEscDraft(),
    obs: $("fObs").value.trim()
  });
  if (!o.escalonamento && o.escalonamentos.length) o.escalonamento = resumoEscalonamentos(o.escalonamentos);
  if (!o.titulo && !o.aplicacao) { $("erroForm").textContent = "Preencha pelo menos o Título ou a Aplicação."; return null; }
  if (!o.titulo) o.titulo = o.aplicacao + (o.cliente ? " " + o.cliente : "");
  if (!o.aplicacao) o.aplicacao = o.titulo;
  return o;
}
function gravar(o, msg) {
  const i = itens.findIndex((x) => x.id === o.id);
  if (i >= 0) itens[i] = o; else itens.push(o);
  fichaFoto = null;
  fecharSheet("sheet");
  save();
  toast(msg);
}
/* v1.9.8: ao salvar, avisa (sem bloquear) se outro card ativo já tem o mesmo link. Card novo: sempre confere.
 * Edição: só se o link mudou e passou a ser igual ao de outro card. Arquivados e link vazio não contam. */
let avisandoLink = false;
async function conferirLinkDuplicado(o) {
  const antes = itens.find((x) => x.id === o.id);
  if (antes && normUrl(antes.url) === normUrl(o.url)) return true;
  const r = cardsMesmoLink(o.url, o.id);
  const todos = r.meus.map((c) => nomeDe(c) + " (Meus)").concat(r.equipe.map((c) => nomeDe(c) + " (Equipe)"));
  if (!todos.length) return true;
  avisandoLink = true; perguntandoDescarte = true;
  try {
    return await dialogo({ titulo: "⚠️ Já existe um card com esse link: " + todos[0], texto: (todos.length > 1 ? "Também: " + todos.slice(1, 4).join(", ") + (todos.length > 4 ? " e mais " + (todos.length - 4) : "") + ". " : "") + "Nada é bloqueado: você decide se salva mesmo assim.", ok: "Salvar mesmo assim", cancelar: "Voltar e editar" });
  } finally { avisandoLink = false; perguntandoDescarte = false; }
}
$("ficha").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (avisandoLink) return;
  const o = lerFicha();
  if (!o) return;
  if (!(await conferirLinkDuplicado(o))) { setTimeout(() => $("fUrl").focus(), 40); return; }
  gravar(o, "Acesso salvo");
});
$("atualizarSenha").addEventListener("click", async () => {
  if (avisandoLink) return;
  const o = lerFicha();
  if (!o) return;
  if (!(await conferirLinkDuplicado(o))) { setTimeout(() => $("fUrl").focus(), 40); return; }
  o.ultima = hoje();
  o.senha_atualizada_em = hoje();
  gravar(o, "Senha atualizada hoje" + (o.ciclo !== "Nunca" ? " · próxima troca em " + o.ciclo + " dias" : ""));
});
$("fechar").addEventListener("click", () => pedirFecharFicha());

/* ---------- Sheets, menu, abas ---------- */
/* v1.9.7: o fundo escuro só fecha se o clique COMEÇOU e TERMINOU nele (arrastar a seleção de um campo para fora não fecha)
 * e não logo depois de voltar para a janela (clique de foco vindo do Bloco de Notas, por exemplo). */
let fundoDown = null, focoJanelaEm = 0;
document.addEventListener("pointerdown", (ev) => { fundoDown = ev.target; }, true);
window.addEventListener("focus", () => { focoJanelaEm = Date.now(); });
function cliqueNoFundo(ev, fundo) { return ev.target === fundo && fundoDown === fundo && Date.now() - focoJanelaEm > 400; }
function abrirSheet(id) { $(id).classList.add("on"); $(id).setAttribute("aria-hidden", "false"); document.body.classList.add("sem-scroll"); }
function fecharSheet(id) { $(id).classList.remove("on"); $(id).setAttribute("aria-hidden", "true"); if (!document.querySelector(".sheet.on, .drawer.on")) { document.body.classList.remove("sem-scroll"); renderSePendente(); } }
document.querySelectorAll("[data-fecha]").forEach((b) => b.addEventListener("click", () => fecharSheet(b.dataset.fecha)));
document.querySelectorAll(".sheet:not(#dlg):not(#dlgSenha):not(#dlgInstalar):not(#dlgMod):not(#dlgVer), .drawer").forEach((s) => s.addEventListener("click", (ev) => { if (!cliqueNoFundo(ev, s)) return; if (s.id === "sheet") pedirFecharFicha(); else fecharSheet(s.id); }));
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (perguntandoDescarte) return;
  const abertos = [...document.querySelectorAll(".sheet.on, .drawer.on")].filter((s) => !(trocaObrigatoria && s.id === "dlgSenha") && s.id !== "dlgMod" && s.id !== "dlgVer");
  if (abertos.some((s) => s.id === "sheet") && fichaSuja()) { abertos.filter((s) => s.id !== "sheet").forEach((s) => fecharSheet(s.id)); fecharMenus(); pedirFecharFicha(); return; }
  abertos.forEach((s) => fecharSheet(s.id));
  fecharMenus();
  if (!abertos.length && selecao) sairSelecao();
});
$("btnMenu").addEventListener("click", () => abrirSheet("drawer"));
$("btnInfo").addEventListener("click", () => abrirSheet("sobre"));
$("btnSync").addEventListener("click", () => sincronizar(true));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && syncEstado.vinculado) sincronizar(false); });
const ACOES = { novo: () => abrirFicha(null), exportar: exportarEquipe, backup: backupPessoal, importar: () => $("imp").click(), "importar-xls": escolherPlanilha, "excel-importar": exportarExcelImportar, "excel-consulta": exportarExcelConsulta, sair: sair, trocar: abrirTrocaSenha, tema: () => { const ks = Object.keys(TEMAS); definirTema(ks[(ks.indexOf(temaAtual()) + 1) % ks.length]); } };
document.querySelectorAll(".dr-item").forEach((b) => b.addEventListener("click", () => { if (b.dataset.acao !== "tema") fecharSheet("drawer"); ACOES[b.dataset.acao](); }));
$("selExcluir").addEventListener("click", () => excluir(selecionados()));
$("selReativar").addEventListener("click", () => {
  const l = selecionados();
  l.forEach((it) => { it.arquivado_em = null; });
  selecao = null;
  save();
  toast(l.length + (l.length === 1 ? " card reativado" : " cards reativados"));
});
$("selCancelar").addEventListener("click", () => sairSelecao());
$("dNovo").addEventListener("click", () => abrirFicha(null));
$("dExport").addEventListener("click", exportarEquipe);
$("dImport").addEventListener("click", () => $("imp").click());
if ($("dImportXls")) $("dImportXls").addEventListener("click", escolherPlanilha);
ligarMenuExcel();
$("imp").addEventListener("change", importarJson);
if ($("impXls")) $("impXls").addEventListener("change", (ev) => { importarPlanilha(ev); });
$("novo").addEventListener("click", () => abrirFicha(null));
$("fGerar").addEventListener("click", () => {
  const o = genOpcoes(); if (o.modo === "palavra") o.modo = "aleatoria";
  const s = gerarSenha(o); const inp = $("fSenha");
  inp.value = s; inp.type = "text"; setOlho($("fOlho"), true);
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  toast("Senha gerada. Ela será gravada ao salvar o card.");
});
document.querySelectorAll("#abas button").forEach((b) => {
  b.addEventListener("click", () => {
    aba = b.dataset.aba;
    document.querySelectorAll("#abas button").forEach((x) => x.classList.toggle("on", x === b));
    render();
    window.scrollTo(0, 0);
  });
});
$("busca").addEventListener("input", render);
/* ---------- Menu "Excel ▾" do topo ---------- */
function ligarMenuExcel() {
  const bt = $("dExcel"), menu = $("excelMenu");
  if (!bt || !menu) return;
  const itensMenu = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));
  const aberto = () => !menu.hidden;
  function abrir(focarPrimeiro) {
    menu.hidden = false;
    bt.setAttribute("aria-expanded", "true");
    bt.classList.add("on");
    if (focarPrimeiro) setTimeout(() => { const l = itensMenu(); if (l[0]) l[0].focus(); }, 0);
  }
  function fechar(focarBotao) {
    if (!aberto()) return;
    menu.hidden = true;
    bt.setAttribute("aria-expanded", "false");
    bt.classList.remove("on");
    if (focarBotao) bt.focus();
  }
  bt.addEventListener("click", (ev) => { ev.stopPropagation(); aberto() ? fechar(false) : abrir(ev.detail === 0); });
  bt.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); abrir(true); }
  });
  menu.addEventListener("keydown", (ev) => {
    const l = itensMenu(), i = l.indexOf(document.activeElement);
    if (ev.key === "ArrowDown") { ev.preventDefault(); l[(i + 1) % l.length].focus(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
    else if (ev.key === "Home") { ev.preventDefault(); l[0].focus(); }
    else if (ev.key === "End") { ev.preventDefault(); l[l.length - 1].focus(); }
    else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); fechar(true); }
    else if (ev.key === "Tab") fechar(false);
  });
  menu.addEventListener("click", (ev) => {
    const it = ev.target.closest('[role="menuitem"]');
    if (!it) return;
    fechar(true);
    if (it.dataset.excel === "importar") exportarExcelImportar();
    else if (it.dataset.excel === "consulta") exportarExcelConsulta();
  });
  document.addEventListener("click", (ev) => { if (!ev.target.closest("#excelDrop")) fechar(false); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && aberto()) fechar(true); }, true);
  window.addEventListener("resize", () => fechar(false));
}
function sair() {
  sessionStorage.removeItem("caderno-acessos-sessao");
  location.reload();
}

/* ---------- Bloqueio automático por inatividade ---------- */
const BLOQ_KEY = "caderno-acessos-bloqueio-min";
const BLOQ_OPCOES = [1, 5, 10, 15, 30, 0]; // 0 = Nunca
const ATIVIDADE_KEY = "caderno-acessos-ultima-atividade";
function minutosBloqueio() {
  const v = localStorage.getItem(BLOQ_KEY);
  if (v == null) return 5;
  const n = parseInt(v, 10);
  return BLOQ_OPCOES.includes(n) ? n : 5;
}
function definirBloqueio(n) {
  localStorage.setItem(BLOQ_KEY, String(n));
  marcarAtividade(true);
  toast(n ? "Bloqueio automático: " + n + " min" : "Bloqueio automático desativado");
  if (aba === "mais") render();
}
let ultimaAtividade = Date.now();
function marcarAtividade(forcar) {
  const agora = Date.now();
  if (!forcar && agora - ultimaAtividade < 1000) return;
  ultimaAtividade = agora;
  try { sessionStorage.setItem(ATIVIDADE_KEY, String(agora)); } catch (e) {}
}
function verificarInatividade() {
  if (document.body.classList.contains("travado")) return;
  const min = minutosBloqueio();
  if (!min) return;
  if (Date.now() - ultimaAtividade >= min * 60000) {
    try { sessionStorage.setItem("caderno-acessos-bloqueado-auto", "1"); } catch (e) {}
    sair();
  }
}
(function iniciarBloqueioAuto() {
  const salvo = parseInt(sessionStorage.getItem(ATIVIDADE_KEY) || "", 10);
  if (salvo) ultimaAtividade = salvo;
  verificarInatividade();
  ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "input"].forEach((ev) =>
    document.addEventListener(ev, () => marcarAtividade(), { passive: true, capture: true }));
  setInterval(verificarInatividade, 15000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verificarInatividade(); });
  window.addEventListener("focus", verificarInatividade);
  window.addEventListener("pageshow", verificarInatividade);
  if (sessionStorage.getItem("caderno-acessos-bloqueado-auto")) {
    sessionStorage.removeItem("caderno-acessos-bloqueado-auto");
    setTimeout(() => toast("Bloqueado por inatividade. Entre novamente."), 300);
  }
})();
aplicarTema(temaAtual());
aplicarIcones();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
}
// Tela de login: senha padrão (hash no código) ou senha customizada só deste aparelho (localStorage).
const LOGIN_PADRAO = { iter: 310000, salt: "015d5ac2a5ab08fdac13e98dd8b789fc", hash: "033d6adcf778bd29c7199d684d705ecebbd10bb47d86ecd732a0d225ffa2e9b8" };
const AUTH_KEY = "caderno-acessos-auth-v1";
const SESSAO = "caderno-acessos-sessao";
const AUTH_MIN = 8;
const AUTH_REGRAS = "A nova senha precisa ter: no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.";
function hexParaBytes(h) { const b = new Uint8Array(h.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }
function bytesParaHex(buf) { return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
function saltAleatorio() { const b = new Uint8Array(16); crypto.getRandomValues(b); return bytesParaHex(b); }
function hashIguais(a, b) {
  const sa = String(a || ""), sb = String(b || "");
  let dif = sa.length ^ sb.length;
  const n = Math.max(sa.length, sb.length);
  for (let i = 0; i < n; i++) dif |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  return dif === 0;
}
function senhaForte(senha) {
  const s = String(senha || "");
  return s.length >= AUTH_MIN && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s);
}
function lerAuthLocal() {
  try {
    const o = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    if (!o || !o.hash || !o.salt || !o.iter) return null;
    return o;
  } catch (e) { return null; }
}
function loginAtivo() {
  const local = lerAuthLocal();
  return local ? { iter: local.iter, salt: local.salt, hash: local.hash, custom: true } : Object.assign({ custom: false }, LOGIN_PADRAO);
}
async function derivarSenha(senha, saltHex, iter) {
  if (!(window.crypto && crypto.subtle)) throw new Error("sem-crypto");
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexParaBytes(saltHex), iterations: iter }, chave, 256);
  return bytesParaHex(bits);
}
async function conferirSenha(senha) {
  const auth = loginAtivo();
  const hex = await derivarSenha(senha, auth.salt, auth.iter);
  return hashIguais(hex, auth.hash);
}
function tokenSessao() { return loginAtivo().hash.slice(0, 16); }
function abrirSessao() { sessionStorage.setItem(SESSAO, tokenSessao()); }
let trocaObrigatoria = false;
function entrar() {
  if (!loginAtivo().custom) { exigirTrocaSenha(); return; }
  trocaObrigatoria = false;
  document.body.classList.remove("troca-obrig");
  document.body.classList.remove("travado");
  if (typeof marcarAtividade === "function") marcarAtividade(true);
  load();
  try { migrarHistorico(); } catch (e) {}
  fotoMeus = fotoIndividuais();
  render();
  if (window.CadernoSync) atualizarEstadoSync().then(() => { sincronizar(false); sugerirPasta(); });
  setTimeout(mostrarNovidadesSePendente, 500);
}
function exigirTrocaSenha() {
  trocaObrigatoria = true;
  document.body.classList.add("troca-obrig");
  abrirTrocaSenha();
  $("dlgSenhaTitulo").textContent = "Crie sua senha";
  $("tsAviso").hidden = false;
  $("tsCancelar").textContent = "Sair";
}
function abrirTrocaSenha() {
  $("dlgSenhaTitulo").textContent = "Trocar senha";
  $("tsAviso").hidden = true;
  $("tsCancelar").textContent = "Cancelar";
  $("tsAtual").value = "";
  $("tsNova").value = "";
  $("tsConf").value = "";
  $("tsErro").textContent = "";
  $("tsRegras").textContent = AUTH_REGRAS;
  resetarOlhos(["tsAtual", "tsNova", "tsConf"]);
  abrirSheet("dlgSenha");
  setTimeout(() => $("tsAtual").focus(), 40);
}
async function salvarTrocaSenha(ev) {
  ev.preventDefault();
  const er = $("tsErro");
  const atual = $("tsAtual").value;
  const nova = $("tsNova").value;
  const conf = $("tsConf").value;
  er.textContent = "";
  const btn = $("tsSalvar");
  btn.disabled = true;
  try {
    if (!(await conferirSenha(atual))) {
      er.textContent = "Senha atual incorreta.";
      $("tsAtual").select();
      return;
    }
    if (!senhaForte(nova)) {
      er.textContent = AUTH_REGRAS;
      $("tsNova").focus();
      return;
    }
    if (nova === atual) {
      er.textContent = "A nova senha precisa ser diferente da atual.";
      $("tsNova").focus();
      return;
    }
    if (nova !== conf) {
      er.textContent = "A confirmação não é igual à nova senha.";
      $("tsConf").select();
      return;
    }
    const salt = saltAleatorio();
    const hash = await derivarSenha(nova, salt, LOGIN_PADRAO.iter);
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      versao: 1,
      iter: LOGIN_PADRAO.iter,
      salt: salt,
      hash: hash,
      alteradoEm: new Date().toISOString()
    }));
    await reembrulharOlho(atual, nova);
    abrirSessao();
    fecharSheet("dlgSenha");
    $("tsAtual").value = $("tsNova").value = $("tsConf").value = "";
    toast("Senha alterada.");
    if (trocaObrigatoria) entrar();
  } catch (e) {
    er.textContent = "Não foi possível trocar a senha neste navegador (abra pelo link https).";
  } finally {
    btn.disabled = false;
  }
}
document.getElementById("loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const inp = document.getElementById("loginSenha");
  const erro = document.getElementById("loginErro");
  const btn = document.getElementById("loginBtn");
  erro.textContent = "";
  btn.disabled = true;
  try {
    if (await conferirSenha(inp.value)) {
      abrirSessao();
      lembrarChaveLogin(inp.value);
      inp.value = "";
      resetarOlhos(["loginSenha"]);
      entrar();
    } else {
      erro.textContent = "Senha incorreta. Tente novamente.";
      inp.select();
    }
  } catch (e) {
    erro.textContent = "Não foi possível verificar a senha neste navegador (abra pelo link https).";
  }
  btn.disabled = false;
});
$("formTrocaSenha").addEventListener("submit", salvarTrocaSenha);
$("tsCancelar").addEventListener("click", () => { if (trocaObrigatoria) sair(); else fecharSheet("dlgSenha"); });
$("dlgSenha").addEventListener("click", (ev) => { if (cliqueNoFundo(ev, $("dlgSenha")) && !trocaObrigatoria) fecharSheet("dlgSenha"); });
document.querySelectorAll(".olho[data-alvo]").forEach(ligarOlho);
aplicarIcones(document.getElementById("login"));
aplicarIcones(document.getElementById("dlgSenha"));
$("nvEntendi").addEventListener("click", () => fecharSheet("dlgNovidades"));
if (sessionStorage.getItem(SESSAO) === tokenSessao()) entrar();
else document.getElementById("loginSenha").focus();

/* ---------- Aviso instalar / salvar PWA ---------- */
const INSTALL_HINT_KEY = "caderno-acessos-install-hint-v1";
let deferredInstall = null;

function appJaInstalado() {
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
  } catch (e) {}
  return false;
}
function installHintVisto() {
  try { return localStorage.getItem(INSTALL_HINT_KEY) === "1"; } catch (e) { return false; }
}
function marcarInstallHint() {
  try { localStorage.setItem(INSTALL_HINT_KEY, "1"); } catch (e) {}
}
function atualizarLinkInstalar() {
  const wrap = document.getElementById("loginInstalarWrap");
  if (!wrap) return;
  wrap.hidden = appJaInstalado();
}
function mostrarTelaInstalar(n) {
  const t1 = document.getElementById("instTela1");
  const t2 = document.getElementById("instTela2");
  if (!t1 || !t2) return;
  t1.hidden = n !== 1;
  t2.hidden = n !== 2;
}
async function tentarPromptInstalar() {
  if (!deferredInstall) return false;
  const ev = deferredInstall;
  deferredInstall = null;
  try {
    await ev.prompt();
    await ev.userChoice;
  } catch (e) {}
  atualizarLinkInstalar();
  return true;
}
function fecharInstalar(marcar) {
  if (marcar) marcarInstallHint();
  fecharSheet("dlgInstalar");
  mostrarTelaInstalar(1);
  atualizarLinkInstalar();
  if (!document.body.classList.contains("travado")) setTimeout(mostrarNovidadesSePendente, 300);
}
function abrirInstalar(forcar) {
  if (appJaInstalado()) { atualizarLinkInstalar(); return; }
  if (!forcar && installHintVisto()) return;
  mostrarTelaInstalar(1);
  abrirSheet("dlgInstalar");
  setTimeout(() => {
    const b = document.getElementById("instEntendi");
    if (b) b.focus();
  }, 30);
}

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  deferredInstall = ev;
  atualizarLinkInstalar();
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  marcarInstallHint();
  fecharSheet("dlgInstalar");
  atualizarLinkInstalar();
});

(function ligarInstalarUI() {
  const dlg = document.getElementById("dlgInstalar");
  const btnEntendi = document.getElementById("instEntendi");
  const btnEntendi2 = document.getElementById("instEntendi2");
  const btnPasso = document.getElementById("instPassoAPasso");
  const btnVoltar = document.getElementById("instVoltar");
  const btnFooter = document.getElementById("btnInstalarApp");
  if (!dlg || !btnEntendi) return;

  async function onEntendi() {
    await tentarPromptInstalar();
    fecharInstalar(true);
  }
  btnEntendi.addEventListener("click", onEntendi);
  if (btnEntendi2) btnEntendi2.addEventListener("click", onEntendi);
  if (btnPasso) btnPasso.addEventListener("click", () => mostrarTelaInstalar(2));
  if (btnVoltar) btnVoltar.addEventListener("click", () => mostrarTelaInstalar(1));
  if (btnFooter) btnFooter.addEventListener("click", async () => {
    if (deferredInstall) {
      await tentarPromptInstalar();
      marcarInstallHint();
      return;
    }
    abrirInstalar(true);
  });
  dlg.addEventListener("click", (ev) => {
    if (cliqueNoFundo(ev, dlg)) fecharInstalar(true);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && dlg.classList.contains("on")) {
      ev.stopPropagation();
      fecharInstalar(true);
    }
  }, true);

  atualizarLinkInstalar();
  // Mostra uma vez (até Entendi), só se ainda não for PWA instalado.
  if (!appJaInstalado() && !installHintVisto()) {
    setTimeout(() => abrirInstalar(false), 400);
  }
})();
