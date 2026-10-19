/* Caderno de Acessos — js/instalar.js
 * Aviso para instalar/salvar o app (PWA).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
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
