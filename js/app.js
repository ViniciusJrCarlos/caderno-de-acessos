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
  return [
    c({ id: "s1", titulo: "CRM Operação A", aplicacao: "CRM Fluxo", cliente: "Operação A", categoria: "Interno", visibilidade: "Equipe", url: "https://crm.fluxo.example/opa", usuario: "suporte.opa", senha: "exemplo123", ciclo: "90", ultima: addDias(hoje(), -10), horario: "24x7", escalonamento: "N2 Sistemas ramal 4010", obs: "Mesmo CRM, instância da Operação A" }),
    c({ id: "s2", titulo: "CRM Operação B", aplicacao: "CRM Fluxo", cliente: "Operação B", categoria: "Interno", visibilidade: "Equipe", url: "https://crm.fluxo.example/opb", usuario: "suporte.opb", senha: "exemplo456", ciclo: "30", ultima: addDias(hoje(), -25), horario: "Seg–Sex 08–20", escalonamento: "N2 Sistemas ramal 4010", obs: "Mesmo CRM, instância da Operação B" }),
    c({ id: "s3", titulo: "Chamados Operação A", aplicacao: "Central de Chamados Delta", cliente: "Operação A", categoria: "Interno", visibilidade: "Equipe", url: "https://chamados.delta.example/opa", usuario: "analista.opa", senha: "teste123", ciclo: "60", ultima: addDias(hoje(), -65), escalonamento: "Coordenação Suporte" }),
    c({ id: "s4", titulo: "Chamados Operação B", aplicacao: "Central de Chamados Delta", cliente: "Operação B", categoria: "Interno", visibilidade: "Individual", url: "https://chamados.delta.example/opb", usuario: "meu.usuario", senha: "teste456", ciclo: "60", ultima: addDias(hoje(), -5), obs: "Login pessoal do analista" }),
    c({ id: "s5", titulo: "VPN Corporativa", aplicacao: "VPN Ponte Segura", cliente: "Interno", categoria: "Interno", visibilidade: "Individual", url: "https://vpn.pontesegura.example", usuario: "meu.usuario", senha: "exemplo789", ciclo: "90", ultima: addDias(hoje(), -20) }),
    c({ id: "s6", titulo: "Portal Fornecedor Alfa", aplicacao: "Alfa Suprimentos", cliente: "Alfa Suprimentos", categoria: "Externo", visibilidade: "Equipe", url: "https://portal.alfasuprimentos.example", usuario: "svc.alfa", senha: "fornecedor123", ciclo: "30", ultima: addDias(hoje(), -27), horario: "09–17",
      escalonamento: "N1 portal · N2 Carla · N3 NOC",
      escalonamentos: [
        { nivel: 1, canal: "portal", valor: "https://portal.alfasuprimentos.example/sd", nome: "Service Desk", horario: "09–17", obs: "Abrir chamado no portal" },
        { nivel: 2, canal: "telefone", valor: "0800 000 0001", nome: "Carla Mendes", horario: "09–17", obs: "" },
        { nivel: 3, canal: "email", valor: "noc@alfasuprimentos.example", nome: "NOC Alfa", horario: "24x7", obs: "" }
      ] }),
    c({ id: "s7", titulo: "Painel Nuvem Azul", aplicacao: "Nuvem Azul", cliente: "Nuvem Azul Tecnologia", categoria: "Externo", visibilidade: "Equipe", url: "https://painel.nuvemazul.example", usuario: "ops.nuvem", senha: "nuvem123", ciclo: "Nunca", ultima: addDias(hoje(), -120), horario: "Seg–Sex 08–18",
      escalonamento: "N1 0800 000 0002 · N2 plantão",
      escalonamentos: [
        { nivel: 1, canal: "telefone", valor: "0800 000 0002", nome: "Suporte N1", horario: "Seg–Sex 08–18", obs: "" },
        { nivel: 2, canal: "email", valor: "plantao@nuvemazul.example", nome: "Plantão", horario: "24x7", obs: "" }
      ] }),
    c({ id: "s8", titulo: "Gestor Ponto Certo", aplicacao: "Ponto Certo", cliente: "Ponto Certo Sistemas", categoria: "Externo", visibilidade: "Individual", url: "https://app.pontocerto.example", usuario: "meu.usuario", senha: "ponto123", ciclo: "90", ultima: addDias(hoje(), -95) }),
    c({ id: "s9", titulo: "Telefonia Sinal Verde", aplicacao: "Sinal Verde Telecom", cliente: "Sinal Verde Telecom", categoria: "Externo", visibilidade: "Equipe", url: "https://admin.sinalverde.example", usuario: "suporte.sv", senha: "exemplo321", ciclo: "60", ultima: addDias(hoje(), -30), horario: "24x7",
      escalonamento: "NOC fictício 0800 000 0003",
      escalonamentos: [
        { nivel: 1, canal: "portal", valor: "https://admin.sinalverde.example/tickets", nome: "Portal de chamados", horario: "24x7", obs: "" },
        { nivel: 2, canal: "telefone", valor: "0800 000 0003", nome: "NOC Sinal Verde", horario: "24x7", obs: "" },
        { nivel: 3, canal: "email", valor: "escalonamento@sinalverde.example", nome: "Escalonamento", horario: "24x7", obs: "" }
      ] }),
    c({ id: "s10", titulo: "Portal Beta Logística (antigo)", aplicacao: "Beta Logística", cliente: "Beta Logística", categoria: "Externo", visibilidade: "Equipe", url: "https://portal.betalogistica.example", usuario: "svc.beta", senha: "antigo123", ciclo: "30", ultima: addDias(hoje(), -200), obs: "Contrato encerrado, mantido só para histórico", arquivado_em: addDias(hoje(), -15) }),
    c({ id: "s11", titulo: "VIN CRM", aplicacao: "VIN CRM", cliente: "VIN CRM", categoria: "Externo", visibilidade: "Equipe", url: "https://portal.vincrm.example", usuario: "svc.vincrm", senha: "exemplo789", ciclo: "60", ultima: hoje(), horario: "Seg–Sex 08–18", escalonamento: "Suporte fictício 0800 000 0011" })
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
  const presentes = new Set(itens.map((it) => it.id));
  let mudou = removeuAntigos;
  exemplos().forEach((it) => {
    if (!entregues.includes(it.id)) {
      if (!presentes.has(it.id) && localStorage.getItem(KEY)) { itens.push(it); mudou = true; }
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
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(itens));
  render();
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
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
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
function btn(cls, icone, texto, fn, titulo) {
  const b = el("button", cls);
  b.type = "button";
  if (icone) b.insertAdjacentHTML("beforeend", svg(icone, 18));
  if (texto) b.appendChild(el("span", "", texto));
  if (titulo) { b.title = titulo; b.setAttribute("aria-label", titulo); }
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
    box.onclick = (ev) => { if (ev.target === box) fim(false); };
    document.addEventListener("keydown", tecla, true);
    abrirSheet("dlg");
    setTimeout(() => (op.cancelar === false ? ok : cancel).focus(), 30);
  });
}
function aviso(titulo, texto) { return dialogo({ titulo: titulo, texto: texto, ok: "OK", cancelar: false }); }

/* ---------- Excluir (só arquivados) com desfazer ---------- */
function nomeDe(it) { return it.titulo || it.aplicacao || "este acesso"; }
async function excluir(lista) {
  lista = lista.filter((it) => it && it.arquivado_em);
  if (!lista.length) return false;
  const sim = await dialogo({
    titulo: lista.length === 1 ? "Excluir " + nomeDe(lista[0]) + " de vez?" : "Excluir " + lista.length + " acessos de vez?",
    texto: "Essa ação não pode ser desfeita.",
    ok: "Excluir", cancelar: "Cancelar", perigo: true
  });
  if (!sim) return false;
  const removidos = [];
  lista.forEach((it) => { const i = itens.indexOf(it); if (i >= 0) removidos.push({ i: i, it: it }); });
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
  const ok = () => toast((rotuloMsg || "Senha") + " copiada");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(ok).catch(() => fallbackCopiar(texto) ? ok() : toast("Não foi possível copiar"));
  } else if (fallbackCopiar(texto)) ok();
  else toast("Não foi possível copiar");
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
function abrirUrl(url) {
  if (!url) { toast("Card sem URL"); return; }
  const u = /^[a-z]+:\/\//i.test(url) ? url : "https://" + url;
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
  if (nivel.canal === "portal" || /^https?:\/\//i.test(v) || /\./.test(v)) return /^[a-z]+:\/\//i.test(v) ? v : "https://" + v;
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
    if (aba === "mais") return false;
    const blob = [it.titulo, it.aplicacao, it.cliente, it.usuario, it.url, it.categoria, it.visibilidade, it.escalonamento, resumoEscalonamentos(niveisDe(it))].join(" ").toLowerCase();
    return !q || blob.indexOf(q) >= 0;
  }).sort((a, b) => (a.aplicacao || a.titulo || "").localeCompare(b.aplicacao || b.titulo || "") || (a.cliente || "").localeCompare(b.cliente || "") || (a.titulo || "").localeCompare(b.titulo || ""));
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
  document.getElementById("buscaWrap").style.display = aba === "mais" ? "none" : "";
  document.getElementById("novo").classList.toggle("oculto", aba === "mais");
  box.classList.toggle("mais", aba === "mais");
  if (aba === "mais") { renderMais(box); return; }
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
    a.href = /^[a-z]+:\/\//i.test(it.url) ? it.url : "https://" + it.url;
    a.target = "_blank"; a.rel = "noopener";
    lu.appendChild(a);
    lu.appendChild(btn("olho", "external", "", () => abrirUrl(it.url), "Abrir URL"));
  } else { lu.appendChild(el("span", "linha-val", "—")); lu.appendChild(el("span", "olho-vazio")); }
  linhas.appendChild(lu);
  const d = diasRestantes(it);
  let info = it.arquivado_em ? "Arquivado em " + it.arquivado_em : (it.ciclo === "Nunca" || !it.ciclo) ? "Ciclo: não expira" : "Ciclo " + it.ciclo + " dias · " + (d < 0 ? "vencido há " + Math.abs(d) + " dia(s)" : "vence em " + d + " dia(s)");
  if (ind && !it.senha && !it.usuario) info += " · usuário/senha não compartilhados";
  linhas.appendChild(el("div", "card-info", info));
  c.appendChild(linhas);

  const niveis = niveisDe(it);
  if (niveis.length || (it.escalonamento && String(it.escalonamento).trim())) {
    const esc = el("div", "esc-bloco");
    const tog = el("button", "esc-toggle");
    tog.type = "button";
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
    bMostrar.querySelector("svg").outerHTML = svg(abrir ? "eyeOff" : "eye", 18);
  });
  if (!it.senha && !it.usuario) bMostrar.disabled = true;
  acoes.appendChild(bMostrar);
  const bCop = btn("acao", "copy", "Copiar", () => copiar(it.senha, "Senha"));
  if (!it.senha) bCop.disabled = true;
  acoes.appendChild(bCop);
  const bAb = btn("acao", "external", "Abrir", () => abrirUrl(it.url));
  if (!it.url) bAb.disabled = true;
  acoes.appendChild(bAb);
  c.appendChild(acoes);
  return c;
}
function fecharMenus() { document.querySelectorAll(".menu-card").forEach((m) => m.remove()); }
function abrirMenuCard(it, ancora) {
  const jaAberto = ancora.parentNode.querySelector(".menu-card");
  fecharMenus();
  if (jaAberto) return;
  const m = el("div", "menu-card");
  m.setAttribute("role", "menu");
  m.appendChild(btn("mi", "edit", "Editar", () => { fecharMenus(); abrirFicha(it); }));
  m.appendChild(btn("mi", "copy", "Copiar usuário", () => { fecharMenus(); copiar(it.usuario, "Usuário"); }));
  if (it.arquivado_em) {
    m.appendChild(btn("mi ok", "restore", "Reativar", () => { it.arquivado_em = null; save(); toast("Card reativado"); }));
    m.appendChild(btn("mi warn", "trash", "Excluir", () => { fecharMenus(); excluir([it]); }));
  }
  else m.appendChild(btn("mi warn", "archive", "Arquivar", () => { it.arquivado_em = hoje(); save(); toast("Card arquivado"); }));
  ancora.parentNode.appendChild(m);
}
document.addEventListener("click", (ev) => { if (!ev.target.closest(".menu-card")) fecharMenus(); });

