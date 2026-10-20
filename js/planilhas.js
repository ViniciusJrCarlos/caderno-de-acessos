/* Caderno de Acessos — js/planilhas.js
 * Excel: exportar (para importar e para consulta), importar o formato do Caderno e planilhas de suporte, menu Excel ▾.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Exportar Excel (v1.5): "para importar" (simples) e "para consulta" (navegável) ---------- */
const XL = { navy: "FF1B365D", ext: "FF2F6DB5", int: "FF1A8C86", ind: "FFDCEBFA", zebra: "FFF4F5F7", cinza: "FFD9D9D9", cinzaTx: "FF595959", sub: "FFDCE6F2", info: "FFEEF3F9", borda: "FFBFC4CC", branco: "FFFFFFFF", link: "FF2F6DB5" };
const XL_NIVEL = { 1: ["FFDCE6F2", "FF1B365D"], 2: ["FFB4C7E7", "FF1B365D"], 3: ["FF7F9CC9", "FFFFFFFF"], 4: ["FF4A6FA5", "FFFFFFFF"], 5: ["FF1B365D", "FFFFFFFF"] };
const XL_STATUS = { "OK": ["FFC6EFCE", "FF006100"], "Vencendo": ["FFFFEB9C", "FF9C5700"], "Vencido": ["FFFFC7CE", "FF9C0006"], "Não expira": ["FFE7E9EE", "FF44546A"], "Arquivado": ["FFD9D9D9", "FF595959"] };
// Colunas da planilha "para importar": 1 coluna = 1 campo do card (ida e volta).
const PLAN_COLS = [
  ["ID", "id", 12], ["Título", "titulo", 30], ["Aplicação", "aplicacao", 24], ["Cliente / operação", "cliente", 24],
  ["Categoria", "categoria", 11], ["Visibilidade", "visibilidade", 12], ["URL", "url", 38], ["Usuário", "usuario", 20],
  ["Senha", "senha", 16], ["Ciclo (dias)", "ciclo", 11], ["Última troca", "ultima", 13], ["Horário", "horario", 18],
  ["Escalonamento (resumo)", "escalonamento", 40], ["Observação", "obs", 36], ["Arquivado em", "arquivado_em", 13]
];
const PLAN_ESC_COLS = [["ID do card", 12], ["Fornecedor / Título", 30], ["Nível", 8], ["Canal", 11], ["Valor", 36], ["Nome", 24], ["Horário", 16], ["Obs", 36]];
const ABAS_PLAN = [
  { nome: "Fornecedores externos", sempre: true, filtro: (it) => !it.arquivado_em && it.categoria === "Externo" },
  { nome: "Ferramentas internas", sempre: true, filtro: (it) => !it.arquivado_em && it.categoria !== "Externo" },
  { nome: "Fornecedores arquivados", filtro: (it) => !!it.arquivado_em && it.categoria === "Externo" },
  { nome: "Ferramentas arquivadas", filtro: (it) => !!it.arquivado_em && it.categoria !== "Externo" }
];
function ordenarCards(lista) {
  return lista.slice().sort((a, b) => String(a.aplicacao || a.titulo || "").localeCompare(String(b.aplicacao || b.titulo || "")) || String(a.cliente || "").localeCompare(String(b.cliente || "")) || String(a.titulo || "").localeCompare(String(b.titulo || "")));
}
function abasPlanilha() {
  return ABAS_PLAN.map((a) => ({ nome: a.nome, sempre: !!a.sempre, arquivo: /arquivad/.test(a.nome), lista: ordenarCards(itensExportaveis().filter(a.filtro)) }))
    .filter((a) => a.sempre || a.lista.length);
}
function dataBR(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : (iso || "");
}
function statusPlan(it) {
  const st = statusDe(it);
  return st === "Ativo" ? "OK" : st === "Sem expiração" ? "Não expira" : st;
}
function valorPlan(it, k) {
  const c = semSegredoIndividual(it);
  if (k === "escalonamento") return c.escalonamento || resumoEscalonamentos(niveisDe(it));
  if (k === "ultima" || k === "arquivado_em") return dataBR(c[k] || "");
  if (k === "ciclo") return /^\d+$/.test(String(c.ciclo || "")) ? Number(c.ciclo) : (c.ciclo || "Nunca");
  if (k === "categoria") return c.categoria === "Externo" ? "Externo" : "Interno";
  if (k === "visibilidade") return c.visibilidade === "Individual" ? "Individual" : "Equipe";
  return c[k] == null ? "" : String(c[k]);
}
function xlBorda() { const s = { style: "thin", color: { argb: XL.borda } }; return { top: s, left: s, bottom: s, right: s }; }
function xlFill(cor) { return { type: "pattern", pattern: "solid", fgColor: { argb: cor } }; }
function xlCabecalho(row, n) {
  for (let i = 1; i <= n; i++) {
    const c = row.getCell(i);
    c.fill = xlFill(XL.navy);
    c.font = { bold: true, color: { argb: XL.branco } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = xlBorda();
  }
  row.height = 30;
}
function xlLinkInterno(aba, ref, texto) {
  const alvo = "#'" + aba.replace(/'/g, "''") + "'!" + ref;
  return { formula: 'HYPERLINK("' + alvo.replace(/"/g, '""') + '","' + String(texto).replace(/"/g, '""') + '")', result: texto };
}
function xlUrl(v) { return /^[a-z]+:\/\//i.test(v) ? v : "https://" + v; }
async function baixarWorkbook(wb, nome) {
  const buf = await wb.xlsx.writeBuffer();
  download(nome, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
function montarPlanilhaImportar(ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Caderno de Acessos";
  wb.created = new Date();
  const abas = abasPlanilha();
  abas.forEach((a) => {
    const ws = wb.addWorksheet(a.nome, { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: a.arquivo ? "FF8C8C8C" : (/Fornecedores/.test(a.nome) ? XL.ext : XL.int) } } });
    ws.columns = PLAN_COLS.map(([h, k, w]) => ({ header: h, key: k, width: w }));
    xlCabecalho(ws.getRow(1), PLAN_COLS.length);
    a.lista.forEach((it, i) => {
      const vals = {};
      PLAN_COLS.forEach(([, k]) => { vals[k] = valorPlan(it, k); });
      const row = ws.addRow(vals);
      for (let j = 1; j <= PLAN_COLS.length; j++) {
        const c = row.getCell(j);
        c.border = xlBorda();
        c.alignment = { vertical: "top", wrapText: true };
        if (a.arquivo) { c.fill = xlFill(XL.cinza); c.font = { color: { argb: XL.cinzaTx } }; }
        else if (i % 2) c.fill = xlFill(XL.zebra);
      }
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: a.lista.length + 1, column: PLAN_COLS.length } };
  });
  const we = wb.addWorksheet("Escalonamento", { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: XL.navy } } });
  we.columns = PLAN_ESC_COLS.map(([h, w]) => ({ header: h, width: w }));
  xlCabecalho(we.getRow(1), PLAN_ESC_COLS.length);
  let n = 0;
  abas.forEach((a) => a.lista.forEach((it) => {
    niveisDe(it).forEach((nv) => {
      const row = we.addRow([it.id, it.titulo || it.aplicacao || "", nv.nivel, canalRotulo(nv.canal), nv.valor, nv.nome, nv.horario, nv.obs]);
      for (let j = 1; j <= PLAN_ESC_COLS.length; j++) {
        const c = row.getCell(j);
        c.border = xlBorda();
        c.alignment = { vertical: "top", wrapText: true };
        if (n % 2) c.fill = xlFill(XL.zebra);
      }
      n++;
    });
  }));
  we.autoFilter = { from: { row: 1, column: 1 }, to: { row: n + 1, column: PLAN_ESC_COLS.length } };
  return wb;
}
function montarPlanilhaConsulta(ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Caderno de Acessos";
  wb.created = new Date();
  const abas = abasPlanilha();
  const COLS = [["Título", 30], ["Aplicação", 22], ["Cliente / operação", 24], ["Visibilidade", 12], ["URL", 38], ["Usuário", 18], ["Senha", 14], ["Ciclo", 9], ["Última troca", 13], ["Status", 12], ["Horário", 18], ["Observação", 34]];
  const PRIMEIRA = 3; // linha 1 = barra, linha 2 = cabeçalho
  const ESC_ATIVOS = "Escalonamento", ESC_ARQ = "Escalonamento arquivados";
  const colLetra = (n) => { let t = ""; while (n > 0) { const m = (n - 1) % 26; t = String.fromCharCode(65 + m) + t; n = Math.floor((n - 1) / 26); } return t; };
  // Posições: card -> (aba, linha, nº de colunas) para o "◀ Voltar ao card" marcar a linha inteira
  const pos = {};
  abas.forEach((a) => {
    const ncols = COLS.length + (a.arquivo ? 1 : 0) + 1;
    a.lista.forEach((it, i) => { pos[it.id] = { aba: a.nome, linha: PRIMEIRA + i, ref: "A" + (PRIMEIRA + i) + ":" + colLetra(ncols) + (PRIMEIRA + i) }; });
  });
  // Escalonamento separado: ativos na aba "Escalonamento", arquivados (fornecedores e ferramentas) em "Escalonamento arquivados"
  const comEsc = [];
  abas.forEach((a) => a.lista.forEach((it) => { const nv = niveisDe(it); if (nv.length) comEsc.push({ it: it, aba: a.nome, arquivo: a.arquivo, niveis: nv }); }));
  const escAtivos = comEsc.filter((e) => !e.arquivo), escArq = comEsc.filter((e) => e.arquivo);
  const IDX = 4; // cabeçalho do índice
  const ESC_NCOLS = 6;
  const blocoDe = {};
  [[ESC_ATIVOS, escAtivos], [ESC_ARQ, escArq]].forEach(([nomeAba, grupo]) => {
    let r = IDX + 1 + grupo.length + 2;
    grupo.forEach((e) => {
      e.linha = r;
      e.abaEsc = nomeAba;
      e.ref = "A" + r + ":" + colLetra(ESC_NCOLS) + (r + 2 + e.niveis.length); // bloco inteiro (título até o último nível)
      blocoDe[e.it.id] = { aba: nomeAba, ref: e.ref };
      r += 3 + e.niveis.length + 1;
    });
  });

  function topo(ws, titulo, ncols) {
    const c = ws.getCell("A1");
    c.value = xlLinkInterno("Leia-me", "A1", "◀ Voltar ao Leia-me");
    c.font = { bold: true, color: { argb: XL.branco } };
    c.fill = xlFill(XL.ext);
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = xlBorda();
    const t = ws.getCell(1, 2);
    t.value = titulo;
    t.font = { bold: true, size: 14, color: { argb: XL.navy } };
    t.alignment = { vertical: "middle" };
    ws.getRow(1).height = 28;
  }

  // Leia-me
  const lm = wb.addWorksheet("Leia-me", { properties: { tabColor: { argb: XL.navy } } });
  lm.getColumn(1).width = 30;
  lm.getColumn(2).width = 92;
  lm.getCell("A1").value = "Caderno de Acessos — Planilha para consulta";
  lm.getCell("A1").font = { bold: true, size: 18, color: { argb: XL.navy } };
  lm.getCell("A2").value = "Gerada em " + dataBR(hoje()) + " · somente leitura (para importar no app, use “Excel para importar”).";
  lm.getCell("A2").font = { italic: true, color: { argb: XL.cinzaTx } };
  let lr = 4;
  const secao = (t) => { const c = lm.getCell(lr, 1); c.value = t; c.font = { bold: true, size: 13, color: { argb: XL.navy } }; lr++; };
  const linha = (a, b, fundo, cor) => {
    const c1 = lm.getCell(lr, 1), c2 = lm.getCell(lr, 2);
    c1.value = a; c2.value = b;
    c1.border = c2.border = xlBorda();
    c1.alignment = { vertical: "top", wrapText: true };
    c2.alignment = { vertical: "top", wrapText: true };
    if (fundo) { c1.fill = xlFill(fundo); c1.font = { bold: true, color: { argb: cor || XL.branco } }; }
    else c1.font = { bold: true, color: { argb: XL.navy } };
    lr++;
    return c1;
  };
  secao("Navegação (clique no botão para abrir a aba)");
  const descAba = {
    "Fornecedores externos": "Fornecedores externos ativos (portais, brokers, telecom, CRM).",
    "Ferramentas internas": "Ferramentas e páginas internas ativas (a mesma ferramenta pode ter uma URL por operação).",
    "Fornecedores arquivados": "Fornecedores inativos, em cinza. O escalonamento continua guardado.",
    "Ferramentas arquivadas": "Ferramentas internas inativas, em cinza."
  };
  const navs = abas.map((a) => [a.nome, descAba[a.nome] + " (" + a.lista.length + " card" + (a.lista.length === 1 ? "" : "s") + ")"]);
  navs.splice(2, 0, [ESC_ATIVOS, "Contatos dos fornecedores e ferramentas ATIVOS, em blocos: nível, canal, nome, contato e horário, com índice no topo e “◀ Voltar ao card”."]);
  if (escArq.length) navs.splice(3, 0, [ESC_ARQ, "Contatos dos fornecedores e ferramentas ARQUIVADOS (em cinza), separados dos ativos, com índice próprio no topo."]);
  navs.forEach(([nome, desc]) => {
    const c = linha("", desc, XL.navy);
    c.value = xlLinkInterno(nome, "A1", "▶  " + nome);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    lm.getRow(lr - 1).height = 30;
  });
  lr++;
  secao("Como navegar");
  linha("◀ Voltar ao Leia-me", "Em todas as abas, a célula azul no canto superior esquerdo volta para esta página.");
  linha("Ver escalonamento ▶", "Na última coluna dos cards, leva direto ao bloco do fornecedor e já deixa a área inteira selecionada. Cards ativos vão para a aba Escalonamento; cards arquivados vão para “Escalonamento arquivados”" + (escArq.length ? "" : " (nesta exportação nenhum arquivado tem escalonamento, então essa aba não foi gerada)") + ". “sem escalonamento” = nada cadastrado.");
  linha("Índice", "Cada aba de escalonamento começa com um índice clicável dos fornecedores dela.");
  linha("◀ Voltar ao card", "No título de cada bloco de escalonamento, volta para a linha do card (na aba de origem) e marca a linha.");
  linha("E-mail / Telefone / Portal", "E-mails abrem o programa de e-mail; telefones usam tel: (discador/Teams, se configurado); portais abrem no navegador.");
  lr++;
  secao("Legenda de cores");
  linha("Individual", "Acesso pessoal do analista: usuário e senha saem em branco.", XL.ind, XL.navy);
  Object.keys(XL_STATUS).forEach((k) => linha(k, { "OK": "Senha dentro do ciclo de troca.", "Vencendo": "Faltam 7 dias ou menos para trocar.", "Vencido": "Ciclo de troca ultrapassado.", "Não expira": "Ciclo “Nunca”.", "Arquivado": "Card inativo (abas de arquivados)." }[k], XL_STATUS[k][0], XL_STATUS[k][1]));
  [1, 2, 3, 4, 5].forEach((n) => linha("Nível " + n, n === 1 ? "Primeiro contato (ex.: portal ou service desk)." : n === 5 ? "Último nível (ex.: gerência)." : "Nível " + n + " de escalonamento.", XL_NIVEL[n][0], XL_NIVEL[n][1]));
  lr++;
  secao("Regras");
  linha("Senhas", "Senhas individuais saem em branco. Só acessos da equipe levam usuário e senha.");
  linha("Somente leitura", "Esta planilha é para consultar e imprimir. Para levar cards para outro aparelho, use “Excel para importar” ou o JSON.");

  // Abas de cards
  function abaCards(a) {
    const ws = wb.addWorksheet(a.nome, { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }], properties: { tabColor: { argb: a.arquivo ? "FF8C8C8C" : (/Fornecedores/.test(a.nome) ? XL.ext : XL.int) } } });
    const cols = COLS.concat(a.arquivo ? [["Arquivado em", 13]] : []).concat([["Ver escalonamento", 20]]);
    cols.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
    topo(ws, a.nome + (a.arquivo ? " (inativos)" : ""), cols.length);
    const hr = ws.getRow(2);
    cols.forEach(([h], i) => { hr.getCell(i + 1).value = h; });
    xlCabecalho(hr, cols.length);
    a.lista.forEach((it, i) => {
      const ind = it.visibilidade === "Individual";
      const st = statusPlan(it);
      const vals = [it.titulo || it.aplicacao || "", it.aplicacao || "", it.cliente || "", ind ? "Individual" : "Equipe", it.url || "",
        ind ? "" : (it.usuario || ""), ind ? "" : (it.senha || ""), valorPlan(it, "ciclo"), dataBR(it.ultima || ""), st, it.horario || "", it.obs || ""];
      if (a.arquivo) vals.push(dataBR(it.arquivado_em || ""));
      const row = ws.getRow(PRIMEIRA + i);
      vals.forEach((v, j) => { row.getCell(j + 1).value = v; });
      for (let j = 1; j <= cols.length; j++) {
        const c = row.getCell(j);
        c.border = xlBorda();
        c.alignment = { vertical: "top", wrapText: true };
        if (a.arquivo) { c.fill = xlFill(XL.cinza); c.font = { color: { argb: XL.cinzaTx } }; }
        else if (i % 2) c.fill = xlFill(XL.zebra);
      }
      const cv = row.getCell(4);
      cv.alignment = { horizontal: "center", vertical: "top" };
      if (ind) { cv.fill = xlFill(XL.ind); cv.font = { bold: true, color: { argb: XL.navy } }; }
      if (ind) { [6, 7].forEach((j) => { row.getCell(j).value = "(individual)"; row.getCell(j).font = { italic: true, color: { argb: "FF808080" } }; }); }
      const cs = row.getCell(10);
      const cor = XL_STATUS[st] || XL_STATUS["OK"];
      cs.fill = xlFill(cor[0]); cs.font = { bold: true, color: { argb: cor[1] } }; cs.alignment = { horizontal: "center", vertical: "top" };
      [8, 9].forEach((j) => { row.getCell(j).alignment = { horizontal: "center", vertical: "top" }; });
      if (it.url) {
        const cu = row.getCell(5);
        cu.value = { text: it.url, hyperlink: xlUrl(it.url) };
        cu.font = { color: { argb: XL.link }, underline: true };
      }
      const ce = row.getCell(cols.length);
      ce.alignment = { horizontal: "center", vertical: "top" };
      if (blocoDe[it.id]) {
        ce.value = xlLinkInterno(blocoDe[it.id].aba, blocoDe[it.id].ref, "Ver escalonamento ▶");
        ce.font = { bold: true, color: { argb: XL.link }, underline: true };
      } else {
        ce.value = "sem escalonamento";
        ce.font = { italic: true, color: { argb: "FF808080" } };
      }
    });
    if (a.lista.length) ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: a.lista.length + 2, column: cols.length } };
    else { ws.getCell("A3").value = "Nenhum card nesta aba."; ws.getCell("A3").font = { italic: true, color: { argb: "FF808080" } }; }
  }
  abas.filter((a) => !a.arquivo).forEach(abaCards);

  // Escalonamento em blocos (uma aba para ativos, outra para arquivados)
  function abaEscalonamento(nomeAba, comEsc, arquivada) {
  const we = wb.addWorksheet(nomeAba, { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: arquivada ? "FF8C8C8C" : XL.navy } } });
  [10, 12, 26, 38, 18, 36].forEach((w, i) => { we.getColumn(i + 1).width = w; });
  topo(we, arquivada ? "Escalonamento dos arquivados (fornecedores e ferramentas inativos)" : "Escalonamento por fornecedor (ativos)", 6);
  we.getCell(IDX - 1, 1).value = comEsc.length ? "Índice (clique para ir ao bloco)" : "Nenhum card ativo com escalonamento cadastrado.";
  we.getCell(IDX - 1, 1).font = { bold: true, color: { argb: XL.navy } };
  if (comEsc.length) {
    const hi = we.getRow(IDX);
    ["Níveis", "Aba", "Fornecedor / Título", "Aplicação · Cliente"].forEach((h, i) => { hi.getCell(i + 1).value = h; });
    xlCabecalho(hi, 4);
    hi.height = 22;
  }
  comEsc.forEach((e, i) => {
    const row = we.getRow(IDX + 1 + i);
    row.getCell(1).value = e.niveis.length;
    row.getCell(2).value = e.aba;
    row.getCell(3).value = xlLinkInterno(nomeAba, e.ref, (e.it.titulo || e.it.aplicacao || "") + " ▶");
    row.getCell(4).value = [e.it.aplicacao, e.it.cliente].filter(Boolean).join(" · ");
    for (let j = 1; j <= 4; j++) { const c = row.getCell(j); c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true }; if (arquivada) c.fill = xlFill(XL.cinza); else if (i % 2) c.fill = xlFill(XL.zebra); }
    row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
    row.getCell(3).font = { bold: true, color: { argb: XL.link }, underline: true };
  });
  const SUBH = ["Nível", "Canal", "Nome", "Contato", "Horário", "Observação"];
  comEsc.forEach((e) => {
    const r0 = e.linha, it = e.it;
    we.mergeCells(r0, 1, r0, 4);
    const t = we.getCell(r0, 1);
    t.value = [it.titulo || it.aplicacao, it.cliente].filter(Boolean).join("  ·  ") + (e.arquivo ? "  ·  ARQUIVADO" : "");
    for (let k = 1; k <= 6; k++) { const c = we.getCell(r0, k); c.fill = xlFill(e.arquivo ? "FF595959" : XL.navy); c.border = xlBorda(); }
    t.font = { bold: true, size: 12, color: { argb: XL.branco } };
    t.alignment = { vertical: "middle" };
    we.mergeCells(r0, 5, r0, 6);
    const p = pos[it.id];
    const b = we.getCell(r0, 5);
    b.value = xlLinkInterno(p.aba, p.ref, "◀ Voltar ao card");
    b.font = { bold: true, color: { argb: XL.branco }, underline: true };
    b.alignment = { horizontal: "center", vertical: "middle" };
    we.getRow(r0).height = 26;
    we.mergeCells(r0 + 1, 1, r0 + 1, 6);
    const info = we.getCell(r0 + 1, 1);
    info.value = "Aba: " + p.aba + "   |   Horário de atendimento: " + (it.horario || "—") + "   |   URL: " + (it.url || "—");
    info.font = { italic: true, color: { argb: XL.navy } };
    info.fill = xlFill(e.arquivo ? "FFEDEDED" : XL.info);
    info.alignment = { vertical: "top", wrapText: true };
    const sh = we.getRow(r0 + 2);
    SUBH.forEach((h, k) => {
      const c = sh.getCell(k + 1);
      c.value = h; c.fill = xlFill(XL.sub); c.font = { bold: true, color: { argb: XL.navy } }; c.border = xlBorda(); c.alignment = { horizontal: "center", vertical: "middle" };
    });
    e.niveis.forEach((nv, i) => {
      const row = we.getRow(r0 + 3 + i);
      [nv.nivel, canalRotulo(nv.canal), nv.nome || "", nv.valor || "", nv.horario || "", nv.obs || ""].forEach((v, k) => {
        const c = row.getCell(k + 1);
        c.value = v; c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true };
        if (e.arquivo) c.fill = xlFill(XL.cinza);
        else if (i % 2) c.fill = xlFill(XL.zebra);
      });
      const cn = row.getCell(1), cor = XL_NIVEL[Math.min(5, Math.max(1, nv.nivel))];
      cn.fill = xlFill(cor[0]); cn.font = { bold: true, color: { argb: cor[1] } }; cn.alignment = { horizontal: "center", vertical: "top" };
      row.getCell(2).alignment = { horizontal: "center", vertical: "top" };
      const href = hrefEsc(nv);
      if (href && nv.valor) {
        const cc = row.getCell(4);
        cc.value = { text: nv.valor, hyperlink: href };
        cc.font = { color: { argb: XL.link }, underline: true };
      }
    });
  });
  }
  abaEscalonamento(ESC_ATIVOS, escAtivos, false);
  if (escArq.length) abaEscalonamento(ESC_ARQ, escArq, true);
  // Ordem das abas: Leia-me, ativos, Escalonamento, arquivados
  abas.filter((a) => a.arquivo).forEach(abaCards);
  // Impressão: paisagem, cabe na largura da página
  wb.worksheets.forEach((ws) => { ws.pageSetup = { orientation: ws.name === "Leia-me" ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }; });
  return wb;
}
async function exportarExcelImportar() {
  const soMeus = !podeArquivosEquipe(); // v2.4.0: o analista só exporta os próprios cards (Meus)
  try {
    const ExcelJS = await carregarExcelJS();
    await baixarWorkbook(montarPlanilhaImportar(ExcelJS), "caderno-acessos-importar-" + hoje() + ".xlsx");
    toast(soMeus ? "Excel dos seus cards (Meus) exportado" : "Excel para importar exportado (sem senhas individuais)");
  } catch (e) {
    aviso("Falha ao exportar", "Não foi possível gerar a planilha. Recarregue a página e tente de novo.");
  }
}
async function exportarExcelConsulta() {
  const soMeus = !podeArquivosEquipe();
  try {
    const ExcelJS = await carregarExcelJS();
    await baixarWorkbook(montarPlanilhaConsulta(ExcelJS), "caderno-acessos-consulta-" + hoje() + ".xlsx");
    toast(soMeus ? "Excel dos seus cards (Meus) exportado" : "Excel para consulta exportado (sem senhas individuais)");
  } catch (e) {
    aviso("Falha ao exportar", "Não foi possível gerar a planilha. Recarregue a página e tente de novo.");
  }
}
/* ---------- Importar o formato do próprio Caderno (v1.5 "para importar" e Excel antigo do app) ---------- */
const PLAN_MAPA = {
  "id": "id", "titulo": "titulo", "aplicacao": "aplicacao", "cliente operacao": "cliente", "cliente": "cliente",
  "categoria": "categoria", "visibilidade": "visibilidade", "url": "url", "usuario": "usuario", "senha": "senha",
  "ciclo dias": "ciclo", "ciclo": "ciclo", "ultima troca": "ultima", "ultimatroca": "ultima", "horario": "horario",
  "escalonamento resumo": "escalonamento", "escalonamento": "escalonamento", "observacao": "obs", "obs": "obs",
  "arquivado em": "arquivado_em", "arquivado": "arquivado_em"
};
const PLAN_ESC_MAPA = { "id do card": "id", "nivel": "nivel", "canal": "canal", "valor": "valor", "contato": "valor", "nome": "nome", "horario": "horario", "obs": "obs", "observacao": "obs" };
function mapaCabecalho(row, mapa) {
  const col = {};
  (row || []).forEach((h, i) => { const k = mapa[normHeader(h)]; if (k && col[k] == null) col[k] = i; });
  return col;
}
function ehCabecalhoCards(col) { return col.titulo != null && (col.aplicacao != null || col.id != null); }
function ehCabecalhoEsc(col) { return col.id != null && col.nivel != null; }
function pad2(n) { return String(n).padStart(2, "0"); }
function dataIso(v, XLSX) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && XLSX && XLSX.SSF) {
    const p = XLSX.SSF.parse_date_code(v);
    if (p && p.y) return p.y + "-" + pad2(p.m) + "-" + pad2(p.d);
  }
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + "-" + pad2(m[2]) + "-" + pad2(m[1]);
  return s;
}
function canalDeTexto(t) {
  const n = normHeader(t);
  if (/mail/.test(n)) return "email";
  if (/tel|fone|phone|celular|whats/.test(n)) return "telefone";
  if (/portal|ticket|chamado|site|url/.test(n)) return "portal";
  return ["portal", "email", "telefone", "outro"].includes(String(t || "").trim()) ? String(t).trim() : "outro";
}
function cardsFormatoCaderno(workbook, XLSX) {
  const usadas = new Set();
  const cards = [];
  const escPorId = {};
  workbook.SheetNames.forEach((nomeAba) => {
    const ws = workbook.Sheets[nomeAba];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    const txt = (row, i) => (i == null || !row || row[i] == null) ? "" : (row[i] instanceof Date ? dataIso(row[i]) : String(row[i]).trim());
    let col = null, modo = null;
    rows.forEach((row) => {
      if (linhaVazia(row)) return;
      const cc = mapaCabecalho(row, PLAN_MAPA);
      if (ehCabecalhoCards(cc)) { col = cc; modo = "cards"; usadas.add(nomeAba); return; }
      const ce = mapaCabecalho(row, PLAN_ESC_MAPA);
      if (ehCabecalhoEsc(ce)) { col = ce; modo = "esc"; usadas.add(nomeAba); return; }
      if (!col) return;
      const preenchidas = row.filter((c) => c != null && String(c).trim() !== "").length;
      if (modo === "esc") {
        const id = txt(row, col.id);
        if (!id) return;
        const nv = limparNivelEsc({ nivel: txt(row, col.nivel), canal: canalDeTexto(txt(row, col.canal)), valor: txt(row, col.valor), nome: txt(row, col.nome), horario: txt(row, col.horario), obs: txt(row, col.obs) });
        if (nv && (nv.valor || nv.nome || nv.obs)) (escPorId[id] = escPorId[id] || []).push(nv);
        return;
      }
      if (preenchidas <= 1) return; // título de seção (ex.: Excel antigo do app)
      const o = {};
      Object.keys(col).forEach((k) => { o[k] = k === "ultima" || k === "arquivado_em" ? dataIso(row[col[k]], XLSX) : txt(row, col[k]); });
      if (!o.titulo && !o.aplicacao) return;
      ["usuario", "senha"].forEach((k) => { if (/^\(individual\)$/i.test(o[k] || "")) o[k] = ""; });
      const nAba = normHeader(nomeAba);
      const cat = normHeader(o.categoria);
      const categoria = /extern/.test(cat) ? "Externo" : /intern/.test(cat) ? "Interno" : (/fornecedor|extern/.test(nAba) ? "Externo" : "Interno");
      let ciclo = String(o.ciclo || "").trim();
      if (!ciclo || /nunca|nao expira/.test(normHeader(ciclo))) ciclo = "Nunca";
      else if (/^\d+(\.0+)?$/.test(ciclo)) ciclo = String(parseInt(ciclo, 10));
      const arq = o.arquivado_em || (/arquiv|antig/.test(nAba) ? hoje() : "");
      const card = {
        id: o.id || idEstavel([o.titulo, o.aplicacao, o.cliente, "planilha"]),
        titulo: o.titulo || o.aplicacao,
        aplicacao: o.aplicacao || o.titulo,
        cliente: o.cliente || "",
        categoria: categoria,
        visibilidade: /individual/i.test(o.visibilidade || "") ? "Individual" : "Equipe",
        url: o.url || "",
        usuario: o.usuario || "",
        senha: o.senha || "",
        ciclo: ciclo,
        ultima: o.ultima || "",
        horario: o.horario || "",
        escalonamento: o.escalonamento || "",
        escalonamentos: [],
        obs: o.obs || "",
        arquivado_em: arq || null
      };
      cards.push(card);
    });
  });
  cards.forEach((c) => {
    const nv = escPorId[c.id];
    if (nv && nv.length) {
      c.escalonamentos = nv.sort((a, b) => a.nivel - b.nivel);
      if (!c.escalonamento) c.escalonamento = resumoEscalonamentos(c.escalonamentos);
    } else if (c.escalonamento) {
      c.escalonamentos = parseEscalonamentoTexto(c.escalonamento);
    }
  });
  return { cards: cards, abasUsadas: usadas };
}
/* ---------- Importar planilha de suporte/brokers (formato v1.4) ---------- */
function normHeader(h) {
  return String(h || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function mapearColunas(headers) {
  const idx = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    if (!n) return;
    if (/tipo de servico|tipo servico/.test(n)) idx.tipo = i;
    else if (/^fornecedor$/.test(n)) idx.fornecedor = i;
    else if (/^aplicacao$|^aplicacao /.test(n) || n === "aplicacao") idx.aplicacao = i;
    else if (/sites? ?\/? ?operacoes|sites operacoes|cliente/.test(n)) idx.sites = i;
    else if (/service desk|servicedesk/.test(n)) idx.sd = i;
    else if (/^acesso$/.test(n)) idx.acesso = i;
    else if (/^contato$/.test(n)) idx.contato = i;
    else if (/escalation|escalonamento/.test(n)) idx.escalation = i;
    else if (/observacoes|^obs$/.test(n)) idx.obs = i;
    else if (/site validado/.test(n)) idx.siteValidado = i;
  });
  return idx;
}
function classificarAba(nome) {
  const n = normHeader(nome);
  if (/antig/.test(n)) return "antigos";
  if (/broker|whatsapp|sms/.test(n)) return "brokers";
  if (/suporte|tecnico/.test(n)) return "suporte";
  return "outro";
}
function celula(row, i) {
  if (i == null || i < 0 || !row) return "";
  const v = row[i];
  return v == null ? "" : String(v);
}
function detectarVisibilidade(acesso) {
  const a = String(acesso || "").toLowerCase();
  if (/individual/.test(a)) return "Individual";
  if (/compartilhad/.test(a)) return "Equipe";
  return "Equipe";
}
function extrairCredenciais(acesso) {
  // Só preenche se a própria coluna trouxer usuário/senha. Não inventa.
  const s = String(acesso || "");
  const out = { usuario: "", senha: "" };
  const um = s.match(/(?:user|usu[aá]rio)\s*[:：]\s*(\S+)/i);
  const sm = s.match(/(?:senha|password|pwd)\s*[:：]\s*(\S+)/i);
  if (um) out.usuario = um[1].trim();
  if (sm) out.senha = sm[1].trim();
  return out;
}
function extrairUrl(sd, contato) {
  const blob = [sd, contato].filter(Boolean).join("\n");
  const m = blob.match(/https?:\/\/[^\s)\]>]+/i);
  if (m) return m[0].replace(/[.,;]+$/, "");
  // e-mail puro no service desk → não é URL de portal
  return "";
}
function idEstavel(partes) {
  const s = partes.join("|").toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "xl-" + (h >>> 0).toString(16);
}
function linhaVazia(row) {
  return !row || !row.some((c) => c != null && String(c).trim() !== "");
}
function sheetTemVermelho(sheet, XLSX) {
  // SheetJS community build may not keep fonts; we rely on sheet name "Antigos" + optional !rows styles if present.
  return false;
}
function cardsDePlanilha(workbook, XLSX, pular) {
  const gerados = [];
  const vistos = new Set();
  const ordem = workbook.SheetNames.filter((n) => !(pular && pular.has(n))).sort((a, b) => {
    const rank = (n) => ({ brokers: 0, suporte: 1, antigos: 2, outro: 3 })[classificarAba(n)] ?? 3;
    return rank(a) - rank(b);
  });
  ordem.forEach((sheetName) => {
    const tipoAba = classificarAba(sheetName);
    const ws = workbook.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    if (!rows.length) return;
    const headers = rows[0].map((h) => String(h || ""));
    const col = mapearColunas(headers);
    if (col.fornecedor == null && col.aplicacao == null) return;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (linhaVazia(row)) continue;
      const fornecedor = celula(row, col.fornecedor).trim();
      const aplicacao = celula(row, col.aplicacao).trim() || fornecedor;
      if (!fornecedor && !aplicacao) continue;
      const sites = celula(row, col.sites).trim();
      const sd = celula(row, col.sd).trim();
      const acesso = celula(row, col.acesso).trim();
      const contato = celula(row, col.contato).trim();
      const escValid = celula(row, col.escalation).trim();
      const obs = celula(row, col.obs).trim();
      const tipoServ = celula(row, col.tipo).trim();
      const chave = (fornecedor + "|" + aplicacao).toLowerCase().replace(/\s+/g, " ").trim();
      if (vistos.has(chave)) continue; // dedupe Brokers > Suporte > Antigos
      vistos.add(chave);
      const niveis = parseEscalonamentoTexto([contato, escValid].filter(Boolean).join("\n"));
      const vis = detectarVisibilidade(acesso);
      const cred = extrairCredenciais(acesso);
      const url = extrairUrl(sd, contato);
      const blobInativo = (fornecedor + "\n" + aplicacao + "\n" + obs).toLowerCase();
      const arquivar = tipoAba === "antigos" || /\b(inativo|encerrado|desativad|contrato encerrado|legado|legacy)\b/.test(blobInativo);
      const titulo = (aplicacao || fornecedor) + (sites ? " · " + sites.split(/\n/)[0].slice(0, 40) : "");
      const obsParts = [];
      if (tipoServ) obsParts.push(tipoServ);
      if (obs) obsParts.push(obs);
      if (acesso && !cred.usuario && !/^(individual|compartilhad|-)$/i.test(acesso.split("\n")[0].trim())) {
        // guarda dica de canal de abertura sem senha
        const dica = acesso.split("\n")[0].trim();
        if (dica && dica.length < 120) obsParts.push("Acesso: " + dica);
      }
      const card = {
        id: idEstavel([fornecedor, aplicacao, "planilha"]),
        titulo: titulo.slice(0, 120),
        aplicacao: aplicacao || fornecedor,
        cliente: sites ? sites.replace(/\s+/g, " ").trim().slice(0, 160) : (fornecedor || ""),
        categoria: "Externo",
        visibilidade: vis,
        url: url,
        usuario: cred.usuario || "",
        senha: cred.senha || "",
        ciclo: "Nunca",
        ultima: hoje(),
        horario: "",
        escalonamento: resumoEscalonamentos(niveis) || contato.slice(0, 240),
        escalonamentos: niveis,
        obs: obsParts.join("\n\n").slice(0, 2000),
        arquivado_em: arquivar ? hoje() : null,
        origem_import: "planilha"
      };
      gerados.push(card);
    }
  });
  return gerados;
}
// Formato do Caderno (abas de cards + Escalonamento por ID) e, nas demais abas, o formato de suporte/brokers.
function cardsDeWorkbook(wb, XLSX) {
  const proprio = cardsFormatoCaderno(wb, XLSX);
  return proprio.cards.concat(cardsDePlanilha(wb, XLSX, proprio.abasUsadas));
}
async function importarPlanilha(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  if (!podeArquivosEquipe()) { ev.target.value = ""; negarArquivosEquipe("importa planilhas para a Equipe"); return; } // v2.4.0
  if (f.size > IMPORT_MAX_BYTES) { aviso("Arquivo grande demais", "O limite é 5 MB por importação. Nada foi importado."); ev.target.value = ""; return; }
  let lista;
  // v2.0.0: erro de LEITURA da planilha ≠ erro depois de salvar (a v1.9.9 dizia "Falha na importação" com os cards já gravados)
  try {
    toast("Lendo planilha…");
    const XLSX = await carregarXlsxLib();
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellStyles: true });
    lista = cardsDeWorkbook(wb, XLSX);
  } catch (e) {
    ev.target.value = "";
    aviso("Falha na importação", "Não foi possível ler a planilha. Verifique se o arquivo é .xlsx ou .xls. Nada foi alterado.");
    return;
  }
  ev.target.value = "";
  if (!lista.length) { aviso("Nada importado", "Não encontrei abas/colunas reconhecíveis (ID, Título, Aplicação… ou Fornecedor, Contato…)."); return; }
  try { await importarComPrevia(lista, "Importar planilha?"); }
  catch (e) { registrarErro("importar planilha", "", e, null); aviso("Falha na importação", "Não foi possível importar a planilha. Nada foi alterado."); }
}
function escolherPlanilha() { if (!podeArquivosEquipe()) return negarArquivosEquipe("importa planilhas para a Equipe"); $("impXls").click(); }
/* ---------- Menu "Excel ▾" do topo ---------- */
function ligarMenuExcel() {
  const bt = $("dExcel"), menu = $("excelMenu");
  if (!bt || !menu) return;
  const itensMenu = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));
  const aberto = () => !menu.hidden;
  function abrir(focarPrimeiro) {
    menu.hidden = false;
    bt.setAttribute("aria-expanded", "true");
    bt.classList.add("on");
    if (focarPrimeiro) setTimeout(() => { const l = itensMenu(); if (l[0]) l[0].focus(); }, 0);
  }
  function fechar(focarBotao) {
    if (!aberto()) return;
    menu.hidden = true;
    bt.setAttribute("aria-expanded", "false");
    bt.classList.remove("on");
    if (focarBotao) bt.focus();
  }
  bt.addEventListener("click", (ev) => { ev.stopPropagation(); aberto() ? fechar(false) : abrir(ev.detail === 0); });
  bt.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); abrir(true); }
  });
  menu.addEventListener("keydown", (ev) => {
    const l = itensMenu(), i = l.indexOf(document.activeElement);
    if (ev.key === "ArrowDown") { ev.preventDefault(); l[(i + 1) % l.length].focus(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
    else if (ev.key === "Home") { ev.preventDefault(); l[0].focus(); }
    else if (ev.key === "End") { ev.preventDefault(); l[l.length - 1].focus(); }
    else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); fechar(true); }
    else if (ev.key === "Tab") fechar(false);
  });
  menu.addEventListener("click", (ev) => {
    const it = ev.target.closest('[role="menuitem"]');
    if (!it) return;
    fechar(true);
    if (it.dataset.excel === "importar") exportarExcelImportar();
    else if (it.dataset.excel === "consulta") exportarExcelConsulta();
  });
  document.addEventListener("click", (ev) => { if (!ev.target.closest("#excelDrop")) fechar(false); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && aberto()) fechar(true); }, true);
  window.addEventListener("resize", () => fechar(false));
}
