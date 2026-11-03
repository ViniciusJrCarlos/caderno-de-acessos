/* Caderno de Acessos — js/relatorios/exportar.js (v3.1.1 · v3.1.2: gráficos nativos do Excel ligados às células, caixinhas com fórmula, links internos reais)
 * "Extrair relatório" (só do Administrador): escolhe os relatórios num diálogo e baixa um Excel (.xlsx) gerado offline com o
 * exceljs do próprio app (js/vendor). Uma aba por relatório, com a descrição (sobre) no topo e os dados de r.dados(ctx),
 * recalculados na hora a partir dos dados atuais. Nunca inclui usuário nem senha. Estilo igual ao "Excel para consulta". */
const REL_PROIBIDAS = /^(usu[aá]rio|senha|login|password)$/i;
async function relAbrirExtrair() {
  if (!podeAdminEquipe()) { aviso("Só o Administrador", DICA_ADMIN); return; }
  const lista = RELATORIOS.filter((r) => typeof r.dados === "function");
  const escolhidos = await janela("dlgVer", (box, fim) => {
    box.classList.add("dlg-extrair");
    box.appendChild(el("h3", "", "Extrair relatório"));
    box.appendChild(el("p", "meta", "Marque os relatórios que vão para o Excel (.xlsx). Cada um vira uma aba, com os dados atuais deste aparelho. Nunca inclui usuário nem senha."));
    const todos = el("label", "rel-ex-todos"); const ct = document.createElement("input"); ct.type = "checkbox"; ct.checked = true; ct.id = "relExTodos";
    todos.appendChild(ct); todos.appendChild(el("span", "", "Marcar todos")); box.appendChild(todos);
    const grade = el("div", "rel-ex-lista");
    const caixas = lista.map((r) => { const l = el("label", "rel-ex-item"); const c = document.createElement("input"); c.type = "checkbox"; c.checked = true; c.value = r.id; c.dataset.relEx = "1";
      const t = el("span", ""); t.appendChild(el("b", "", r.titulo)); if (r.sobre) t.appendChild(el("small", "", r.sobre)); l.appendChild(c); l.appendChild(t); grade.appendChild(l); return c; });
    box.appendChild(grade);
    const cont = el("p", "meta rel-ex-cont"); box.appendChild(cont);
    const bb = el("div", "dlg-botoes"); const baixar = botaoDlg("pri", "Baixar Excel", () => fim(caixas.filter((c) => c.checked).map((c) => c.value)));
    const atual = () => { const n = caixas.filter((c) => c.checked).length; cont.textContent = n + " de " + caixas.length + " selecionado(s)"; ct.checked = n === caixas.length; ct.indeterminate = n > 0 && n < caixas.length; baixar.disabled = !n; };
    ct.addEventListener("change", () => { caixas.forEach((c) => { c.checked = ct.checked; }); atual(); });
    caixas.forEach((c) => c.addEventListener("change", atual)); atual();
    bb.appendChild(baixar); bb.appendChild(botaoDlg("", "Cancelar", () => fim(false))); box.appendChild(bb);
  });
  if (!escolhidos || !escolhidos.length) return;
  try {
    const ExcelJS = await carregarExcelJS(), JSZip = await carregarJSZip(); // JSZip só na hora de extrair
    const { wb, pedidos } = relMontarExcelNativo(ExcelJS, escolhidos), buf = await wb.xlsx.writeBuffer();
    download("caderno-acessos-relatorios-" + hoje() + ".xlsx", await gnInjetar(JSZip, buf, pedidos, "arraybuffer"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    toast("Relatório exportado: " + escolhidos.length + " aba(s), sem usuário e senha");
  } catch (e) { console.error(e); aviso("Falha ao exportar", "Não foi possível gerar a planilha. Recarregue a página e tente de novo."); }
}
function relNomeAba(t, usados) {
  let n = String(t).replace(/[\\\/\?\*\[\]:]/g, "-").replace(/×/g, "x").slice(0, 31).trim(), b = n, i = 2;
  while (usados.has(n.toLowerCase()) || n.toLowerCase() === "leia-me") { const suf = " " + i++; n = b.slice(0, 31 - suf.length) + suf; }
  usados.add(n.toLowerCase()); return n;
}
function relMontarExcel(ExcelJS, ids) {
  const ctx = relContexto(), wb = new ExcelJS.Workbook(); wb.creator = "Caderno de Acessos"; wb.created = new Date();
  const sel = ids.map((id) => RELATORIOS.find((r) => r.id === id)).filter((r) => r && typeof r.dados === "function");
  const usados = new Set(), abas = sel.map((r) => ({ r, aba: relNomeAba(r.titulo, usados) }));
  // Leia-me / índice
  const lm = wb.addWorksheet("Leia-me", { properties: { tabColor: { argb: XL.navy } } });
  [34, 96, 12].forEach((w, i) => { lm.getColumn(i + 1).width = w; });
  lm.mergeCells("A1:C1"); const t = lm.getCell("A1"); t.value = "Caderno de Acessos — Relatórios"; t.font = { bold: true, size: 16, color: { argb: XL.branco } }; t.fill = xlFill(XL.navy); t.alignment = { vertical: "middle" }; lm.getRow(1).height = 32;
  const info = [["Gerado em", dataHoraBR(new Date().toISOString())], ["Versão do app", "v" + APP_VERSAO], ["Cards ativos", ctx.ativos.length + " · " + (ctx.base.length - ctx.ativos.length) + " arquivado(s)"], ["Segurança", "Nunca inclui usuário nem senha. Dados calculados na hora, a partir deste aparelho."]];
  info.forEach(([a, b], i) => { const r = lm.getRow(3 + i); r.getCell(1).value = a; r.getCell(1).font = { bold: true, color: { argb: XL.navy } }; r.getCell(2).value = b; r.getCell(2).alignment = { wrapText: true, vertical: "top" }; });
  const h0 = 3 + info.length + 1, hr = lm.getRow(h0); ["Relatório (clique para abrir)", "O que compara", "Linhas"].forEach((h, i) => { hr.getCell(i + 1).value = h; }); xlCabecalho(hr, 3);
  const linhas = abas.map((a) => { const d = a.r.dados(ctx) || { cab: [], linhas: [] }; d.cab = d.cab || []; d.linhas = (d.linhas || []).map((l) => l.map((v, k) => REL_PROIBIDAS.test(String(d.cab[k] || "")) ? "" : v)); return d; });
  abas.forEach((a, i) => { const r = lm.getRow(h0 + 1 + i);
    r.getCell(1).value = xlLinkInterno(a.aba, "A1", a.r.titulo); r.getCell(1).font = { bold: true, color: { argb: XL.link }, underline: true };
    r.getCell(2).value = a.r.sobre || a.r.desc || ""; r.getCell(3).value = linhas[i].linhas.length;
    for (let k = 1; k <= 3; k++) { const c = r.getCell(k); c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true }; if (i % 2) c.fill = xlFill(XL.zebra); }
    r.getCell(3).alignment = { horizontal: "center", vertical: "top" }; });
  // Uma aba por relatório
  abas.forEach((a, i) => {
    const d = linhas[i], n = Math.max(2, d.cab.length), ws = wb.addWorksheet(a.aba, { views: [{ state: "frozen", ySplit: 4 }], properties: { tabColor: { argb: i % 2 ? XL.ext : XL.int } } });
    const c1 = ws.getCell("A1"); c1.value = xlLinkInterno("Leia-me", "A1", "◀ Voltar ao Leia-me"); c1.font = { bold: true, color: { argb: XL.branco } }; c1.fill = xlFill(XL.ext); c1.alignment = { horizontal: "center", vertical: "middle" }; c1.border = xlBorda();
    ws.mergeCells(1, 2, 1, n); const tt = ws.getCell(1, 2); tt.value = a.r.titulo; tt.font = { bold: true, size: 14, color: { argb: XL.navy } }; tt.alignment = { vertical: "middle" }; ws.getRow(1).height = 28;
    ws.mergeCells(2, 1, 2, n); const ds = ws.getCell(2, 1); ds.value = a.r.sobre || a.r.desc || ""; ds.font = { italic: true, color: { argb: XL.navy } }; ds.fill = xlFill(XL.info); ds.alignment = { wrapText: true, vertical: "middle" }; ws.getRow(2).height = 34;
    const hr = ws.getRow(4); d.cab.forEach((h, k) => { hr.getCell(k + 1).value = h; }); if (d.cab.length) xlCabecalho(hr, d.cab.length);
    d.linhas.forEach((l, j) => { const r = ws.getRow(5 + j); l.forEach((v, k) => { const c = r.getCell(k + 1); c.value = v == null ? "" : v; c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true, horizontal: typeof v === "number" ? "center" : "left" }; if (j % 2) c.fill = xlFill(XL.zebra); }); });
    if (!d.linhas.length) { const c = ws.getCell(5, 1); c.value = "Nada por aqui."; c.font = { italic: true, color: { argb: "FF808080" } }; }
    else ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + d.linhas.length, column: d.cab.length } };
    d.cab.forEach((h, k) => { const mx = Math.max(String(h).length, ...d.linhas.map((l) => String(l[k] == null ? "" : l[k]).length)); ws.getColumn(k + 1).width = Math.min(60, Math.max(k ? 10 : 22, mx + 2)); });
    if (ws.getColumn(1).width < 22) ws.getColumn(1).width = 22;
  });
  wb.worksheets.forEach((ws) => { ws.pageSetup = { orientation: ws.name === "Leia-me" ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }; });
  return wb;
}

