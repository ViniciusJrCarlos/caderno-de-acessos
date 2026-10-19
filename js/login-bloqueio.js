/* Caderno de Acessos — js/login-bloqueio.js
 * Login local (senha do aparelho), troca obrigatória de senha, sessão e bloqueio automático por inatividade.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* v2.0.0 (item 6): bloquear NÃO recarrega a página: cobre a tela na hora (sem o "Sair do site?" do navegador), guarda o rascunho
 * da ficha em memória (o formulário continua como estava, escondido) e o devolve depois da senha. Nada do app fica visível travado
 * (body.travado esconde #app inteiro: lista, ficha, diálogos e avisos). Recarregar só acontece no "Sair" da troca de senha obrigatória,
 * quando ainda não há nenhum card aberto (nenhum rascunho a perder). Se um dia for preciso recarregar por segurança, o rascunho é
 * descartado sem perguntar (beforeunload é desligado antes). */
let travadoEmMemoria = false;
function bloquear(auto) {
  try { sessionStorage.removeItem(SESSAO); } catch (e) {}
  document.body.classList.add("travado");
  travadoEmMemoria = true;
  chaveLoginSessao = null;
  try { fecharMenus(); } catch (e) {}
  try { $("fSenha").type = "password"; setOlho($("fOlho"), false); } catch (e) {}
  try { document.querySelectorAll("#app .linha-val.aberto").forEach((n) => { n.classList.remove("aberto"); n.textContent = MASCARA; }); } catch (e) {}
  const er = $("loginErro");
  if (er) er.textContent = auto ? "Bloqueado por inatividade. Digite a senha para continuar" + (fichaSuja() ? " — o card que você estava editando continua aberto." : ".") : "";
  const inp = $("loginSenha"); if (inp) { inp.value = ""; setTimeout(() => { try { inp.focus(); } catch (e) {} }, 30); }
}
function sair() {
  if (trocaObrigatoria) { semAvisoAoSair = true; sessionStorage.removeItem("caderno-acessos-sessao"); location.reload(); return; }
  bloquear(false);
}
let semAvisoAoSair = false;
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
    bloquear(true);
  }
}
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
  if (travadoEmMemoria) {
    // v2.0.0: desbloqueio do bloqueio em memória: nada é recarregado; a ficha aberta (e o rascunho) volta como estava
    travadoEmMemoria = false;
    document.body.classList.remove("travado");
    $("loginErro").textContent = "";
    marcarAtividade(true);
    try { render(); } catch (e) {}
    if ($("sheet").classList.contains("on")) setTimeout(() => { try { ($("ficha").querySelector(":focus") || $("fTitulo")).focus(); } catch (e) {} }, 60);
    if (window.CadernoSync) sincronizar(false);
    return;
  }
  trocaObrigatoria = false;
  document.body.classList.remove("troca-obrig");
  document.body.classList.remove("travado");
  if (typeof marcarAtividade === "function") marcarAtividade(true);
  load();
  try { migrarHistorico(); } catch (e) {}
  try { adotarModelosOrfaos(); } catch (e) {}
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
