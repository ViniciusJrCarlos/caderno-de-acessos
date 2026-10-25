/* Caderno de Acessos — js/ui.js
 * Interface comum: ícones SVG, el(), btn(), toast, dialogo(), aviso(), janela(), botaoDlg(), abrir/fechar sheets, temas, copiar e abrir links, cores.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Ícones SVG inline (funcionam offline) ---------- */
const IC = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  star: '<path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
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
    // v2.0.1: botões extras (ex.: trava "um link = um card"). Cada um resolve com o seu "valor"; a grade vira uma coluna.
    const linha = ok.parentElement; const extras = [];
    (op.extras || []).forEach((x) => { const b = el("button", "btn dlg-extra" + (x.cls ? " " + x.cls : ""), x.texto); b.type = "button"; b.onclick = () => fim(x.valor); linha.insertBefore(b, cancel); extras.push(b); });
    box.querySelector(".dlg").classList.toggle("dlg-mais", extras.length > 0 || !!op.coluna);
    function fim(v) {
      extras.forEach((b) => b.remove()); box.querySelector(".dlg").classList.remove("dlg-mais");
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
/* ---------- Temas ---------- */
const TEMAS = { marinho: { nome: "Marinho", cor: "#0A1424" }, claro: { nome: "Claro", cor: "#1B365D" }, escuro: { nome: "Escuro", cor: "#0B1626" }, suave: { nome: "Suave", cor: "#2C4766" } };
const TEMA_KEY = "caderno-tema";
function temaAtual() { const t = Dados.texto(TEMA_KEY); return TEMAS[t] ? t : "marinho"; }
function aplicarTema(t) {
  if (!TEMAS[t]) t = "marinho";
  document.documentElement.setAttribute("data-tema", t);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", TEMAS[t].cor);
  const dr = document.querySelector('.dr-item[data-acao="tema"] .dr-tema');
  if (dr) dr.textContent = TEMAS[t].nome;
}
function definirTema(t) {
  Dados.gravarTexto(TEMA_KEY, t);
  aplicarTema(t);
  if (emPainel()) render();
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
  return diasAte(it);
}
const CORES = ["#0F6B8A", "#1B5FAD", "#1B365D", "#5B4BB7", "#0E7C5A", "#B4530A", "#9D2B6B", "#2F6F73"];
function corDe(it) {
  const s = (it.aplicacao || it.titulo || "") + "|" + (it.categoria || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
}
const MASCARA = "••••••••••";
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
const $ = (id) => document.getElementById(id);
/* ---------- Sheets, menu, abas ---------- */
/* v1.9.7: o fundo escuro só fecha se o clique COMEÇOU e TERMINOU nele (arrastar a seleção de um campo para fora não fecha)
 * e não logo depois de voltar para a janela (clique de foco vindo do Bloco de Notas, por exemplo). */
let fundoDown = null, focoJanelaEm = 0;
function cliqueNoFundo(ev, fundo) { return ev.target === fundo && fundoDown === fundo && Date.now() - focoJanelaEm > 400; }
function abrirSheet(id) { $(id).classList.add("on"); $(id).setAttribute("aria-hidden", "false"); document.body.classList.add("sem-scroll"); }
function fecharSheet(id) { $(id).classList.remove("on"); $(id).setAttribute("aria-hidden", "true"); if (!document.querySelector(".sheet.on, .drawer.on")) { document.body.classList.remove("sem-scroll"); renderSePendente(); } }

/* v2.5.1 (item 8): no celular, a mensagem de erro (role="alert" / .erro-form / #loginErro) fica visível acima do teclado virtual.
 * Quando um erro aparece, rola até ele; com o teclado aberto (visualViewport menor que a janela), ajusta para que fique dentro da área visível. */
function mostrarErroVisivel(n) {
  if (!n || !n.textContent || !n.textContent.trim()) return;
  if (!(window.matchMedia && matchMedia("(max-width: 999px), (pointer: coarse)").matches)) return;
  const ajustar = () => {
    try { n.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {}
    const vv = window.visualViewport; if (!vv) return;
    const r = n.getBoundingClientRect(), base = vv.offsetTop + vv.height - 8, topo = vv.offsetTop + 8;
    const sc = n.closest(".dlg-box, .dlg, .sheet, .login, .dlg-wrap") || null;
    const delta = r.bottom > base ? r.bottom - base : r.top < topo ? r.top - topo : 0;
    if (!delta) return;
    if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop += delta; else window.scrollBy(0, delta);
  };
  ajustar(); setTimeout(ajustar, 320); // de novo depois que o teclado termina de abrir
}
(function vigiarErros() {
  if (typeof MutationObserver !== "function") return;
  const ehErro = (x) => x && x.nodeType === 1 && (x.matches('[role="alert"], .erro-form, #loginErro'));
  const mo = new MutationObserver((ms) => {
    const vistos = new Set();
    ms.forEach((m) => { let t = m.target.nodeType === 3 ? m.target.parentNode : m.target; while (t && !ehErro(t) && t !== document.body) t = t.parentNode; if (ehErro(t)) vistos.add(t); });
    vistos.forEach(mostrarErroVisivel);
  });
  const ligar = () => mo.observe(document.body, { childList: true, characterData: true, subtree: true });
  if (document.body) ligar(); else document.addEventListener("DOMContentLoaded", ligar);
  if (window.visualViewport) visualViewport.addEventListener("resize", () => { const a = document.activeElement; const box = a && a.closest && a.closest("form, .dlg-padrao, .login-box"); const er = box && box.querySelector('[role="alert"], .erro-form'); if (er) mostrarErroVisivel(er); });
})();