/* ---------- v3.1.2: gráficos nativos (chart XML injetado com JSZip, js/vendor/jszip.min.js) ---------- */
function carregarJSZip() { return carregarScript("js/vendor/jszip.min.js", "JSZip"); }
const GN = { navy: "1B365D", teal: "1A8C86", ext: "2F6DB5", lilas: "9BB3CF", red: "C0392B", laranja: "B4530A", cinza: "98A2B3", verde: "2E9E5B", grade: "E4E7EC", tx: "344054", info: "EAF1FB" };
const PX = 9525; // EMU por pixel
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ref = (aba, r) => "'" + aba.replace(/'/g, "''") + "'!" + r;
function spPr(cor) { return `<c:spPr><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>`; }
function txPr(sz, cor, b) { return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b ? 1 : 0}"><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`; }
function serie(i, aba, s, cat, comPontos, rot) {
  const pts = comPontos ? s.coresPontos.map((c, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/>${spPr(c)}</c:dPt>`).join("") : "";
  return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${esc(ref(aba, s.nome))}</c:f></c:strRef></c:tx>${spPr(s.cor || GN.teal)}${pts}`
    + (rot === false ? "" : `<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, GN.navy, 1)}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`)
    + `<c:cat><c:strRef><c:f>${esc(ref(aba, cat))}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(ref(aba, s.val))}</c:f></c:numRef></c:val></c:ser>`;
}
/* g = { tipo: "barraH" | "colunas" | "empilhado" | "rosca", titulo, cat, series:[{nome(célula do nome), val(intervalo), cor, coresPontos}] } */
function gnChartXml(aba, g) {
  const ax = `<c:axId val="1"/><c:axId val="2"/>`, leg = g.series.length > 1 || g.tipo === "rosca";
  let plot;
  if (g.tipo === "rosca") plot = `<c:doughnutChart><c:varyColors val="1"/>${serie(0, aba, g.series[0], g.cat, true)}<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`;
  else {
    const dir = g.tipo === "barraH" ? "bar" : "col", grp = g.tipo === "empilhado" || g.empilhar ? "stacked" : "clustered";
    plot = `<c:barChart><c:barDir val="${dir}"/><c:grouping val="${grp}"/><c:varyColors val="0"/>${g.series.map((s, i) => serie(i, aba, s, g.cat, false, g.series.length === 1 || grp !== "stacked")).join("")}<c:gapWidth val="60"/>${grp === "stacked" ? '<c:overlap val="100"/>' : ""}${ax}</c:barChart>`
      + `<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="${(dir === "bar") !== !!g.rev ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${dir === "bar" ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:solidFill><a:srgbClr val="${GN.grade}"/></a:solidFill></a:ln></c:spPr>${txPr(800, GN.tx)}<c:crossAx val="2"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="1"/><c:axPos val="${dir === "bar" ? "t" : "l"}"/><c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="1"/><c:crosses val="${dir === "bar" ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>`
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="pt-BR" sz="1100" b="1"><a:solidFill><a:srgbClr val="${GN.navy}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${esc(g.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + `<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>`
    + (leg ? `<c:legend><c:legendPos val="${g.tipo === "rosca" ? "r" : "b"}"/><c:overlay val="0"/>${txPr(800, GN.tx)}</c:legend>` : "")
    + `<c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${GN.grade}"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
}
function gnDrawingXml(anc) { // anc: [{col,row,w,h,rid}] (col/row 0-based)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">`
    + anc.map((x, i) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${x.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${x.row}</xdr:row><xdr:rowOff>${x.rowOff || 0}</xdr:rowOff></xdr:from><xdr:ext cx="${x.w * PX}" cy="${x.h * PX}"/>`
      + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
      + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="${x.rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`).join("") + `</xdr:wsDr>`;
}
/* Pós-processa o buffer do exceljs. pedidos: { [nomeAba]: [{...g, col,row,w,h}] } */
async function gnInjetar(JSZip, buf, pedidos, tipoSaida) {
  const zip = await JSZip.loadAsync(buf);
  const wbXml = await zip.file("xl/workbook.xml").async("string"), wbRels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  let ct = await zip.file("[Content_Types].xml").async("string"), nChart = 0, nDraw = 0;
  const abas = [...wbXml.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => ({ nome: m[1].replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"'), rid: m[2] }));
  zip.forEach((p) => { if (/^xl\/drawings\/drawing\d+\.xml$/.test(p)) nDraw++; if (/^xl\/charts\/chart\d+\.xml$/.test(p)) nChart++; });
  for (const a of abas) {
    const gs = pedidos[a.nome]; if (!gs || !gs.length) continue;
    const alvo = new RegExp(`Id="${a.rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${a.rid}"`).exec(wbRels), sheetPath = "xl/" + (alvo[1] || alvo[2]).replace(/^\/?xl\//, "");
    const relsPath = sheetPath.replace(/worksheets\//, "worksheets/_rels/") + ".rels", d = ++nDraw, anc = [], dRels = [];
    gs.forEach((g, i) => { const c = ++nChart; zip.file(`xl/charts/chart${c}.xml`, gnChartXml(a.nome, g)); ct = ct.replace("</Types>", `<Override PartName="/xl/charts/chart${c}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      dRels.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${c}.xml"/>`); anc.push({ ...g, rid: "rId" + (i + 1) }); });
    zip.file(`xl/drawings/drawing${d}.xml`, gnDrawingXml(anc));
    zip.file(`xl/drawings/_rels/drawing${d}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${dRels.join("")}</Relationships>`);
    ct = ct.replace("</Types>", `<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    let rels = zip.file(relsPath) ? await zip.file(relsPath).async("string") : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    rels = rels.replace("</Relationships>", `<Relationship Id="rIdGN${d}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${d}.xml"/></Relationships>`);
    zip.file(relsPath, rels);
    let sx = await zip.file(sheetPath).async("string"); const tag = `<drawing r:id="rIdGN${d}"/>`;
    if (!/xmlns:r=/.test(sx.slice(0, 600))) sx = sx.replace("<worksheet ", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    const m = /<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)[ >]/.exec(sx);
    sx = m ? sx.slice(0, m.index) + tag + sx.slice(m.index) : sx.replace("</worksheet>", tag + "</worksheet>");
    zip.file(sheetPath, sx);
  }
  // Links internos: exceljs grava r:id externo + location="#'Aba'!A1". O padrão OOXML é só location="'Aba'!A1" (sem # e sem r:id).
  for (const p of Object.keys(zip.files).filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))) {
    let sx = await zip.file(p).async("string"); const ids = [];
    sx = sx.replace(/<hyperlink ([^>]*?)\/>/g, (t, at) => { const loc = /location="#([^"]*)"/.exec(at); if (!loc) return t; const id = /r:id="([^"]+)"/.exec(at); if (id) ids.push(id[1]);
      return "<hyperlink " + at.replace(/\s*r:id="[^"]+"/, "").replace(/location="#/, 'location="') + "/>"; });
    zip.file(p, sx); const rp = p.replace("worksheets/", "worksheets/_rels/") + ".rels";
    if (ids.length && zip.file(rp)) { let r = await zip.file(rp).async("string"); ids.forEach((id) => { r = r.replace(new RegExp(`<Relationship Id="${id}"[^>]*/>`), ""); }); zip.file(rp, r); }
  }
  zip.file("[Content_Types].xml", ct);
  return zip.generateAsync({ type: tipoSaida || (typeof window !== "undefined" && window.document ? "blob" : "nodebuffer"), compression: "DEFLATE" });
}

/* ---------- v3.1.2: gráficos no topo de cada aba, ligados a fórmulas sobre a tabela ---------- */
/* v3.1.2: folga de linhas nas fórmulas: linhas novas digitadas logo abaixo da tabela entram nas contas */
const REL_FOLGA = 200;
const NV = { navy: "1B365D", teal: "1A8C86", ext: "2F6DB5", lilas: "9BB3CF", red: "C0392B", laranja: "B4530A", cinza: "98A2B3", verde: "2E9E5B" };
const NV_FX = ["C0392B", "E67E22", "E9B949", "1A8C86", "2F6DB5", "98A2B3", "D0D5DD"];
const nvL = (k) => { let s = ""; while (k > 0) { const m = (k - 1) % 26; s = String.fromCharCode(65 + m) + s; k = Math.floor((k - 1) / 26); } return s; };
const nvQ = (t) => '"' + String(t).replace(/"/g, '""') + '"';
/* v3.1.2: conta só linhas reais (a tabela vazia tem "Nada por aqui." na 1ª célula) */
const nvConta = (rg) => `(COUNTA(${rg})-COUNTIF(${rg},"Nada por aqui."))`;
/* Spec por relatório. T = {col(k) -> "$X$a:$X$b", cel(k,j) -> "X(a+j)", n (linhas)}. Retorna { kpis:[{t,f,cor}], graf:[{tipo,titulo,h,itens|series...}] } */
const NV_REL = {
  ferramentas: (ctx, d, T) => ({ kpis: [["URL única", NV.teal], ["URL por operação", NV.ext], ["1 operação", NV.cinza, "Só 1 operação"]].map(([k, cor, t]) => ({ t: t || k, cor, f: `COUNTIF(${T.col(2)},${nvQ(k)})` })),
    graf: [{ tipo: "barraH", titulo: "Cards ativos por ferramenta (top 9)", cor: NV.teal, cab: "Cards", total: { n: nvConta(T.col(1)), v: `SUM(${T.col(5)})` }, itens: d.linhas.map((l, j) => ({ n: { formula: T.cel(1, j) }, v: T.cel(5, j) })) }] }),
  fornecedores: (ctx, d, T) => { const ops = relOrdena(relAgrupa(ctx.externos, relOp)).map(([o]) => o);
    return { kpis: [{ t: "Fornecedores", cor: NV.ext, f: nvConta(T.col(1)) }, { t: "Cards ativos", cor: NV.navy, f: `SUM(${T.col(3)})` }, { t: "Operações", cor: NV.teal, f: `SUMPRODUCT((${T.col(2)}<>"")/COUNTIF(${T.col(2)},${T.col(2)}&""))>0`, fOps: true }],
      graf: [{ tipo: "barraH", titulo: "Cards de fornecedores por operação", cor: NV.ext, cab: "Cards", itens: ops.map((o) => ({ n: o, v: `SUMPRODUCT(ISNUMBER(SEARCH(${nvQ(", " + o + ",")},", "&${T.col(2)}&","))*${T.col(3)})` })) }] }; },
  "ferr-op": (ctx, d, T) => { const ops = d.cab.slice(2), l = d.linhas.slice(0, 9);
    return { graf: [{ tipo: "empilhadoH", titulo: "Ferramenta × operação (cards, top 9)", h: Math.min(320, 70 + l.length * 24), direto: true, cat: T.faixa(1, 0, l.length), series: ops.map((o, i) => ({ nome: T.cab(3 + i), val: T.faixa(3 + i, 0, l.length), cor: NV_FX[i % NV_FX.length] })) }] }; },
  senhas: (ctx, d, T) => { const e = REL_FAIXAS.map((f) => d.linhas.filter((l) => l[6] === f && l[3] === "Equipe").length), m = REL_FAIXAS.map((f) => d.linhas.filter((l) => l[6] === f && l[3] !== "Equipe").length);
    // SUMPRODUCT com "=" (e não COUNTIFS): "> 90 dias" seria lido como comparação pelo COUNTIF
    const fe = (f) => `SUMPRODUCT((${T.col(7)}=${nvQ(f)})*(${T.col(4)}="Equipe"))`, fm = (f) => `SUMPRODUCT((${T.col(7)}=${nvQ(f)})*(${T.col(4)}="Meus"))`;
    if (REL_FAIXAS.filter((_, i) => e[i] + m[i]).length <= 1) { const i = REL_FAIXAS.findIndex((_, i) => e[i] + m[i]); return { kpis: [{ t: "Total no período", cor: NV.navy, f: nvConta(T.col(1)) }].concat(i >= 0 ? [{ t: "Tudo em " + REL_FAIXAS[i], cor: NV.teal, f: fe(REL_FAIXAS[i]) + "+" + fm(REL_FAIXAS[i]) }] : []) }; }
    return { graf: [{ tipo: "empilhado", titulo: "Senhas por faixa de vencimento", cab: ["Equipe", "Meus"], cores: [NV.teal, NV.lilas], itens: REL_FAIXAS.map((f) => ({ n: f, vs: [fe(f), fm(f)] })) }] }; },
  analistas: (ctx, d, T) => { const st = [["ativo", NV.verde], ["desativado", NV.cinza], ["bloqueado", NV.red]].map(([k, cor]) => { const p = ctx.pessoas.find((x) => relStatus(x)[0] === k); return { n: p ? relStatus(p)[1] : k[0].toUpperCase() + k.slice(1), cor, q: ctx.pessoas.filter((x) => relStatus(x)[0] === k).length }; });
    const f = (n) => `SUMPRODUCT(--(${T.col(4)}=${nvQ(n)}))`, fo = `${nvConta(T.col(1))}-${st.map((x) => f(x.n)).join("-")}`; // v3.1.2: "Outros status" fecha a soma com o total de perfis
    const outros = { n: "Outros status", cor: NV.laranja, q: ctx.pessoas.length - st.reduce((s, x) => s + x.q, 0) };
    if (st.filter((x) => x.q).length + (outros.q ? 1 : 0) <= 1) return { kpis: st.filter((x) => x.q).concat(st.filter((x) => !x.q)).map((x) => ({ t: x.n, cor: x.q ? x.cor : NV.cinza, f: f(x.n) })).concat([{ t: outros.n, cor: outros.q ? outros.cor : NV.cinza, f: fo }]) };
    if (st.filter((x) => x.q).length <= 1) return { kpis: st.filter((x) => x.q).concat(st.filter((x) => !x.q)).map((x) => ({ t: x.n, cor: x.q ? x.cor : NV.cinza, f: f(x.n) })).concat([{ t: outros.n, cor: outros.cor, f: fo }]) };
    return { graf: [{ tipo: "rosca", titulo: "Perfis por status", cab: "Perfis", itens: st.map((x) => ({ n: x.n, v: f(x.n), cor: x.cor })).concat([{ n: outros.n, v: fo, cor: outros.cor }]) }] }; },
  envios: (ctx, d, T) => { const m = new Map(); d.linhas.forEach((l) => String(l[2]).split(", ").filter(Boolean).forEach((n) => m.set(n, (m.get(n) || 0) + 1))); const l = Array.from(m).sort((a, b) => b[1] - a[1]);
    const f = (n) => `COUNTIF(${T.col(3)},${nvQ("*" + n + "*")})`;
    if (l.length <= 1) return { kpis: l.length ? [{ t: l[0][0] + " · cards recebidos", cor: NV.teal, f: f(l[0][0]) }] : [{ t: "Nada por aqui", cor: NV.cinza, f: nvConta(T.col(1)) }] };
    return { graf: [{ tipo: "barraH", titulo: "Cards recebidos por pessoa", cor: NV.teal, cab: "Cards recebidos", itens: l.map(([n]) => ({ n, v: f(n) })) }] }; },
  "sem-esc": (ctx, d, T) => ({ kpis: [{ t: "Sem escalonamento", cor: NV.laranja, f: `COUNTIF(${T.col(5)},"*Escalonamento*")` }, { t: "Sem Resumo", cor: NV.laranja, f: `COUNTIF(${T.col(5)},"*Resumo*")` }, { t: "Faltam os dois", cor: NV.red, f: `COUNTIF(${T.col(5)},"* e *")` }] }),
  "sem-ultima": (ctx, d, T) => ({ kpis: [{ t: "Ferramentas", cor: NV.teal, f: `COUNTIF(${T.col(3)},"Ferramenta")` }, { t: "Fornecedores", cor: NV.ext, f: `COUNTIF(${T.col(3)},"Fornecedor")` }] }),
  calendario: (ctx, d, T) => { if (d.linhas.filter((l) => l[1]).length <= 1) { const i = d.linhas.findIndex((l) => l[1]); return { kpis: [{ t: "Total no período", cor: NV.navy, f: `SUM(${T.col(2)})` }].concat(i >= 0 ? [{ t: "Tudo em " + d.linhas[i][0].slice(0, 5), cor: NV.teal, f: T.cel(2, i) }] : []) }; }
    return { graf: [{ tipo: "colunas", titulo: "Trocas por semana (próximas 8)", cor: NV.teal, cab: "Trocas", itens: d.linhas.map((l, j) => ({ n: { formula: `LEFT(${T.cel(1, j)},5)` }, v: T.cel(2, j) })) }] }; },
  "op-venc": (ctx, d, T) => { const l = d.linhas.slice(0, 9);
    return { graf: [{ tipo: "empilhadoH", titulo: "Operação × faixa de vencimento (top 9)", h: Math.min(320, 80 + l.length * 24), direto: true, cat: T.faixa(1, 0, l.length), series: REL_FAIXAS.map((f, i) => ({ nome: T.cab(2 + i), val: T.faixa(2 + i, 0, l.length), cor: NV_FX[i] })) }] }; },
  ciclo: (ctx, d, T) => ({ graf: [{ tipo: "rosca", titulo: "Cards da Equipe por ciclo", direto: true, cat: T.faixa(1, 0, d.linhas.length), series: [{ nome: T.cab(2), val: T.faixa(2, 0, d.linhas.length), coresPontos: [NV.red, NV.laranja, NV.teal, NV.cinza] }] }] }),
  log: (ctx, d, T) => { const it = []; for (let i = 13; i >= 0; i--) { const dd = new Date(Date.now() - i * 864e5).toLocaleDateString("pt-BR").slice(0, 5); it.push({ n: dd, q: d.linhas.filter((l) => String(l[0]).startsWith(dd)).length, v: `COUNTIF(${T.col(1)},${nvQ(dd + "*")})` }); }
    if (it.filter((x) => x.q).length <= 1) { const x = it.find((x) => x.q); return { kpis: [{ t: "Total no período", cor: NV.navy, f: nvConta(T.col(1)) }].concat(x ? [{ t: "Tudo em " + x.n, cor: NV.teal, f: x.v }] : []) }; }
    return { graf: [{ tipo: "colunas", titulo: "Registros no Log por dia (14 dias)", cor: NV.navy, cab: "Registros", itens: it, semCorte: true }] }; },
  acessos: (ctx, d, T) => ({ kpis: [["Nunca entrou", NV.cinza], ["7+ dias", NV.laranja, "7+ dias sem entrar"], ["30+ dias", NV.red]].map(([k, cor, t]) => ({ t: t || k, cor, f: `COUNTIF(${T.col(4)},${nvQ(k)})` })) }),
  duplicados: (ctx, d, T) => ({ kpis: [{ t: "Links em Meus e Equipe", cor: NV.laranja, f: nvConta(T.col(1)) }] }),
  arquivados: (ctx, d, T) => { if (d.linhas.filter((l) => l[1] + l[2]).length <= 1) { const i = d.linhas.findIndex((l) => l[1] + l[2]); return { kpis: [{ t: "Total no período", cor: NV.navy, f: `SUM(${T.col(2)})+SUM(${T.col(3)})` }].concat(i >= 0 ? [{ t: "Tudo em " + d.linhas[i][0], cor: NV.teal, f: T.cel(2, i) + "+" + T.cel(3, i) }] : []) }; }
    return { graf: [{ tipo: "empilhado", titulo: "Arquivados por mês", direto: true, rev: true, cat: T.faixa(1, 0, d.linhas.length), series: [{ nome: T.cab(2), val: T.faixa(2, 0, d.linhas.length), cor: NV.teal }, { nome: T.cab(3), val: T.faixa(3, 0, d.linhas.length), cor: NV.ext }] }] }; },
  "esc-edit": (ctx, d, T) => ({ kpis: [{ t: "Cards editados", cor: NV.navy, f: nvConta(T.col(1)) }] })
};
/* Escreve o bloco "Dados do gráfico" (fórmulas) e devolve o pedido do gráfico. Top 9 + "Outros" quando passa de 10. */
function nvBloco(ws, g, col, r0) {
  const it = g.itens.slice(), nS = it[0] && it[0].vs ? it[0].vs.length : 1, cabs = Array.isArray(g.cab) ? g.cab : [g.cab];
  const h = ws.getCell(r0, col); h.value = "Dados do gráfico"; cabs.forEach((c, i) => { ws.getCell(r0, col + 1 + i).value = c; });
  for (let k = 0; k <= nS; k++) { const c = ws.getCell(r0, col + k); c.font = { bold: true, color: { argb: XL.branco } }; c.fill = xlFill(XL.navy); c.border = xlBorda(); }
  ws.getColumn(col).width = Math.max(ws.getColumn(col).width || 0, 24); for (let k = 1; k <= nS; k++) ws.getColumn(col + k).width = Math.max(ws.getColumn(col + k).width || 0, 11);
  const corte = !g.semCorte && it.length > 10, vis = corte ? 10 : it.length, put = (j, x) => { const r = r0 + 1 + j; ws.getCell(r, col).value = x.n; (x.vs || [x.v]).forEach((f, k) => { const c = ws.getCell(r, col + 1 + k); c.value = typeof f === "object" ? f : { formula: f }; c.alignment = { horizontal: "center" }; });
    for (let k = 0; k <= nS; k++) { const c = ws.getCell(r, col + k); c.border = xlBorda(); if (j % 2) c.fill = xlFill(XL.zebra); } };
  if (corte) { it.slice(0, 9).forEach((x, j) => put(j, x)); const a = r0 + 12, b = r0 + 11 + it.length - 9, L = nvL(col), V = nvL(col + 1);
    const r9 = `${V}${r0 + 1}:${V}${r0 + 9}`; put(9, g.total ? { n: { formula: `"Outros ("&(${g.total.n}-9)&")"` }, v: `${g.total.v}-SUM(${r9})` } : { n: { formula: `"Outros ("&COUNTA(${L}${a}:${L}${b})&")"` }, v: `SUM(${V}${a}:${V}${b})` }); ws.getCell(r0 + 11, col).value = "(resto, somado em Outros)"; ws.getCell(r0 + 11, col).font = { italic: true, color: { argb: XL.cinzaTx } };
    it.slice(9).forEach((x, j) => put(11 + j, x)); }
  else it.forEach((x, j) => put(j, x));
  const rng = (k) => `$${nvL(col + k)}$${r0 + 1}:$${nvL(col + k)}$${r0 + vis}`;
  return { cat: rng(0), series: Array.from({ length: nS }, (_, k) => ({ nome: `$${nvL(col + 1 + k)}$${r0}`, val: rng(1 + k), cor: (g.cores || [])[k] || g.cor, coresPontos: g.itens.map((x) => x.cor || g.cor) })), vis };
}
function nvLinkReal(ws) { ws.eachRow((row) => row.eachCell((c) => { const v = c.value; if (v && v.formula && /^HYPERLINK\(/.test(v.formula)) { const m = /^HYPERLINK\("#((?:[^"]|"")*)","((?:[^"]|"")*)"\)$/.exec(v.formula); if (m) c.value = { text: m[2].replace(/""/g, '"'), hyperlink: "#" + m[1].replace(/""/g, '"') }; } })); }
function relMontarExcelNativo(ExcelJS, ids) {
  const ctx = relContexto(), wb = relMontarExcel(ExcelJS, ids), pedidos = {};
  const sel = ids.map((id) => RELATORIOS.find((r) => r.id === id));
  wb.worksheets.forEach(nvLinkReal);
  sel.forEach((r, i) => {
    const ws = wb.worksheets[i + 1], d = r.dados(ctx); if (!NV_REL[r.id]) return;
    // reserva o topo: calcula alturas antes de empurrar a tabela
    const n = Math.max(2, d.cab.length), pre = { kpis: [], graf: [] }, Tfake = { col: () => "A1", cel: () => "A1", faixa: () => "A1", cab: () => "A1" }, sp0 = NV_REL[r.id](ctx, d, Tfake);
    const altG = (g) => g.h || (g.tipo === "barraH" ? Math.min(300, 60 + Math.min(10, g.itens.length) * 22) : g.tipo === "rosca" ? 210 : 230);
    const linhasG = (sp0.graf || []).reduce((s, g) => s + Math.ceil((altG(g) + 10) / 20), 0), nk = sp0.kpis && sp0.kpis.length ? 3 : 0, nl = nk + linhasG + 1;
    ws.spliceRows(3, 0, ...Array.from({ length: nl }, () => [])); for (let j = 3; j < 3 + nl; j++) ws.getRow(j).height = 15;
    const t = ws.getCell(3, 1); t.value = "Gráficos"; t.font = { bold: true, color: { argb: XL.navy } };
    const H = 4 + nl, D0 = H + 1, D1 = H + Math.max(1, d.linhas.length);
    const T = { col: (k) => `$${nvL(k)}$${D0}:$${nvL(k)}$${D1 + REL_FOLGA}`, cel: (k, j) => `${nvL(k)}${D0 + j}`, faixa: (k, j, q) => `$${nvL(k)}$${D0 + j}:$${nvL(k)}$${D0 + j + Math.max(1, q) - 1}`, cab: (k) => `$${nvL(k)}$${H}` };
    const sp = NV_REL[r.id](ctx, d, T);
    // caixinhas: valor (fórmula) + rótulo, uma por coluna
    (sp.kpis || []).forEach((k, j) => { const v = ws.getCell(4, j + 1), l = ws.getCell(5, j + 1); ws.getRow(4).height = 30; ws.getRow(5).height = 18;
      v.value = { formula: k.f }; v.font = { bold: true, size: 20, color: { argb: "FF" + k.cor } }; v.fill = xlFill("FFF4F7FB"); v.alignment = { horizontal: "left", vertical: "middle", indent: 1 }; v.border = { left: { style: "thick", color: { argb: "FF" + k.cor } } };
      l.value = k.t; l.font = { size: 9, color: { argb: "FF667085" } }; l.fill = xlFill("FFF4F7FB"); l.alignment = { indent: 1, vertical: "top", wrapText: true }; l.border = { left: { style: "thick", color: { argb: "FF" + k.cor } } };
      if ((ws.getColumn(j + 1).width || 9) < 16) ws.getColumn(j + 1).width = 16; });
    // fornecedores: "Operações" = nº de linhas do bloco de dados do gráfico (operações distintas)
    let col = n + 2, row = 3 + nk; pedidos[ws.name] = [];
    (sp.graf || []).forEach((g) => { let ref = g; if (!g.direto) { const b = nvBloco(ws, g, col, H); ref = { ...g, cat: b.cat, series: b.series }; col += (b.series.length + 2); }
      const tipo = g.tipo === "empilhadoH" ? "barraH" : g.tipo; pedidos[ws.name].push({ ...ref, tipo, empilhar: g.tipo === "empilhadoH", col: 0, row, w: 380, h: altG(g) }); row += Math.ceil((altG(g) + 10) / 20); });
    (sp.kpis || []).forEach((k, j) => { if (k.fOps) { const L = nvL(n + 2); ws.getCell(4, j + 1).value = { formula: `COUNTA($${L}$${H + 1}:$${L}$${H + 400})-COUNTIF($${L}$${H + 1}:$${L}$${H + 400},"Outros*")-COUNTIF($${L}$${H + 1}:$${L}$${H + 400},"(resto*")` }; } });
    ws.views = [{ state: "frozen", ySplit: 0 }]; ws.pageSetup.printArea = "A1:" + nvL(n) + (H + Math.max(1, d.linhas.length)); // impressão só da tabela (bloco de dados do gráfico fica fora)
    if (ws.autoFilter && ws.autoFilter.from) { ws.autoFilter.from.row += nl; ws.autoFilter.to.row += nl; }
  });
  return { wb, pedidos };
}
