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
const PESSOAL_CONF_KEY = "caderno-perfil-pessoal-confirmado"; // v2.4.0: perfil de analista confirmado com a senha pessoal neste aparelho
const TENTATIVAS_KEY = "caderno-perfil-tentativas";   // v2.4.0: { perfilId: erros seguidos de senha pessoal neste aparelho }
const MAX_TENTATIVAS = 5;                              // v2.4.0: 5 erros seguidos bloqueiam a conta (o Administrador desbloqueia)
const PERFIS_ITER = 310000;                     // o mesmo padrão da senha de login
const DICA_ADMIN = "Só o Administrador pode alterar";
/* Campos do card da Equipe que o analista pode mudar. Observações e horário do card ficam só leitura (fácil de ajustar aqui). */
const CAMPOS_ANALISTA = ["escalonamentos", "escalonamento", "senha", "ultima", "senha_atualizada_em", "ciclo"]; // restaurado da v2.3.0: analista edita senha, ciclo, datas e escalonamento
const CAMPOS_META = new Set(["id", "updatedAt", "updatedBy", "baseAt", "assin"]);
let modoAdmin = false;          // só em memória: some no bloqueio, no logout e ao fechar/recarregar a página
let baseEquipe = null;          // foto dos cards da Equipe aceitos (para desfazer o que o analista não pode mudar)
let tentativasAdmin = 0, esperaAdminAte = 0;
const PRESENCA_MS = 15 * 6e4;   // v2.5.1 (item 4): no máximo uma gravação de presença a cada 15 min

