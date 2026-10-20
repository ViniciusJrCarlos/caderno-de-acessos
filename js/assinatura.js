/* Caderno de Acessos — js/assinatura.js (v2.3.0)
 * Assinatura das ações de admin nos cards da Equipe (ECDSA P-256, WebCrypto). Cada admin tem um par de chaves: a pública fica no
 * perfil (dentro do arquivo cifrado) e a privada também, mas cifrada com uma chave derivada da senha de admin (PBKDF2 + AES-GCM).
 * Ao entrar como admin, a privada é aberta só em memória e assina: mudança de card, exclusão (tombstone) e ação na Lixeira.
 * Na sincronização, só vale como admin o que tem assinatura válida de um perfil admin ativo; o nome sozinho não dá permissão.
 * A chave pública de cada admin é fixada neste aparelho na primeira vez que é vista (quem trocar a chave no arquivo não é aceito).
 * Limites: ver docs/ARQUITETURA.md ("Assinatura do admin").
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const CHAVES_PIN_KEY = "caderno-perfis-chaves";       // { perfilId: chave pública } fixada na primeira vez (TOFU)
const ASSINAR_PEND_KEY = "caderno-assinar-pendentes"; // ações feitas no modo admin que ainda não foram assinadas ("c:id", "t:id", "l:id")
const ALG_ASSIN = { name: "ECDSA", namedCurve: "P-256" }, HASH_ASSIN = { name: "ECDSA", hash: "SHA-256" };
let chaveAdmin = null;            // { pid, priv } só em memória (some ao recarregar a página)
const cachePub = new Map();
function bufB64(buf) { let s = ""; new Uint8Array(buf).forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); }
function b64Buf(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function bufB64url(buf) { return bufB64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64urlBuf(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return b64Buf(s); }
function pinsChaves() { return lerJSON(CHAVES_PIN_KEY, {}); }
/* Fixa a chave pública dos admins que ainda não estão fixados. Devolve a lista com a chave fixada no lugar da do arquivo. */
function fixarChaves(l) {
  const pins = pinsChaves(); let mudou = false;
  (l || []).forEach((p) => {
    if (p && p.papel === "admin" && p.chavePub && !pins[p.id]) { pins[p.id] = p.chavePub; mudou = true; }
    else if (p && p.papel !== "admin" && pins[p.id]) { delete pins[p.id]; mudou = true; } // admin retirado: se voltar a ser admin, vem com chave nova
  });
  if (mudou) localStorage.setItem(CHAVES_PIN_KEY, JSON.stringify(pins));
  return pins;
}
async function chaveEmbrulho(senha, saltHex) {
  const hex = await derivarSenha(senha, saltHex, PERFIS_ITER);
  return crypto.subtle.importKey("raw", hexParaBytes(hex), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function embrulharPriv(pk8, senha) {
  const salt = saltAleatorio(), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, await chaveEmbrulho(senha, salt), pk8);
  return { chavePriv: bufB64(iv) + "." + bufB64(ct), chaveSalt: salt };
}
/* Novo par de chaves para um admin; a privada sai cifrada com a senha (de admin ou temporária). */
async function gerarChavesAdmin(senha) {
  const kp = await crypto.subtle.generateKey(ALG_ASSIN, true, ["sign", "verify"]);
  const pub = bufB64url(await crypto.subtle.exportKey("raw", kp.publicKey));
  const pk8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  return Object.assign({ chavePub: pub }, await embrulharPriv(pk8, senha));
}
/* Abre a privada com a senha. Devolve { priv, pk8 } ou null. */
async function abrirPriv(p, senha) {
  if (!p || !p.chavePriv || !p.chaveSalt) return null;
  try {
    const [iv, ct] = p.chavePriv.split(".");
    const pk8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64Buf(iv) }, await chaveEmbrulho(senha, p.chaveSalt), b64Buf(ct));
    const priv = await crypto.subtle.importKey("pkcs8", pk8, ALG_ASSIN, false, ["sign"]);
    return { priv: priv, pk8: pk8 };
  } catch (e) { return null; }
}
/* Chamado no "Entrar como admin" (senha já conferida). Abre a chave do perfil; sem chave (admin vindo da v2.2.0), cria uma.
 * novaSenha: a privada é cifrada de novo com a senha nova (a chave pública não muda). Devolve os campos a gravar no perfil (ou null). */
