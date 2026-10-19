/* Caderno de Acessos — js/cards.js
 * Regras dos cards: nomeDe(), atual(), normTxt(), normUrl(), mesmoLink(), cards com o mesmo link, "um link = um card" na Equipe e painel de duplicados.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Excluir (só arquivados) com desfazer ---------- */
function nomeDe(it) { return it.titulo || it.aplicacao || "este acesso"; }
// v1.9.6: a sincronização em segundo plano troca os objetos dos cards da Equipe; sempre busca o card atual pelo id.
function atual(it) { return it ? (itens.find((x) => x.id === it.id) || null) : null; }
/* ---------- v2.0.0: painel de duplicados (cards da Equipe com o mesmo link) ---------- */
const DUP_DEC_KEY = "caderno-acessos-duplicados-decisoes"; // { [normUrl|ids ordenados]: "manter" } — muda o grupo, pergunta de novo
const dupAvisados = new Set();
function gruposDuplicados(todos) {
  const m = new Map();
  itens.filter((c) => compartilhado(c) && !c.arquivado_em).forEach((c) => { const u = normUrl(c.url); if (!u) return; if (!m.has(u)) m.set(u, []); m.get(u).push(c); });
  const dec = lerJSON(DUP_DEC_KEY, {});
  // v2.0.1 (item 5): grupo em que todos os clientes/operações são preenchidos e diferentes entre si (normTxt) não é duplicado:
  // é o mesmo portal atendendo operações diferentes (salvo pela exceção "outra operação" ou já existente assim).
  const outrasOperacoes = (l) => { const k = l.map((c) => normTxt(c.cliente)); return k.every(Boolean) && new Set(k).size === k.length; };
  return [...m.entries()].filter(([, l]) => l.length > 1 && !outrasOperacoes(l)).map(([u, l]) => ({ url: u, cards: l, chave: u + "|" + l.map((x) => x.id).sort().join(",") }))
    .filter((g) => todos || dec[g.chave] !== "manter");
}
function textoDuplicados(gs) { const n = gs.reduce((a, g) => a + g.cards.length, 0); return "⚠️ " + n + " cards da Equipe com o mesmo link"; }
function avisarDuplicadosNovos() {
  const gs = gruposDuplicados().filter((g) => !dupAvisados.has(g.chave));
  if (!gs.length) return false;
  gs.forEach((g) => dupAvisados.add(g.chave));
  toast(textoDuplicados(gruposDuplicados()), { texto: "Ver", ms: 9000, fn: () => painelDuplicados() });
  return true;
}
function painelDuplicados() {
  const gs = gruposDuplicados();
  if (!gs.length) { toast("Nenhum card da Equipe repetido"); return Promise.resolve(false); }
  return janela("dlgVer", (box, fim) => {
    box.classList.add("dlg-dup");
    box.appendChild(el("h3", "", textoDuplicados(gs)));
    box.appendChild(el("p", "meta", "Na Equipe vale “um link = um card”. Abra os cards, arquive o que sobra (vai para o Arquivo e, se quiser, depois para a Lixeira) ou mantenha os dois se forem mesmo diferentes."));
    gs.forEach((g) => {
      const sec = el("section", "dup-grupo"); sec.dataset.url = g.url;
      sec.appendChild(el("div", "dup-link", g.url));
      g.cards.forEach((c) => {
        const row = el("div", "dup-card"); row.dataset.id = c.id;
        const tx = el("div", "dup-tx"); tx.appendChild(el("b", "", nomeDe(c)));
        tx.appendChild(el("div", "hist2-sub", rotuloCliente(c) + (c.updatedBy ? " · atualizado por " + c.updatedBy : "") + (c.updatedAt ? " em " + dataHoraBR(c.updatedAt) : "")));
        row.appendChild(tx);
        const ac = el("div", "dup-acoes");
        ac.appendChild(botaoDlg("pequeno", "Abrir", () => { fim(true); const x = atual(c); if (x) abrirFicha(x); }));
        ac.appendChild(botaoDlg("pequeno", "Arquivar", () => { const x = atual(c); if (x) { x.arquivado_em = hoje(); save(); toast("Card arquivado"); } fim(true); if (gruposDuplicados().length) setTimeout(painelDuplicados, 60); }));
        row.appendChild(ac); sec.appendChild(row);
      });
      const bm = botaoDlg("pequeno", g.cards.length > 2 ? "Manter todos" : "Manter os dois", () => { const d = lerJSON(DUP_DEC_KEY, {}); d[g.chave] = "manter"; localStorage.setItem(DUP_DEC_KEY, JSON.stringify(d)); toast("Decisão guardada"); fim(true); render(); if (gruposDuplicados().length) setTimeout(painelDuplicados, 60); });
      bm.classList.add("dup-manter"); sec.appendChild(bm);
      box.appendChild(sec);
    });
    const bb = el("div", "dlg-botoes"); bb.appendChild(botaoDlg("pri", "Fechar", () => fim(false))); box.appendChild(bb);
  });
}
/* Faixa de avisos (conflitos e duplicados) no topo da Equipe e em Mais. */
function faixaAvisos(box) {
  const cs = lerConflitos().itens, gs = gruposDuplicados();
  if (!cs.length && !gs.length) return;
  const f = el("div", "faixa-avisos");
  if (cs.length) {
    const l = el("div", "faixa-it faixa-conflito");
    l.appendChild(el("span", "", cs.length === 1 ? tituloConflito(cs[0]) + ": " + cs[0].titulo : "⚠️ " + cs.length + " cards editados ao mesmo tempo por pessoas diferentes"));
    l.appendChild(botaoDlg("pequeno", "Ver as duas versões", () => verConflito(cs[0].id)));
    f.appendChild(l);
  }
  if (gs.length) {
    const l = el("div", "faixa-it faixa-dup");
    l.appendChild(el("span", "", textoDuplicados(gs)));
    l.appendChild(botaoDlg("pequeno", "Ver", () => painelDuplicados()));
    f.appendChild(l);
  }
  box.appendChild(f);
}
function blocoAvisos(box) {
  const cs = lerConflitos().itens, gs = gruposDuplicados();
  const c = el("article", "card painel-mais avisos-v2"); c.id = "blocoAvisos";
  c.appendChild(el("h3", "", "Conflitos de edição e cards repetidos"));
  if (!cs.length && !gs.length) { c.appendChild(el("p", "meta", "Nenhum conflito de edição nem card da Equipe com o mesmo link.")); box.appendChild(c); return; }
  if (cs.length) {
    const ul = el("ul", "lix-lista");
    cs.forEach((x) => { const li = el("li", "lix-it"); const tx = el("div", "lix-tx"); tx.appendChild(el("b", "", tituloConflito(x))); tx.appendChild(el("div", "hist2-sub", x.titulo + " · " + dataHoraBR(x.quando))); li.appendChild(tx); const ac = el("div", "lix-acoes"); ac.appendChild(botaoDlg("pequeno pri", "Ver as duas versões", () => verConflito(x.id))); li.appendChild(ac); ul.appendChild(li); });
    c.appendChild(ul);
  }
  if (gs.length) {
    c.appendChild(el("p", "meta", textoDuplicados(gs) + ":"));
    const ul = el("ul", "lix-lista");
    gs.forEach((g) => { const li = el("li", "lix-it"); const tx = el("div", "lix-tx"); tx.appendChild(el("b", "", g.url)); tx.appendChild(el("div", "hist2-sub", g.cards.map((x) => nomeDe(x) + " (" + rotuloCliente(x) + ")").join(" · "))); li.appendChild(tx); ul.appendChild(li); });
    c.appendChild(ul);
    const row = el("div", "acoes-mais"); row.appendChild(botaoDlg("pri", "Ver e resolver", () => painelDuplicados())); c.appendChild(row);
  }
  box.appendChild(c);
}
/* v1.9.9: reativar nunca trava; se o card da Equipe reativado repete link + cliente de outro card ativo, só avisa. */
function avisarDuplicadosReativados(lista) {
  const dups = lista.map((c) => atual(c) || c).filter((c) => compartilhado(c) && !c.arquivado_em).map((c) => ({ c: c, d: duplicadosEquipe(c) })).filter((x) => x.d.length);
  if (!dups.length) return;
  const x = dups[0];
  aviso("⚠️ Já existe um card da Equipe com esse link: " + nomeDe(x.d[0]) + " (" + rotuloCliente(x.d[0]) + ")", "O card " + nomeDe(x.c) + " foi reativado mesmo assim, mas tem o mesmo link de outro card ativo da Equipe (na Equipe vale “um link = um card”)." + (dups.length > 1 ? " Outros " + (dups.length - 1) + " card(s) reativado(s) também se repetem." : "") + " Em Mais › Conflitos de edição e cards repetidos você arquiva um deles ou mantém os dois.");
}
function normTxt(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
/* v2.0.0: normUrl conservador (ver CadernoSync.normUrl): só o host vai para minúsculas; caminho e query mantêm maiúsculas. */
function normUrl(u) { return window.CadernoSync ? CadernoSync.normUrl(u) : String(u || "").trim(); }
/* v1.9.8: aviso de duplicado SÓ quando o link é exatamente igual (depois de normUrl). Nome não conta; link vazio nunca é duplicado. */
function mesmoLink(a, b) { const u = normUrl(a); return !!u && u === normUrl(b); }
/* Cards ativos (não arquivados) com o mesmo link, separados em Meus (Individual) e Equipe. "ignorarId" evita comparar o card com ele mesmo. */
function cardsMesmoLink(url, ignorarId) {
  const r = { meus: [], equipe: [] };
  if (!normUrl(url)) return r;
  itens.forEach((c) => { if (c.id === ignorarId || c.arquivado_em || !mesmoLink(url, c.url)) return; (compartilhado(c) ? r.equipe : r.meus).push(c); });
  return r;
}
/* v1.9.9: cliente/operação comparado com normTxt (sem maiúsculas, acentos e espaços extras); vazio = vazio. */
function mesmoCliente(a, b) { return normTxt(a) === normTxt(b); }
function rotuloCliente(c) { return String((c && c.cliente) || "").trim() || "sem cliente"; }
/* v2.0.0: "um link = um card" na Equipe: outro card da Equipe ativo com o mesmo link (normUrl), qualquer título ou cliente. */
function duplicadosEquipe(o) {
  if (!normUrl(o.url)) return [];
  return itens.filter((c) => c.id !== o.id && compartilhado(c) && !c.arquivado_em && mesmoLink(c.url, o.url));
}
/* Retorna true (salvar), false (voltar e editar), "abrir" (abriu o card existente), "outra" (v2.0.1: salvar como outra operação)
 * ou "meus" (v2.0.1: salvar em Meus e sugerir à equipe). */
function rotuloClientes(l) { const n = l.map(rotuloCliente).filter((v, i, a) => a.indexOf(v) === i); return n.length > 1 ? n.slice(0, -1).join(", ") + " e " + n[n.length - 1] : n[0] || ""; }
