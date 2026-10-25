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
  if (mudou) Dados.gravarTexto(CHAVES_PIN_KEY, JSON.stringify(pins));
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
    if (pins[p.id] && p.chavePub && pins[p.id] !== p.chavePub) return { erro: "A chave de Administrador deste perfil no arquivo não confere com a que este aparelho conhece." };
    if (pins[p.id] && !p.chavePriv) return { erro: "A chave de Administrador deste perfil ainda não chegou neste aparelho. Sincronize e tente de novo." };
    campos = await gerarChavesAdmin(novaSenha || senha);
    aberto = await abrirPriv(Object.assign({}, p, campos), novaSenha || senha);
    const pn = pinsChaves(); pn[p.id] = campos.chavePub; Dados.gravarTexto(CHAVES_PIN_KEY, JSON.stringify(pn));
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
function marcarAssinar(k) { if (papelAtual() !== "admin") return; const s = pendentesAssin(); s.add(k); Dados.gravarTexto(ASSINAR_PEND_KEY, JSON.stringify([...s].slice(-2000))); }
/* Antes de cada sincronização: assina o que foi feito no modo admin (a chave fica em memória até fechar/recarregar a página). */
async function assinarPendentes() {
  const pend = pendentesAssin(); if (!pend.size || !chaveAdmin) return false;
  const eu = meuPerfil(); if (!eu || eu.id !== chaveAdmin.pid) return false;
  const quem = autor(); let mudou = false;
  for (const k of [...pend]) {
    const tipo = k.slice(0, 1), id = k.slice(2);
    if (tipo === "c") { const it = itens.find((x) => x.id === id && compartilhado(x)); if (it && it.updatedBy === quem) { it.assin = await assinar(msgCard(itemParaEquipe(it))); mudou = true; } }
    else if (tipo === "t") { const rem = removidosLocais(); const t = rem.find((x) => x.id === id); if (t && t.deletedBy === quem) { t.assin = await assinar(msgTomb(t)); Dados.gravarTexto(REMOVIDOS_KEY, JSON.stringify(rem)); } }
    else if (tipo === "l") {
      const o = lerJSON(LIX_EQ_KEY, {}); const rs = (o.removidos || []).filter((x) => x && x.id === id && x.por === quem);
      for (const t of rs) t.assin = await assinar(msgLix(t));
      if (rs.length) Dados.gravarTexto(LIX_EQ_KEY, JSON.stringify(o));
    }
    pend.delete(k);
  }
  Dados.gravarTexto(ASSINAR_PEND_KEY, JSON.stringify([...pend]));
  if (mudou) Dados.gravarTexto(KEY, JSON.stringify(itens));
  return mudou;
}
/* ---------- v2.4.0: perfis assinados pelo Administrador ----------
 * Toda mudança de perfil feita com a chave do Administrador aberta (Gestão, Entrar como administrador) leva "assinP" sobre os campos
 * que dão poder (nome, papel, ativo, bloqueado, senha pessoal, senha temporária, hash e chave de Administrador).
 * Na sincronização, uma mudança de perfil SEM assinatura válida de um Administrador que este aparelho já conhece é desfeita, a não ser
 * que seja uma das mudanças que a própria pessoa pode fazer: trocar a senha temporária pela sua (senhaTemp passa a falso) ou a conta
 * ficar bloqueada por 5 erros. Perfil novo sem assinatura também não entra. Aparelho sem perfis (primeira vez) aceita a lista (TOFU),
 * e Administradores ainda sem chave (vindos da v2.2.0) seguem a regra antiga até o primeiro "Entrar como administrador". */
