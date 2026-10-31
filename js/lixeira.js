/* Caderno de Acessos — js/lixeira.js
 * Excluir e Lixeira (30 dias): mover, restaurar, apagar de vez, bloco da Lixeira em Mais.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* v2.0.0: "Excluir" manda para a Lixeira (Mais › Lixeira) por 30 dias. Equipe: lixeira no arquivo da equipe (restaurável por
 * qualquer analista; o tombstone continua, para versões antigas não ressuscitarem o card). Meus: lixeira só deste aparelho, com login e senha. */
async function excluir(lista) {
  if (negarAnalista()) return false; // v3.0.1 (item 4)
  lista = lista.map(atual).filter((it) => it && it.arquivado_em);
  if (!lista.length) return false;
  if (bloqueadoEquipe(lista)) return false;
  const temEq = lista.some(compartilhado);
  const sim = await dialogo({
    titulo: lista.length === 1 ? "Mover " + nomeDe(lista[0]) + " para a Lixeira?" : "Mover " + lista.length + " acessos para a Lixeira?",
    texto: "Fica em Mais › Lixeira por " + DIAS_LIXEIRA + " dias e pode ser restaurado" + (temEq ? " (cards da Equipe: por qualquer analista, para todos)" : "") + ". Depois disso é apagado de vez.",
    ok: "Mover para a Lixeira", cancelar: "Cancelar", perigo: true
  });
  if (!sim) return false;
  const agora = new Date().toISOString(), quem = autor();
  const lixEq = lerLixeiraEq(), lixMeus = lerLixeiraMeus();
  const ids = [];
  lista.forEach((it) => {
    const i = itens.findIndex((x) => x.id === it.id); if (i < 0) return;
    const c = itens[i]; ids.push(c.id);
    if (compartilhado(c)) { paraLixeira.add(c.id); lixEq.itens = lixEq.itens.filter((e) => e.id !== c.id); lixEq.itens.unshift({ id: c.id, card: itemParaEquipe(c), excluidoEm: agora, excluidoPor: quem }); }
    else { paraLixeiraMeus.add(c.id); lixMeus.splice(0, lixMeus.length, ...lixMeus.filter((e) => e.id !== c.id)); lixMeus.unshift({ id: c.id, card: Object.assign({}, c), excluidoEm: agora, excluidoPor: quem }); }
    itens.splice(i, 1);
  });
  gravarLixeiraEq(lixEq); gravarLixeiraMeus(lixMeus);
  sairSelecao(false);
  save();
  toast(ids.length === 1 ? "Movido para a Lixeira" : ids.length + " movidos para a Lixeira", { texto: "Desfazer", ms: 6000, fn: () => { restaurarDaLixeira(ids); } });
  return true;
}
/* ---------- v2.0.0: Lixeira (30 dias) ---------- */
const LIX_EQ_KEY = "caderno-acessos-lixeira-equipe";   // { itens: [{ id, card, excluidoEm, excluidoPor }], removidos: [{ id, em, por }] } (cópia local da lixeira do arquivo)
const LIX_MEUS_KEY = "caderno-acessos-lixeira-meus";   // [{ id, card (completo, com login e senha), excluidoEm, excluidoPor }] — nunca sai do aparelho
const CONF_KEY = "caderno-acessos-conflitos";          // { itens: [cópias de conflito], resolvidos: [{ id, em, por }] }
const DIAS_LIXEIRA = 30;
const paraLixeiraMeus = new Set();
function lerLixeiraEq() {
  const o = lerJSON(LIX_EQ_KEY, {});
  if (!window.CadernoSync) return { itens: [], removidos: [] };
  const removidos = CadernoSync.mesclarRemocoes([CadernoSync.limparRemocoes(o.removidos)]);
  return { itens: CadernoSync.mesclarLixeira([CadernoSync.limparLixeira(o.itens)], removidos), removidos: removidos };
}
function gravarLixeiraEq(l) { Dados.gravarTexto(LIX_EQ_KEY, JSON.stringify({ itens: (l.itens || []).filter((e) => e && e.card && compartilhado(e.card)), removidos: l.removidos || [] })); }
function lerLixeiraMeus() {
  const lim = Date.now() - DIAS_LIXEIRA * 864e5;
  const l = lerJSON(LIX_MEUS_KEY, []);
  return (Array.isArray(l) ? l : []).filter((e) => e && e.id && e.card && typeof e.card === "object" && new Date(e.excluidoEm).getTime() >= lim);
}
function lixeiraMeusVisivel() { return lerLixeiraMeus().filter((e) => individualVisivel(e.card)); } // v2.5.2 (item 1)
function gravarLixeiraMeus(l) { Dados.gravarTexto(LIX_MEUS_KEY, JSON.stringify(l)); }
function restaurarDaLixeira(ids) {
  if (negarAnalista()) return; // v3.0.1 (item 4)
  const lixEq = lerLixeiraEq(); let lixMeus = lerLixeiraMeus();
  if (!podeAdminEquipe() && lixEq.itens.some((e) => ids.indexOf(e.id) >= 0)) { toast(DICA_ADMIN + " (Lixeira da Equipe)."); return false; }
  const agora = new Date().toISOString(), quem = autor();
  let n = 0;
  ids.forEach((id) => {
    const e = lixEq.itens.find((x) => x.id === id);
    if (e) {
      lixEq.itens = lixEq.itens.filter((x) => x.id !== id); lixEq.removidos.push({ id: id, em: agora, por: quem }); marcarAssinar("l:" + id);
      if (!itens.some((x) => x.id === id)) { const c = Object.assign({}, e.card); if (!c.arquivado_em) c.arquivado_em = hoje(); restaurando.add(id); itens.push(c); n++; }
      return;
    }
    const m = lixMeus.find((x) => x.id === id && individualVisivel(x.card));
    if (m) { lixMeus = lixMeus.filter((x) => x.id !== id); if (!itens.some((x) => x.id === id)) { restaurandoMeus.add(id); itens.push(Object.assign({}, m.card)); n++; } }
  });
  gravarLixeiraEq(lixEq); gravarLixeiraMeus(lixMeus);
  save();
  toast(n === 1 ? "Card restaurado (está no Arquivo)" : n + " cards restaurados (estão no Arquivo)");
  return n;
}
async function apagarDaLixeira(e, equipe) {
  if (negarAnalista()) return; // v3.0.1 (item 4)
  if (equipe && !podeAdminEquipe()) { toast(DICA_ADMIN + " (Lixeira da Equipe)."); return false; }
  const sim = await dialogo({ titulo: "Excluir agora da lixeira?", texto: "O card " + nomeDe(e.card) + " será apagado de vez" + (equipe ? ", para toda a equipe" : "") + ". Não dá para desfazer.", ok: "Excluir agora", cancelar: "Cancelar", perigo: true });
  if (!sim) return false;
  const agora = new Date().toISOString(), quem = autor();
  if (equipe) {
    const l = lerLixeiraEq(); l.itens = l.itens.filter((x) => x.id !== e.id); l.removidos.push({ id: e.id, em: agora, por: quem }); marcarAssinar("l:" + e.id); gravarLixeiraEq(l);
    addHist({ id: "la-" + e.id + "-" + agora, tipo: "lixeira-apagado", card: String(nomeDe(e.card)).slice(0, 200), escopo: "Equipe", quando: agora });
    agendarSync();
  } else {
    gravarLixeiraMeus(lerLixeiraMeus().filter((x) => x.id !== e.id));
    addHist({ id: "ila-" + e.id + "-" + agora, tipo: "lixeira-apagado", card: String(nomeDe(e.card)).slice(0, 200), escopo: "Meu", local: true, quando: agora });
  }
  render(); toast("Apagado de vez");
  return true;
}
function diasParaApagar(e) { return Math.max(0, Math.ceil((new Date(e.excluidoEm).getTime() + DIAS_LIXEIRA * 864e5 - Date.now()) / 864e5)); }
function blocoLixeira(box) {
  const eq = lerLixeiraEq().itens, meus = lixeiraMeusVisivel();
  const c = el("article", "card painel-mais lixeira"); c.id = "blocoLixeira";
  c.appendChild(el("h3", "", "🗑️ Lixeira" + (eq.length + meus.length ? " (" + (eq.length + meus.length) + ")" : "")));
  c.appendChild(el("p", "meta", (perfisAtivos() && papelAtual() !== "admin" ? "Cards excluídos ficam aqui por " + DIAS_LIXEIRA + " dias. Os seus (Meus) ficam só neste aparelho e voltam com usuário e senha." : "Cards excluídos ficam aqui por " + DIAS_LIXEIRA + " dias. Os da Equipe podem ser restaurados " + (perfisAtivos() ? "pelo Administrador" : "por qualquer analista") + " e voltam para o Arquivo de todos. Os Meus ficam só neste aparelho e voltam com usuário e senha.")));
  const todos = eq.map((e) => ({ e: e, equipe: true })).concat(meus.map((e) => ({ e: e, equipe: false }))).sort((a, b) => String(b.e.excluidoEm).localeCompare(String(a.e.excluidoEm)));
  if (!todos.length) c.appendChild(el("p", "meta vazio-lix", "A Lixeira está vazia."));
  else {
    const ul = el("ul", "lix-lista");
    todos.forEach(({ e, equipe }) => {
      const li = el("li", "lix-it"); li.dataset.id = e.id;
      const tx = el("div", "lix-tx");
      tx.appendChild(el("b", "", nomeDe(e.card)));
      tx.appendChild(el("span", "lix-tag " + (equipe ? "equipe" : "meu"), equipe ? "Equipe" : "Meu"));
      tx.appendChild(el("div", "hist2-sub", "Excluído" + (e.excluidoPor ? " por " + e.excluidoPor : "") + " em " + dataHoraBR(e.excluidoEm) + " · apaga sozinho em " + diasParaApagar(e) + " dia(s)"));
      li.appendChild(tx);
      const ac = el("div", "lix-acoes");
      if ((equipe && !podeAdminEquipe()) || analistaPuro()) ac.appendChild(el("small", "trava-dica", "🔒 " + DICA_ADMIN));
      else {
        ac.appendChild(btn("btn pequeno pri", "restore", "Restaurar", () => { restaurarDaLixeira([e.id]); }));
        ac.appendChild(btn("btn pequeno perigo", "trash", "Excluir agora da lixeira", () => apagarDaLixeira(e, equipe)));
      }
      li.appendChild(ac); ul.appendChild(li);
    });
    c.appendChild(ul);
  }
  box.appendChild(c);
}
