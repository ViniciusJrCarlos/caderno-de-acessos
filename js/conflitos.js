/* Caderno de Acessos — js/conflitos.js
 * Cópias de conflito (edição ao mesmo tempo): guardar, ver as duas versões, resolver; extras do arquivo (lixeira, conflitos).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- v2.0.0: cópias de conflito (edição simultânea) ----------
 * A versão mais recente continua valendo (como antes); a outra fica guardada como "cópia de conflito" no arquivo da equipe por 30 dias
 * (só cards da Equipe: nada Individual). Qualquer analista pode ver as duas versões e escolher. */
function lerConflitos() {
  const o = lerJSON(CONF_KEY, {});
  if (!window.CadernoSync) return { itens: [], resolvidos: [] };
  const resolvidos = CadernoSync.mesclarRemocoes([CadernoSync.limparRemocoes(o.resolvidos)]);
  return { itens: CadernoSync.mesclarConflitos([CadernoSync.limparConflitos(o.itens)], resolvidos), resolvidos: resolvidos };
}
function gravarConflitos(c) { Dados.gravarTexto(CONF_KEY, JSON.stringify({ itens: (c.itens || []).filter((x) => x && x.perdedora && compartilhado(x.perdedora)), resolvidos: c.resolvidos || [] })); }
function tituloConflito(c) {
  const a = c.perdedorPor || "Alguém", b = c.vencedorPor || "outra pessoa";
  return a === b ? "⚠️ " + a + " editou o mesmo card em dois aparelhos" : "⚠️ " + a + " e " + b + " editaram o mesmo card";
}
/* Junta lixeira e conflitos do arquivo, das cópias do OneDrive e deste aparelho. */
function mesclarExtras(remoto, copias, r, conf, remAqui, voltaram) {
  const agora = Date.now(), nowIso = new Date().toISOString(), quem = autor();
  const lixL = lerLixeiraEq(), confL = lerConflitos();
  const hist = [], extraRem = [];
  const remAntes = CadernoSync.mesclarRemocoes([remoto ? remoto.lixeiraRemovidos : [], lixL.removidos]);
  voltaram.forEach((v) => {
    const id = v.item.id;
    const rr = remAntes.find((t) => t.id === id);
    extraRem.push({ id: id, em: nowIso, por: quem });
    if (rr && CadernoSync.ts(rr.em) >= CadernoSync.ts(v.tomb.deletedAt)) return; // restaurado pela Lixeira: o Histórico já tem "Card restaurado"
    // exclui x edita: a edição foi DEPOIS da exclusão → o card volta (decisão v2.0.0, documentada)
    hist.push({ id: "volta-" + id + "-" + (v.item.updatedAt || ""), tipo: "texto", texto: "Card " + nomeDe(v.item) + " voltou: " + (v.item.updatedBy || "alguém") + " editou depois de " + (v.tomb.deletedBy || "alguém") + " excluir", card: String(nomeDe(v.item)).slice(0, 200), quem: v.item.updatedBy || "", quando: v.item.updatedAt || nowIso, escopo: "Equipe" });
  });
  // exclusão feita DEPOIS da edição: o card sai, mas a versão editada deste aparelho entra na Lixeira (nada se perde)
  const remAquiEntradas = remAqui.filter((m) => m.item && m.item.id && compartilhado(m.item)).map((m) => ({ id: m.item.id, card: itemParaEquipe(m.item), excluidoEm: m.em || nowIso, excluidoPor: m.por || "" }));
  const lixRem = CadernoSync.mesclarRemocoes([remAntes, ...copias.map((c) => c.doc.lixeiraRemovidos), extraRem]);
  const ativos = new Set(r.itens.map((x) => x.id));
  let lixeira = CadernoSync.mesclarLixeira([remoto ? remoto.lixeira : [], ...copias.map((c) => c.doc.lixeira), lixL.itens, remAquiEntradas], lixRem, agora);
  lixeira.filter((e) => ativos.has(e.id)).forEach((e) => lixRem.push({ id: e.id, em: nowIso, por: quem }));
  lixeira = lixeira.filter((e) => !ativos.has(e.id));
  const confRes = CadernoSync.mesclarRemocoes([remoto ? remoto.conflitosResolvidos : [], ...copias.map((c) => c.doc.conflitosResolvidos), confL.resolvidos]);
  const novos = [], vistos = new Set();
  conf.forEach((c) => {
    const p = c.perdedor, v = c.vencedor;
    if (!p || !v || !compartilhado(p) || !compartilhado(v)) return;
    const id = "cf-" + p.id + "-" + CadernoSync.ts(p.updatedAt);
    if (vistos.has(id)) return; vistos.add(id);
    novos.push({ id: id, cardId: p.id, titulo: String(nomeDe(v)).slice(0, 200), perdedora: itemParaEquipe(p), vencedoraAt: v.updatedAt || "", vencedorPor: v.updatedBy || "", perdedorPor: p.updatedBy || "", quando: nowIso });
  });
  const conflitos = CadernoSync.mesclarConflitos([remoto ? remoto.conflitos : [], ...copias.map((c) => c.doc.conflitos), confL.itens, novos], confRes, agora);
  const conhecidos = new Set(confL.itens.map((c) => c.id).concat(confL.resolvidos.map((c) => c.id)));
  const novosConf = conflitos.filter((c) => !conhecidos.has(c.id));
  novos.forEach((c) => hist.push({ id: "h" + c.id, tipo: "conflito", card: c.titulo, quem: c.perdedorPor, texto: tituloConflito(c).replace(/^⚠️ /, "") + " (" + c.titulo + "). Ficou a versão de " + (c.vencedorPor || "outra pessoa") + ", a mais recente; a de " + (c.perdedorPor || "outra pessoa") + " está guardada como cópia de conflito.", quando: c.quando, escopo: "Equipe" }));
  const sig = (l, f) => JSON.stringify((l || []).map(f).sort());
  const fl = (e) => e.id + "@" + e.excluidoEm + "@" + (e.card.updatedAt || ""), ft = (t) => t.id + "@" + t.em, fc = (c) => c.id;
  const precisa = !remoto || sig(remoto.lixeira, fl) !== sig(lixeira, fl) || sig(remoto.lixeiraRemovidos, ft) !== sig(lixRem, ft) || sig(remoto.conflitos, fc) !== sig(conflitos, fc) || sig(remoto.conflitosResolvidos, ft) !== sig(confRes, ft);
  return { lixeira: lixeira, lixRem: lixRem, conflitos: conflitos, confRes: confRes, novosConf: novosConf, hist: hist, precisa: precisa };
}
const CAMPOS_VER = [["titulo", "Título"], ["aplicacao", "Aplicação"], ["cliente", "Cliente / operação"], ["categoria", "Categoria"], ["url", "Link"], ["usuario", "Usuário"], ["senha", "Senha"], ["ciclo", "Ciclo (dias)"], ["ultima", "Última troca"], ["horario", "Horário"], ["escalonamentos", "Escalonamento"], ["obs", "Observações"], ["arquivado_em", "Arquivado em"]];
function valorVer(c, k) {
  if (k === "escalonamentos") return resumoEscalonamentos(niveisDe(c)) || c.escalonamento || "";
  if (k === "ultima" || k === "arquivado_em") return c[k] ? dataBR(c[k]) : "";
  return c[k] == null ? "" : String(c[k]);
}
function verConflito(id) {
  if (!podeAdminEquipe()) { toast("O Administrador vai resolver este conflito de edição."); return Promise.resolve(false); }
  const c = lerConflitos().itens.find((x) => x.id === id);
  if (!c) { toast("Esse conflito já foi resolvido"); return Promise.resolve(false); }
  const vivo = itens.find((x) => x.id === c.cardId);
  return janela("dlgVer", (box, fim) => {
    box.classList.add("dlg-conflito");
    box.appendChild(el("h3", "", tituloConflito(c)));
    if (!vivo) {
      box.appendChild(el("p", "meta", "O card " + c.titulo + " não existe mais (foi excluído). Você pode recuperar a outra versão pela Lixeira, se ainda estiver lá."));
      const bb = el("div", "dlg-botoes"); bb.appendChild(botaoDlg("pri", "Dispensar aviso", () => { resolverConflito(c, false); fim(true); })); bb.appendChild(botaoDlg("", "Fechar", () => fim(false))); box.appendChild(bb);
      return;
    }
    box.appendChild(el("p", "meta", "Card: " + nomeDe(vivo) + ". Ficou valendo a versão de " + (vivo.updatedBy || c.vencedorPor || "outra pessoa") + " (" + dataHoraBR(vivo.updatedAt) + "), a mais recente. A versão de " + (c.perdedorPor || "outra pessoa") + " (" + dataHoraBR(c.perdedora.updatedAt) + ") ficou guardada. Escolha qual fica."));
    const difs = CAMPOS_VER.filter(([k]) => valorVer(vivo, k) !== valorVer(c.perdedora, k));
    if (!difs.length) box.appendChild(el("p", "meta", "As duas versões têm o mesmo conteúdo."));
    else {
      const t = el("table", "conf-tab");
      const hr = el("tr"); ["Campo", "Esta (atual, de " + (vivo.updatedBy || "?") + ")", "A outra (de " + (c.perdedorPor || "?") + ")"].forEach((h) => hr.appendChild(el("th", "", h))); t.appendChild(hr);
      difs.forEach(([k, r]) => {
        const tr = el("tr");
        tr.appendChild(el("td", "conf-campo", r));
        const v1 = valorVer(vivo, k), v2 = valorVer(c.perdedora, k);
        // senhas nunca aparecem: só que são diferentes
        tr.appendChild(el("td", "", k === "senha" ? (v1 ? MASCARA + " (diferente)" : "—") : (v1 || "—")));
        tr.appendChild(el("td", "", k === "senha" ? (v2 ? MASCARA + " (diferente)" : "—") : (v2 || "—")));
        t.appendChild(tr);
      });
      const w = el("div", "conf-wrap"); w.appendChild(t); box.appendChild(w);
    }
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("pri", "Ficar com esta", () => { resolverConflito(c, false); fim(true); toast("Ficou a versão atual"); }));
    bb.appendChild(botaoDlg("", "Ficar com a outra", () => { resolverConflito(c, true); fim(true); toast("Ficou a outra versão"); }));
    bb.appendChild(botaoDlg("", "Fechar", () => fim(false)));
    box.appendChild(bb);
  });
}
function resolverConflito(c, outra) {
  const agora = new Date().toISOString(), quem = autor();
  const l = lerConflitos(); l.itens = l.itens.filter((x) => x.id !== c.id); l.resolvidos.push({ id: c.id, em: agora, por: quem }); gravarConflitos(l);
  const vivo = itens.find((x) => x.id === c.cardId);
  let ficou = vivo ? (vivo.updatedBy || c.vencedorPor || "outra pessoa") : "";
  if (outra && vivo) {
    Object.keys(c.perdedora).forEach((k) => { if (["id", "updatedAt", "updatedBy", "baseAt"].indexOf(k) < 0) vivo[k] = c.perdedora[k]; });
    ficou = c.perdedorPor || "outra pessoa";
  }
  addHist({ id: "hr" + c.id, tipo: "conflito-resolvido", card: c.titulo, texto: "Conflito em " + c.titulo + " resolvido por " + (quem || "analista") + (ficou ? ": ficou a versão de " + ficou : ""), escopo: "Equipe", quando: agora });
  if (outra && vivo) save(); else { render(); agendarSync(); }
}