async function prepararChaveAdmin(p, senha, novaSenha) {
  const pins = pinsChaves();
  let aberto = await abrirPriv(p, senha), campos = null;
  if (aberto && pins[p.id] && pins[p.id] !== p.chavePub) aberto = null; // chave trocada no arquivo: não usa
  if (!aberto) {
    if (pins[p.id] && p.chavePub && pins[p.id] !== p.chavePub) return { erro: "A chave de admin deste perfil no arquivo não confere com a que este aparelho conhece." };
    if (pins[p.id] && !p.chavePriv) return { erro: "A chave de admin deste perfil ainda não chegou neste aparelho. Sincronize e tente de novo." };
    campos = await gerarChavesAdmin(novaSenha || senha);
    aberto = await abrirPriv(Object.assign({}, p, campos), novaSenha || senha);
    const pn = pinsChaves(); pn[p.id] = campos.chavePub; localStorage.setItem(CHAVES_PIN_KEY, JSON.stringify(pn));
  } else if (novaSenha) campos = await embrulharPriv(aberto.pk8, novaSenha);
  chaveAdmin = aberto ? { pid: p.id, priv: aberto.priv } : null;
  return { campos: campos };
}
function msgCard(c) { const n = (window.CadernoSync && CadernoSync.normalizarCard(c)) || c; return "c|" + c.id + "|" + (c.updatedAt || "") + "|" + CadernoSync.semMeta(n); }
function msgTomb(t) { return "t|" + t.id + "|" + (t.origAt || t.deletedAt || ""); }
function msgLix(t) { return "l|" + t.id + "|" + (t.em || ""); }
async function assinar(msg) {
  const sig = await crypto.subtle.sign(HASH_ASSIN, chaveAdmin.priv, new TextEncoder().encode(msg));
  return chaveAdmin.pid + ":" + bufB64(sig);
}
async function pubDe(txt) {
  if (cachePub.has(txt)) return cachePub.get(txt);
  const k = await crypto.subtle.importKey("raw", b64urlBuf(txt), ALG_ASSIN, false, ["verify"]);
  cachePub.set(txt, k); return k;
}
/* Assinatura válida de um perfil admin ativo (com a chave fixada neste aparelho, se houver). */
async function verificarAssin(assin, msg, perfis) {
  try {
    const i = String(assin || "").lastIndexOf(":"); if (i <= 0) return false;
    const pid = assin.slice(0, i), sig = assin.slice(i + 1);
    const p = (perfis || []).find((x) => x.id === pid);
    if (!p || p.papel !== "admin" || !p.ativo) return false;
    const pub = pinsChaves()[pid] || p.chavePub; if (!pub) return false;
    return await crypto.subtle.verify(HASH_ASSIN, await pubDe(pub), b64Buf(sig), new TextEncoder().encode(msg));
  } catch (e) { return false; }
}
/* A ação remota vale como admin? Com assinatura: só se ela confere. Sem assinatura: só para admin legado (que ainda não tem chave,
 * isto é, nunca entrou como admin na v2.3.0); depois que o admin tem chave, o nome sozinho não vale mais. */
async function ehAdminRemoto(nome, assin, msg, perfis) {
  if (assin) return verificarAssin(assin, msg, perfis);
  const p = perfilPorNome(nome, perfis);
  return !!(p && p.ativo && p.papel === "admin" && !p.chavePub && !pinsChaves()[p.id]);
}
async function papelRemoto(nome, assin, msg, perfis) {
  if (await ehAdminRemoto(nome, assin, msg, perfis)) return "admin";
  const p = perfilPorNome(nome, perfis);
  return p && !p.ativo ? "leitura" : "analista";
}
function pendentesAssin() { return new Set(lerJSON(ASSINAR_PEND_KEY, [])); }
function marcarAssinar(k) { if (papelAtual() !== "admin") return; const s = pendentesAssin(); s.add(k); localStorage.setItem(ASSINAR_PEND_KEY, JSON.stringify([...s].slice(-2000))); }
/* Antes de cada sincronização: assina o que foi feito no modo admin (a chave fica em memória até fechar/recarregar a página). */
async function assinarPendentes() {
  const pend = pendentesAssin(); if (!pend.size || !chaveAdmin) return false;
  const eu = meuPerfil(); if (!eu || eu.id !== chaveAdmin.pid) return false;
  const quem = autor(); let mudou = false;
  for (const k of [...pend]) {
    const tipo = k.slice(0, 1), id = k.slice(2);
    if (tipo === "c") { const it = itens.find((x) => x.id === id && compartilhado(x)); if (it && it.updatedBy === quem) { it.assin = await assinar(msgCard(itemParaEquipe(it))); mudou = true; } }
    else if (tipo === "t") { const rem = removidosLocais(); const t = rem.find((x) => x.id === id); if (t && t.deletedBy === quem) { t.assin = await assinar(msgTomb(t)); localStorage.setItem(REMOVIDOS_KEY, JSON.stringify(rem)); } }
    else if (tipo === "l") {
      const o = lerJSON(LIX_EQ_KEY, {}); const rs = (o.removidos || []).filter((x) => x && x.id === id && x.por === quem);
      for (const t of rs) t.assin = await assinar(msgLix(t));
      if (rs.length) localStorage.setItem(LIX_EQ_KEY, JSON.stringify(o));
    }
    pend.delete(k);
  }
  localStorage.setItem(ASSINAR_PEND_KEY, JSON.stringify([...pend]));
  if (mudou) localStorage.setItem(KEY, JSON.stringify(itens));
  return mudou;
}
