/* Caderno de Acessos — js/perfis.js (v2.2.0; v2.3.0: assinatura do admin, nome sem troca, só admin arquiva e compartilha)
 * Perfis Admin e Analista nos cards da EQUIPE: lista de perfis (coleção "perfis" no arquivo da equipe, cifrado), bootstrap
 * ("Configurar perfis"), modo admin (senha de admin POR ADMIN, PBKDF2, só o hash no arquivo cifrado), painel de perfis,
 * escolha do nome, regras de permissão na tela e na camada de dados (save, merge da sincronização e importação).
 * É uma proteção de tela, não um controle forte: quem edita o arquivo por fora ou usa um app antigo não é barrado.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const PERFIS_KEY = "caderno-perfis";            // cópia local da lista, SEM hashes (repõe o que um app antigo apagar do arquivo)
const PERFIS_COFRE_KEY = "caderno-perfis-cofre"; // cópia local COM os hashes de admin, cifrada com a senha da equipe
const PERFIL_ID_KEY = "caderno-perfil-id";      // qual perfil é este aparelho
const PERFIS_ANTIGOS_KEY = "caderno-perfis-antigos"; // quem gravou o arquivo com um app antigo (aviso para o admin)
const PERFIS_NO_ARQUIVO_KEY = "caderno-perfis-no-arquivo"; // v2.3.0: o arquivo da equipe tem perfis (até carregar, este aparelho é analista)
const ADMIN_CONF_KEY = "caderno-perfil-admin-confirmado"; // v2.3.0: perfil admin confirmado com a senha de admin neste aparelho
const PERFIS_ITER = 310000;                     // o mesmo padrão da senha de login
const DICA_ADMIN = "Só o admin pode alterar";
/* Campos do card da Equipe que o analista pode mudar. Observações e horário do card ficam só leitura (fácil de ajustar aqui). */
const CAMPOS_ANALISTA = ["escalonamentos", "escalonamento", "senha", "ultima", "senha_atualizada_em", "ciclo"];
const CAMPOS_META = new Set(["id", "updatedAt", "updatedBy", "baseAt", "assin"]);
let modoAdmin = false;          // só em memória: some no bloqueio, no logout e ao fechar/recarregar a página
let baseEquipe = null;          // foto dos cards da Equipe aceitos (para desfazer o que o analista não pode mudar)
let tentativasAdmin = 0, esperaAdminAte = 0;

function semHash(p) { const o = Object.assign({}, p); delete o.adminHash; delete o.adminSalt; delete o.adminIter; delete o.chavePriv; delete o.chaveSalt; return o; }
function lerPerfis() { return window.CadernoSync ? CadernoSync.limparPerfis(lerJSON(PERFIS_KEY, [])).map(semHash) : []; }
/* Grava a lista: a parte pública em texto e a completa (com hashes) só cifrada com a chave da equipe deste aparelho. */
async function gravarPerfis(l) {
  l = CadernoSync.limparPerfis(l);
  localStorage.setItem(PERFIS_KEY, JSON.stringify(l.map(semHash)));
  if (adminsAtivos(l).length) localStorage.setItem(PERFIS_NO_ARQUIVO_KEY, "1");
  if (typeof fixarChaves === "function") fixarChaves(l);
  try {
    const env = await fecharDocEquipe({ tipo: "caderno-perfis-cofre", versao: 1, perfis: l }, null);
    if (window.CadernoCripto && CadernoCripto.ehProtegido(env)) localStorage.setItem(PERFIS_COFRE_KEY, JSON.stringify(env));
  } catch (e) {}
}
async function lerCofrePerfis() {
  const env = lerJSON(PERFIS_COFRE_KEY, null);
  if (!env || !window.CadernoCripto || !CadernoCripto.ehProtegido(env)) return [];
  try { const d = await abrirDocEquipe(env, true); return CadernoSync.limparPerfis(d && d.perfis); } catch (e) { return []; }
}
/* Lista pública + hashes do cofre (o cofre é gravado junto com a lista). */
async function perfisCompletos() {
  const cofre = new Map((await lerCofrePerfis()).map((p) => [p.id, p]));
  return lerPerfis().map((p) => { const c = cofre.get(p.id); return c && p.papel === "admin" && c.adminHash ? Object.assign({}, p, { adminHash: c.adminHash, adminSalt: c.adminSalt, adminIter: c.adminIter }, c.chavePriv && (!p.chavePub || p.chavePub === c.chavePub) ? { chavePub: c.chavePub, chavePriv: c.chavePriv, chaveSalt: c.chaveSalt } : {}) : p; });
}
function adminsAtivos(l) { return (l || lerPerfis()).filter((p) => p.papel === "admin" && p.ativo); }
function perfisAtivos() { return adminsAtivos().length > 0; }
function perfilPorNome(nome, l) {
  const n = normTxt(nome); if (!n) return null;
  const ps = (l || lerPerfis()).filter((p) => normTxt(p.nome) === n);
  return ps.find((p) => p.ativo) || ps[0] || null;
}
/* Perfil deste aparelho: pelo id guardado; senão pelo nome salvo (normTxt), que fica associado sozinho.
 * v2.3.0: o nome de um admin nunca é associado sozinho (só com a senha de admin, em escolherPerfil). */