/* ---------- Aba Mais ---------- */
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
    b.insertAdjacentHTML("afterbegin", '<span class="amostra amostra-' + k + '"></span>');
    return b;
  });
  bloco("Tema", "Aparência só deste aparelho. Vale também para a tela de login.", bt);
  bloco("Compartilhar com a equipe", "Gera o JSON para os outros analistas. Cards Individuais vão sem usuário e sem senha (só título, aplicação, cliente, URL etc.).",
    [btn("btn pri", "download", "Exportar JSON", exportarEquipe)]);
  bloco("Backup pessoal (inclui minhas senhas)", "Arquivo completo, com os usuários e senhas dos seus acessos Individuais. Use só para levar para outro aparelho seu. Não compartilhe.",
    [btn("btn", "lock", "Backup pessoal (inclui minhas senhas)", backupPessoal)]);
  bloco("Importar", "Junta os cards do arquivo com os deste aparelho (pelo id). Cards que só existem aqui continuam. Usuário e senha que você já tem não são apagados por um arquivo que veio sem eles.",
    [btn("btn", "upload", "Importar JSON", () => document.getElementById("imp").click()),
     btn("btn", "table", "Importar planilha Excel", escolherPlanilha)]);
  bloco("Planilha", "Excel separado em Fornecedores externos e Ferramentas internas. Usuário e senha dos acessos Individuais não entram. Use “Importar planilha” para ler a planilha de brokers/suporte.",
    [btn("btn", "table", "Excel Interno/Externo", exportarExcel)]);
  bloco("Senha deste aparelho", "Altera a senha de acesso salva só neste navegador. Outros aparelhos continuam com a senha padrão até alguém trocar lá também.",
    [btn("btn", "lock", "Trocar senha", abrirTrocaSenha)]);
  bloco("Offline e instalação", "Abra o link no Chrome uma vez com internet (fora da VPN) e use “Instalar app”. Depois funciona sem internet; quando houver internet, a versão nova chega sozinha.",
    [btn("btn", "logout", "Sair (bloquear)", sair)]);
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
function mesclar(lista) {
  let novos = 0, atualizados = 0;
  lista.forEach((inc) => {
    if (!inc || typeof inc !== "object") return;
    if (!inc.id) inc.id = Math.random().toString(16).slice(2, 10);
    if (Array.isArray(inc.escalonamentos)) inc.escalonamentos = inc.escalonamentos.map(limparNivelEsc).filter(Boolean);
    const i = itens.findIndex((x) => x.id === inc.id);
    if (i < 0) {
      // também evita duplicar por fornecedor+aplicação se id diferente
      const chave = chaveCard(inc);
      const j = chave ? itens.findIndex((x) => chaveCard(x) === chave) : -1;
      if (j >= 0) {
        const atual = itens[j];
        const junto = Object.assign({}, atual, inc, { id: atual.id });
        ["usuario", "senha"].forEach((k) => { if (!inc[k] && atual[k]) junto[k] = atual[k]; });
        if ((!inc.escalonamentos || !inc.escalonamentos.length) && atual.escalonamentos && atual.escalonamentos.length) junto.escalonamentos = atual.escalonamentos;
        itens[j] = junto;
        atualizados++;
        return;
      }
      itens.push(inc); novos++; return;
    }
    const atual = itens[i];
    const junto = Object.assign({}, atual, inc);
    ["usuario", "senha"].forEach((k) => { if (!inc[k] && atual[k]) junto[k] = atual[k]; });
    if ((!inc.escalonamentos || !inc.escalonamentos.length) && atual.escalonamentos && atual.escalonamentos.length) junto.escalonamentos = atual.escalonamentos;
    itens[i] = junto;
    atualizados++;
  });
  return { novos: novos, atualizados: atualizados };
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
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      const lista = Array.isArray(data) ? data : (data.itens || []);
      const res = mesclar(lista);
      save();
      aviso("Importação concluída", res.novos + " novo(s), " + res.atualizados + " atualizado(s). Total: " + itens.length + " card(s).");
    } catch (e) {
      aviso("Arquivo inválido", "Esse arquivo não é um JSON do Caderno de Acessos.");
    }
    ev.target.value = "";
  };
  r.readAsText(f);
}
function exportarExcel() {
  const head = ["Titulo", "Aplicacao", "Cliente", "Categoria", "Visibilidade", "URL", "Usuario", "Senha", "Ciclo", "UltimaTroca", "Horario", "Escalonamento", "Obs", "Arquivado"];
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function tabela(lista, titulo) {
    let html = "<h2>" + titulo + "</h2><table border='1'><tr>";
    head.forEach((h) => { html += "<th>" + h + "</th>"; });
    html += "</tr>";
    lista.forEach((orig) => {
      const it = semSegredoIndividual(orig);
      const ind = orig.visibilidade === "Individual";
      const escTxt = it.escalonamento || resumoEscalonamentos(niveisDe(orig));
      const vals = [it.titulo, it.aplicacao, it.cliente, it.categoria, it.visibilidade, it.url, ind ? "(individual)" : it.usuario, ind ? "(individual)" : it.senha, it.ciclo, it.ultima, it.horario, escTxt, it.obs, it.arquivado_em || ""];
      html += "<tr>";
      vals.forEach((v) => { html += "<td>" + esc(v) + "</td>"; });
      html += "</tr>";
    });
    return html + "</table>";
  }
  const ext = itens.filter((i) => i.categoria === "Externo");
  const inn = itens.filter((i) => i.categoria !== "Externo");
  download("caderno-acessos.xls", "<html><meta charset='utf-8'><body>" + tabela(ext, "Fornecedores externos") + tabela(inn, "Ferramentas internas") + "</body></html>", "application/vnd.ms-excel");
  toast("Excel exportado (sem senhas individuais)");
}

