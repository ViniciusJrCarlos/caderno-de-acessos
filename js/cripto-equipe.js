/* Caderno de Acessos v1.9.5 — senha da equipe no arquivo caderno-equipe.json.
 * AES-GCM 256 (WebCrypto). Chave = PBKDF2-SHA256(senha da equipe, salt aleatório, 600.000 iterações).
 * O arquivo protegido guarda só: salt, iterações, um verificador (para detectar senha errada), iv e os dados cifrados.
 * A senha da equipe NUNCA vai para o arquivo. Versões antigas (tipo diferente, sem "itens") recusam o arquivo e não gravam nele.
 * No aparelho: a chave derivada fica no IndexedDB como CryptoKey NÃO exportável (não dá para copiar os bytes dela). */
(function (g) {
  "use strict";
  const TIPO_P = "caderno-equipe-protegido";
  const ITER = 600000;
  const VERIF = "caderno-equipe-ok";
  const te = new TextEncoder(), td = new TextDecoder();
  function b64(buf) { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function deB64(s) { const t = atob(s); const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; }
  function aleatorio(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  function ehProtegido(d) { return !!(d && d.tipo === TIPO_P && d.kdf && d.kdf.salt && d.dados); }
  function aad(salt) { return te.encode(TIPO_P + "|1|" + salt); }
  function erro(nome, msg) { const e = new Error(msg); e.name = nome; return e; }

  async function derivar(senha, saltB64, iter) {
    const base = await crypto.subtle.importKey("raw", te.encode(String(senha).normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: deB64(saltB64), iterations: iter || ITER }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function cifrar(chave, texto, salt) { const iv = aleatorio(12); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: aad(salt) }, chave, te.encode(texto)); return { iv: b64(iv), ct: b64(ct) }; }
  async function decifrar(chave, o, salt) { return td.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(o.iv), additionalData: aad(salt) }, chave, deB64(o.ct))); }

  /* Nova chave da equipe (ativar ou trocar). info: { por, em } (nomes e datas, nunca segredos). */
  async function novaChave(senha) { const salt = b64(aleatorio(16)); const chave = await derivar(senha, salt, ITER); const verif = await cifrar(chave, VERIF, salt); return { salt: salt, iter: ITER, chave: chave, verif: verif }; }
  /* Confere a senha digitada contra o cabeçalho do arquivo. Retorna a chave ou lança SenhaEquipeIncorreta. */
  async function abrirComSenha(env, senha) {
    const chave = await derivar(senha, env.kdf.salt, env.kdf.iter);
    if (!(await conferirChave(env, chave))) throw erro("SenhaEquipeIncorreta", "Senha da equipe incorreta.");
    return chave;
  }
  async function conferirChave(env, chave) { try { return (await decifrar(chave, env.verif, env.kdf.salt)) === VERIF; } catch (e) { return false; } }
  async function fechar(doc, k, info) {
    const d = await cifrar(k.chave, JSON.stringify(doc), k.salt);
    return { tipo: TIPO_P, versao: 1, aviso: "Arquivo da equipe protegido. Abra pelo Caderno de Acessos v1.9.5 ou mais novo e digite a senha da equipe.",
      kdf: { nome: "PBKDF2-SHA256", iter: k.iter, salt: k.salt }, verif: k.verif, cifra: "AES-GCM-256", iv: d.iv, dados: d.ct,
      senha_por: (info && info.por) || "", senha_em: (info && info.em) || "", senha_acao: (info && info.acao) || "", atualizado_em: new Date().toISOString() };
  }
  async function abrir(env, chave) {
    try { return JSON.parse(await decifrar(chave, { iv: env.iv, ct: env.dados }, env.kdf.salt)); }
    catch (e) { throw erro("SenhaEquipeIncorreta", "Não foi possível abrir o arquivo da equipe com esta senha."); }
  }

  /* ---------- Chaves guardadas neste aparelho (IndexedDB, CryptoKey não exportável) ---------- */
  const DB = "caderno-acessos-cripto", ST = "chaves";
  function idb(modo, fn) {
    return new Promise((ok, falha) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(ST);
      req.onerror = () => falha(req.error);
      req.onsuccess = () => { const tx = req.result.transaction(ST, modo); const r = fn(tx.objectStore(ST)); tx.oncomplete = () => { req.result.close(); ok(r && r.result); }; tx.onerror = () => falha(tx.error); };
    });
  }
  async function guardarChave(salt, reg) { await idb("readwrite", (s) => s.put(reg, salt)); }
  async function chaveGuardada(salt) { try { return (await idb("readonly", (s) => s.get(salt))) || null; } catch (e) { return null; } }
  async function limparChaves() { try { await idb("readwrite", (s) => s.clear()); } catch (e) {} }

  /* ---------- Cópia da senha da equipe para o "olho", cifrada pela senha de login deste aparelho ---------- */
  async function chaveDeLogin(senhaLogin, saltB64) { return derivar(senhaLogin, saltB64, 310000); }
  async function embrulhar(chaveLogin, salt, texto) { return cifrar(chaveLogin, texto, "login|" + salt); }
  async function desembrulhar(chaveLogin, salt, o) { return decifrar(chaveLogin, o, "login|" + salt); }

  /* Frase fácil de lembrar (ex.: cafe-azul-mesa-27) */
  const PALAVRAS = "abacate agua alto amigo amora anel areia azul banco barco bola bravo brisa cafe caju calmo campo canto carta casa cedro ceu chave chuva cinza claro cobre coral corda couro doce dourado escada estrela faca farol feliz ferro festa figo flor folha forte fruta fumaca gato gelo girafa grama janela jardim lago lapis leite leve limao livro lobo lua macio manga mapa mar mel mesa milho monte morango nave neve noite norte nuvem ostra ouro ovo palco papel pato pedra peixe pena pera piano pipa planta ponte porta praia prata quente raio rede rio roda rosa sal selo serra sino sol sorte suco taco teto tigre trem trigo tulipa uva vela verde vento vidro vinho zebra".split(" ");
  function rnd(n) { const lim = Math.floor(0x100000000 / n) * n; const a = new Uint32Array(1); do { crypto.getRandomValues(a); } while (a[0] >= lim); return a[0] % n; }
  function frase() { const p = []; for (let i = 0; i < 4; i++) p.push(PALAVRAS[rnd(PALAVRAS.length)]); return p.join("-") + "-" + (10 + rnd(90)); }
  /* Regra: mínimo 10 caracteres, não pode ser só números. Aviso (não bloqueia) se for fraca. */
  function avaliar(s) {
    s = String(s || "");
    if (s.length < 10) return { ok: false, msg: "Use pelo menos 10 caracteres. Dica: uma frase como “cafe-azul-mesa-27”." };
    if (/^[\d\s.\-\/]+$/.test(s)) return { ok: false, msg: "Não use só números ou datas: é fácil de adivinhar. Use uma frase com palavras." };
    const fraca = new Set(s.toLowerCase()).size < 6 || /^(.)\1+$/.test(s) || /(senha|password|123456|qwerty|caderno)/i.test(s);
    return { ok: true, aviso: fraca ? "Essa senha parece fácil de adivinhar. Prefira 3 ou 4 palavras e um número." : "" };
  }

  g.CadernoCripto = { TIPO_P: TIPO_P, ITER: ITER, ehProtegido: ehProtegido, novaChave: novaChave, abrirComSenha: abrirComSenha, conferirChave: conferirChave,
    fechar: fechar, abrir: abrir, guardarChave: guardarChave, chaveGuardada: chaveGuardada, limparChaves: limparChaves,
    chaveDeLogin: chaveDeLogin, embrulhar: embrulhar, desembrulhar: desembrulhar, frase: frase, avaliar: avaliar, b64: b64, aleatorio: aleatorio };
})(typeof window !== "undefined" ? window : globalThis);