function meuPerfil(l) {
  l = l || lerPerfis();
  const id = localStorage.getItem(PERFIL_ID_KEY);
  let p = id ? l.find((x) => x.id === id) : null;
  if (!p) { p = perfilPorNome(autor(), l); if (p && p.papel !== "admin") localStorage.setItem(PERFIL_ID_KEY, p.id); else p = null; }
  return p || null;
}
function adminConfirmado(id) { return !!id && localStorage.getItem(ADMIN_CONF_KEY) === id; }
/* v2.3.0 (item 1): o arquivo da equipe tem perfis, mas eles ainda não chegaram aqui (arquivo cifrado sem a senha, primeira sincronização). */
function perfisNoArquivo() { return localStorage.getItem(PERFIS_NO_ARQUIVO_KEY) === "1"; }
function notarPerfisNoArquivo(bruto) {
  try {
    const tem = !!bruto && (bruto.perfis === true || (Array.isArray(bruto.perfis) && bruto.perfis.some((p) => p && p.papel === "admin" && p.ativo !== false)));
    if (tem) localStorage.setItem(PERFIS_NO_ARQUIVO_KEY, "1");
  } catch (e) {}
}
/* livre (sem perfis: como antes) · admin (no modo admin) · analista · leitura (analista desativado) */
function papelAtual() {
  if (!perfisAtivos()) return perfisNoArquivo() ? "analista" : "livre";
  const p = meuPerfil();
  if (p && !p.ativo) return "leitura";
  if (modoAdmin && p && p.papel === "admin" && p.ativo) return "admin";
  return "analista";
}
function podeAdminEquipe() { const p = papelAtual(); return p === "livre" || p === "admin"; }
function souAdminCadastrado() { const p = perfisAtivos() ? meuPerfil() : null; return !!(p && p.ativo && p.papel === "admin"); }
/* Card da Equipe e o usuário não é admin: a ação proibida mostra a dica e não acontece. */
function bloqueadoEquipe(lista, msg) {
  if (podeAdminEquipe()) return false;
  if (lista && !lista.some((it) => it && compartilhado(it))) return false;
  toast(msg || DICA_ADMIN + " (cards da Equipe).");
  return true;
}
/* ---------- Camada de dados ---------- */
function vazioP(v) { return v == null || v === "" || (Array.isArray(v) && !v.length); }
function igualP(a, b) { return (vazioP(a) && vazioP(b)) || JSON.stringify(a) === JSON.stringify(b); }
function normP(it) { const n = window.CadernoSync && CadernoSync.normalizarCard ? CadernoSync.normalizarCard(it) : null; return n || it; }
/* Desfaz no card "depois" o que o papel não pode mudar em relação a "antes". Devolve o card corrigido e os campos barrados. */
function sanearEquipe(antes, depois, papel) {
  const a = normP(antes), d = normP(depois), o = Object.assign({}, depois), barrados = [];
  new Set(Object.keys(a).concat(Object.keys(d))).forEach((k) => {
    if (CAMPOS_META.has(k) || igualP(a[k], d[k])) return;
    const ok = papel === "analista" && CAMPOS_ANALISTA.indexOf(k) >= 0; // v2.3.0 (item 8): arquivar também é só do admin
    if (ok) return;
    if (Object.prototype.hasOwnProperty.call(antes, k)) o[k] = antes[k]; else delete o[k];
    barrados.push(k);
  });
  return { card: o, barrados: barrados };
}
function fotografarEquipe() {
  baseEquipe = new Map();
  (itens || []).filter(compartilhado).forEach((it) => baseEquipe.set(it.id, JSON.parse(JSON.stringify(it))));
}
/* Chamado no começo do save(): analista não grava mudança proibida, não cria nem some com card da Equipe. */
function guardarPermissoes() {
  const papel = papelAtual();
  if (papel === "livre" || papel === "admin" || !baseEquipe) return null;
  const vistos = new Set(); let barrados = 0, viraramMeus = 0, voltaram = 0;
  itens.forEach((it, i) => {
    const b = baseEquipe.get(it.id);
    if (b) { vistos.add(it.id); const r = sanearEquipe(b, it, papel); if (r.barrados.length) { itens[i] = r.card; barrados++; } }
    else if (compartilhado(it)) { it.visibilidade = "Individual"; viraramMeus++; }
  });
  baseEquipe.forEach((b, id) => { if (!vistos.has(id)) { itens.push(JSON.parse(JSON.stringify(b))); voltaram++; } });
  if (barrados || viraramMeus || voltaram) {
    setTimeout(() => toast(viraramMeus ? "Só o admin cria cards da Equipe: o card foi salvo em Meus." : DICA_ADMIN + ": a mudança proibida não foi gravada."), 0);
    return { barrados: barrados, viraramMeus: viraramMeus, voltaram: voltaram };
  }
  return null;
}
function papelDeQuem(nome, l) {
  const p = perfilPorNome(nome, l);
  if (!p) return "analista";
  if (!p.ativo) return "leitura";
  return p.papel === "admin" ? "admin" : "analista";
}
/* Merge da sincronização: mudança de quem não é admin em campo proibido é desfeita (vale também para apps antigos).
 * Card novo da Equipe criado por quem não é admin não é apagado (num aparelho novo não dá para saber o que é antigo):
 * fica registrado no Histórico para o admin revisar.
 * v2.3.0: quem é admin vem da assinatura (js/assinatura.js), não do nome. Também desfaz, de quem não é admin:
 * exclusão de card da Equipe (tombstone), restauração/edição de card que um admin excluiu e "Excluir agora" da Lixeira da Equipe.
 * ctx: { remoto, copias, remAqui, voltaram } (as listas são ajustadas no lugar, antes de mesclarExtras). */