function msgPerfil(p) {
  return "p|" + [p.id, p.updatedAt || "", p.nome || "", p.papel || "", p.ativo === false ? 0 : 1, p.bloqueado ? 1 : 0, p.senhaHash || "", p.senhaTemp ? 1 : 0, p.adminHash || "", p.chavePub || "", p.trocarSenha ? 1 : 0].join("|") + (p.matricula ? "|m:" + p.matricula : "") + (p.excluido ? "|x" : ""); // v2.5.0: matrícula e exclusão só entram quando existem (assinaturas antigas continuam valendo)
}
async function assinarPerfil(p) {
  delete p.assinP;
  if (!chaveAdmin) return false;
  try { p.assinP = await assinar(msgPerfil(p)); return true; } catch (e) { return false; }
}
const CAMPOS_PERFIL_PODER = ["nome", "papel", "ativo", "bloqueado", "senhaHash", "senhaSalt", "senhaIter", "senhaTemp", "adminHash", "adminSalt", "adminIter", "chavePub", "chavePriv", "chaveSalt", "trocarSenha", "matricula", "excluido"];
function difPerfil(a, b) { return CAMPOS_PERFIL_PODER.filter((k) => JSON.stringify(a[k] === undefined ? null : a[k]) !== JSON.stringify(b[k] === undefined ? null : b[k])); }
function mudancaPropria(a, b) {
  const d = difPerfil(a, b); if (!d.length) return true;
  const so = (lista) => d.every((k) => lista.indexOf(k) >= 0);
  if (a.senhaTemp && !b.senhaTemp && b.senhaHash && so(["senhaHash", "senhaSalt", "senhaIter", "senhaTemp"])) return true; // trocou a temporária
  if (!a.bloqueado && b.bloqueado && so(["bloqueado"])) return true;                                                            // 5 erros: bloqueou
  // Administrador legado (sem chave): cria a própria chave e troca a senha temporária no "Entrar como administrador"
  if (a.papel === "admin" && b.papel === "admin" && !a.chavePub && !pinsChaves()[a.id] && so(["chavePub", "chavePriv", "chaveSalt", "adminHash", "adminSalt", "adminIter", "trocarSenha"])) return true;
  return false;
}
/* cache: lista que este aparelho já aceitou; l: lista mesclada com o arquivo. Devolve { itens, desfeitos:[nomes] } */
async function filtrarPerfisRemoto(cache, l) {
  const out = { itens: l, desfeitos: [] };
  if (!cache || !cache.length || !adminsAtivos(cache).length) return out;
  const legado = !adminsAtivos(cache).some((p) => p.chavePub || pinsChaves()[p.id]);
  if (legado) return out;
  const ant = new Map(cache.map((p) => [p.id, p]));
  const res = [];
  for (const p of l) {
    const a = ant.get(p.id);
    // v2.5.1 (item 3): mudança só de presença (ultimoAcesso/ultimaSync/versao, fora de CAMPOS_PERFIL_PODER) entra sem assinatura
    if (a && (a.updatedAt === p.updatedAt || !difPerfil(a, p).length)) { res.push(p); continue; }
    const assinOk = p.assinP && await verificarAssin(p.assinP, msgPerfil(p), cache);
    if (assinOk) {
      const signer = p.assinP.slice(0, p.assinP.lastIndexOf(":"));
      if (p.papel === "admin" && p.chavePub && signer !== p.id) { const pn = pinsChaves(); pn[p.id] = p.chavePub; Dados.gravarTexto(CHAVES_PIN_KEY, JSON.stringify(pn)); } // reset/novo Administrador: a chave nova vale
      res.push(p); continue;
    }
    if (a && mudancaPropria(a, p)) { res.push(p); continue; }
    out.desfeitos.push(p.nome || p.id);
    if (a) {
      const v = Object.assign({}, a, { ultimoAcesso: p.ultimoAcesso, ultimaSync: p.ultimaSync, versao: p.versao });
      // no modo Administrador a versão certa volta mais nova e assinada, e corrige também o aparelho que mexeu
      if (chaveAdmin) { v.updatedAt = new Date().toISOString(); v.updatedBy = autor(); await assinarPerfil(v); }
      res.push(v);
    }
  }
  out.itens = res;
  return out;
}
