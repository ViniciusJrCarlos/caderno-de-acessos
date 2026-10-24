/* Caderno de Acessos — js/instalar.js (v2.5.0: duas telas, “Instalar” e “Ver passo a passo”)
 * Detecta o aparelho e o navegador (Android: Chrome, Edge, Samsung Internet; PC: Edge, Chrome; iPhone/iPad: Safari, com aviso
 * quando aberto em outro navegador). Botão principal: "Instalar agora" quando o navegador oferece a instalação (beforeinstallprompt),
 * senão "Ver como instalar", com o passo a passo do aparelho atual primeiro e o selo "este aparelho".
 * "Agora não" só adia (7 dias) e diz onde reabrir; aberto pelo app instalado, mostra "já instalado".
 * Visual: o diálogo padrão (.dlg-senha), como a tela "Crie sua senha".
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const INSTALL_HINT_KEY = "caderno-acessos-install-hint-v1"; // até a v2.3.0: "Entendi" escondia o aviso de vez (continua respeitado)
const INSTALL_ADIADO_KEY = "caderno-instalar-adiado-ate";   // v2.4.0: "Agora não" adia por alguns dias
const INSTALL_ADIAR_DIAS = 7;
let deferredInstall = null;
let instalarDetalhe = false;
function appJaInstalado() {
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia && window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
  } catch (e) {}
  return false;
}
/* { so: "android" | "ios" | "pc", nav: "chrome" | "edge" | "samsung" | "safari" | "firefox" | "outro" } */
function detectarAparelho(ua, toque) {
  ua = String(ua == null ? (navigator.userAgent || "") : ua);
  if (toque == null) toque = (navigator.maxTouchPoints || 0) > 0;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && toque);
  const android = !ios && /Android/i.test(ua);
  const so = ios ? "ios" : android ? "android" : "pc";
  let nav = "outro";
  if (/SamsungBrowser/i.test(ua)) nav = "samsung";
  else if (/EdgA\/|EdgiOS\/|Edg\//i.test(ua)) nav = "edge";
  else if (/Firefox\/|FxiOS\//i.test(ua)) nav = "firefox";
  else if (/CriOS\//i.test(ua)) nav = "chrome";
  else if (/OPR\/|Opera/i.test(ua)) nav = "outro";
  else if (/Chrome\//i.test(ua)) nav = "chrome";
  else if (/Safari\//i.test(ua) && ios) nav = "safari";
  return { so: so, nav: nav, ipad: /iPad/i.test(ua) || (/Macintosh/i.test(ua) && toque) };
}
const NOMES_SO = { android: "Android", ios: "iPhone/iPad", pc: "Computador" };
const NOMES_NAV = { chrome: "Chrome", edge: "Edge", samsung: "Samsung Internet", safari: "Safari", firefox: "Firefox", outro: "outro navegador" };
const PASSOS_INSTALAR = [
  { so: "android", nav: "chrome", titulo: "Android · Chrome", passos: ["Toque no menu ⋮ (canto de cima, à direita).", "Toque em “Instalar app” (ou “Adicionar à tela inicial”).", "Confirme em “Instalar”. O ícone do Caderno aparece na tela inicial."] },
  { so: "android", nav: "edge", titulo: "Android · Edge", passos: ["Toque no menu ≡ (barra de baixo, à direita).", "Toque em “Adicionar ao telefone”.", "Confirme em “Instalar”. O ícone do Caderno aparece na tela inicial."] },
  { so: "android", nav: "samsung", titulo: "Android · Samsung Internet", passos: ["Toque no menu ☰ (barra de baixo, à direita).", "Toque em “Adicionar página a” › “Tela inicial” (ou no ícone de instalar na barra de endereço).", "Confirme em “Adicionar”."] },
  { so: "pc", nav: "edge", titulo: "Computador · Edge", passos: ["Clique no menu ··· (canto de cima, à direita).", "Vá em “Aplicativos” › “Instalar este site como um aplicativo” (ou clique no ícone de instalar na barra de endereço).", "Confirme em “Instalar”. O Caderno abre numa janela própria e fica no menu Iniciar."] },
  { so: "pc", nav: "chrome", titulo: "Computador · Chrome", passos: ["Clique no ícone de instalar na barra de endereço (monitor com seta) ou no menu ⋮ › “Transmitir, salvar e compartilhar” › “Instalar página como app”.", "Confirme em “Instalar”. O Caderno abre numa janela própria."] },
  { so: "ios", nav: "safari", titulo: "iPhone/iPad · Safari", passos: ["Toque em Compartilhar (o quadrado com a seta para cima).", "Role e toque em “Adicionar à Tela de Início”.", "Toque em “Adicionar”. O ícone do Caderno aparece na tela inicial."] }
];
/* Passos com o aparelho atual primeiro (e o navegador atual antes dos outros do mesmo aparelho). */
function passosOrdenados(d) {
  const peso = (p) => (p.so === d.so ? 0 : 2) + (p.so === d.so && p.nav === d.nav ? 0 : 1);
  return PASSOS_INSTALAR.map((p, i) => ({ p: p, i: i })).sort((a, b) => peso(a.p) - peso(b.p) || a.i - b.i).map((x) => Object.assign({ atual: x.p.so === d.so && (x.p.nav === d.nav || (d.so === "ios")) }, x.p));
}
function installHintVisto() {
  try {
    if (Dados.texto(INSTALL_HINT_KEY) === "1") return true;
    const ate = Number(Dados.texto(INSTALL_ADIADO_KEY) || 0);
    return ate > Date.now();
  } catch (e) { return false; }
}
function marcarInstallHint() { try { Dados.gravarTexto(INSTALL_HINT_KEY, "1"); } catch (e) {} }
function adiarInstalar() { try { Dados.gravarTexto(INSTALL_ADIADO_KEY, String(Date.now() + INSTALL_ADIAR_DIAS * 864e5)); } catch (e) {} }
function atualizarLinkInstalar() {
  const wrap = document.getElementById("loginInstalarWrap");
  if (!wrap) return;
  wrap.hidden = appJaInstalado();
}
function mostrarTelaInstalar(n) { instalarDetalhe = n === 2; desenharInstalar(); setTimeout(() => { const b = document.getElementById("instPrincipal"); if (b) b.focus(); const g = document.querySelector(".inst-passos__grupo--atual"); if (g && g.scrollIntoView && n === 2) g.scrollIntoView({ block: "nearest" }); }, 30); }
/* v2.5.0: duas telas. Tela 1: "Agora não" / "Instalar" e o link "Ver passo a passo". Tela 2: passo a passo do Android, do
 * computador e do iPhone, com o aparelho atual primeiro e o selo "este aparelho"; botões Voltar / Entendi. */
const GRUPOS_INSTALAR = [["android", "Android"], ["pc", "Computador"], ["ios", "iPhone/iPad"]];
function desenharInstalar() {
  const box = document.getElementById("instCaixa"); if (!box) return;
  box.textContent = "";
  const d = detectarAparelho();
  const h = el("h3", "", ""); h.id = "instTitulo"; box.appendChild(h);
  box.dataset.so = d.so; box.dataset.nav = d.nav; box.dataset.tela = instalarDetalhe ? "2" : "1";
  if (appJaInstalado()) {
    h.textContent = "O Caderno já está instalado";
    box.appendChild(el("p", "dlg-padrao__texto inst-instalado", "Você está usando o app instalado neste aparelho. Ele abre pelo ícone e funciona sem internet."));
    const bb = el("div", "dlg-botoes"); const ok = botaoDlg("pri", "OK", () => fecharInstalar(false)); ok.id = "instOk"; ok.classList.add("dlg-padrao__unico"); bb.appendChild(ok); box.appendChild(bb);
    return;
  }
  const bb = el("div", "dlg-botoes");
  if (!instalarDetalhe) {
    h.textContent = "Instalar o Caderno de Acessos";
    box.appendChild(el("p", "dlg-padrao__texto", d.so === "ios"
      ? "No iPhone/iPad: no Safari, toque em Compartilhar (quadrado com a seta para cima) e depois em “Adicionar à Tela de Início”."
      : "Com um toque o Caderno vai para a tela inicial ou para a área de trabalho e funciona mesmo sem internet."));
    const det = el("p", "hint inst-detectado"); det.id = "instDetectado";
    det.textContent = "Este aparelho: " + NOMES_SO[d.so] + (d.ipad ? " (iPad)" : "") + " · " + NOMES_NAV[d.nav] + ".";
    box.appendChild(det);
    if (d.so === "ios" && d.nav !== "safari") { const a = el("p", "aviso-forte inst-aviso-ios", "Você está em outro navegador. No iPhone/iPad só dá para instalar pelo Safari: copie o link e abra no Safari."); a.id = "instAvisoIos"; box.appendChild(a); }
    else if (d.nav === "firefox" || d.nav === "outro") box.appendChild(el("p", "aviso-forte inst-aviso-nav", "Este navegador pode não instalar o app. Se não aparecer a opção, abra no " + (d.so === "pc" ? "Edge ou no Chrome" : "Chrome, no Edge ou no Samsung Internet") + "."));
    const nao = botaoDlg("", "Agora não", () => { adiarInstalar(); fecharInstalar(false); toast("Tudo bem. Para instalar depois: “Instalar app” na tela de entrada ou no menu da sua conta."); }); nao.id = "instAgoraNao";
    const pri = botaoDlg("pri", "Instalar", async () => {
      if (d.so === "ios" || !deferredInstall) { mostrarTelaInstalar(2); return; } // sem instalação de um toque: passo a passo
      const r = await tentarPromptInstalar();
      if (r === "accepted") { marcarInstallHint(); fecharInstalar(false); toast("Caderno instalado"); } else mostrarTelaInstalar(2);
    });
    pri.id = "instPrincipal";
    bb.appendChild(nao); bb.appendChild(pri); box.appendChild(bb);
    const lk = el("p", "inst-link"); const a = el("button", "link-discreto", "Ver passo a passo"); a.type = "button"; a.id = "instVerPassos"; a.addEventListener("click", () => mostrarTelaInstalar(2)); lk.appendChild(a); box.appendChild(lk);
    return;
  }
  h.textContent = "Como instalar";
  const lista = el("div", "inst-passos"); lista.id = "instPassos";
  const grupos = GRUPOS_INSTALAR.slice().sort((a, b) => (a[0] === d.so ? 0 : 1) - (b[0] === d.so ? 0 : 1));
  grupos.forEach(([so, nome]) => {
    const g = el("section", "inst-passos__grupo inst-bloco" + (so === d.so ? " inst-passos__grupo--atual atual" : "")); g.dataset.so = so; g.dataset.aparelho = so;
    const t = el("p", "inst-passos__titulo"); t.appendChild(el("strong", "", nome));
    if (so === d.so) t.appendChild(el("span", "inst-passos__selo", "este aparelho"));
    g.appendChild(t);
    const vars = PASSOS_INSTALAR.filter((p) => p.so === so).sort((a, b) => (a.nav === d.nav ? 0 : 1) - (b.nav === d.nav ? 0 : 1));
    vars.forEach((p) => {
      const sub = el("div", "inst-var" + (so === d.so && p.nav === d.nav ? " inst-var--atual" : "")); sub.dataset.nav = p.nav;
      sub.appendChild(el("p", "inst-var__tit", NOMES_NAV[p.nav]));
      const ol = el("ol", "inst-passos__lista"); p.passos.forEach((x) => ol.appendChild(el("li", "", x))); sub.appendChild(ol);
      g.appendChild(sub);
    });
    lista.appendChild(g);
  });
  box.appendChild(lista);
  const volta = botaoDlg("", "Voltar", () => mostrarTelaInstalar(1)); volta.id = "instVoltar";
  const ok = botaoDlg("pri", "Entendi", () => { adiarInstalar(); fecharInstalar(false); }); ok.id = "instPrincipal";
  bb.appendChild(volta); bb.appendChild(ok); box.appendChild(bb);
}
async function tentarPromptInstalar() {
  if (!deferredInstall) return "";
  const ev = deferredInstall;
  deferredInstall = null;
  let r = "";
  try { await ev.prompt(); const c = await ev.userChoice; r = c && c.outcome || ""; } catch (e) {}
  atualizarLinkInstalar();
  return r;
}
function fecharInstalar(marcar) {
  if (marcar) marcarInstallHint();
  fecharSheet("dlgInstalar");
  instalarDetalhe = false;
  atualizarLinkInstalar();
  if (!document.body.classList.contains("travado")) setTimeout(mostrarNovidadesSePendente, 300);
}
function abrirInstalar(forcar) {
  if (!forcar && (appJaInstalado() || installHintVisto())) { atualizarLinkInstalar(); return; }
  instalarDetalhe = false;
  desenharInstalar();
  abrirSheet("dlgInstalar");
  setTimeout(() => { const b = document.getElementById("instPrincipal") || document.getElementById("instOk"); if (b) b.focus(); }, 30);
}
/* Ligação (chamada pelo js/app.js). */
function ligarInstalar() {
  const dlg = document.getElementById("dlgInstalar");
  const btnFooter = document.getElementById("btnInstalarApp");
  if (!dlg) return;
  if (btnFooter) btnFooter.addEventListener("click", () => abrirInstalar(true));
  dlg.addEventListener("click", (ev) => { if (cliqueNoFundo(ev, dlg)) fecharInstalar(false); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && dlg.classList.contains("on")) { ev.stopPropagation(); fecharInstalar(false); }
  }, true);
  atualizarLinkInstalar();
  if (!appJaInstalado() && !installHintVisto()) setTimeout(() => abrirInstalar(false), 400);
}