async function filtrarPermissoesRemoto(r, base, perfis, primeiraSync, ctx) {
  const out = { mudou: false, hist: [] };
  if (!adminsAtivos(perfis).length) return out;
  ctx = ctx || {};
  const porId = new Map((base.itens || []).map((it) => [it.id, it]));
  const agora = new Date().toISOString(), eu = autor(), pend = pendentesAssin();
  const h = (id, card, texto) => out.hist.push({ id: id + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipo: "texto", card: card, quem: eu, quando: agora, escopo: "Equipe", texto: texto });
  const saida = [];
  for (const it of r.itens) {
    const b = porId.get(it.id);
    const quem = it.updatedBy || "";
    const papel = await papelRemoto(quem, it.assin, msgCard(it), perfis);
    if (papel === "admin") { saida.push(it); continue; }
    if (!b) {
      const vi = (ctx.voltaram || []).findIndex((v) => v.item && v.item.id === it.id);
      const v = vi >= 0 ? ctx.voltaram[vi] : null;
      if (v && !pend.has("c:" + it.id) && await ehAdminRemoto(v.tomb.deletedBy, v.tomb.assin, msgTomb(v.tomb), perfis)) {
        // o admin excluiu e quem não é admin restaurou/editou depois: volta a ficar excluído (a exclusão do admin vale)
        r.removidos.push(Object.assign({}, v.tomb, { deletedAt: agora, origAt: v.tomb.origAt || v.tomb.deletedAt }));
        ctx.voltaram.splice(vi, 1); out.mudou = true;
        h("pv-" + it.id, nomeDe(it), "Restauração sem permissão desfeita (feita por " + (quem || "sem nome") + "): " + nomeDe(it));
        continue;
      }
      if (!primeiraSync && !v) out.hist.push({ id: "pn-" + it.id, tipo: "texto", card: nomeDe(it), quem: quem, quando: agora, escopo: "Equipe", texto: "Card da Equipe criado sem ser admin (" + (quem || "sem nome") + "); o admin deve revisar: " + nomeDe(it) });
      saida.push(it); continue;
    }
    const s = sanearEquipe(b, it, papel);
    if (!s.barrados.length) { saida.push(it); continue; }
    out.mudou = true;
    out.hist.push({ id: "pd-" + it.id + "-" + Date.now().toString(36), tipo: "texto", card: nomeDe(b), quem: eu, quando: agora, escopo: "Equipe", texto: "Mudança sem permissão desfeita (" + s.barrados.map(rotuloCampoP).join(", ") + ", feita por " + (quem || "sem nome") + "): " + nomeDe(b) });
    delete s.card.assin;
    saida.push(Object.assign(s.card, { updatedAt: agora, updatedBy: eu || s.card.updatedBy }));
  }
  r.itens = saida;
  // exclusão (tombstone) de card da Equipe por quem não é admin: o card volta
  const ativos = new Set(r.itens.map((x) => x.id));
  for (const t of r.removidos.slice()) {
    const b = porId.get(t.id);
    if (!b || ativos.has(t.id) || pend.has("t:" + t.id)) continue;
    if (await ehAdminRemoto(t.deletedBy, t.assin, msgTomb(t), perfis)) continue;
    const c = Object.assign({}, b, { updatedAt: agora, updatedBy: eu || b.updatedBy }); delete c.assin;
    r.itens.push(c); ativos.add(t.id);
    r.removidos = r.removidos.filter((x) => x !== t);
    if (ctx.remAqui) for (let i = ctx.remAqui.length - 1; i >= 0; i--) if (ctx.remAqui[i].item && ctx.remAqui[i].item.id === t.id) ctx.remAqui.splice(i, 1);
    out.mudou = true;
    h("px-" + t.id, nomeDe(b), "Exclusão sem permissão desfeita (feita por " + (t.deletedBy || "sem nome") + "): " + nomeDe(b));
  }
  // "Excluir agora" / restaurar da Lixeira da Equipe por quem não é admin: a entrada de remoção é ignorada (o card fica na Lixeira)
  const lixLocal = new Set(lerLixeiraEq().itens.map((e) => e.id));
  const daLix = async (l) => { const ok = []; for (const t of (l || [])) { if (!lixLocal.has(t.id) || ativos.has(t.id) || await ehAdminRemoto(t.por, t.assin, msgLix(t), perfis)) ok.push(t); else out.mudou = true; } return ok; };
  if (ctx.remoto && ctx.remoto.lixeiraRemovidos) ctx.remoto.lixeiraRemovidos = await daLix(ctx.remoto.lixeiraRemovidos);
  for (const c of (ctx.copias || [])) if (c.doc && c.doc.lixeiraRemovidos) c.doc.lixeiraRemovidos = await daLix(c.doc.lixeiraRemovidos);
  return out;
}
function rotuloCampoP(k) { return ({ titulo: "título", aplicacao: "aplicação", cliente: "cliente", categoria: "categoria", visibilidade: "visibilidade", url: "URL", usuario: "usuário", obs: "observações", horario: "horário", arquivado_em: "reativação" })[k] || k; }
/* Perfis na sincronização: junta a cópia local, o arquivo e as cópias de conflito. Sem a coleção no arquivo (app antigo
 * regravou) a cópia local repõe e o admin fica sabendo quem gravou. */
