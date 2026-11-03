/* Caderno de Acessos — js/relatorios/base.js (v3.1.0)
 * Aba Relatórios (só do Administrador). Cada relatório é um bloco registrado com relRegistrar({ id, titulo, desc, aberto, render(ctx, corpo) }).
 * Para tirar um relatório, é só remover o relRegistrar dele (principais.js / extras.js). Tudo é recalculado a cada render() da aba,
 * a partir dos dados do próprio app (itens, perfis, modelos de envio, Log). Nunca mostra usuário nem senha. Sem biblioteca externa:
 * só HTML, CSS e SVG (funciona offline). Script clássico (escopo global), carregado em ordem pelo index.html. */
const RELATORIOS = [];
const relEstado = { abertos: {}, resumo: "", filtroSenhas: "todos" };
function relRegistrar(r) { if (!RELATORIOS.some((x) => x.id === r.id)) RELATORIOS.push(r); }
function relEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function relApp(c) { return String(c.aplicacao || c.titulo || "").trim() || "Sem aplicação"; }
function relOp(c) { return String(c.cliente || "").trim() || "Sem operação"; }
function relData(iso) { const s = String(iso || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("/") : "—"; }
function relVence(c) { const f = c.ultima && c.ciclo && c.ciclo !== "Nunca" ? addDias(c.ultima, Number(c.ciclo)) : ""; return f; }
/* Faixas de vencimento: 0 Vencido, 1 ≤30, 2 ≤60, 3 ≤90, 4 >90, 5 Nunca, 6 Sem data (mesma conta de diasAte, armazenamento.js) */
const REL_FAIXAS = ["Vencido", "≤ 30 dias", "≤ 60 dias", "≤ 90 dias", "> 90 dias", "Nunca", "Sem data"];
function relFaixa(c) {
  if (!c.ciclo || c.ciclo === "Nunca") return 5;
  const d = diasAte(c); if (d == null) return 6;
  return d < 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4;
}
function relAgrupa(l, fn) { const m = new Map(); l.forEach((x) => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; }
function relOrdena(m) { return Array.from(m).sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]), "pt-BR")); }
/* Ferramenta: "um" (1 operação), "unica" (mesma URL para todas) ou "op" (URL muda por operação) */
function relTipoUrl(l) {
  if (new Set(l.map((c) => normTxt(relOp(c)))).size <= 1) return "um";
  return new Set(l.map((c) => normUrl(c.url)).filter(Boolean)).size <= 1 ? "unica" : "op";
}
const REL_TIPO_TXT = { um: "1 operação", unica: "URL única", op: "URL por operação" };
function relContexto() {
  const base = itens.filter((c) => c && c.id !== "s12" && individualVisivel(c));
  const ativos = base.filter((c) => !c.arquivado_em);
  const internos = ativos.filter((c) => c.categoria !== "Externo"), externos = ativos.filter((c) => c.categoria === "Externo");
  const pessoas = lerPerfis().filter((p) => !p.excluido);
  let modelos = []; try { modelos = modelosAtivos(); } catch (e) {}
  return { base, ativos, internos, externos, pessoas, modelos, hist: lerHist(),
    ferr: relAgrupa(internos, (c) => normTxt(relApp(c))), forn: relAgrupa(externos, (c) => normTxt(relApp(c))) };
}
function relStatus(p) { try { return statusPessoa(p); } catch (e) { return p.ativo ? ["ativo", "Ativo"] : ["desativado", "Desativado"]; } }
/* ---------- Peças visuais ---------- */
function relBarras(linhas, cor, tip) { // linhas: [{ n, v, sub, tip }]
  const mx = Math.max(1, ...linhas.map((l) => l.v));
  if (!linhas.length) return '<p class="rel-vazio">Nada por aqui.</p>';
  return linhas.map((l) => '<div class="rel-bar"' + (l.tip ? ' data-tip="' + relEsc(l.tip) + '"' : "") + '><span class="rel-bar__n" title="' + relEsc(l.n) + '">' + relEsc(l.n) +
    (l.sub ? "<small>" + relEsc(l.sub) + "</small>" : "") + '</span><span class="rel-bar__t"><i data-st="width:' + (l.v / mx * 100).toFixed(1) + "%;background:" + (l.cor || cor || "var(--teal)") + '"></i></span><b>' + l.v + "</b></div>").join("");
}
function relTabela(cab, linhas, cls) {
  if (!linhas.length) return '<p class="rel-vazio">Nada por aqui.</p>';
  return '<div class="rel-tab-wrap"><table class="rel-tab ' + (cls || "") + '"><thead><tr>' + cab.map((c) => "<th>" + relEsc(c) + "</th>").join("") + "</tr></thead><tbody>" +
    linhas.map((l) => "<tr>" + l.map((c) => "<td>" + (c && c.html != null ? c.html : relEsc(c)) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
}
function relChip(t, cls) { return '<span class="rel-chip ' + (cls || "") + '">' + relEsc(t) + "</span>"; }
function relDonut(fatias, centro, rot) { // fatias: [{ t, v, cor, tip }]
  const tot = fatias.reduce((s, f) => s + f.v, 0) || 1, R = 60, C = 2 * Math.PI * R; let off = 0;
  const arcos = fatias.map((f) => { const fr = f.v / tot, s = '<circle r="60" cx="80" cy="80" fill="none" stroke="' + f.cor + '" stroke-width="24" stroke-dasharray="' + (fr * C).toFixed(2) + " " + C.toFixed(2) + '" stroke-dashoffset="' + (-off * C).toFixed(2) + '" transform="rotate(-90 80 80)" data-tip="' + relEsc(f.tip || f.t + ": " + f.v) + '"/>'; off += fr; return s; }).join("");
  return '<div class="rel-donut"><svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="' + relEsc(rot) + '"><circle r="60" cx="80" cy="80" fill="none" stroke="var(--line2)" stroke-width="24"/>' + arcos +
    '<text x="80" y="80" text-anchor="middle" class="rel-donut__n">' + centro + '</text><text x="80" y="100" text-anchor="middle" class="rel-donut__t">' + relEsc(rot) + "</text></svg><div>" +
    fatias.map((f) => '<div class="rel-leg-l" data-tip="' + relEsc(f.tip || "") + '"><i data-st="background:' + f.cor + '"></i><span>' + relEsc(f.t) + "</span><b>" + f.v + "</b></div>").join("") + "</div></div>";
}
/* ---------- Dica ao passar o mouse (ou tocar) ---------- */
function relDica(raiz) {
  let tip = document.getElementById("relTip");
  if (!tip) { tip = el("div", "rel-tip"); tip.id = "relTip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
  const some = () => { tip.style.display = "none"; };
  raiz.addEventListener("pointermove", (e) => {
    const a = e.target.closest && e.target.closest("[data-tip]"); if (!a || !a.dataset.tip) return some();
    tip.textContent = ""; a.dataset.tip.split("\n").forEach((l, i) => tip.appendChild(el(i ? "div" : "b", "", l)));
    tip.style.display = "block"; tip.style.left = Math.min(e.clientX + 14, innerWidth - 280) + "px"; tip.style.top = (e.clientY + 14) + "px";
  });
  raiz.addEventListener("pointerleave", some); window.addEventListener("scroll", some, { passive: true });
}
/* A CSP do app (style-src 'self') bloqueia style="" no HTML; os tamanhos e cores vêm em data-st e entram pelo CSSOM (permitido). */
function relEstilos(raiz) { (raiz.matches && raiz.matches("[data-st]") ? [raiz] : []).concat(Array.from(raiz.querySelectorAll ? raiz.querySelectorAll("[data-st]") : [])).forEach((n) => {
  String(n.dataset.st).split(";").forEach((d) => { const i = d.indexOf(":"); if (i > 0) n.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim()); }); n.removeAttribute("data-st"); }); }
/* ---------- A aba ---------- */
function renderRelatorios(box) {
  if (!podeAdminEquipe()) { box.appendChild(el("p", "vazio", DICA_ADMIN)); return; }
  const ctx = relContexto();
  const wrap = el("div", "rel"); box.appendChild(wrap);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) relEstilos(n); }))).observe(wrap, { childList: true, subtree: true });
  const cab = el("article", "card painel-mais rel-cab");
  cab.appendChild(el("h3", "", "Relatórios"));
  cab.appendChild(el("p", "meta", "Panorama dos cards, operações e perfis deste aparelho, atualizado sozinho. Clique num resumo para ver a lista; passe o mouse nos gráficos para ver detalhes. Nunca mostra usuário nem senha."));
  const bx = btn("btn", "download", "Extrair relatório", relAbrirExtrair); bx.classList.add("rel-extrair"); bx.id = "relExtrair"; cab.appendChild(bx); // v3.1.1
  wrap.appendChild(cab);
  try { relResumo(ctx, wrap); } catch (e) { console.error(e); }
  RELATORIOS.forEach((r) => {
    const d = el("details", "card painel-mais rel-bloco"); d.dataset.rel = r.id;
    d.open = relEstado.abertos[r.id] != null ? relEstado.abertos[r.id] : !!r.aberto;
    const s = el("summary", "rel-bloco__tit"); s.appendChild(el("span", "", r.titulo)); if (r.desc) s.appendChild(el("small", "", r.desc));
    d.appendChild(s);
    if (r.sobre) d.appendChild(el("p", "rel-sobre", r.sobre)); // v3.1.1: o que o relatório compara
    const corpo = el("div", "rel-bloco__corpo"); d.appendChild(corpo);
    const desenha = () => { corpo.textContent = ""; try { r.render(ctx, corpo); } catch (e) { console.error(e); corpo.appendChild(el("p", "rel-vazio", "Não foi possível montar este relatório.")); } };
    if (d.open) desenha();
    d.addEventListener("toggle", () => { relEstado.abertos[r.id] = d.open; if (d.open && !corpo.childNodes.length) desenha(); });
    wrap.appendChild(d);
  });
  relDica(wrap);
}
