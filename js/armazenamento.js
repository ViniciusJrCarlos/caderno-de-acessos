/* Caderno de Acessos — js/armazenamento.js
 * Estado dos cards (itens, aba, edit) e gravação no aparelho: load(), save(), migrações e datas (hoje, diasAte, statusDe), lerJSON().
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const KEY = "caderno-acessos-web-v1";
let aba = "equipe";
let itens = [];
let edit = null;
function hoje() {
  return new Date().toISOString().slice(0, 10);
}
// v2.0.0: data inválida nunca derruba o app ("ontem" numa planilha deixava tudo em branco na v1.9.9): devolve "".
function addDias(iso, n) {
  const d = new Date(String(iso || "").slice(0, 10) + "T12:00:00");
  if (isNaN(d) || !Number.isFinite(Number(n))) return "";
  d.setDate(d.getDate() + Number(n));
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}
function diasAte(it) {
  const fim = addDias(it.ultima, Number(it.ciclo));
  if (!fim) return null;
  const v = Math.round((new Date(fim + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 86400000);
  return Number.isFinite(v) ? v : null;
}
function statusDe(it) {
  if (it.arquivado_em) return "Arquivado";
  if (!it.ciclo || it.ciclo === "Nunca") return "Sem expiração";
  if (!it.ultima) return "Ativo";
  const dias = diasAte(it);
  if (dias == null) return "Ativo";
  if (dias < 0) return "Vencido";
  if (dias <= 7) return "Vencendo";
  return "Ativo";
}
function rotulo(it) {
  const st = statusDe(it);
  if (st === "Arquivado" || st === "Sem expiração" || st === "Ativo" && (!it.ultima || it.ciclo === "Nunca")) return st === "Sem expiração" ? "Não expira" : st;
  if (!it.ultima || it.ciclo === "Nunca") return st;
  const dias = diasAte(it);
  if (dias == null) return st;
  if (dias < 0) return "Vencido há " + Math.abs(dias) + " dia(s)";
  return "Vence em " + dias + " dias";
}
function exemplos() {
  // Dados 100% fictícios para demonstração (ids s1..s11).
  const c = (o) => Object.assign({ horario: "", escalonamento: "", escalonamentos: [], obs: "", arquivado_em: null }, o);
  // v1.9.2: um único card de exemplo, "Individual" para nunca ir ao arquivo da equipe.
  return [
    c({ id: "s12", titulo: "Portal Exemplo (apague-me)", aplicacao: "Sistema Exemplo", cliente: "Empresa Fictícia", categoria: "Externo", visibilidade: "Individual", url: "https://portal.exemplo.example", usuario: "meu.usuario", senha: "exemplo123", ciclo: "90", ultima: addDias(hoje(), -10), horario: "Seg–Sex 08–18",
      escalonamento: "N1 portal · N2 0800 000 0001",
      escalonamentos: [
        { nivel: 1, canal: "portal", valor: "https://portal.exemplo.example/chamados", nome: "Service Desk", horario: "Seg–Sex 08–18", obs: "Abrir chamado no portal" },
        { nivel: 2, canal: "telefone", valor: "0800 000 0001", nome: "Suporte N2", horario: "24x7", obs: "" }
      ], obs: "Card fictício de exemplo. Pode apagar." })
  ];
}
function load() {
  try { itens = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { itens = []; }
  if (!Array.isArray(itens)) itens = [];
  // v2.0.0: descarta lixo (não objeto / sem id) e saneia datas e ciclo dos cards guardados (cliente já quebrado pela v1.9.9 se recupera)
  itens = itens.filter((it) => it && typeof it === "object" && !Array.isArray(it) && it.id != null && it.id !== "");
  // v2.0.0 (E1): marcas calculadas ANTES de qualquer ajuste, nas duas fórmulas (antiga e nova), para a migração não carimbar nada
  const marcasAntes = {};
  if (window.CadernoSync) itens.filter(compartilhado).forEach((it) => { marcasAntes[it.id] = [CadernoSync.semMetaV1(it), CadernoSync.semMetaV1(itemParaEquipe(it)), CadernoSync.semMeta(it), marcaDe(it)]; });
  let saneou = false;
  if (window.CadernoSync) itens.forEach((it) => { if (CadernoSync.sanearDatas(it)) saneou = true; });
  const antes = itens.length;
  // Remove exemplos de versões anteriores (só se ainda estiverem com a senha de exemplo original).
  itens = itens.filter((it) => !(["j1", "j2", "a1", "f1", "f2", "f3"].includes(it.id) && it.senha === "exemplo"));
  const removeuAntigos = itens.length < antes;
  if (localStorage.getItem(KEY) === null || removeuAntigos) {
    const ids = new Set(itens.map((it) => it.id));
    exemplos().forEach((it) => { if (!ids.has(it.id)) itens.push(it); });
  }
  // Exemplos novos entram uma única vez em quem já tem cards (se apagar, não volta).
  let entregues = [];
  try { entregues = JSON.parse(localStorage.getItem(KEY + "_exemplos") || "[]"); } catch (e) { entregues = []; }
  let mudou = removeuAntigos;
  exemplos().forEach((it) => {
    if (!entregues.includes(it.id)) {
      // v1.9.2: quem já usa o app não recebe o novo exemplo (só marca como entregue).
      entregues.push(it.id);
    }
  });
  localStorage.setItem(KEY + "_exemplos", JSON.stringify(entregues));
  itens.forEach((it) => {
    if (!Array.isArray(it.escalonamentos)) it.escalonamentos = [];
    if (!it.escalonamentos.length && it.escalonamento) {
      const parsed = parseEscalonamentoTexto(it.escalonamento);
      if (parsed.length) { it.escalonamentos = parsed; mudou = true; }
    }
  });
  // v1.4: enriquece exemplos fictícios que ainda estão com a senha de demo e sem níveis estruturados.
  const demoSenhas = new Set(["fornecedor123", "nuvem123", "exemplo321"]);
  const porId = Object.fromEntries(exemplos().map((e) => [e.id, e]));
  itens.forEach((it) => {
    const ex = porId[it.id];
    if (!ex || !ex.escalonamentos || !ex.escalonamentos.length) return;
    if (!demoSenhas.has(it.senha)) return;
    if (it.escalonamentos && it.escalonamentos.length) return;
    it.escalonamentos = ex.escalonamentos.map((n) => Object.assign({}, n));
    if (!it.escalonamento) it.escalonamento = ex.escalonamento || resumoEscalonamentos(it.escalonamentos);
    mudou = true;
  });
  if (mudou || saneou) localStorage.setItem(KEY, JSON.stringify(itens));
  if (window.CadernoSync && !syncMeta().marcas) carimbarMudancas();
  else if (window.CadernoSync) migrarMarcas(marcasAntes);
  if (typeof fotografarEquipe === "function") fotografarEquipe();
}
/* v2.0.0 (E1): abrir o app ou ajustar cards antigos (sem níveis, só o texto do escalonamento, data inválida) nunca muda
 * updatedAt/updatedBy nem cria Histórico. Se a marca guardada era a do card antes do ajuste (em qualquer fórmula), passa a ser a do
 * card ajustado. Idempotente: rodar de novo não muda nada. Cards realmente editados (marca diferente) continuam sendo carimbados. */
function migrarMarcas(antes) {
  const meta = syncMeta(); if (!meta.marcas) return;
  let mudou = false;
  itens.filter(compartilhado).forEach((it) => {
    const m = meta.marcas[it.id]; const a = antes[it.id]; if (m == null || !a) return;
    const nova = marcaDe(it);
    if (m !== nova && a.includes(m)) { meta.marcas[it.id] = nova; mudou = true; }
  });
  if (meta.marcaV !== 3) { meta.marcaV = 3; mudou = true; }
  if (mudou) gravarMeta(meta);
}
function save() {
  if (typeof guardarPermissoes === "function") guardarPermissoes(); // v2.2.0: o analista não grava o que só o admin pode mudar
  if (window.CadernoSync) carimbarMudancas();
  registrarMeus();
  restaurando.clear(); paraLixeira.clear(); paraLixeiraMeus.clear(); restaurandoMeus.clear();
  localStorage.setItem(KEY, JSON.stringify(itens));
  if (typeof fotografarEquipe === "function") fotografarEquipe();
  render();
  if (window.CadernoSync) agendarSync();
}
function lerJSON(k, pad) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? pad : v; } catch (e) { return pad; } }
