/* Caderno de Acessos — js/importar-exportar.js
 * Exportar e importar JSON (equipe e backup pessoal) com prévia, e carregamento das bibliotecas de planilha (js/vendor).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Exportar / importar ---------- */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function semSegredoIndividual(it) {
  if (it.visibilidade !== "Individual") return Object.assign({}, it);
  const c = Object.assign({}, it);
  c.usuario = "";
  c.senha = "";
  return c;
}
function exportarEquipe() {
  if (!podeArquivosEquipe()) return negarArquivosEquipe("exporta o JSON da equipe"); // v2.4.0: guarda também no código
  download("caderno-acessos-equipe-" + hoje() + ".json", JSON.stringify({ versao: "web-2", tipo: "equipe", gerado_em: hoje(), itens: itens.map(semSegredoIndividual) }, null, 2), "application/json");
  toast("JSON da equipe exportado (sem senhas individuais)");
}
function backupPessoal() {
  download("caderno-acessos-backup-pessoal-" + hoje() + ".json", JSON.stringify({ versao: "web-2", tipo: "backup-pessoal", gerado_em: hoje(), itens: itens }, null, 2), "application/json");
  toast("Backup pessoal exportado");
}
/* v1.9.7: todo card importado passa por CadernoSync.normalizarCard (lista branca, só texto, limites). "alvo" permite simular (prévia). */
function idDaChave(chave) { let h = 2166136261; for (let k = 0; k < chave.length; k++) { h ^= chave.charCodeAt(k); h = Math.imul(h, 16777619); } return "imp-" + (h >>> 0).toString(16).padStart(8, "0"); }
function prepararImportacao(lista) {
  const ok = [], invalidos = [], datas = [], ciclos = [], cortes = [], vistos = new Set();
  lista.forEach((raw, pos) => {
    const info = { cortados: [], datasInvalidas: [] };
    const inc = window.CadernoSync ? CadernoSync.normalizarCard(raw, info) : null;
    if (!inc) { invalidos.push(pos); return; }
    if (!inc.id) { const k = chaveCard(inc); if (!k) { invalidos.push(pos); return; } inc.id = idDaChave(k); }
    if (!inc.titulo && !inc.aplicacao) { invalidos.push(pos); return; }
    if (!inc.escalonamentos) inc.escalonamentos = [];
    // v2.0.0: dois cards do mesmo arquivo com o mesmo id (ex.: linhas sem ID com o mesmo título) não se fundem: o segundo ganha sufixo
    if (vistos.has(inc.id)) { let n = 2; while (vistos.has(inc.id + "-" + n)) n++; inc.id = (inc.id + "-" + n).slice(0, 64); }
    vistos.add(inc.id);
    // v2.0.0: nada é cortado ou zerado em silêncio: a prévia e o aviso final listam os cards
    if (info.datasInvalidas.some((k) => k !== "ciclo")) datas.push(nomeDe(inc));
    if (info.datasInvalidas.indexOf("ciclo") >= 0) ciclos.push(nomeDe(inc));
    if (info.cortados.length) cortes.push(nomeDe(inc) + " (" + [...new Set(info.cortados)].map(rotuloCampo).join(", ") + ")");
    ok.push(inc);
  });
  return { itens: ok, invalidos: invalidos, datas: datas, ciclos: ciclos, cortes: cortes };
}
function rotuloCampo(k) {
  const r = { titulo: "título", aplicacao: "aplicação", cliente: "cliente", url: "link", usuario: "usuário", senha: "senha", horario: "horário", escalonamento: "escalonamento", obs: "observações", "escalonamento.valor": "valor do nível", "escalonamento.nome": "nome do nível", "escalonamento.horario": "horário do nível", "escalonamento.obs": "obs. do nível" };
  return r[k] || k;
}
/* v2.0.0 (item 7): "mais recente" de um card = maior entre updatedAt, senha_atualizada_em e ultima.
 * Se o card do arquivo é diferente do seu e mais antigo por esse critério, nunca substitui sem você escolher (padrão: manter o seu).
 * Arquivo sem nenhuma data (nem updatedAt, nem última troca) contra um card seu também sem datas: não há como saber, aplica normal. */
function recenteDe(it) { const T = CadernoSync.ts; return Math.max(T(it.updatedAt), T(it.senha_atualizada_em), T(it.ultima)); }
function maisAntigo(inc, atual) {
  const T = CadernoSync.ts;
  if (CadernoSync.semMeta(itemParaEquipeBruto(inc)) === CadernoSync.semMeta(itemParaEquipeBruto(atual))) return false;
  return recenteDe(inc) < recenteDe(atual);
}
function itemParaEquipeBruto(it) { const n = CadernoSync.normalizarCard(it); return n || it; }
/* v2.0.0 (item 2): identidade só pelo id (a v1.9.9 juntava cards diferentes com o mesmo título+aplicação+cliente).
 * modo "manter" (padrão): card do arquivo mais antigo que o seu não substitui; "substituir": substitui.
 * Login e senha locais nunca são trocados por vazio. Data de alteração local é mantida (o carimbo vem no save). */
