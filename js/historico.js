/* Caderno de Acessos — js/historico.js
 * Histórico estruturado (Equipe e Meu): addHist(), histAcao(), registros de Meus, migração e o bloco do Histórico em Mais.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- v1.9.7: Histórico estruturado { id, tipo, card, quem, quando, escopo } ----------
 * Ações da Equipe viajam no arquivo da equipe (cifrado quando protegido), juntadas pelo id, últimas 100.
 * Ações dos cards Meus ficam só neste aparelho. Nunca guarda senhas, só o nome do card e o tipo da ação. */
const HIST2_KEY = "caderno-acessos-historico-v2";
const APARELHO_KEY = "caderno-acessos-aparelho";
const PRIMEIRO_KEY = "caderno-acessos-primeiro-acesso";
let histLote = null; // importação: um registro só, em vez de um por card
function idAparelho() {
  let v = localStorage.getItem(APARELHO_KEY);
  if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem(APARELHO_KEY, v); }
  return v;
}
function lerHist() { return window.CadernoSync ? CadernoSync.limparHistorico(lerJSON(HIST2_KEY, [])) : []; }
function gravarHist(l) { localStorage.setItem(HIST2_KEY, JSON.stringify(window.CadernoSync ? CadernoSync.mesclarHistorico([l], 100) : l.slice(0, 100))); }
function addHist(e) {
  const o = Object.assign({ id: "h-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), card: "", quem: autor(), quando: new Date().toISOString(), escopo: "Equipe" }, e);
  const l = lerHist().filter((x) => x.id !== o.id); l.unshift(o); gravarHist(l);
}
function tipoMudanca(antes, it) {
  if (!antes) return "adicionado";
  if (!antes.arquivado_em && it.arquivado_em) return "arquivado";
  if (antes.arquivado_em && !it.arquivado_em) return "reativado";
  if ((antes.senha || "") !== (it.senha || "")) return "senha";
  if (!antes.modeloDono && it.modeloDono) return "compartilhado";
  if (antes.modeloDono && !it.modeloDono) return "parou";
  return "editado";
}
function histAcao(tipo, it, escopo, id, quando) {
  if (histLote) { histLote.n++; return; }
  addHist({ id: id, tipo: tipo, card: String(nomeDe(it || {}) || "").slice(0, 200), escopo: escopo, quando: quando || new Date().toISOString() });
}
/* Cards Meus (Individuais): compara com a última foto em memória a cada save(). */
let fotoMeus = null;
const restaurandoMeus = new Set();
function fotoIndividuais() { const m = new Map(); itens.filter((x) => !compartilhado(x)).forEach((x) => m.set(x.id, JSON.stringify(x))); return m; }
function registrarMeus() {
  const nova = fotoIndividuais();
  if (fotoMeus) {
    const agora = new Date().toISOString();
    nova.forEach((j, id) => {
      const a = fotoMeus.get(id); if (a === j) return;
      const antes = a ? JSON.parse(a) : null, it = JSON.parse(j);
      if (restaurandoMeus.has(id)) addHist({ id: "ir-" + id + "-" + agora, tipo: "restaurado", card: String(nomeDe(it)).slice(0, 200), texto: "Card restaurado por " + (autor() || "você"), escopo: "Meu", local: true, quando: agora });
      else histAcao(tipoMudanca(antes, it), it, "Meu", "i-" + id + "-" + agora, agora);
      // v2.0.0: card Meu também ganha data de alteração (só neste aparelho), para a reimportação não voltar a uma versão antiga
      const vivo = itens.find((x) => x.id === id); if (vivo && !histLote) { vivo.updatedAt = agora; nova.set(id, JSON.stringify(vivo)); }
    });
    fotoMeus.forEach((j, id) => { if (!nova.has(id) && !itens.some((x) => x.id === id)) { if (paraLixeiraMeus.has(id)) addHist({ id: "ix-" + id + "-" + agora, tipo: "lixeira", card: String(nomeDe(JSON.parse(j))).slice(0, 200), escopo: "Meu", local: true, quando: agora }); else histAcao("excluido", JSON.parse(j), "Meu", "ix-" + id + "-" + agora, agora); } });
  }
  fotoMeus = nova;
}
/* Entradas vindas da sincronização (mudanças de outros analistas). Mesmo id da entrada criada por quem fez: não duplica. */
function histDeMudanca(m) {
  const it = m.item || {};
  const tipo = m.tipo === "novo" ? "adicionado" : m.tipo === "removido" ? "excluido" : "editado";
  return { id: (m.tipo === "removido" ? "x-" : "c-") + it.id + "-" + (m.em || ""), tipo: tipo, card: String(nomeDe(it)).slice(0, 200), quem: m.por || "", quando: m.em || new Date().toISOString(), escopo: "Equipe" };
}
/* Migração única do histórico antigo (só texto) para o novo formato. */
function migrarHistorico() {
  if (localStorage.getItem(HIST2_KEY) != null) return;
  const velho = lerJSON(HIST_KEY, []);
  const l = (Array.isArray(velho) ? velho : []).filter((x) => x && x.texto).map((x, i) => ({ id: "v-" + i + "-" + String(x.em || ""), tipo: "texto", texto: String(x.texto).slice(0, 300), card: "", quem: "", quando: String(x.em || ""), escopo: "Equipe", local: true }));
  gravarHist(l);
  if (syncMeta().ultimaSync) localStorage.setItem(PRIMEIRO_KEY, "migrado"); // quem já usava não ganha "Primeiro acesso" falso
}
function registrarAcao(acao, card) { syncEstado.acoes.push({ acao: acao, card: card }); if (syncEstado.acoes.length > 20) syncEstado.acoes.shift(); }
function descreverErro(e) {
  const n = e && e.name;
  if (n === "NotAllowedError" || n === "SecurityError") return "Sem permissão para a pasta/arquivo da equipe. Clique em Sincronizar e escolha “Permitir”.";
  if (n === "NotFoundError") return "O arquivo da equipe não foi encontrado (pasta movida ou renomeada). Vincule de novo em Mais.";
  if (n === "VerificacaoFalhou") return "Outra pessoa gravou ao mesmo tempo. Tentei de novo e não consegui; clique em Sincronizar em instantes.";
  if (n === "SyntaxError") return "O arquivo da equipe está incompleto (o OneDrive ainda está baixando). Aguarde e clique em Sincronizar.";
  if (n === "NotReadableError" || n === "NoModificationAllowedError" || n === "InvalidStateError" || n === "InvalidModificationError") return "O arquivo da equipe está em uso pelo OneDrive. Aguarde alguns segundos e clique em Sincronizar.";
  return "Não foi possível sincronizar agora" + (e && e.message ? " (" + e.message + ")" : "") + ".";
}
/* Log de erros: no aparelho (Mais → Log de erros) e, com a pasta vinculada, em caderno-equipe-log.csv. Nunca inclui senhas. */
async function registrarErro(acao, card, e, a) {
  const campos = [new Date().toISOString(), autor() || "(sem nome)", acao, card || "", ((e && e.name) || "Erro") + ": " + String((e && e.message) || "").slice(0, 200)];
  const l = lerJSON(LOGERR_KEY, []); l.unshift(campos); localStorage.setItem(LOGERR_KEY, JSON.stringify(l.slice(0, 100)));
  const linha = [new Date().toLocaleString("pt-BR")].concat(campos.slice(1));
  try { if (a && a.registrarLog) await CadernoSync.comRetentativa(() => a.registrarLog(linha), { tentativas: 3, atrasos: [400, 900] }); } catch (x) { /* log em arquivo é melhor esforço */ }
}
async function escolherAdaptador() {
  if (window.__syncAdaptadorTeste) return window.__syncAdaptadorTeste;
  if (syncPasta && syncPasta.suportado() && await syncPasta.vinculado()) return syncPasta;
  if (syncArquivo && syncArquivo.suportado() && await syncArquivo.vinculado()) return syncArquivo;
  return null;
}
async function atualizarEstadoSync() {
  syncEstado.pastaSuportada = !!(syncPasta && syncPasta.suportado()) || !!(window.__syncAdaptadorTeste && window.__syncAdaptadorTeste.modo === "pasta");
  syncEstado.suportado = syncEstado.pastaSuportada || !!(syncArquivo && syncArquivo.suportado()) || !!window.__syncAdaptadorTeste;
  syncAtivo = await escolherAdaptador();
  const a = adaptador();
  syncEstado.vinculado = !!(a && await a.vinculado());
  syncEstado.modo = syncEstado.vinculado ? a.modo : "";
  syncEstado.nome = syncEstado.vinculado ? await a.nome() : "";
  desenharBotaoSync();
}
function desenharBotaoSync() {
  const b = $("btnSync"); if (!b) return;
  b.hidden = !syncEstado.vinculado;
  const ult = syncMeta().ultimaSync;
  $("syncInfo").textContent = syncEstado.rodando ? "Sincronizando…" : syncEstado.pendente ? "Clique para sincronizar" : ult ? "Última sincronização " + horaBR(ult) : "Ainda não sincronizado";
  b.classList.toggle("pendente", syncEstado.pendente);
  b.title = syncEstado.nome ? "Sincronizar com " + syncEstado.nome : "Sincronizar";
}
/* v1.9.7: Histórico com ícone, ação, card, quem, quando e etiqueta Equipe/Meu. */
const HIST_ROT = {
  adicionado: ["➕", "Card adicionado"], editado: ["✏️", "Card editado"], senha: ["🔑", "Senha alterada"], arquivado: ["📦", "Card arquivado"],
  reativado: ["♻️", "Card reativado"], excluido: ["🗑️", "Card excluído"], compartilhado: ["📤", "Card compartilhado"], parou: ["🚫", "Parou de compartilhar"],
  importado: ["📥", "Importação"], "se-ativada": ["🛡️", "Arquivo protegido com senha da equipe"], "se-trocada": ["🛡️", "Senha da equipe trocada"],
  ignorado: ["🙈", "Card compartilhado ignorado"], "outra-operacao": ["🔗", "Card salvo com link repetido (outra operação)"], primeiro: ["👋", "Primeiro acesso"], conflito: ["⚠️", "Edição ao mesmo tempo"], "conflito-resolvido": ["✅", "Conflito resolvido"], lixeira: ["🗑️", "Movido para a Lixeira"], restaurado: ["♻️", "Card restaurado"], "lixeira-apagado": ["❌", "Apagado de vez da Lixeira"], copia: ["🔀", "Cópia de conflito juntada"], texto: ["🕘", ""]
};
let histFiltro = "todos";
function blocoHistorico(box) {
  const todos = lerHist();
  const c = el("article", "card painel-mais historico hist2");
  c.appendChild(el("h3", "", "Histórico"));
  c.appendChild(el("p", "meta", "Mostrando as últimas 100 ações"));
  const chips = el("div", "hist-chips");
  [["todos", "Todos"], ["Equipe", "Equipe"], ["Meu", "Meus"]].forEach(([k, t]) => {
    const b = btn("hist-chip" + (histFiltro === k ? " on" : ""), null, t, () => { histFiltro = k; render(); });
    b.dataset.filtro = k; b.setAttribute("aria-pressed", histFiltro === k ? "true" : "false"); chips.appendChild(b);
  });
  c.appendChild(chips);
  const l = todos.filter((e) => histFiltro === "todos" || e.escopo === histFiltro).slice(0, 100);
  if (!l.length) c.appendChild(el("p", "meta", "Nenhuma ação registrada ainda."));
  else {
    const ul = el("ul", "hist2-lista");
    l.forEach((e) => {
      const r = HIST_ROT[e.tipo] || HIST_ROT.texto;
      const li = el("li", "hist2-it"); li.dataset.tipo = e.tipo;
      li.appendChild(el("span", "hist2-ic", r[0]));
      const tx = el("div", "hist2-tx");
      if (e.tipo === "texto") tx.appendChild(el("b", "", e.texto || ""));
      else if (e.tipo === "primeiro") tx.appendChild(el("b", "", "Primeiro acesso de " + (e.quem || "analista")));
      else { tx.appendChild(el("b", "", r[1])); if (e.card) { tx.appendChild(document.createTextNode(" · ")); tx.appendChild(el("span", "hist2-card", e.card)); } }
      tx.appendChild(el("div", "hist2-sub", (e.quem && e.tipo !== "primeiro" ? "por " + e.quem + " · " : "") + dataHoraBR(e.quando)));
      li.appendChild(tx);
      li.appendChild(el("span", "hist2-tag " + (e.escopo === "Meu" ? "meu" : "equipe"), e.escopo === "Meu" ? "Meu" : "Equipe"));
      ul.appendChild(li);
    });
    c.appendChild(ul);
  }
  c.appendChild(el("div", "hist2-nota", "🔒 O histórico nunca mostra senhas, só que foram alteradas. Ações da Equipe viajam no arquivo da equipe (protegido, se houver senha da equipe); as dos cards Meus ficam só neste aparelho."));
  box.appendChild(c);
}