/* ---------- Importar planilha Excel (SheetJS sob demanda) ---------- */
let xlsxLibPromise = null;
function carregarXlsxLib() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLibPromise) return xlsxLibPromise;
  xlsxLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.async = true;
    s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX indisponível"));
    s.onerror = () => reject(new Error("Falha ao carregar SheetJS"));
    document.head.appendChild(s);
  });
  return xlsxLibPromise;
}
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
function cardsDePlanilha(workbook, XLSX) {
  const gerados = [];
  const vistos = new Set();
  const ordem = workbook.SheetNames.slice().sort((a, b) => {
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
async function importarPlanilha(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  try {
    toast("Lendo planilha…");
    const XLSX = await carregarXlsxLib();
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellStyles: true });
    const lista = cardsDePlanilha(wb, XLSX);
    if (!lista.length) {
      aviso("Nada importado", "Não encontrei abas/colunas reconhecíveis (Fornecedor, Aplicação, Contato…).");
      return;
    }
    const res = mesclar(lista);
    save();
    aviso("Planilha importada", res.novos + " novo(s), " + res.atualizados + " atualizado(s). Senhas individuais já preenchidas neste aparelho não foram apagadas.");
  } catch (e) {
    aviso("Falha na importação", "Não foi possível ler a planilha. Verifique se é .xlsx/.xls e se há internet na primeira vez (biblioteca SheetJS).");
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
    }));

    row.appendChild(labN); row.appendChild(inpN);
    row.appendChild(labC); row.appendChild(selC);
    row.appendChild(labV); row.appendChild(inpV);
    row.appendChild(labNome); row.appendChild(inpNome);
    row.appendChild(labH); row.appendChild(inpH);
    row.appendChild(labO); row.appendChild(inpO);
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
  return Array.from(new Set(itens.map((it) => (it[campo] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
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
  setTimeout(() => $("fTitulo").focus(), 50);
}
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
  fecharSheet("sheet");
  save();
  toast(msg);
}
$("ficha").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const o = lerFicha();
  if (o) gravar(o, "Acesso salvo");
});
$("atualizarSenha").addEventListener("click", () => {
  const o = lerFicha();
  if (!o) return;
  o.ultima = hoje();
  o.senha_atualizada_em = hoje();
  gravar(o, "Senha atualizada hoje" + (o.ciclo !== "Nunca" ? " · próxima troca em " + o.ciclo + " dias" : ""));
});
$("fechar").addEventListener("click", () => fecharSheet("sheet"));