async function mesclarPerfisSync(remoto, remoto0, copias) {
  const cache = await perfisCompletos();
  const remP = remoto && Array.isArray(remoto.perfis) ? remoto.perfis : null;
  const l = CadernoSync.mesclarPerfis([cache, remP || []].concat(copias.map((c) => c.doc.perfis || [])));
  if (remoto && !remP && adminsAtivos(cache).length && remoto0 && remoto0.atualizado_por) {
    const av = lerJSON(PERFIS_ANTIGOS_KEY, {}); av[String(remoto0.atualizado_por).slice(0, 60)] = new Date().toISOString();
    localStorage.setItem(PERFIS_ANTIGOS_KEY, JSON.stringify(av));
  }
  const eu = meuPerfil(l);
  if (eu && (eu.papel !== "admin" || adminConfirmado(eu.id))) { // v2.3.0: ninguém atualiza o último acesso de um admin sem a senha dele
    const agora = new Date();
    if (eu.versao !== APP_VERSAO || agora - CadernoSync.ts(eu.ultimaSync) > 6 * 36e5) { eu.ultimaSync = agora.toISOString(); eu.versao = APP_VERSAO; }
    if (!eu.ultimoAcesso || agora - CadernoSync.ts(eu.ultimoAcesso) > 6 * 36e5) eu.ultimoAcesso = agora.toISOString();
  }
  if (eu && eu.nome !== autor()) localStorage.setItem(AUTOR_KEY, eu.nome); // o admin renomeou: o nome deste aparelho acompanha
  const gravar = !!lerSE().atual; // perfis (com hashes) só vão para um arquivo cifrado
  const precisa = gravar && l.length > 0 && JSON.stringify(CadernoSync.limparPerfis(remP || [])) !== JSON.stringify(CadernoSync.limparPerfis(l));
  return { itens: l, precisa: precisa, gravar: gravar };
}
async function concluirPerfisSync(l) {
  if (l && l.length) await gravarPerfis(l);
  if (l && l.length) fixarChaves(l);
  const eu = meuPerfil(l);
  if (modoAdmin && !(eu && eu.ativo && eu.papel === "admin")) sairModoAdmin(true);
  desenharSeloAdmin();
}
function avisosVersaoAntiga() {
  const av = lerJSON(PERFIS_ANTIGOS_KEY, {}), lim = Date.now() - 30 * 864e5, out = [];
  Object.keys(av).forEach((n) => { if (CadernoSync.ts(av[n]) >= lim) out.push(n); });
  lerPerfis().forEach((p) => { if (p.ativo && p.versao && cmpVersao(p.versao, APP_VERSAO) < 0 && out.indexOf(p.nome) < 0) out.push(p.nome); });
  return out;
}
function cmpVersao(a, b) { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
function histPerfil(texto) { addHist({ tipo: "texto", card: "", escopo: "Equipe", texto: texto }); }
function novoIdPerfil() { return "pf-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
async function hashAdmin(senha) { const salt = saltAleatorio(); return { adminHash: await derivarSenha(senha, salt, PERFIS_ITER), adminSalt: salt, adminIter: PERFIS_ITER }; }
async function alterarPerfil(id, mud, texto) {
  const l = await perfisCompletos(); const p = l.find((x) => x.id === id); if (!p) return null;
  Object.assign(p, mud, { updatedAt: new Date().toISOString(), updatedBy: autor() });
  if (p.papel !== "admin") { delete p.adminHash; delete p.adminSalt; delete p.adminIter; delete p.chavePub; delete p.chavePriv; delete p.chaveSalt; }
  if (!adminsAtivos(l).length) { toast("Não dá para remover, desativar ou rebaixar o último admin"); return null; }
  await gravarPerfis(l); if (texto) histPerfil(texto);
  agendarSync(); return p;
}
/* ---------- Modo admin ---------- */
function sairModoAdmin(silencioso) {
  if (!modoAdmin) return;
  modoAdmin = false;
  if (!silencioso) { histPerfil("Saiu do modo admin: " + autor()); toast("Você saiu do modo admin"); }
  desenharSeloAdmin();
  try { render(); } catch (e) {}
}
function desenharSeloAdmin() {
  const s = $("seloAdmin"); if (!s) return;
  s.hidden = !modoAdmin;
  document.body.classList.toggle("modo-admin", modoAdmin);
}
/* v2.3.0 (item 7): campo de senha de admin com o botão de olho (mostrar/ocultar). */
function campoSenhaAdmin(box, id, rot, auto) {
  const i = campoSenha(box, id, rot, auto);
  const l = i.parentNode; l.classList.add("campo-senha");
  const olho = el("button", "campo-senha__olho"); olho.type = "button"; olho.id = id + "Olho";
  const pinta = () => { const vis = i.type === "text"; olho.innerHTML = svg(vis ? "eyeOff" : "eye", 18); olho.title = vis ? "Ocultar a senha" : "Mostrar a senha"; olho.setAttribute("aria-label", olho.title); olho.setAttribute("aria-pressed", vis ? "true" : "false"); };
  olho.addEventListener("click", (ev) => { ev.preventDefault(); i.type = i.type === "password" ? "text" : "password"; pinta(); i.focus(); });
  const w = el("span", "campo-senha__linha"); l.insertBefore(w, i); w.appendChild(i); w.appendChild(olho); pinta();
  return i;
}
/* v2.3.0 (item 7): força da senha (fraca/média/forte), só para orientar; a regra mínima é senhaForte(). */
function forcaSenhaAdmin(v) {
  v = String(v || ""); if (!v) return 0;
  let n = 0; if (v.length >= AUTH_MIN) n++; if (v.length >= 12) n++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++; if (/[0-9]/.test(v)) n++; if (/[^A-Za-z0-9]/.test(v)) n++;
  return !senhaForte(v) ? 1 : n >= 5 ? 3 : 2;
}
function medidorForca(box, inp) {
  const m = el("div", "forca-senha"); m.id = inp.id + "Forca"; m.setAttribute("aria-live", "polite");
  const barra = el("span", "forca-senha__barra"); const t = el("span", "forca-senha__texto");
  m.appendChild(barra); m.appendChild(t); box.appendChild(m);
  const nomes = ["", "Fraca", "Média", "Forte"], mods = ["", "fraca", "media", "forte"];
  const pinta = () => { const f = forcaSenhaAdmin(inp.value); m.className = "forca-senha" + (f ? " forca-senha--" + mods[f] : ""); t.textContent = f ? "Força: " + nomes[f] + (f === 1 ? " (ainda não atende às regras)" : "") : ""; };
  inp.addEventListener("input", pinta); pinta();
  return m;
}
function campoNovaSenhaAdmin(box) {
  const s1 = campoSenhaAdmin(box, "paNova", "Nova senha de admin", "new-password");
  medidorForca(box, s1);
  const s2 = campoSenhaAdmin(box, "paConf", "Confirme a senha de admin", "new-password");
  box.appendChild(el("p", "meta", "Mínimo de " + AUTH_MIN + " caracteres, com letras (uma maiúscula), número e símbolo. É só sua: não use a senha de login nem a da equipe."));
  return { s1: s1, s2: s2, erro: () => !senhaForte(s1.value) ? "A senha de admin precisa ter " + AUTH_MIN + "+ caracteres, maiúscula, número e símbolo." : (s1.value !== s2.value ? "As duas senhas não são iguais." : "") };
}
function entrarComoAdmin() {
  const p = meuPerfil();
  if (!souAdminCadastrado()) { toast("Só um admin cadastrado pode entrar no modo admin"); return Promise.resolve(false); }
  return janela("dlgPerfis", (box, fim) => {
    box.classList.add("dlg-admin");
    box.appendChild(el("h3", "", "Entrar como admin"));
    box.appendChild(el("p", "meta", p.nome + ", digite a sua senha de admin para liberar as ações de admin nos cards da Equipe. O modo admin acaba no bloqueio, ao sair e ao fechar a página."));
    const s = campoSenhaAdmin(box, "paSenha", "Senha de admin", "current-password");
    let nova = null;
    if (p.trocarSenha) { box.appendChild(el("p", "se-aviso", "Sua senha de admin é temporária: crie a sua agora.")); nova = campoNovaSenhaAdmin(box); }
    const er = el("p", "se-erro"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", "Entrar como admin", async () => {
      er.textContent = "";
      if (Date.now() < esperaAdminAte) { er.textContent = "Muitas tentativas. Aguarde alguns segundos."; return; }
      if (nova && nova.erro()) { er.textContent = nova.erro(); return; }
      ok.disabled = true;
      try {
        const atual = meuPerfil(await perfisCompletos());
        if (!atual || !atual.adminHash) { er.textContent = "A senha de admin deste perfil ainda não chegou neste aparelho. Sincronize e tente de novo."; return; }
        const h = await derivarSenha(s.value, atual.adminSalt, atual.adminIter || PERFIS_ITER);
        if (!hashIguais(h, atual.adminHash)) {
          tentativasAdmin++; if (tentativasAdmin >= 5) { tentativasAdmin = 0; esperaAdminAte = Date.now() + 30000; }
          er.textContent = "Senha de admin incorreta."; s.select(); return;
        }
        tentativasAdmin = 0;
        // v2.3.0 (item 6): abre (ou cria, para admin vindo da v2.2.0) a chave que assina as ações de admin
        const ch = await prepararChaveAdmin(atual, s.value, nova ? nova.s1.value : "");
        if (ch.erro) { er.textContent = ch.erro; return; }
        if (nova) { await alterarPerfil(atual.id, Object.assign(await hashAdmin(nova.s1.value), ch.campos || {}, { trocarSenha: false }), "Senha de admin definida: " + atual.nome); nova.s1.value = nova.s2.value = ""; }
        else if (ch.campos) await alterarPerfil(atual.id, ch.campos, "");
        localStorage.setItem(ADMIN_CONF_KEY, atual.id); localStorage.setItem(PERFIL_ID_KEY, atual.id);
        s.value = "";
        modoAdmin = true;
        histPerfil("Entrou no modo admin: " + atual.nome);
        fim(true);
        desenharSeloAdmin(); render();
        toast("Modo admin ativado");
      } catch (e) { er.textContent = "Não foi possível conferir a senha (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
    bb.appendChild(ok); box.appendChild(bb);
  });
}
/* ---------- Bootstrap ---------- */
async function configurarPerfis() {
  if (perfisAtivos() || perfisNoArquivo()) { toast("Os perfis já estão configurados. Só um admin pode promover outro."); return false; }
  if (!syncEstado.vinculado) { aviso("Vincule o arquivo da equipe", "Para configurar os perfis, primeiro vincule a pasta/arquivo da equipe em Mais › Arquivo da equipe."); return false; }
  if (!autor()) { aviso("Salve o seu nome", "Digite e salve o seu nome em Mais › Arquivo da equipe antes de configurar os perfis."); return false; }
  if (!lerSE().atual || seEstado.precisaSenha) { aviso("Proteja o arquivo da equipe", "Os perfis guardam a senha de admin (só o hash), por isso só ficam num arquivo protegido com a senha da equipe. Ative a senha da equipe primeiro."); return false; }
  await sincronizarAgora(false); // alguém pode ter configurado antes: confere o arquivo primeiro
  if (perfisAtivos()) { toast("Outro analista já configurou os perfis. Peça ao admin para cadastrar você."); render(); return false; }
  return janela("dlgPerfis", (box, fim) => {
    box.appendChild(el("h3", "", "Configurar perfis"));
    box.appendChild(el("p", "meta", "Você (" + autor() + ") vira o primeiro admin. Depois disso, ninguém mais vira admin sozinho: só um admin promove outro. Os analistas já vistos no Histórico entram na lista como analistas."));
    const n = campoNovaSenhaAdmin(box);
    const er = el("p", "se-erro"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", "Virar admin", async () => {
      er.textContent = "";
      if (n.erro()) { er.textContent = n.erro(); return; }
      ok.disabled = true;
      try {
        const agora = new Date().toISOString(), eu = autor();
        const l = [Object.assign({ id: novoIdPerfil(), nome: eu, papel: "admin", ativo: true, criadoPor: eu, criadoEm: agora, updatedAt: agora, updatedBy: eu, versao: APP_VERSAO }, await hashAdmin(n.s1.value))];
        const ch = await prepararChaveAdmin(l[0], n.s1.value, ""); if (ch.campos) Object.assign(l[0], ch.campos);
        nomesConhecidos().forEach((nome) => { if (!l.some((p) => normTxt(p.nome) === normTxt(nome))) l.push({ id: novoIdPerfil(), nome: nome, papel: "analista", ativo: true, criadoPor: eu, criadoEm: agora, updatedAt: agora, updatedBy: eu }); });
        n.s1.value = n.s2.value = "";
        await gravarPerfis(l); localStorage.setItem(PERFIL_ID_KEY, l[0].id); localStorage.setItem(ADMIN_CONF_KEY, l[0].id);
        histPerfil("Perfis configurados; primeiro admin: " + eu);
        modoAdmin = true; histPerfil("Entrou no modo admin: " + eu);
        fim(true); desenharSeloAdmin();
        await sincronizar(true); render();
        toast("Perfis configurados. Você é o admin (modo admin ativo).");
      } catch (e) { er.textContent = "Não foi possível configurar (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
    bb.appendChild(ok); box.appendChild(bb);
  });
}
function nomesConhecidos() {
  const s = new Map();
  lerHist().forEach((e) => { const q = String(e.quem || "").trim(); if (q && !s.has(normTxt(q))) s.set(normTxt(q), q.slice(0, 60)); });
  itens.filter(compartilhado).forEach((it) => { const q = String(it.updatedBy || "").trim(); if (q && !s.has(normTxt(q))) s.set(normTxt(q), q.slice(0, 60)); });
  return Array.from(s.values()).slice(0, 100);
}
/* ---------- Painel de perfis (só o admin, no modo admin) ---------- */
function painelPerfis() {
  if (papelAtual() !== "admin") { toast("Entre como admin para abrir o painel de perfis"); return Promise.resolve(false); }
  return janela("dlgPerfis", (box, fim) => {
    box.classList.add("dlg-perfis");
    const desenhar = () => {
      box.textContent = "";
      box.appendChild(el("h3", "", "Perfis da equipe"));
      const l = lerPerfis(), adm = adminsAtivos(l);
      if (adm.length === 1) box.appendChild(el("p", "se-aviso perfis-um-admin", "Recomendado: ter 2 admins. Hoje só " + adm[0].nome + " é admin."));
      avisosVersaoAntiga().forEach((nome) => box.appendChild(el("p", "se-aviso perfis-antigo", nome + " ainda está numa versão antiga (não respeita as permissões). Peça para atualizar.")));
      const ul = el("ul", "lix-lista perfis-lista");
      l.forEach((p) => {
        const li = el("li", "lix-it" + (p.ativo ? "" : " perfil-inativo")); li.dataset.id = p.id;
        const tx = el("div", "lix-tx");
        tx.appendChild(el("b", "", p.nome));
        tx.appendChild(el("span", "lix-tag " + (p.papel === "admin" ? "equipe" : "meu"), (p.papel === "admin" ? "Admin" : "Analista") + (p.ativo ? "" : " · desativado") + (p.trocarSenha ? " · senha temporária" : "")));
        tx.appendChild(el("div", "hist2-sub", "Último acesso: " + (p.ultimoAcesso ? dataHoraBR(p.ultimoAcesso) : "—") + " · última sincronização: " + (p.ultimaSync ? dataHoraBR(p.ultimaSync) : "—") + (p.versao ? " · v" + p.versao : "")));
        li.appendChild(tx);
        const ac = el("div", "lix-acoes");
        const ultimoAdmin = p.papel === "admin" && p.ativo && adm.length <= 1;
        ac.appendChild(botaoDlg("pequeno", "Renomear", async () => { const v = await pedirTexto("Renomear perfil", "Novo nome", p.nome); if (v && v !== p.nome) { if (perfilPorNome(v) && perfilPorNome(v).id !== p.id) { toast("Já existe um perfil com esse nome"); } else await alterarPerfil(p.id, { nome: v }, "Perfil renomeado: " + p.nome + " → " + v); } desenhar(); }));
        if (p.ativo) {
          const bd = botaoDlg("pequeno perigo", "Desativar", async () => { if (await dialogo({ titulo: "Desativar " + p.nome + "?", texto: "Nos cards da Equipe, " + p.nome + " fica só leitura. Pode ser reativado depois.", ok: "Desativar", cancelar: "Cancelar", perigo: true })) await alterarPerfil(p.id, { ativo: false }, "Perfil desativado: " + p.nome); desenhar(); });
          if (ultimoAdmin) { bd.disabled = true; bd.title = "Não dá para desativar o último admin"; }
          ac.appendChild(bd);
        } else ac.appendChild(botaoDlg("pequeno", "Reativar", async () => { await alterarPerfil(p.id, { ativo: true }, "Perfil reativado: " + p.nome); desenhar(); }));
        if (p.papel === "admin") {
          const bt = botaoDlg("pequeno", "Tirar o admin", async () => { if (adminsAtivos().length <= 1 && p.ativo) { toast("Não dá para tirar o último admin"); return; } if (await dialogo({ titulo: "Tirar o admin de " + p.nome + "?", texto: p.nome + " passa a ser analista.", ok: "Tirar o admin", cancelar: "Cancelar" })) { await alterarPerfil(p.id, { papel: "analista", trocarSenha: false }, "Admin retirado: " + p.nome); if (p.id === (meuPerfil() || {}).id) { sairModoAdmin(true); fim(true); render(); return; } } desenhar(); });
          if (ultimoAdmin) { bt.disabled = true; bt.title = "Não dá para tirar o último admin"; }
          ac.appendChild(bt);
        } else if (p.ativo) ac.appendChild(botaoDlg("pequeno pri", "Tornar admin", async () => { await tornarAdmin(p); desenhar(); }));
        li.appendChild(ac); ul.appendChild(li);
      });
      box.appendChild(ul);
      const linha = el("div", "sync-nome");
      const inp = el("input"); inp.type = "text"; inp.id = "perfilNovoNome"; inp.placeholder = "Nome do colaborador"; inp.maxLength = 40;
      linha.appendChild(inp);
      linha.appendChild(botaoDlg("", "Cadastrar", () => {
        const v = inp.value.trim(); if (!v) { toast("Digite o nome"); return; }
        if (perfilPorNome(v)) { toast("Já existe um perfil com esse nome"); return; }
        const agora = new Date().toISOString(), l2 = lerPerfis();
        l2.push({ id: novoIdPerfil(), nome: v, papel: "analista", ativo: true, criadoPor: autor(), criadoEm: agora, updatedAt: agora, updatedBy: autor() });
        perfisCompletos().then((l3) => { l3.push(l2[l2.length - 1]); return gravarPerfis(l3); }).then(() => { histPerfil("Perfil criado: " + v); agendarSync(); desenhar(); });
      }));
      box.appendChild(linha);
      box.appendChild(el("p", "meta", textoHonestoPerfis()));
      const bb = el("div", "dlg-botoes"); bb.appendChild(botaoDlg("pri", "Fechar", () => { fim(true); render(); })); box.appendChild(bb);
    };
    desenhar();
  });
}
function textoHonestoPerfis() {
  return "Importante: os perfis são uma proteção de tela, não um controle forte. Desde a v2.3.0, as ações de admin saem assinadas e o nome sozinho não dá permissão, mas quem tem o arquivo e a senha da equipe ainda consegue mexer nele por fora, e apps antigos (v2.2.0 ou anterior) não conferem as assinaturas. Peça para todos atualizarem.";
}
/* Tornar admin: o admin define uma senha temporária, que o novo admin troca no primeiro “Entrar como admin”. */
function tornarAdmin(p) {
  return janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", "Tornar " + p.nome + " admin"));
    box.appendChild(el("p", "meta", "Defina uma senha temporária e passe para " + p.nome + " pessoalmente. No primeiro “Entrar como admin”, " + p.nome + " cria a própria senha de admin."));
    const n = campoNovaSenhaAdmin(box);
    const er = el("p", "se-erro"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", "Tornar admin", async () => {
      er.textContent = ""; if (n.erro()) { er.textContent = n.erro(); return; }
      ok.disabled = true;
      try { const ch = await gerarChavesAdmin(n.s1.value); await alterarPerfil(p.id, Object.assign({ papel: "admin", ativo: true, trocarSenha: true }, await hashAdmin(n.s1.value), ch), "Admin concedido: " + p.nome); n.s1.value = n.s2.value = ""; fim(true); toast(p.nome + " agora é admin (senha temporária)"); }
      finally { ok.disabled = false; }
    });
    bb.appendChild(ok); box.appendChild(bb);
  });
}
function pedirTexto(titulo, rot, valor) {
  return janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", titulo));
    const l = el("label", "se-campo"); l.appendChild(el("span", "", rot));
    const i = el("input"); i.type = "text"; i.maxLength = 40; i.value = valor || ""; l.appendChild(i); box.appendChild(l);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    bb.appendChild(botaoDlg("pri", "Salvar", () => fim(i.value.trim())));
    box.appendChild(bb);
  });
}
/* ---------- Bloco em Mais ---------- */
function blocoPerfis(box) {
  const c = el("article", "card painel-mais perfis"); c.id = "blocoPerfis";
  c.appendChild(el("h3", "", "Perfis da equipe"));
  const row = el("div", "acoes-mais");
  if (!perfisAtivos()) {
    if (perfisNoArquivo()) {
      c.appendChild(el("p", "meta perfil-eu perfis-carregando", "O arquivo da equipe tem perfis, mas eles ainda não chegaram neste aparelho. Sincronize (e digite a senha da equipe, se pedir). Até lá você usa como analista."));
      row.appendChild(btn("btn", "refresh", "Sincronizar agora", () => sincronizar(true)));
    } else {
      c.appendChild(el("p", "meta", "Hoje todos têm acesso total aos cards da Equipe. Com os perfis, só o admin cria cards da Equipe, muda link e identificação, arquiva, reativa, exclui, compartilha e resolve conflitos; o analista atualiza senha, datas, ciclo e escalonamento e cuida dos próprios cards em Meus."));
      row.appendChild(btn("btn", "lock", "Configurar perfis", configurarPerfis));
    }
  } else {
    const p = meuPerfil(), papel = papelAtual();
    const rot = { admin: "Admin (modo admin ativo)", analista: p && p.papel === "admin" ? "Admin (entrou como analista)" : "Analista", leitura: "Analista desativado (cards da Equipe só leitura)" }[papel];
    c.appendChild(el("p", "meta perfil-eu", p ? "Você: " + p.nome + " · " + rot : "Seu nome não está na lista de perfis. Peça ao admin para cadastrar você. Até lá você usa como analista."));
    // v2.3.0 (item 5): o analista já identificado não troca de nome (o admin renomeia no Painel de perfis).
    // Quem ainda não tem perfil escolhe o nome; o nome de um admin só com a senha de admin.
    if (!p || p.papel === "admin") {
      const lista = lerPerfis().filter((x) => x.ativo || (p && x.id === p.id));
      const sel = el("select"); sel.id = "perfilEscolha"; sel.setAttribute("aria-label", "Escolha o seu nome");
      sel.appendChild(el("option", "", p ? "Trocar meu nome…" : "Escolha o seu nome na lista…")); sel.firstChild.value = "";
      lista.forEach((x) => { const o = el("option", "", x.nome + (x.papel === "admin" ? " (admin: pede a senha)" : "")); o.value = x.id; sel.appendChild(o); });
      sel.addEventListener("change", () => escolherPerfil(sel.value));
      row.appendChild(sel);
    }
    if (souAdminCadastrado()) {
      if (modoAdmin) { row.appendChild(btn("btn pri", "edit", "Painel de perfis", painelPerfis)); row.appendChild(btn("btn", "x", "Sair do modo admin", () => sairModoAdmin(false))); }
      else row.appendChild(btn("btn pri", "key", "Entrar como admin", entrarComoAdmin));
    }
    if (papel === "admin") {
      if (adminsAtivos().length === 1) c.appendChild(el("p", "se-aviso perfis-um-admin", "Recomendado: ter 2 admins (Painel de perfis › Tornar admin)."));
      avisosVersaoAntiga().forEach((nome) => c.appendChild(el("p", "se-aviso perfis-antigo", nome + " ainda está numa versão antiga")));
    }
    c.appendChild(el("p", "meta", textoHonestoPerfis()));
  }
  c.appendChild(row);
  box.appendChild(c);
}
async function escolherPerfil(id) {
  const p = lerPerfis().find((x) => x.id === id); if (!p) return false;
  const eu = meuPerfil();
  if (eu && eu.papel !== "admin") { toast("Só o admin muda o seu nome (Painel de perfis)."); render(); return false; }
  if (p.papel === "admin" && !(eu && eu.id === p.id)) { // v2.3.0 (item 5): nome de admin só com a senha desse admin
    const ok = await confirmarSenhaDoAdmin(p);
    if (!ok) { render(); return false; }
    localStorage.setItem(ADMIN_CONF_KEY, p.id);
  }
  if (modoAdmin) sairModoAdmin(true);
  localStorage.setItem(PERFIL_ID_KEY, p.id); localStorage.setItem(AUTOR_KEY, p.nome);
  toast("Nome salvo: " + p.nome); render();
  return true;
}
function confirmarSenhaDoAdmin(p) {
  return janela("dlgPerfis", (box, fim) => {
    box.classList.add("dlg-admin");
    box.appendChild(el("h3", "", "Este nome é de um admin"));
    box.appendChild(el("p", "meta", "Para usar o nome " + p.nome + " neste aparelho, digite a senha de admin de " + p.nome + "."));
    const s = campoSenhaAdmin(box, "paNomeSenha", "Senha de admin de " + p.nome, "current-password");
    const er = el("p", "se-erro"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", "Confirmar", async () => {
      er.textContent = "";
      if (Date.now() < esperaAdminAte) { er.textContent = "Muitas tentativas. Aguarde alguns segundos."; return; }
      ok.disabled = true;
      try {
        const c = (await perfisCompletos()).find((x) => x.id === p.id);
        if (!c || !c.adminHash) { er.textContent = "A senha de admin deste perfil ainda não chegou neste aparelho. Sincronize e tente de novo."; return; }
        const h = await derivarSenha(s.value, c.adminSalt, c.adminIter || PERFIS_ITER);
        if (!hashIguais(h, c.adminHash)) { tentativasAdmin++; if (tentativasAdmin >= 5) { tentativasAdmin = 0; esperaAdminAte = Date.now() + 30000; } er.textContent = "Senha de admin incorreta."; s.select(); return; }
        tentativasAdmin = 0; s.value = ""; fim(true);
      } catch (e) { er.textContent = "Não foi possível conferir a senha (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
    bb.appendChild(ok); box.appendChild(bb);
  });
}
/* v2.3.0 (item 5): "Salvar nome" em Arquivo da equipe não aceita o nome de um admin (use a lista, com a senha). */
function nomeLivre(v) {
  if (!perfisAtivos()) return true;
  const p = perfilPorNome(v), eu = meuPerfil();
  if (p && p.papel === "admin" && !(eu && eu.id === p.id)) { toast("Esse nome é de um admin. Escolha na lista em Perfis da equipe (pede a senha de admin)."); return false; }
  return true;
}
/* ---------- Ficha ---------- */
const CAMPOS_FICHA_ADMIN = ["fTitulo", "fAplicacao", "fAplicacaoNova", "fCliente", "fClienteNovo", "fCategoria", "fVisibilidade", "fUrl", "fUsuario", "fHorario", "fObs"];
const CAMPOS_FICHA_ANALISTA = ["fSenha", "fCiclo", "fUltima", "fEscalonamento", "fGerar"];
function aplicarTravasFicha(it) {
  const sheet = $("sheet"); if (!sheet) return;
  sheet.querySelectorAll(".trava-dica").forEach((x) => x.remove());
  sheet.querySelectorAll("[data-trava]").forEach((x) => { x.disabled = false; x.removeAttribute("data-trava"); x.removeAttribute("title"); });
  sheet.classList.remove("ficha-leitura");
  const papel = papelAtual();
  if (papel === "livre" || papel === "admin") return;
  const travar = (id) => {
    const x = $(id); if (!x) return;
    x.disabled = true; x.setAttribute("data-trava", "1"); x.title = DICA_ADMIN;
    if (x.type === "button" || /Nov[ao]$/.test(id)) return; // o campo "+ Novo..." usa o cadeado do select ao lado
    const d = el("small", "trava-dica", "🔒 " + DICA_ADMIN); d.title = DICA_ADMIN;
    x.insertAdjacentElement("afterend", d);
  };
  if (!it) { $("fVisibilidade").value = "Individual"; $("avisoInd").hidden = false; edit.visibilidade = "Individual"; travar("fVisibilidade"); return; }
  if (!compartilhado(it)) { travar("fVisibilidade"); return; } // card de Meus não vira card da Equipe
  CAMPOS_FICHA_ADMIN.forEach(travar);
  if (papel === "leitura") { CAMPOS_FICHA_ANALISTA.forEach(travar); sheet.classList.add("ficha-leitura"); sheet.querySelectorAll("#escEdit input, #escEdit select, #escEdit textarea, #escEdit button").forEach((x) => { x.disabled = true; x.setAttribute("data-trava", "1"); x.title = DICA_ADMIN; }); }
}
/* Importação: o analista não importa para a Equipe (os cards da Equipe do arquivo ficam de fora). */
function filtrarImportacaoEquipe(lista) {
  if (podeAdminEquipe()) return { itens: lista, fora: 0 };
  const ids = new Set(itens.filter(compartilhado).map((x) => x.id));
  const ok = lista.filter((x) => !(compartilhado(x) || ids.has(x.id)));
  return { itens: ok, fora: lista.length - ok.length };
}
