/* Caderno de Acessos — js/sincronizacao.js
 * Sincronização com o arquivo da equipe (pasta do OneDrive): adaptador, carimbo de mudanças, sincronizarAgora(), aplicarResultado().
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Arquivo da equipe (sincronização via pasta do OneDrive) ---------- */
const AUTOR_KEY = "caderno-acessos-autor";
const SYNC_META_KEY = "caderno-acessos-sync-meta";
const REMOVIDOS_KEY = "caderno-acessos-removidos";
const HIST_KEY = "caderno-acessos-historico";
const SYNC_ARQUIVO = "caderno-equipe.json";
const LOGERR_KEY = "caderno-acessos-log-erros";
const MIGRAR_KEY = "caderno-acessos-aviso-pasta";
const MODELOS_KEY = "caderno-acessos-modelos";
const MEUS_MODELOS_KEY = "caderno-acessos-meus-modelos";
const MODELOS_DEC_KEY = "caderno-acessos-modelos-decisoes";
let modelosPendentesEnvio = false;
// Adaptadores trocáveis (no futuro, um servidor pode entrar no lugar)
const syncPasta = window.CadernoSync ? CadernoSync.AdaptadorPasta() : null;
const syncArquivo = window.CadernoSync ? CadernoSync.AdaptadorArquivo() : null;
const syncFila = window.CadernoSync ? CadernoSync.Fila() : null;
const syncEstado = { suportado: false, pastaSuportada: false, vinculado: false, modo: "", nome: "", pendente: false, rodando: false, agendado: false, acoes: [] };
let syncAtivo = null;
function adaptador() { return window.__syncAdaptadorTeste || syncAtivo; }
function autor() { return (localStorage.getItem(AUTOR_KEY) || "").trim(); }
function syncMeta() { return lerJSON(SYNC_META_KEY, { ultimaSync: "", marcas: null }); }
function gravarMeta(m) { localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); }
function removidosLocais() { return lerJSON(REMOVIDOS_KEY, []); }
/* Mesma regra do JSON da equipe: só cards de Equipe; Individuais nunca saem. */
function compartilhado(it) { return !!it && it.visibilidade !== "Individual"; }
function itemParaEquipe(it) { const c = semSegredoIndividual(it); const n = window.CadernoSync && CadernoSync.normalizarCard ? CadernoSync.normalizarCard(c) : c; return n && n.id ? n : c; }
// v2.0.0: a marca é a do card normalizado (o mesmo que vai para o arquivo): ajustes de formato não contam como edição.
function marcaDe(it) { return window.CadernoSync ? CadernoSync.semMeta(itemParaEquipe(it)) : JSON.stringify(it); }
/* Chamada a cada save(): carimba updatedAt/updatedBy nos cards de equipe alterados e cria tombstones das exclusões. */
function carimbarMudancas() {
  const meta = syncMeta();
  const novas = {};
  itens.filter(compartilhado).forEach((it) => { novas[it.id] = marcaDe(it); });
  if (!meta.marcas) { meta.marcas = novas; gravarMeta(meta); return false; }
  const agora = new Date().toISOString(); const quem = autor();
  let mudou = false;
  const bases = meta.bases || {};
  itens.filter(compartilhado).forEach((it) => {
    if (meta.marcas[it.id] !== novas[it.id]) {
      let antes = null; try { antes = meta.marcas[it.id] ? JSON.parse(meta.marcas[it.id]) : null; } catch (e) { antes = {}; }
      registrarAcao(!antes ? "novo card" : (!antes.arquivado_em && it.arquivado_em) ? "arquivar" : (antes.arquivado_em && !it.arquivado_em) ? "reativar" : antes.senha !== it.senha ? "atualizar senha" : "salvar", nomeDe(it));
      if (restaurando.has(it.id)) addHist({ id: "r-" + it.id + "-" + agora, tipo: "restaurado", card: String(nomeDe(it)).slice(0, 200), texto: "Card restaurado por " + (quem || "analista"), escopo: "Equipe", quando: agora });
      else histAcao(tipoMudanca(antes, it), it, "Equipe", "c-" + it.id + "-" + agora, agora);
      // v2.0.0: baseAt = versão em que esta edição se baseou (a última vista na sincronização), para detectar edição simultânea
      it.baseAt = Object.prototype.hasOwnProperty.call(bases, it.id) ? (bases[it.id] || "") : (it.updatedAt || "");
      it.updatedAt = agora; it.updatedBy = quem; mudou = true;
      if (typeof marcarAssinar === "function") marcarAssinar("c:" + it.id);
    }
  });
  let rem = removidosLocais();
  Object.keys(meta.marcas).forEach((id) => {
    if (!(id in novas)) {
      const antigo = itens.find((x) => x.id === id);
      rem = rem.filter((t) => t.id !== id);
      let titulo = antigo ? nomeDe(antigo) : ""; try { if (!titulo) titulo = nomeDe(JSON.parse(meta.marcas[id])); } catch (e) {}
      registrarAcao("excluir", titulo);
      if (paraLixeira.has(id)) addHist({ id: "x-" + id + "-" + agora, tipo: "lixeira", card: String(titulo).slice(0, 200), escopo: "Equipe", quando: agora });
      else histAcao("excluido", { titulo: titulo }, "Equipe", "x-" + id + "-" + agora, agora);
      rem.push({ id: id, deletedAt: agora, deletedBy: quem, titulo: titulo });
      if (typeof marcarAssinar === "function") marcarAssinar("t:" + id);
      mudou = true;
    }
  });
  const antes = rem.length;
  rem = rem.filter((t) => !(t.id in novas) || CadernoSync.ts(t.deletedAt) >= CadernoSync.ts((itens.find((x) => x.id === t.id) || {}).updatedAt));
  if (rem.length !== antes) mudou = true;
  localStorage.setItem(REMOVIDOS_KEY, JSON.stringify(rem));
  itens.filter(compartilhado).forEach((it) => { novas[it.id] = marcaDe(it); });
  meta.marcas = novas; gravarMeta(meta);
  if (atualizarMeusModelos()) mudou = true;
  return mudou;
}
const restaurando = new Set(), paraLixeira = new Set(); // v2.0.0: ids sendo restaurados da / movidos para a Lixeira (tipo certo no Histórico)
function dataHoraBR(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}
function horaBR(iso) { const d = new Date(iso); return isNaN(d) ? "" : String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function textoMudanca(m) {
  const nome = nomeDe(m.item);
  const acao = { novo: "adicionado", atualizado: "atualizado", removido: "excluído" }[m.tipo] || "alterado";
  return "Fornecedor " + nome + " " + acao + (m.por ? " por " + m.por : "") + (m.em && CadernoSync.ts(m.em) ? " em " + dataHoraBR(m.em) : "");
}
function registrarHistorico(textos) {
  if (!textos.length) return;
  const h = lerJSON(HIST_KEY, []);
  const agora = new Date().toISOString();
  textos.forEach((t) => h.unshift({ em: agora, texto: t }));
  localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 60))); // formato antigo mantido (volta para a v1.9.6)
}
let syncTimer = null;
/* Várias gravações seguidas viram uma só (espera 1,5 s sem novas alterações). */
function agendarSync() {
  if (!syncEstado.vinculado) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sincronizar(false), 1500);
}
/* Tudo passa pela fila: nunca duas sincronizações ao mesmo tempo nesta aba. Pedidos repetidos enquanto uma roda viram um só. */
function sincronizar(interativo) {
  if (!window.CadernoSync) return Promise.resolve(false);
  if (syncEstado.agendado && !interativo) return syncEstado.agendado;
  const p = syncFila.rodar(() => { syncEstado.agendado = null; return sincronizarAgora(interativo); });
  syncEstado.agendado = p;
  return p;
}
async function sincronizarAgora(interativo) {
  const a = adaptador();
  if (!a || !syncEstado.vinculado || document.body.classList.contains("travado")) return false;
  syncEstado.rodando = true; desenharBotaoSync();
  const acoes = syncEstado.acoes.splice(0);
  try {
    if (!(await a.permissao(!!interativo))) {
      syncEstado.pendente = true; syncEstado.acoes = acoes.concat(syncEstado.acoes);
      if (interativo) toast("Sem permissão para a pasta da equipe. Clique em Sincronizar e escolha “Permitir”.");
      return false;
    }
    let copiasMescladas = [], copiasFechadas = [], invalidos = [];
    let resultado = null;
    // ler → mesclar (principal + cópias de conflito) → gravar → reler para verificar. Repete se o arquivo estiver ocupado.
    await CadernoSync.comRetentativa(async () => {
      const bruto = await a.ler();
      notarPerfisNoArquivo(bruto); // v2.3.0 (item 1): até os perfis chegarem, este aparelho é analista
      const remoto0 = await abrirDocEquipe(bruto, false); // v1.9.5: decifra se protegido (pede a senha da equipe uma vez por aparelho)
      if (remoto0 && !CadernoSync.docValido(remoto0)) { const e = new Error("O arquivo vinculado não é um arquivo da equipe do Caderno."); e.name = "ArquivoInvalido"; throw e; }
      // v1.9.7: cada card do arquivo é conferido e limpo; o que estiver estragado é ignorado e vai para o log (não trava o app)
      invalidos = [];
      const lr = remoto0 ? CadernoSync.limparDoc(remoto0) : { doc: null, invalidos: [] };
      const remoto = lr.doc; lr.invalidos.forEach((x) => invalidos.push({ origem: SYNC_ARQUIVO, x: x }));
      const copias = [];
      for (const c of await a.lerCopias()) {
        if (!c.doc) continue;
        try { const d = await abrirDocEquipe(c.doc, true); if (CadernoSync.docValido(d)) { const lc = CadernoSync.limparDoc(d); lc.invalidos.forEach((x) => invalidos.push({ origem: c.nome, x: x })); copias.push({ nome: c.nome, doc: lc.doc }); } }
        catch (e) { copiasFechadas.push(c.nome); } // cópia cifrada com uma senha que este aparelho não conhece: fica na pasta
      }
      if (!localStorage.getItem(PRIMEIRO_KEY) && autor()) addHist({ id: "pa-" + idAparelho(), tipo: "primeiro", card: "", escopo: "Equipe" });
      carimbarMudancas();
      await assinarPendentes(); // v2.3.0 (item 6): o que foi feito no modo admin sai assinado
      const meta = syncMeta();
      let base = { itens: itens.filter(compartilhado).map(itemParaEquipe), removidos: removidosLocais() };
      let r = CadernoSync.mesclar(base, remoto, meta.ultimaSync);
      const mud = r.mudancasRemotas.slice(), conf = r.conflitos.slice(), remAqui = r.removidosAqui.slice(), voltaram = r.voltaram.slice();
      let localMudou = r.localMudou, precisa = r.remotoPrecisa || !remoto || !!seEstado.pendente || precisaCifrar(bruto);
      // v1.9.4: modelos (cards Individuais compartilhados, sem login/senha). O cache local repõe o que um app antigo (v1.9.3) tenha apagado ao gravar.
      let rm = CadernoSync.mesclar(modelosLocais(), CadernoSync.modelosDoDoc(remoto) || { itens: [], removidos: [] }, "", null);
      if (rm.remotoPrecisa) precisa = true;
      if (reporExtrasModelos(rm, CadernoSync.modelosDoDoc(remoto))) precisa = true;
      copias.forEach((c) => {
        const r2 = CadernoSync.mesclar({ itens: r.itens, removidos: r.removidos }, c.doc, meta.ultimaSync);
        r2.mudancasRemotas.forEach((m) => mud.push(m)); r2.conflitos.forEach((x) => conf.push(x)); r2.removidosAqui.forEach((x) => remAqui.push(x)); r2.voltaram.forEach((x) => voltaram.push(x));
        localMudou = localMudou || r2.localMudou; precisa = true; r = r2;
        rm = CadernoSync.mesclar({ itens: rm.itens, removidos: rm.removidos }, CadernoSync.modelosDoDoc(c.doc), "", null);
      });
      copiasFechadas = copiasFechadas.filter((n, i, l) => l.indexOf(n) === i);
      // v1.9.7: histórico da Equipe viaja no arquivo; primeiro o que veio do arquivo (vence pelo id), depois o deste aparelho e o deduzido das mudanças
      // v2.0.0: lixeira da Equipe e cópias de conflito (juntadas com a cópia local, que repõe o que um app v1.9.x tenha apagado)
      // v2.2.0: perfis (a cópia local repõe o que um app antigo apagou) e permissões dos cards da Equipe também no merge
      const pf = await mesclarPerfisSync(remoto, remoto0, copias);
      if (pf.precisa) precisa = true;
      const perm = await filtrarPermissoesRemoto(r, base, pf.itens, !meta.ultimaSync, { remoto: remoto, copias: copias, remAqui: remAqui, voltaram: voltaram });
      if (perm.mudou) { precisa = true; localMudou = true; }
      const ex = mesclarExtras(remoto, copias, r, conf, remAqui, voltaram);
      if (ex.precisa) precisa = true;
      const histLocal = lerHist();
      const histEq = CadernoSync.mesclarHistorico([remoto ? remoto.historico : [], ...copias.map((c) => c.doc.historico), histLocal.filter((e) => e.escopo === "Equipe" && !e.local), mud.map(histDeMudanca), ex.hist, perm.hist], CadernoSync.HIST_MAX);
      const idsRem = new Set(((remoto && remoto.historico) || []).map((e) => e.id));
      if (histEq.some((e) => !idsRem.has(e.id))) precisa = true;
      if (precisa) await a.gravar(await fecharDocEquipe(CadernoSync.montarDoc(r.itens, r.removidos, autor(), compartilhado, { modelos: rm.itens, modelosRemovidos: rm.removidos, historico: histEq, lixeira: ex.lixeira, lixeiraRemovidos: ex.lixRem, conflitos: ex.conflitos, conflitosResolvidos: ex.confRes, perfis: pf.gravar ? pf.itens : [] }), bruto));
      resultado = { r: r, mud: mud, conf: ex.novosConf, localMudou: localMudou, rm: rm, histEq: histEq, ex: ex, perfis: pf.itens };
      copiasMescladas = copias.map((c) => c.nome);
    }, { aoFalhar: () => { syncEstado.pendente = true; desenharBotaoSync(); } });
    await concluirSenhaPendente(a);
    gravarHist(CadernoSync.mesclarHistorico([resultado.histEq, lerHist()], 100));
    if (!localStorage.getItem(PRIMEIRO_KEY) && autor()) localStorage.setItem(PRIMEIRO_KEY, new Date().toISOString());
    for (const v of invalidos.slice(0, 20)) await registrarErro("ignorar card inválido", (v.x.titulo ? v.x.titulo + " " : "") + "(posição " + (v.x.pos + 1) + " em " + v.origem + ")", { name: "CardInvalido", message: "card com formato errado foi ignorado e não foi aplicado" }, a);
    for (const nome of copiasFechadas) await registrarErro("juntar cópia de conflito", nome, { name: "SenhaEquipe", message: "cópia protegida com outra senha da equipe; ficou na pasta" }, a);
    gravarModelosLocais({ itens: resultado.rm.itens.map(CadernoSync.limparModelo), removidos: resultado.rm.removidos });
    adotarModelosOrfaos();
    gravarLixeiraEq({ itens: resultado.ex.lixeira, removidos: resultado.ex.lixRem });
    gravarConflitos({ itens: resultado.ex.conflitos, resolvidos: resultado.ex.confRes });
    await concluirPerfisSync(resultado.perfis);
    aplicarResultado(resultado.r);
    // só apaga as cópias depois da gravação verificada do arquivo principal
    for (const nome of copiasMescladas) {
      try { await CadernoSync.comRetentativa(() => a.apagarCopia(nome), { tentativas: 3, atrasos: [500, 1500] }); registrarHistorico(["Cópia de conflito " + nome + " juntada ao arquivo da equipe e apagada"]); addHist({ tipo: "copia", card: nome, quem: "", escopo: "Equipe", local: true }); }
      catch (e) { await registrarErro("apagar cópia de conflito", nome, e, a); }
    }
    syncEstado.pendente = false;
    const textos = resultado.mud.map(textoMudanca);
    resultado.conf.forEach((c) => textos.push(tituloConflito(c) + ": " + c.titulo + ". Ficou a versão mais recente; a outra está guardada (Mais › Conflitos de edição)."));
    registrarHistorico(textos);
    renderAposSync(); // v1.9.6: sempre redesenha (os objetos dos cards da Equipe foram trocados)
    const dupNovos = avisarDuplicadosNovos();
    if (resultado.conf.length) toast(textos[textos.length - 1], { texto: "Ver as duas versões", ms: 9000, fn: () => verConflito(resultado.conf[0].id) });
    else if (dupNovos) { /* toast de duplicados já mostrado */ }
    else if (copiasMescladas.length) toast(copiasMescladas.length + (copiasMescladas.length === 1 ? " cópia de conflito do OneDrive juntada" : " cópias de conflito do OneDrive juntadas") + " ao arquivo da equipe");
    else if (textos.length === 1) toast(textos[0]);
    else if (textos.length > 1) toast(textos.length + " alterações da equipe recebidas (veja o Histórico em Mais)");
    else if (interativo) toast("Arquivo da equipe sincronizado");
    setTimeout(() => verificarModelos(false), 0);
    return true;
  } catch (e) {
    syncEstado.pendente = true;
    syncEstado.acoes = acoes.concat(syncEstado.acoes);
    if (e && e.name === "SenhaEquipeNecessaria") {
      seEstado.protegido = true; seEstado.precisaSenha = true; seEstado.env = e.env;
      if (interativo || !seEstado.dispensado) setTimeout(() => pedirSenhaEquipe(e.env), 0);
      if (aba === "mais") render();
      return false;
    }
    const msg = e && e.name === "ArquivoInvalido" ? e.message : descreverErro(e);
    const ult = acoes[acoes.length - 1];
    await registrarErro(ult ? ult.acao : "sincronizar", acoes.map((x) => x.card).filter(Boolean).slice(-5).join(", "), e, a);
    toast(msg + " Suas alterações estão salvas neste aparelho.");
    return false;
  } finally {
    syncEstado.rodando = false; desenharBotaoSync();
  }
}
// Redesenha sem atrapalhar: com ficha/diálogo aberto ou digitando, espera fechar; mantém a rolagem.
let renderPendente = false;
function podeRenderAgora() {
  if (document.querySelector(".sheet.on, .drawer.on, .menu-card")) return false;
  const a = document.activeElement;
  if (a && a.closest && a.closest("main") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  return true;
}
function renderAposSync() {
  if (!podeRenderAgora()) { renderPendente = true; return; }
  renderPendente = false;
  const y = window.scrollY; render(); if (window.scrollY !== y) window.scrollTo(0, y);
}
function renderSePendente() { if (renderPendente) setTimeout(renderAposSync, 0); }
function aplicarResultado(r0) {
  // Alterações feitas enquanto o arquivo era gravado não se perdem: mescla de novo o que está na tela com o que foi gravado.
  carimbarMudancas();
  const r = CadernoSync.mesclar({ itens: itens.filter(compartilhado).map(itemParaEquipe), removidos: removidosLocais() }, { tipo: CadernoSync.TIPO, itens: r0.itens, removidos: r0.removidos }, "");
  if ((r.remotoPrecisa || modelosPendentesEnvio) && syncMeta().ultimaSync) setTimeout(agendarSync, 0);
  modelosPendentesEnvio = false;
  // Individuais ficam intactos; cards de equipe passam a ser os do merge
  const porId = new Map(r.itens.map((it) => [it.id, it]));
  const locaisPorId = new Map(itens.map((it) => [it.id, it]));
  const novaLista = [];
  itens.forEach((it) => {
    if (!compartilhado(it)) { if (!porId.has(it.id)) novaLista.push(it); return; }
    if (porId.has(it.id)) { novaLista.push(porId.get(it.id)); porId.delete(it.id); }
  });
  porId.forEach((it) => { const l = locaisPorId.get(it.id); novaLista.push(l && !compartilhado(l) ? l : it); });
  itens = novaLista;
  localStorage.setItem(KEY, JSON.stringify(itens));
  localStorage.setItem(REMOVIDOS_KEY, JSON.stringify(r.removidos));
  const marcas = {}, bases = {}; itens.filter(compartilhado).forEach((it) => { marcas[it.id] = marcaDe(it); bases[it.id] = it.updatedAt || ""; });
  gravarMeta(Object.assign({}, syncMeta(), { ultimaSync: new Date().toISOString(), marcas: marcas, bases: bases, marcaV: 3 }));
  fotoMeus = fotoIndividuais();
  if (typeof fotografarEquipe === "function") fotografarEquipe();
}