/* ---------- Sheets, menu, abas ---------- */
function abrirSheet(id) { $(id).classList.add("on"); $(id).setAttribute("aria-hidden", "false"); document.body.classList.add("sem-scroll"); }
function fecharSheet(id) { $(id).classList.remove("on"); $(id).setAttribute("aria-hidden", "true"); if (!document.querySelector(".sheet.on, .drawer.on")) document.body.classList.remove("sem-scroll"); }
document.querySelectorAll("[data-fecha]").forEach((b) => b.addEventListener("click", () => fecharSheet(b.dataset.fecha)));
document.querySelectorAll(".sheet:not(#dlg):not(#dlgSenha):not(#dlgInstalar), .drawer").forEach((s) => s.addEventListener("click", (ev) => { if (ev.target === s) fecharSheet(s.id); }));
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  const abertos = document.querySelectorAll(".sheet.on, .drawer.on");
  abertos.forEach((s) => fecharSheet(s.id));
  fecharMenus();
  if (!abertos.length && selecao) sairSelecao();
});
$("btnMenu").addEventListener("click", () => abrirSheet("drawer"));
$("btnInfo").addEventListener("click", () => abrirSheet("sobre"));
const ACOES = { novo: () => abrirFicha(null), exportar: exportarEquipe, backup: backupPessoal, importar: () => $("imp").click(), "importar-xls": escolherPlanilha, excel: exportarExcel, sair: sair, trocar: abrirTrocaSenha, tema: () => { const ks = Object.keys(TEMAS); definirTema(ks[(ks.indexOf(temaAtual()) + 1) % ks.length]); } };
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
$("dExcel").addEventListener("click", exportarExcel);
$("imp").addEventListener("change", importarJson);
if ($("impXls")) $("impXls").addEventListener("change", (ev) => { importarPlanilha(ev); });
$("novo").addEventListener("click", () => abrirFicha(null));
document.querySelectorAll("#abas button").forEach((b) => {
  b.addEventListener("click", () => {
    aba = b.dataset.aba;
    document.querySelectorAll("#abas button").forEach((x) => x.classList.toggle("on", x === b));
    render();
    window.scrollTo(0, 0);
  });
});
$("busca").addEventListener("input", render);
function sair() {
  sessionStorage.removeItem("caderno-acessos-sessao");
  location.reload();
}
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
function entrar() {
  document.body.classList.remove("travado");
  load();
  render();
}
function abrirTrocaSenha() {
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
    abrirSessao();
    fecharSheet("dlgSenha");
    $("tsAtual").value = $("tsNova").value = $("tsConf").value = "";
    toast("Senha alterada.");
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
$("tsCancelar").addEventListener("click", () => fecharSheet("dlgSenha"));
$("dlgSenha").addEventListener("click", (ev) => { if (ev.target === $("dlgSenha")) fecharSheet("dlgSenha"); });
document.querySelectorAll(".olho[data-alvo]").forEach(ligarOlho);
aplicarIcones(document.getElementById("login"));
aplicarIcones(document.getElementById("dlgSenha"));
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
    if (ev.target === dlg) fecharInstalar(true);
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
