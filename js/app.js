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
  // Dados 100% fictícios para demonstração (ids s1..s10).
  const c = (o) => Object.assign({ horario: "", escalonamento: "", obs: "", arquivado_em: null }, o);
  return [
    c({ id: "s1", titulo: "CRM Operação A", aplicacao: "CRM Fluxo", cliente: "Operação A", categoria: "Interno", visibilidade: "Equipe", url: "https://crm.fluxo.example/opa", usuario: "suporte.opa", senha: "exemplo123", ciclo: "90", ultima: addDias(hoje(), -10), horario: "24x7", escalonamento: "N2 Sistemas ramal 4010", obs: "Mesmo CRM, instância da Operação A" }),
    c({ id: "s2", titulo: "CRM Operação B", aplicacao: "CRM Fluxo", cliente: "Operação B", categoria: "Interno", visibilidade: "Equipe", url: "https://crm.fluxo.example/opb", usuario: "suporte.opb", senha: "exemplo456", ciclo: "30", ultima: addDias(hoje(), -25), horario: "Seg–Sex 08–20", escalonamento: "N2 Sistemas ramal 4010", obs: "Mesmo CRM, instância da Operação B" }),
    c({ id: "s3", titulo: "Chamados Operação A", aplicacao: "Central de Chamados Delta", cliente: "Operação A", categoria: "Interno", visibilidade: "Equipe", url: "https://chamados.delta.example/opa", usuario: "analista.opa", senha: "teste123", ciclo: "60", ultima: addDias(hoje(), -65), escalonamento: "Coordenação Suporte" }),
    c({ id: "s4", titulo: "Chamados Operação B", aplicacao: "Central de Chamados Delta", cliente: "Operação B", categoria: "Interno", visibilidade: "Individual", url: "https://chamados.delta.example/opb", usuario: "meu.usuario", senha: "teste456", ciclo: "60", ultima: addDias(hoje(), -5), obs: "Login pessoal do analista" }),
    c({ id: "s5", titulo: "VPN Corporativa", aplicacao: "VPN Ponte Segura", cliente: "Interno", categoria: "Interno", visibilidade: "Individual", url: "https://vpn.pontesegura.example", usuario: "meu.usuario", senha: "exemplo789", ciclo: "90", ultima: addDias(hoje(), -20) }),
    c({ id: "s6", titulo: "Portal Fornecedor Alfa", aplicacao: "Alfa Suprimentos", cliente: "Alfa Suprimentos", categoria: "Externo", visibilidade: "Equipe", url: "https://portal.alfasuprimentos.example", usuario: "svc.alfa", senha: "fornecedor123", ciclo: "30", ultima: addDias(hoje(), -27), horario: "09–17", escalonamento: "Contato fictício: Carla (0800 000 0001)" }),
    c({ id: "s7", titulo: "Painel Nuvem Azul", aplicacao: "Nuvem Azul", cliente: "Nuvem Azul Tecnologia", categoria: "Externo", visibilidade: "Equipe", url: "https://painel.nuvemazul.example", usuario: "ops.nuvem", senha: "nuvem123", ciclo: "Nunca", ultima: addDias(hoje(), -120), horario: "Seg–Sex 08–18", escalonamento: "N1 0800 000 0002" }),
    c({ id: "s8", titulo: "Gestor Ponto Certo", aplicacao: "Ponto Certo", cliente: "Ponto Certo Sistemas", categoria: "Externo", visibilidade: "Individual", url: "https://app.pontocerto.example", usuario: "meu.usuario", senha: "ponto123", ciclo: "90", ultima: addDias(hoje(), -95) }),
    c({ id: "s9", titulo: "Telefonia Sinal Verde", aplicacao: "Sinal Verde Telecom", cliente: "Sinal Verde Telecom", categoria: "Externo", visibilidade: "Equipe", url: "https://admin.sinalverde.example", usuario: "suporte.sv", senha: "exemplo321", ciclo: "60", ultima: addDias(hoje(), -30), horario: "24x7", escalonamento: "NOC fictício 0800 000 0003" }),
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
  if (!itens.length || removeuAntigos) {
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
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
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
    const blob = [it.titulo, it.aplicacao, it.cliente, it.usuario, it.url, it.categoria, it.visibilidade].join(" ").toLowerCase();
    return !q || blob.indexOf(q) >= 0;
  }).sort((a, b) => (a.aplicacao || a.titulo || "").localeCompare(b.aplicacao || b.titulo || "") || (a.cliente || "").localeCompare(b.cliente || "") || (a.titulo || "").localeCompare(b.titulo || ""));
}
function render() {
  const box = document.getElementById("lista");
  box.innerHTML = "";
  fecharMenus();
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
  if (it.arquivado_em) m.appendChild(btn("mi ok", "restore", "Reativar", () => { it.arquivado_em = null; save(); toast("Card reativado"); }));
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
  bloco("Compartilhar com a equipe", "Gera o JSON para os outros analistas. Cards Individuais vão sem usuário e sem senha (só título, aplicação, cliente, URL etc.).",
    [btn("btn pri", "download", "Exportar JSON", exportarEquipe)]);
  bloco("Backup pessoal (inclui minhas senhas)", "Arquivo completo, com os usuários e senhas dos seus acessos Individuais. Use só para levar para outro aparelho seu. Não compartilhe.",
    [btn("btn", "lock", "Backup pessoal (inclui minhas senhas)", backupPessoal)]);
  bloco("Importar", "Junta os cards do arquivo com os deste aparelho (pelo id). Cards que só existem aqui continuam. Usuário e senha que você já tem não são apagados por um arquivo que veio sem eles.",
    [btn("btn", "upload", "Importar JSON", () => document.getElementById("imp").click())]);
  bloco("Planilha", "Excel separado em Fornecedores externos e Ferramentas internas. Usuário e senha dos acessos Individuais não entram.",
    [btn("btn", "table", "Excel Interno/Externo", exportarExcel)]);
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
    const i = itens.findIndex((x) => x.id === inc.id);
    if (i < 0) { itens.push(inc); novos++; return; }
    const atual = itens[i];
    const junto = Object.assign({}, atual, inc);
    ["usuario", "senha"].forEach((k) => { if (!inc[k] && atual[k]) junto[k] = atual[k]; });
    itens[i] = junto;
    atualizados++;
  });
  return { novos: novos, atualizados: atualizados };
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
      alert("Importado: " + res.novos + " novo(s), " + res.atualizados + " atualizado(s). Total: " + itens.length + " card(s).");
    } catch (e) {
      alert("Arquivo inválido: não é um JSON do Caderno.");
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
      const vals = [it.titulo, it.aplicacao, it.cliente, it.categoria, it.visibilidade, it.url, ind ? "(individual)" : it.usuario, ind ? "(individual)" : it.senha, it.ciclo, it.ultima, it.horario, it.escalonamento, it.obs, it.arquivado_em || ""];
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
  $("fOlho").innerHTML = svg("eye", 20);
  $("fCiclo").value = ["30", "60", "90", "Nunca"].includes(String(edit.ciclo)) ? String(edit.ciclo) : "90";
  $("fUltima").value = edit.ultima || "";
  $("fHorario").value = edit.horario || "";
  $("fEscalonamento").value = edit.escalonamento || "";
  $("fObs").value = edit.obs || "";
  $("erroForm").textContent = "";
  $("avisoInd").hidden = $("fVisibilidade").value !== "Individual";
  abrirSheet("sheet");
  setTimeout(() => $("fTitulo").focus(), 50);
}
$("fVisibilidade").addEventListener("change", () => { $("avisoInd").hidden = $("fVisibilidade").value !== "Individual"; });
$("fOlho").addEventListener("click", () => {
  const ver = $("fSenha").type === "password";
  $("fSenha").type = ver ? "text" : "password";
  $("fOlho").innerHTML = svg(ver ? "eyeOff" : "eye", 20);
  $("fOlho").setAttribute("aria-label", ver ? "Ocultar senha" : "Mostrar senha");
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
    obs: $("fObs").value.trim()
  });
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
document.querySelectorAll(".sheet, .drawer").forEach((s) => s.addEventListener("click", (ev) => { if (ev.target === s) fecharSheet(s.id); }));
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { document.querySelectorAll(".sheet.on, .drawer.on").forEach((s) => fecharSheet(s.id)); fecharMenus(); } });
$("btnMenu").addEventListener("click", () => abrirSheet("drawer"));
$("btnInfo").addEventListener("click", () => abrirSheet("sobre"));
const ACOES = { novo: () => abrirFicha(null), exportar: exportarEquipe, backup: backupPessoal, importar: () => $("imp").click(), excel: exportarExcel, sair: sair };
document.querySelectorAll(".dr-item").forEach((b) => b.addEventListener("click", () => { fecharSheet("drawer"); ACOES[b.dataset.acao](); }));
$("dNovo").addEventListener("click", () => abrirFicha(null));
$("dExport").addEventListener("click", exportarEquipe);
$("dImport").addEventListener("click", () => $("imp").click());
$("dExcel").addEventListener("click", exportarExcel);
$("imp").addEventListener("change", importarJson);
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
aplicarIcones();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
}
// Tela de login: senha padrão fixa. Só o hash PBKDF2-SHA256 fica no código.
const LOGIN = { iter: 310000, salt: "015d5ac2a5ab08fdac13e98dd8b789fc", hash: "033d6adcf778bd29c7199d684d705ecebbd10bb47d86ecd732a0d225ffa2e9b8" };
const SESSAO = "caderno-acessos-sessao";
function hexParaBytes(h) { const b = new Uint8Array(h.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }
async function conferirSenha(senha) {
  if (!(window.crypto && crypto.subtle)) throw new Error("sem-crypto");
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexParaBytes(LOGIN.salt), iterations: LOGIN.iter }, chave, 256);
  const hex = Array.from(new Uint8Array(bits)).map((x) => x.toString(16).padStart(2, "0")).join("");
  let dif = hex.length ^ LOGIN.hash.length;
  for (let i = 0; i < hex.length; i++) dif |= hex.charCodeAt(i) ^ LOGIN.hash.charCodeAt(i);
  return dif === 0;
}
function entrar() {
  document.body.classList.remove("travado");
  load();
  render();
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
      sessionStorage.setItem(SESSAO, LOGIN.hash.slice(0, 16));
      inp.value = "";
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
if (sessionStorage.getItem(SESSAO) === LOGIN.hash.slice(0, 16)) entrar();
else document.getElementById("loginSenha").focus();