const SEGREDOS_PERFIL = ["adminHash", "adminSalt", "adminIter", "chavePriv", "chaveSalt", "senhaHash", "senhaIter"]; // v2.4.0: senhaSalt fica na cópia pública (não é segredo; marca a senha atual);
function semHash(p) { const o = Object.assign({}, p); SEGREDOS_PERFIL.forEach((k) => delete o[k]); return o; }
function lerPerfis() { return window.CadernoSync ? CadernoSync.limparPerfis(lerJSON(PERFIS_KEY, [])).map(semHash) : []; }
/* Grava a lista: a parte pública em texto e a completa (com hashes) só cifrada com a chave da equipe deste aparelho. */
async function gravarPerfis(l) {
  l = CadernoSync.limparPerfis(l);
  Dados.gravarTexto(PERFIS_KEY, JSON.stringify(l.map(semHash)));
  if (adminsAtivos(l).length) Dados.gravarTexto(PERFIS_NO_ARQUIVO_KEY, "1");
  if (typeof fixarChaves === "function") fixarChaves(l);
  try {
    const env = await fecharDocEquipe({ tipo: "caderno-perfis-cofre", versao: 1, perfis: l }, null);
    if (window.CadernoCripto && CadernoCripto.ehProtegido(env)) Dados.gravarTexto(PERFIS_COFRE_KEY, JSON.stringify(env));
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
  return lerPerfis().map((p) => {
    const c = cofre.get(p.id); if (!c) return p;
    let o = p;
    if (p.papel === "admin" && c.adminHash) o = Object.assign({}, p, { adminHash: c.adminHash, adminSalt: c.adminSalt, adminIter: c.adminIter }, c.chavePriv && (!p.chavePub || p.chavePub === c.chavePub) ? { chavePub: c.chavePub, chavePriv: c.chavePriv, chaveSalt: c.chaveSalt } : {});
    if (c.senhaHash && c.updatedAt === p.updatedAt) o = Object.assign({}, o, { senhaHash: c.senhaHash, senhaSalt: c.senhaSalt, senhaIter: c.senhaIter }); // v2.4.0
    return o;
  });
}
function adminsAtivos(l) { return (l || lerPerfis()).filter((p) => p.papel === "admin" && p.ativo); }
function perfisAtivos() { return adminsAtivos().length > 0; }
function perfilPorNome(nome, l) {
  const n = normTxt(nome); if (!n) return null;
  const ps = (l || lerPerfis()).filter((p) => normTxt(p.nome) === n);
  return ps.find((p) => p.ativo) || ps[0] || null;
}
/* Perfil deste aparelho: só pelo id guardado e confirmado com senha.
 * v2.3.0: o nome de um admin nunca é associado sozinho. v2.4.0: o nome de ninguém é associado sozinho; o analista confirma com a
 * senha pessoal (PESSOAL_CONF_KEY) e o Administrador com a senha de Administrador (ADMIN_CONF_KEY ou id gravado no "Entrar como"). */
function meuPerfil(l) {
  l = l || lerPerfis();
  // v3.0.0 (item 4): a identidade é a da sessão DESTA aba (sessionStorage); o id compartilhado só vale numa aba sem login por perfil
  const sid = typeof sessaoPerfilId !== "undefined" && sessaoPerfilId ? sessaoPerfilId : "";
  const id = sid || Dados.texto(PERFIL_ID_KEY);
  const p = id ? l.find((x) => x.id === id) : null;
  if (!p) return null;
  if (sid && p.papel !== "admin" && sessaoSaltAba() === (p.senhaSalt || "")) return p; // senha pessoal conferida nesta aba
  if (p.papel !== "admin" && Dados.texto(PESSOAL_CONF_KEY) !== p.id + "|" + (p.senhaSalt || "") && !adminConfirmado(p.id)) return null; // analista sem a senha pessoal (ou a senha foi resetada)
  return p;
}
function sessaoSaltAba() { try { const s = sessionStorage.getItem(SESSAO) || ""; return s.indexOf("p:") === 0 ? s.split(":")[2] || "" : null; } catch (e) { return null; } }
function adminConfirmado(id) { return !!id && Dados.texto(ADMIN_CONF_KEY) === id; }
/* v2.3.0 (item 1): o arquivo da equipe tem perfis, mas eles ainda não chegaram aqui (arquivo cifrado sem a senha, primeira sincronização). */
function perfisNoArquivo() { return Dados.texto(PERFIS_NO_ARQUIVO_KEY) === "1"; }
function notarPerfisNoArquivo(bruto) {
  try {
    const tem = !!bruto && (bruto.perfis === true || (Array.isArray(bruto.perfis) && bruto.perfis.some((p) => p && p.papel === "admin" && p.ativo !== false)));
    if (tem) Dados.gravarTexto(PERFIS_NO_ARQUIVO_KEY, "1");
  } catch (e) {}
}
/* livre (sem perfis: como antes) · admin (no modo admin) · analista · leitura (analista desativado) */
function papelAtual() {
  if (!perfisAtivos()) return perfisNoArquivo() ? "analista" : "livre";
  const p = meuPerfil();
  if (p && (!p.ativo || p.bloqueado)) return "leitura"; // v2.4.0: conta bloqueada também fica só leitura
  if (modoAdmin && p && p.papel === "admin" && p.ativo) return "admin";
  return "analista";
}
/* v3.0.1 (item 4): analista (perfil que não é Administrador): não cria, não compartilha, não arquiva, não exclui e não reativa.
 * Em Meus ele só tem os cards que o Administrador enviou (Selecionar e enviar) e preenche login, senha, datas e escalonamento. */
const DICA_ANALISTA = "Só o Administrador cria, compartilha, arquiva, exclui ou reativa cards";
const CAMPOS_MEUS_ANALISTA = CAMPOS_ANALISTA.concat(["usuario"]);
function analistaPuro() { try { return typeof perfisAtivos === "function" && perfisAtivos() && !souAdminCadastrado(); } catch (e) { return false; } }
function negarAnalista() { if (!analistaPuro()) return false; toast(DICA_ANALISTA + "."); return true; }
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
    const ok = papel === "analista" && !a.arquivado_em && CAMPOS_ANALISTA.indexOf(k) >= 0; // v3.0.1 (item 4): card arquivado é só leitura para o analista // v2.3.0 (item 8): arquivar também é só do admin
    if (ok) return;
    if (Object.prototype.hasOwnProperty.call(antes, k)) o[k] = antes[k]; else delete o[k];
    barrados.push(k);
  });
  return { card: o, barrados: barrados };
}
let baseMeus = null; // v3.0.1 (item 4): foto dos Meus para o analista não criar, excluir nem mudar campos proibidos
function fotografarEquipe() {
  baseMeus = new Map(); (itens || []).filter((it) => it && !compartilhado(it)).forEach((it) => baseMeus.set(it.id, JSON.parse(JSON.stringify(it))));
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
  if (analistaPuro() && baseMeus) { // v3.0.1 (item 4): Meus do analista = cards enviados pelo admin; só login, senha, datas e escalonamento
    const vm = new Set();
    for (let i = itens.length - 1; i >= 0; i--) {
      const it = itens[i]; if (!it || compartilhado(it)) continue;
      const b = baseMeus.get(it.id);
      if (!b) { if (it.modeloId && !it.arquivado_em) continue; itens.splice(i, 1); barrados++; continue; } // card novo só se veio de um enviado pelo admin
      vm.add(it.id);
      const o = Object.assign({}, it); let mudou = false;
      new Set(Object.keys(b).concat(Object.keys(it))).forEach((k) => {
        if (CAMPOS_META.has(k) || k === "modeloVersao" || igualP(b[k], it[k])) return;
        if (!b.arquivado_em && CAMPOS_MEUS_ANALISTA.indexOf(k) >= 0) return;
        if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k]; else delete o[k]; mudou = true;
      });
      if (mudou) { itens[i] = o; barrados++; }
    }
    baseMeus.forEach((b, id) => { if (!vm.has(id) && !itens.some((x) => x.id === id)) { itens.push(JSON.parse(JSON.stringify(b))); voltaram++; } });
  }
  if (barrados || viraramMeus || voltaram) {
    setTimeout(() => toast(viraramMeus ? "Só o Administrador cria cards da Equipe: o card foi salvo em Meus." : DICA_ADMIN + ": a mudança proibida não foi gravada."), 0);
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
      if (syncSoLeituraAtual && !primeiraSync && !v) { out.mudou = true; out.recusados = (out.recusados || 0) + 1; continue; } // v2.5.0: card novo sem assinatura do Administrador não entra
      if (!primeiraSync && !v) out.hist.push({ id: "pn-" + it.id, tipo: "texto", card: nomeDe(it), quem: quem, quando: agora, escopo: "Equipe", texto: "Card da Equipe criado sem ser Administrador (" + (quem || "sem nome") + "); o Administrador deve revisar: " + nomeDe(it) });
      saida.push(it); continue;
    }
    const s = sanearEquipe(b, it, papel);
    if (!s.barrados.length) { saida.push(it); continue; }
    out.mudou = true; out.recusados = (out.recusados || 0) + 1;
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
    r.itens.push(c); ativos.add(t.id); out.recusados = (out.recusados || 0) + 1;
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
  let l = CadernoSync.mesclarPerfis([cache, remP || []].concat(copias.map((c) => c.doc.perfis || [])));
  // v2.4.0: mudança de perfil sem a assinatura de um Administrador conhecido é desfeita (js/assinatura.js)
  const fp = await filtrarPerfisRemoto(cache, l); l = fp.itens;
  fp.desfeitos.forEach((n) => addHist({ id: "pp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tipo: "texto", card: "", escopo: "Equipe", texto: "Mudança de perfil sem a assinatura do Administrador desfeita: " + n }));
  if (remoto && !remP && adminsAtivos(cache).length && remoto0 && remoto0.atualizado_por && CadernoSync.ts(remoto0.atualizado_em) > Math.min(...adminsAtivos(cache).map((a) => CadernoSync.ts(a.criadoEm) || Infinity))) { // v2.5.0: só conta o que foi gravado depois de os perfis existirem
    const av = lerJSON(PERFIS_ANTIGOS_KEY, {}); av[String(remoto0.atualizado_por).slice(0, 60)] = new Date().toISOString();
    Dados.gravarTexto(PERFIS_ANTIGOS_KEY, JSON.stringify(av));
  }
  const eu = meuPerfil(l);
  if (eu && (eu.papel !== "admin" || adminConfirmado(eu.id))) { // v2.3.0: ninguém atualiza o último acesso de um admin sem a senha dele
    // v2.5.1 (item 4): presença a cada login/sincronização, no máximo uma gravação a cada 15 min (antes: 6 h)
    const agora = new Date();
    if (eu.versao !== APP_VERSAO || agora - CadernoSync.ts(eu.ultimaSync) > PRESENCA_MS) { eu.ultimaSync = agora.toISOString(); eu.versao = APP_VERSAO; }
    if (!eu.ultimoAcesso || agora - CadernoSync.ts(eu.ultimoAcesso) > PRESENCA_MS) eu.ultimoAcesso = agora.toISOString();
  }
  if (eu && eu.nome !== autor()) Dados.gravarTexto(AUTOR_KEY, eu.nome); // o admin renomeou: o nome deste aparelho acompanha
  const gravar = !!lerSE().atual; // perfis (com hashes) só vão para um arquivo cifrado
  const precisa = gravar && l.length > 0 && JSON.stringify(CadernoSync.limparPerfis(remP || [])) !== JSON.stringify(CadernoSync.limparPerfis(l));
  return { itens: l, precisa: precisa, gravar: gravar, desfeitos: fp.desfeitos.length };
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
  lerPerfis().forEach((p) => { if (p.ativo && p.papel === "admin" && p.versao && cmpVersao(p.versao, APP_VERSAO) < 0 && out.indexOf(p.nome) < 0) out.push(p.nome); });
  return out;
}
function cmpVersao(a, b) { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
function histPerfil(texto) { addHist({ tipo: "texto", card: "", escopo: "Equipe", texto: texto }); }
function novoIdPerfil() { return "pf-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
async function hashAdmin(senha) { const salt = saltAleatorio(); return { adminHash: await derivarSenha(senha, salt, PERFIS_ITER), adminSalt: salt, adminIter: PERFIS_ITER }; }
async function alterarPerfil(id, mud, texto) {
  const l = await perfisCompletos(); const p = l.find((x) => x.id === id); if (!p) return null;
  Object.assign(p, mud, { updatedAt: new Date().toISOString(), updatedBy: autor() });
  if (p.papel !== "admin") { delete p.adminHash; delete p.adminSalt; delete p.adminIter; delete p.chavePub; delete p.chavePriv; delete p.chaveSalt; delete p.trocarSenha; }
  if (!adminsAtivos(l).length) { toast("Não dá para remover, desativar ou rebaixar o último Administrador"); return null; }
  await assinarPerfil(p); // v2.4.0: mudança feita com a chave do Administrador aberta sai assinada
  if (p.papel === "admin" && p.chavePub && chaveAdmin && chaveAdmin.pid !== p.id) { const pn = pinsChaves(); pn[p.id] = p.chavePub; Dados.gravarTexto(CHAVES_PIN_KEY, JSON.stringify(pn)); }
  await gravarPerfis(l); if (texto) histPerfil(texto);
  agendarSync(); return p;
}
/* ---------- Modo admin ---------- */
function sairModoAdmin(silencioso) {
  if (!modoAdmin) return;
  modoAdmin = false;
  if (!silencioso) { histPerfil("Saiu do modo Administrador: " + autor()); toast("Você saiu do modo Administrador"); }
  desenharSeloAdmin();
  try { render(); } catch (e) {}
}
function desenharSeloAdmin() { // v2.5.0: sem o selo amarelo; o botão da conta mostra "Administrador ▾"
  document.body.classList.toggle("modo-admin", modoAdmin);
  try { desenharConta(); } catch (e) {}
  try { aplicarPapelNaTela(); } catch (e) {} // v2.4.0: aba Gestão só no modo Administrador
}
/* v2.3.0 (item 7): campo de senha de admin com o botão de olho (mostrar/ocultar). */
function campoSenhaAdmin(box, id, rot, auto) { // v2.4.0: campo do diálogo padrão (rótulo, campo e olho)
  box.classList.add("dlg-senha", "dlg-padrao");
  const i = campoPadrao(box, id, rot, { senha: true, auto: auto });
  const o = i.parentNode.querySelector(".olho"); if (o) o.id = id + "Olho";
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
  const s1 = campoSenhaAdmin(box, "paNova", "Nova senha de Administrador", "new-password");
  medidorForca(box, s1);
  const s2 = campoSenhaAdmin(box, "paConf", "Confirme a senha de Administrador", "new-password");
  regrasPadrao(box, "A senha precisa ter: no mínimo " + AUTH_MIN + " caracteres, 1 letra maiúscula, 1 número e 1 caractere especial. É só sua: não use a senha de login nem a da equipe.");
  return { s1: s1, s2: s2, erro: () => !senhaForte(s1.value) ? "A senha de Administrador precisa ter " + AUTH_MIN + "+ caracteres, maiúscula, número e símbolo." : (s1.value !== s2.value ? "As duas senhas não são iguais." : "") };
}
function entrarComoAdmin() {
  const p = meuPerfil();
  if (!souAdminCadastrado()) { toast("Só um Administrador cadastrado pode entrar no modo Administrador"); return Promise.resolve(false); }
  return janela("dlgPerfis", (box, fim) => {
    box.classList.add("dlg-admin");
    dlgPadrao(box, "Entrar como administrador", p.nome + ", digite a sua senha de Administrador para liberar as ações de Administrador nos cards da Equipe. O modo Administrador acaba no bloqueio, ao sair e ao fechar a página.");
    const s = campoSenhaAdmin(box, "paSenha", "Senha de Administrador", "current-password");
    let nova = null;
    if (p.trocarSenha) { box.appendChild(el("p", "aviso-forte", "Sua senha de Administrador é temporária: crie a sua agora.")); nova = campoNovaSenhaAdmin(box); }
    const er = el("p", "erro-form se-erro"); er.setAttribute("role", "alert"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", "Entrar como administrador", async () => {
      er.textContent = "";
      if (Date.now() < esperaAdminAte) { er.textContent = "Muitas tentativas. Aguarde alguns segundos."; return; }
      if (nova && nova.erro()) { er.textContent = nova.erro(); return; }
      ok.disabled = true;
      try {
        const atual = meuPerfil(await perfisCompletos());
        if (!atual || !atual.adminHash) { er.textContent = "A senha de Administrador deste perfil ainda não chegou neste aparelho. Sincronize e tente de novo."; return; }
        const h = await derivarSenha(s.value, atual.adminSalt, atual.adminIter || PERFIS_ITER);
        if (!hashIguais(h, atual.adminHash)) {
          tentativasAdmin++; if (tentativasAdmin >= 5) { tentativasAdmin = 0; esperaAdminAte = Date.now() + 30000; }
          er.textContent = "Senha de Administrador incorreta."; s.select(); return;
        }
        tentativasAdmin = 0;
        // v2.3.0 (item 6): abre (ou cria, para admin vindo da v2.2.0) a chave que assina as ações de admin
        const ch = await prepararChaveAdmin(atual, s.value, nova ? nova.s1.value : "");
        if (ch.erro) { er.textContent = ch.erro; return; }
        if (nova) { await alterarPerfil(atual.id, Object.assign(await hashAdmin(nova.s1.value), ch.campos || {}, { trocarSenha: false }), "Senha de Administrador definida: " + atual.nome); nova.s1.value = nova.s2.value = ""; }
        else if (ch.campos) await alterarPerfil(atual.id, ch.campos, "");
        Dados.gravarTexto(ADMIN_CONF_KEY, atual.id); Dados.gravarTexto(PERFIL_ID_KEY, atual.id);
        s.value = "";
        modoAdmin = true;
        histPerfil("Entrou no modo Administrador: " + atual.nome);
        fim(true);
        desenharSeloAdmin(); render();
        toast("Modo Administrador ativado");
      } catch (e) { er.textContent = "Não foi possível conferir a senha (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
    bb.appendChild(ok); box.appendChild(bb);
  });
}
/* ---------- Bootstrap ---------- */
async function configurarPerfis() {
  if (perfisAtivos() || perfisNoArquivo()) { toast("Os perfis já estão configurados. Só um Administrador pode promover outro."); return false; }
  if (!syncEstado.vinculado) { aviso("Vincule o arquivo da equipe", "Para configurar os perfis, primeiro vincule a pasta/arquivo da equipe em Mais › Arquivo da equipe."); return false; }
  if (!autor()) { aviso("Salve o seu nome", "Digite e salve o seu nome em Mais › Arquivo da equipe antes de configurar os perfis."); return false; }
  if (!lerSE().atual || seEstado.precisaSenha) { aviso("Proteja o arquivo da equipe", "Os perfis guardam a senha de Administrador (só o hash), por isso só ficam num arquivo protegido com a senha da equipe. Ative a senha da equipe primeiro."); return false; }
  await sincronizarAgora(false); // alguém pode ter configurado antes: confere o arquivo primeiro
  if (perfisAtivos()) { toast("Outro analista já configurou os perfis. Peça ao Administrador para cadastrar você."); render(); return false; }
  return janela("dlgPerfis", (box, fim) => {
    dlgPadrao(box, "Configurar perfis", "Você (" + autor() + ") vira o primeiro Administrador. Depois disso, ninguém mais vira Administrador sozinho: só um Administrador promove outro. Os analistas já vistos no Histórico entram na lista como analistas.");
    const n = campoNovaSenhaAdmin(box);
    const er = el("p", "erro-form se-erro"); er.setAttribute("role", "alert"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", "Virar Administrador", async () => {
      er.textContent = "";
      if (n.erro()) { er.textContent = n.erro(); return; }
      ok.disabled = true;
      try {
        const agora = new Date().toISOString(), eu = autor();
        const l = [Object.assign({ id: novoIdPerfil(), nome: eu, papel: "admin", ativo: true, criadoPor: eu, criadoEm: agora, updatedAt: agora, updatedBy: eu, versao: APP_VERSAO }, await hashAdmin(n.s1.value))];
        const ch = await prepararChaveAdmin(l[0], n.s1.value, ""); if (ch.campos) Object.assign(l[0], ch.campos);
        nomesConhecidos().forEach((nome) => { if (!l.some((p) => normTxt(p.nome) === normTxt(nome))) l.push({ id: novoIdPerfil(), nome: nome, papel: "analista", ativo: true, criadoPor: eu, criadoEm: agora, updatedAt: agora, updatedBy: eu }); });
        n.s1.value = n.s2.value = "";
        for (const x of l) await assinarPerfil(x); // v2.4.0
        await gravarPerfis(l); Dados.gravarTexto(PERFIL_ID_KEY, l[0].id); Dados.gravarTexto(ADMIN_CONF_KEY, l[0].id);
        histPerfil("Perfis configurados; primeiro Administrador: " + eu);
        modoAdmin = true; histPerfil("Entrou no modo Administrador: " + eu);
        fim(true); desenharSeloAdmin();
        await sincronizar(true); render();
        toast("Perfis configurados. Você é o Administrador (modo Administrador ativo).");
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
/* ---------- Painel de perfis: v2.4.0 virou a aba Gestão (js/gestao.js) ---------- */
function painelPerfis() { return abrirGestao(); }
function textoHonestoPerfis() {
  return "Importante: os perfis são uma proteção de tela, não um controle forte. Desde a v2.3.0, as ações de Administrador saem assinadas e o nome sozinho não dá permissão, mas quem tem o arquivo e a senha da equipe ainda consegue mexer nele por fora, e apps antigos (v2.2.0 ou anterior) não conferem as assinaturas. Peça para todos atualizarem.";
}
/* Tornar administrador: senha temporária (gerada), que o novo Administrador troca no primeiro "Entrar como administrador". v2.4.0: diálogo padrão. */
function tornarAdmin(p) {
  return janela("dlgSE", (box, fim) => {
    dlgPadrao(box, "Tornar " + p.nome + " administrador", "Passe a senha temporária para " + p.nome + " pessoalmente. No primeiro acesso, " + p.nome + " cria a própria senha de Administrador.");
    const s1 = campoPadrao(box, "paNova", "Senha temporária de Administrador", { senha: true, valor: gerarSenhaTemporaria(), auto: "new-password" });
    avisoPadrao(box, "O Administrador troca a senha no primeiro acesso.");
    regrasPadrao(box);
    const er = erroPadrao(box);
    const ok = botoesPadrao(box, "Cancelar", "Salvar", () => fim(false), async () => {
      er.textContent = ""; if (!senhaForte(s1.value)) { er.textContent = REGRAS_SENHA; return; }
      ok.disabled = true;
      try { const ch = await gerarChavesAdmin(s1.value); await alterarPerfil(p.id, Object.assign({ papel: "admin", ativo: true, trocarSenha: true }, await hashAdmin(s1.value), ch), "Administrador concedido: " + p.nome); s1.value = ""; fim(true); toast(p.nome + " agora é Administrador (senha temporária)"); }
      finally { ok.disabled = false; }
    });
  });
}
function pedirTexto(titulo, rot, valor) {
  return janela("dlgSE", (box, fim) => {
    dlgPadrao(box, titulo, "");
    const i = campoPadrao(box, "pedirTextoCampo", rot, { valor: valor || "", max: 40 });
    botoesPadrao(box, "Cancelar", "Salvar", () => fim(false), () => fim(i.value.trim()));
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
      c.appendChild(el("p", "meta", "Hoje todos têm acesso total aos cards da Equipe. Com os perfis, só o Administrador cria cards da Equipe, muda link e identificação, arquiva, reativa, exclui, compartilha e resolve conflitos; o analista atualiza senha, datas, ciclo e escalonamento e cuida dos próprios cards em Meus."));
      row.appendChild(btn("btn", "lock", "Configurar perfis", configurarPerfis));
    }
  } else {
    // v2.4.0: "Meu perfil" — sem painel de perfis e sem dicas de Administrador para o analista
    c.querySelector("h3").textContent = "Meu perfil";
    const p = meuPerfil(), papel = papelAtual();
    const rot = papel === "admin" ? "Administrador (modo Administrador ativo)" : p && p.bloqueado ? "conta bloqueada: peça ao Administrador para desbloquear" : p && !p.ativo ? "desativado (cards da Equipe só leitura)" : "Analista";
    c.appendChild(el("p", "meta perfil-eu", p ? "Você: " + p.nome + " · " + rot : "Escolha o seu nome e digite a sua senha pessoal. Até lá você usa como analista."));
    if (!p) {
      const lista = lerPerfis().filter((x) => x.ativo);
      const sel = el("select"); sel.id = "perfilEscolha"; sel.setAttribute("aria-label", "Escolha o seu nome");
      sel.appendChild(el("option", "", "Escolha o seu nome na lista…")); sel.firstChild.value = "";
      lista.forEach((x) => { const o = el("option", "", x.nome); o.value = x.id; sel.appendChild(o); });
      sel.addEventListener("change", () => escolherPerfil(sel.value));
      row.appendChild(sel);
    }
    if (souAdminCadastrado()) {
      if (modoAdmin) { row.appendChild(btn("btn pri", "edit", "Abrir Gestão", abrirGestao)); row.appendChild(btn("btn", "x", "Sair do modo Administrador", () => sairModoAdmin(false))); }
      else row.appendChild(btn("btn link-discreto", "key", "Entrar como administrador", entrarComoAdmin));
    }
  }
  c.appendChild(row);
  box.appendChild(c);
}
async function escolherPerfil(id) {
  const p = lerPerfis().find((x) => x.id === id); if (!p) return false;
  const eu = meuPerfil();
  if (eu && eu.papel !== "admin") { toast("Só o Administrador muda o seu nome (Gestão)."); render(); return false; }
  if (p.papel !== "admin") return confirmarSenhaPessoal(p); // v2.4.0: o analista confirma com a senha pessoal
  if (p.papel === "admin" && !(eu && eu.id === p.id)) { // v2.3.0 (item 5): nome de admin só com a senha desse admin
    const ok = await confirmarSenhaDoAdmin(p);
    if (!ok) { render(); return false; }
    Dados.gravarTexto(ADMIN_CONF_KEY, p.id);
  }
  if (modoAdmin) sairModoAdmin(true);
  Dados.gravarTexto(PERFIL_ID_KEY, p.id); Dados.gravarTexto(AUTOR_KEY, p.nome);
  toast("Nome salvo: " + p.nome); render();
  return true;
}
function confirmarSenhaDoAdmin(p) {
  return janela("dlgPerfis", (box, fim) => {
    box.classList.add("dlg-admin");
    dlgPadrao(box, "Confirme que é você", "Para usar o nome " + p.nome + " neste aparelho, digite a senha de " + p.nome + ".");
    const s = campoPadrao(box, "paNomeSenha", "Senha de " + p.nome, { senha: true, auto: "current-password" });
    const er = erroPadrao(box);
    const ok = botoesPadrao(box, "Cancelar", "Confirmar", () => fim(false), async () => {
      er.textContent = "";
      if (Date.now() < esperaAdminAte) { er.textContent = "Muitas tentativas. Aguarde alguns segundos."; return; }
      ok.disabled = true;
      try {
        const c = (await perfisCompletos()).find((x) => x.id === p.id);
        if (!c || !c.adminHash) { er.textContent = "A senha deste perfil ainda não chegou neste aparelho. Sincronize e tente de novo."; return; }
        const h = await derivarSenha(s.value, c.adminSalt, c.adminIter || PERFIS_ITER);
        if (!hashIguais(h, c.adminHash)) { tentativasAdmin++; if (tentativasAdmin >= 5) { tentativasAdmin = 0; esperaAdminAte = Date.now() + 30000; } er.textContent = "Senha incorreta."; s.select(); return; }
        tentativasAdmin = 0; s.value = ""; fim(true);
      } catch (e) { er.textContent = "Não foi possível conferir a senha (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
  });
}
/* v2.3.0 (item 5): "Salvar nome" em Arquivo da equipe não aceita o nome de um admin (use a lista, com a senha). */
function nomeLivre(v) {
  if (!perfisAtivos()) return true;
  const p = perfilPorNome(v), eu = meuPerfil();
  if (p && p.papel === "admin" && !(eu && eu.id === p.id)) { toast("Esse nome é de um Administrador. Escolha na lista em Perfis da equipe (pede a senha de Administrador)."); return false; }
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
  const restr = analistaPuro(); // v3.0.1 (item 4)
  const tudo = () => { CAMPOS_FICHA_ADMIN.concat(CAMPOS_FICHA_ANALISTA).forEach(travar); sheet.classList.add("ficha-leitura"); $("fichaTitulo").textContent = "Ver acesso (só leitura)"; sheet.querySelectorAll("#escEdit input, #escEdit select, #escEdit textarea, #escEdit button, #escAdd").forEach((x) => { x.disabled = true; x.setAttribute("data-trava", "1"); }); };
  if (restr && it.arquivado_em) { tudo(); return; } // arquivado: só leitura
  if (!compartilhado(it)) { if (restr) CAMPOS_FICHA_ADMIN.filter((k) => k !== "fUsuario").forEach(travar); else travar("fVisibilidade"); return; } // card de Meus não vira card da Equipe; analista só preenche login, senha, datas e escalonamento
  CAMPOS_FICHA_ADMIN.forEach(travar);
  if (papel === "leitura") { CAMPOS_FICHA_ANALISTA.forEach(travar); sheet.classList.add("ficha-leitura"); $("fichaTitulo").textContent = "Ver acesso (só leitura)"; sheet.querySelectorAll("#escEdit input, #escEdit select, #escEdit textarea, #escEdit button").forEach((x) => { x.disabled = true; x.setAttribute("data-trava", "1"); x.title = DICA_ADMIN; }); } else if (papel === "analista") { $("fichaTitulo").textContent = "Editar acesso (operação)"; }
}
/* Importação: o analista não importa para a Equipe (os cards da Equipe do arquivo ficam de fora). */
function filtrarImportacaoEquipe(lista) {
  if (podeAdminEquipe()) return { itens: lista, fora: 0 };
  const ids = new Set(itens.filter(compartilhado).map((x) => x.id));
  const ok = lista.filter((x) => !(compartilhado(x) || ids.has(x.id)));
  return { itens: ok, fora: lista.length - ok.length };
}