function mesclar(lista, alvo, modo) {
  alvo = alvo || itens;
  let novos = 0, atualizados = 0, duplicados = 0, mantidos = 0, iguais = 0;
  const antigos = [];
  const links = new Map(); alvo.forEach((x) => { const u = normUrl(x.url); if (u) links.set(u, (links.get(u) || 0) + 1); });
  lista.forEach((inc) => {
    if (!inc || typeof inc !== "object" || !inc.id) return;
    const i = alvo.findIndex((x) => x.id === inc.id);
    if (i < 0) {
      const u = normUrl(inc.url);
      if (u && links.get(u)) duplicados++;
      if (u) links.set(u, (links.get(u) || 0) + 1);
      alvo.push(inc); novos++; return;
    }
    const atual = alvo[i];
    if (maisAntigo(inc, atual)) { antigos.push(nomeDe(atual)); if (modo !== "substituir") { mantidos++; return; } }
    const junto = Object.assign({}, atual, inc);
    ["usuario", "senha"].forEach((k) => { if (!inc[k] && atual[k]) junto[k] = atual[k]; });
    if (!inc.senha && atual.senha_atualizada_em) junto.senha_atualizada_em = atual.senha_atualizada_em;
    if ((!inc.escalonamentos || !inc.escalonamentos.length) && atual.escalonamentos && atual.escalonamentos.length) { junto.escalonamentos = atual.escalonamentos; if (!inc.escalonamento) junto.escalonamento = atual.escalonamento; }
    ["updatedAt", "updatedBy", "baseAt"].forEach((k) => { if (k in atual) junto[k] = atual[k]; else delete junto[k]; });
    if (CadernoSync.semMeta(itemParaEquipeBruto(junto)) === CadernoSync.semMeta(itemParaEquipeBruto(atual))) { iguais++; return; }
    alvo[i] = junto;
    atualizados++;
  });
  return { novos: novos, atualizados: atualizados, duplicados: duplicados, mantidos: mantidos, iguais: iguais, antigos: antigos };
}
const IMPORT_MAX_BYTES = 5 * 1024 * 1024, IMPORT_MAX_CARDS = 2000;
function listaNomes(l, n) { n = n || 5; return l.slice(0, n).join(", ") + (l.length > n ? " e mais " + (l.length - n) : ""); }
/* Prévia antes de aplicar: novos, atualizados, mais antigos que os seus (escolha), datas inválidas e textos que serão cortados. */
async function importarComPrevia(listaBruta, titulo) {
  if (listaBruta.length > IMPORT_MAX_CARDS) { aviso("Arquivo grande demais", "O arquivo tem " + listaBruta.length + " cards. O limite é " + IMPORT_MAX_CARDS + " por importação. Nada foi importado."); return false; }
  const prep = prepararImportacao(listaBruta);
  const fe = filtrarImportacaoEquipe(prep.itens); prep.itens = fe.itens; // v2.2.0: só o admin importa para a Equipe
  if (fe.fora) toast(fe.fora + " card(s) da Equipe ficaram de fora: o analista importa só para Meus (backup pessoal).");
  if (!prep.itens.length) { aviso("Nada importado", "Nenhum card válido no arquivo" + (prep.invalidos.length ? " (" + prep.invalidos.length + " ignorado(s) por formato errado)" : "") + "."); return false; }
  const sim = mesclar(prep.itens.map((x) => Object.assign({}, x)), itens.map((x) => Object.assign({}, x)), "manter");
  const modo = await janela("dlgVer", (box, fim) => {
    box.classList.add("dlg-import");
    box.appendChild(el("h3", "", titulo || "Importar cards?"));
    const p = (t, cls) => box.appendChild(el("p", "meta" + (cls ? " " + cls : ""), t));
    p(sim.novos + " novo(s), " + sim.atualizados + " atualizado(s)" + (sim.iguais ? ", " + sim.iguais + " igual(is) aos seus" : "") + ". " + sim.duplicados + " possível(is) duplicado(s) (mesmo link).", "imp-resumo");
    if (sim.antigos.length) p("⚠️ " + sim.antigos.length + " card(s) do arquivo são mais antigos que os seus: " + listaNomes(sim.antigos) + ". Por padrão o app mantém os seus.", "imp-antigos");
    if (prep.datas.length) p("Data inválida em " + prep.datas.length + " card(s): " + listaNomes(prep.datas) + ". Vão ficar sem data.", "imp-datas");
    if (prep.ciclos.length) p("Ciclo inválido em " + prep.ciclos.length + " card(s): " + listaNomes(prep.ciclos) + ". Vão ficar como “Nunca expira”.", "imp-ciclos");
    if (prep.cortes.length) p("Texto longo demais em " + prep.cortes.length + " card(s), será cortado no limite do app: " + listaNomes(prep.cortes, 4) + ".", "imp-cortes");
    if (prep.invalidos.length) p(prep.invalidos.length + " card(s) com formato errado serão ignorados.");
    p("Um usuário ou senha vazio no arquivo nunca apaga o que você já tem. Se o arquivo trouxer usuário ou senha preenchidos, eles substituem os seus nos cards atualizados.", "imp-senhas");
    const bb = el("div", "dlg-botoes");
    if (sim.antigos.length) {
      bb.appendChild(botaoDlg("pri", "Importar mantendo os meus", () => fim("manter")));
      bb.appendChild(botaoDlg("", "Importar e substituir", () => fim("substituir")));
    } else bb.appendChild(botaoDlg("pri", "Importar", () => fim("manter")));
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    box.appendChild(bb);
  });
  if (!modo) { toast("Importação cancelada"); return false; }
  histLote = { n: 0 };
  let res; const antesLS = Dados.texto(KEY);
  try { res = mesclar(prep.itens, itens, modo); save(); }
  catch (e) {
    if (!res || Dados.texto(KEY) === antesLS) { try { itens = JSON.parse(antesLS || "[]"); itensOcultos = []; separarOcultos(); } catch (x) {} histLote = null; throw e; }
    registrarErro("importar", "", e, null); // os cards já foram gravados: segue com o aviso de sucesso
  } finally { histLote = null; }
  // v2.0.0: daqui em diante os cards JÁ estão salvos: um erro não pode mais dizer "Falha na importação"
  try {
    addHist({ tipo: "importado", card: res.novos + " novo(s), " + res.atualizados + " atualizado(s)" + (res.mantidos ? ", " + res.mantidos + " mantido(s)" : ""), escopo: "Meu", local: true });
    fotoMeus = fotoIndividuais();
    if (emPainel()) render();
  } catch (e) { registrarErro("importar (depois de salvar)", "", e, null); }
  const resumo = "Importação concluída: " + res.novos + " novo(s), " + res.atualizados + " atualizado(s)" + (res.mantidos ? ", " + res.mantidos + " mantido(s) (os seus eram mais novos)" : "") + ". Total: " + itens.length + " card(s).";
  const extras = [];
  if (prep.datas.length) extras.push("Data inválida em " + prep.datas.length + " card(s): " + listaNomes(prep.datas) + " (ficaram sem data).");
  if (prep.ciclos.length) extras.push("Ciclo inválido em " + prep.ciclos.length + " card(s): " + listaNomes(prep.ciclos) + " (ficaram como “Nunca expira”).");
  if (prep.cortes.length) extras.push("Texto cortado no limite em " + prep.cortes.length + " card(s): " + listaNomes(prep.cortes, 4) + ".");
  if (extras.length) aviso("Importação concluída", resumo + " " + extras.join(" "));
  else toast(resumo);
  setTimeout(() => { if (!extras.length) avisarDuplicadosNovos(); else if (gruposDuplicados().some((g) => !dupAvisados.has(g.chave))) avisarDuplicadosNovos(); }, extras.length ? 0 : 2400);
  return true;
}
function chaveCard(it) {
  const a = String(it.aplicacao || "").trim().toLowerCase();
  const f = String(it.cliente || it.titulo || "").trim().toLowerCase();
  const t = String(it.titulo || "").trim().toLowerCase();
  if (!a && !f && !t) return "";
  return a + "|" + f + "|" + t;
}
function importarJson(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  if (f.size > IMPORT_MAX_BYTES) { aviso("Arquivo grande demais", "O limite é 5 MB por importação. Nada foi importado."); ev.target.value = ""; return; }
  const r = new FileReader();
  r.onload = async () => {
    ev.target.value = "";
    let data;
    try { data = JSON.parse(r.result); } catch (e) { aviso("Arquivo inválido", "Esse arquivo não é um JSON do Caderno de Acessos."); return; }
    const lista = Array.isArray(data) ? data : (data && typeof data === "object" && Array.isArray(data.itens)) ? data.itens : null;
    if (!lista) { aviso("Arquivo inválido", "Formato não reconhecido: o JSON precisa ser uma lista de cards ou ter a lista em “itens”. Nada foi importado."); return; }
    try { await importarComPrevia(lista, "Importar JSON?"); }
    catch (e) { registrarErro("importar JSON", "", e, null); aviso("Falha na importação", "Não foi possível importar esse arquivo. Nada foi alterado."); }
  };
  r.readAsText(f);
}
/* ---------- Bibliotecas de planilha (vendorizadas em js/vendor, funcionam offline) ---------- */
const libsCarregando = {};
function carregarScript(src, global) {
  if (window[global]) return Promise.resolve(window[global]);
  if (libsCarregando[src]) return libsCarregando[src];
  libsCarregando[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => window[global] ? resolve(window[global]) : reject(new Error(global + " indisponível"));
    s.onerror = () => { delete libsCarregando[src]; s.remove(); reject(new Error("Falha ao carregar " + src)); };
    document.head.appendChild(s);
  });
  return libsCarregando[src];
}
function carregarXlsxLib() {
  return carregarScript("js/vendor/xlsx.full.min.js", "XLSX");
}
function carregarExcelJS() { return carregarScript("js/vendor/exceljs.min.js", "ExcelJS"); }
