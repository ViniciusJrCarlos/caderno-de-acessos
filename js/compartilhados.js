/* Caderno de Acessos — js/compartilhados.js
 * Cards compartilhados (modelos sem login e senha): Compartilhar meu card, Só para…, adoção, Card parecido, tela Cards compartilhados.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- v1.9.4: "Compartilhar meu card" (modelos sem login/senha) ---------- */
// Cache local dos modelos da equipe: repõe o que um app antigo apague ao gravar o arquivo.
function modelosLocais() { const m = lerJSON(MODELOS_KEY, null); return { itens: (m && m.itens) || [], removidos: (m && m.removidos) || [] }; }
function gravarModelosLocais(m) { Dados.gravarTexto(MODELOS_KEY, JSON.stringify({ itens: m.itens, removidos: m.removidos })); }
function meusModelos() { return lerJSON(MEUS_MODELOS_KEY, []); }
function decisoesModelos() { return lerJSON(MODELOS_DEC_KEY, {}); }
function gravarDecisoes(d) { Dados.gravarTexto(MODELOS_DEC_KEY, JSON.stringify(d)); }
function modelosAtivos() { const m = modelosLocais(); const rem = new Set(m.removidos.map((t) => t.id)); return m.itens.filter((x) => !rem.has(x.id) || CadernoSync.ts(x.updatedAt) > CadernoSync.ts((m.removidos.find((t) => t.id === x.id) || {}).deletedAt)); }
/* Só nome, link, sistema, escalonamento e observações. Nunca login nem senha. */
function conteudoModelo(card) {
  return CadernoSync.limparModelo({ nome: card.titulo || card.aplicacao || "", url: card.url || "", sistema: card.aplicacao || "", escalonamento: card.escalonamento || "",
    escalonamentos: niveisDe(card).map((n) => ({ nivel: n.nivel, canal: n.canal, nome: n.nome, valor: n.valor, horario: n.horario, obs: n.obs })), obs: card.obs || "" });
}
function mesmoConteudo(a, b) { const k = ["nome", "url", "sistema", "escalonamento", "escalonamentos", "obs"]; return k.every((c) => JSON.stringify(a[c] == null ? "" : a[c]) === JSON.stringify(b[c] == null ? "" : b[c])); }
/* Chamada em carimbarMudancas(): o dono atualiza o modelo quando edita o card; card excluído vira tombstone. */
const MODELOS_BASE_KEY = "caderno-acessos-meus-modelos-base";
/* v2.0.1 (item 3): card de Meus com modeloDono cujo modelo ativo foi compartilhado por mim (mesmo nome, normTxt) volta para a
 * lista dos meus modelos (ex.: backup pessoal restaurado em outro navegador). Idempotente; não mexe no card (sem recarimbo).
 * Guarda a foto do conteúdo na adoção: o modelo só muda quando eu editar o card de verdade. */
function adotarModelosOrfaos() {
  if (!window.CadernoSync) return 0;
  const eu = normTxt(autor()); if (!eu) return 0;
  const meus = meusModelos(); const ativos = modelosAtivos(); const base = lerJSON(MODELOS_BASE_KEY, {});
  let n = 0;
  itens.forEach((c) => {
    if (!c.modeloDono || c.visibilidade !== "Individual" || meus.indexOf(c.modeloDono) >= 0) return;
    const m = ativos.find((x) => x.id === c.modeloDono);
    if (!m || normTxt(m.sharedBy) !== eu) return;
    meus.push(c.modeloDono); base[c.modeloDono] = conteudoModelo(c); n++;
  });
  if (n) { Dados.gravarTexto(MEUS_MODELOS_KEY, JSON.stringify(meus)); Dados.gravarTexto(MODELOS_BASE_KEY, JSON.stringify(base)); }
  return n;
}
/* v2.0.1 (item 4/6): uma versão antiga (v1.9.9/v2.0.0) apaga sugeridoPara e parecidoCom ao regravar o arquivo. Se o modelo é o
 * mesmo (mesmo updatedAt) e a cópia local tinha esses campos, eles voltam. Sem a cópia, o card fica para todos (seguro). */
function reporExtrasModelos(rm, remotoModelos) {
  const loc = new Map(modelosLocais().itens.map((x) => [x.id, x]));
  const rem = new Map(((remotoModelos && remotoModelos.itens) || []).map((x) => [x.id, x]));
  let precisa = false;
  rm.itens.forEach((it) => {
    const l = loc.get(it.id); if (!l || l.updatedAt !== it.updatedAt) return;
    ["sugeridoPara", "parecidoCom"].forEach((k) => { if (l[k] != null && it[k] == null) it[k] = l[k]; });
    const r = rem.get(it.id);
    if (r && ["sugeridoPara", "parecidoCom"].some((k) => it[k] != null && r[k] == null)) precisa = true;
  });
  return precisa;
}
function atualizarMeusModelos() {
  if (!window.CadernoSync) return false;
  adotarModelosOrfaos();
  const meus = meusModelos(); if (!meus.length) return false;
  const base = lerJSON(MODELOS_BASE_KEY, {}); let baseMudou = false;
  const m = modelosLocais(); const agora = new Date().toISOString(); const quem = autor();
  let mudou = false; const ficam = [];
  meus.forEach((tid) => {
    const card = itens.find((c) => c.modeloDono === tid);
    const i = m.itens.findIndex((x) => x.id === tid);
    if (!card || card.visibilidade !== "Individual") {
      if (i >= 0) { m.removidos = m.removidos.filter((t) => t.id !== tid); m.removidos.push({ id: tid, deletedAt: agora, deletedBy: quem, titulo: m.itens[i].nome || "" }); m.itens.splice(i, 1); mudou = true; }
      if (card) delete card.modeloDono;
      return;
    }
    ficam.push(tid);
    if (i < 0) return;
    const novo = conteudoModelo(card);
    if (base[tid]) { if (mesmoConteudo(novo, base[tid])) return; delete base[tid]; baseMudou = true; }
    if (!mesmoConteudo(novo, m.itens[i])) { m.itens[i] = Object.assign({}, m.itens[i], novo, { id: tid, updatedAt: agora, updatedBy: quem }); mudou = true; }
  });
  Dados.gravarTexto(MEUS_MODELOS_KEY, JSON.stringify(ficam));
  Object.keys(base).forEach((k) => { if (ficam.indexOf(k) < 0) { delete base[k]; baseMudou = true; } });
  if (baseMudou) Dados.gravarTexto(MODELOS_BASE_KEY, JSON.stringify(base));
  if (mudou) { gravarModelosLocais(m); modelosPendentesEnvio = true; }
  return mudou;
}
function parecidos(card, tidProprio) {
  const out = [];
  if (!normUrl(card.url)) return out;
  modelosAtivos().forEach((m) => { if (m.id === tidProprio) return; if (mesmoLink(card.url, m.url)) out.push({ tipo: "modelo", nome: m.nome, motivo: "Mesmo link", por: m.sharedBy, dados: m }); });
  itens.filter((c) => compartilhado(c) && !c.arquivado_em).forEach((c) => { if (mesmoLink(card.url, c.url)) out.push({ tipo: "equipe", nome: nomeDe(c), motivo: "Mesmo link", por: "", dados: Object.assign({ id: c.id }, conteudoModelo(c)) }); });
  return out;
}
function verModelo(d, origem) {
  return janela("dlgVer", (box, fim) => {
    box.appendChild(el("h3", "", d.nome || "(sem nome)"));
    box.appendChild(el("p", "meta", origem));
    const lin = (r, v) => { const x = el("div", "mod-linha"); x.appendChild(el("b", "", r)); x.appendChild(el("span", v ? "" : "vz", v || "—")); box.appendChild(x); };
    lin("Link", d.url); lin("Sistema", d.sistema);
    lin("Escalonamento", (d.escalonamentos && d.escalonamentos.length) ? resumoEscalonamentos(d.escalonamentos) : d.escalonamento);
    lin("Observações", d.obs);
    const bb = el("div", "dlg-botoes"); bb.appendChild(botaoDlg("pri", "Voltar", () => fim(true))); box.appendChild(bb);
  });
}
async function compartilharMeuCard(card) {
  if (!card || card.visibilidade !== "Individual") return;
  if (!podeAdminEquipe()) { toast("Só o Administrador compartilha cards com a equipe. Seus cards de Meus ficam só com você."); return; } // v2.3.0 (item 9)
  if (!syncEstado.vinculado) { toast("Para compartilhar, vincule a pasta da equipe em Mais › Arquivo da equipe."); return; }
  if (!autor()) { toast("Salve seu nome em Mais › Arquivo da equipe antes de compartilhar."); return; }
  const tid = card.modeloDono || ("m-" + card.id);
  const par = parecidos(card, tid);
  if (par.length) {
    const seguir = await janela("dlgMod", (box, fim) => {
      box.appendChild(el("h3", "", "⚠️ Já existe um card com esse link"));
      box.appendChild(el("p", "", par.length === 1 ? "Este link já está na equipe:" : "Este link já está na equipe em " + par.length + " cards:"));
      par.forEach((p) => {
        const it = el("div", "mod-item");
        const t = el("div", "mod-txt"); t.appendChild(el("strong", "", p.nome));
        t.appendChild(el("small", "", p.motivo + (p.dados.url ? ": " + p.dados.url : "") + " · " + (p.tipo === "modelo" ? "compartilhado por " + (p.por || "alguém da equipe") : "card da Equipe")));
        it.appendChild(t);
        it.appendChild(botaoDlg("pequeno", "Ver modelo", () => verModelo(p.dados, p.tipo === "modelo" ? "Compartilhado por " + (p.por || "alguém da equipe") : "Card da Equipe")));
        box.appendChild(it);
      });
      const bb = el("div", "dlg-botoes");
      bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
      bb.appendChild(botaoDlg("pri", "Compartilhar mesmo assim", () => fim(true)));
      box.appendChild(bb);
      box.appendChild(el("p", "mod-nota", "Nada é bloqueado: você decide. Aviso só quando o link é exatamente igual."));
    });
    if (!seguir) return;
  }
  const ok = await janela("dlgMod", (box, fim) => {
    box.appendChild(el("h3", "", "Compartilhar meu card?"));
    const a = el("p", "mod-ok"); a.appendChild(el("b", "", "✅ Vai para a equipe: ")); a.appendChild(document.createTextNode("nome, link, sistema, escalonamento e observações.")); box.appendChild(a);
    const b = el("p", "mod-no"); b.appendChild(el("b", "", "🔒 Não vai: ")); b.appendChild(document.createTextNode("login e senha.")); box.appendChild(b);
    // v2.0.1 (item 4): "Para" — Todos (padrão) ou Só para… (sugestão: só muda quem recebe o aviso de card novo).
    const fs = el("fieldset", "mod-para"); fs.appendChild(el("legend", "", "Para"));
    const radio = (v, t, on) => { const l = el("label", "mod-radio"); const r = el("input"); r.type = "radio"; r.name = "modPara"; r.value = v; r.checked = on; r.id = "modPara" + v; l.appendChild(r); l.appendChild(document.createTextNode(" " + t)); fs.appendChild(l); return r; };
    const rTodos = radio("Todos", "Todos", true); const rSo = radio("So", "Só para…", false);
    const lista = el("div", "mod-para-lista"); lista.id = "modParaLista"; lista.hidden = true;
    const marcados = new Map();
    const addNome = (n, on) => {
      const k = normTxt(n); if (!k || k === normTxt(autor()) || marcados.has(k)) { if (marcados.has(k) && on) marcados.get(k).checked = true; return; }
      const l = el("label", "mod-chk mod-para-nome"); const cb = el("input"); cb.type = "checkbox"; cb.checked = !!on; cb.value = String(n).trim();
      l.appendChild(cb); l.appendChild(document.createTextNode(" " + String(n).trim())); lista.insertBefore(l, novoBox); marcados.set(k, cb);
    };
    const novoBox = el("div", "mod-para-novo");
    const inpNome = el("input"); inpNome.type = "text"; inpNome.id = "modParaNome"; inpNome.maxLength = 120; inpNome.placeholder = "Outro nome"; inpNome.setAttribute("aria-label", "Outro nome");
    const bAdd = botaoDlg("pequeno", "Adicionar", () => { if (inpNome.value.trim()) { addNome(inpNome.value, true); inpNome.value = ""; inpNome.focus(); } });
    bAdd.id = "modParaAdd";
    inpNome.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); bAdd.click(); } });
    novoBox.appendChild(inpNome); novoBox.appendChild(bAdd); lista.appendChild(novoBox);
    nomesAnalistas().forEach((n) => addNome(n, false));
    fs.appendChild(lista);
    fs.appendChild(el("p", "mod-nota", "O aviso de card novo só aparece para quem você marcar. O card continua disponível para toda a equipe em Mais › Cards compartilhados."));
    // v2.3.0 (item 11): onde o card chega
    box.appendChild(el("p", "mod-nota mod-chegada", "📥 Quem recebe vê o card em Mais › Cards compartilhados (depois de sincronizar) e escolhe “Adicionar selecionados” para levá-lo a Meus, onde preenche o próprio login e senha."));
    const troca = () => { lista.hidden = !rSo.checked; };
    rTodos.addEventListener("change", troca); rSo.addEventListener("change", troca);
    box.appendChild(fs);
    const er = el("p", "erro-form"); er.id = "modParaErro"; box.appendChild(er);
    fs.addEventListener("change", () => { er.textContent = ""; }); // v2.5.0: some a mensagem velha ao marcar alguém ou escolher Todos
    if (inpNome) inpNome.addEventListener("input", () => { er.textContent = ""; });
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    bb.appendChild(botaoDlg("pri", "Compartilhar", () => {
      if (!rSo.checked) { fim({ para: [] }); return; }
      if (inpNome.value.trim()) addNome(inpNome.value, true);
      const para = [...marcados.values()].filter((cb) => cb.checked).map((cb) => cb.value);
      if (!para.length) { er.textContent = "Marque ao menos um analista ou escolha Todos."; return; }
      fim({ para: para });
    }));
    box.appendChild(bb);
  });
  if (!ok) return;
  await compartilharModelo(card, { para: ok.para, parecidoCom: "" });
  toast((ok.para.length ? "Card compartilhado, sugerido para " + ok.para.join(", ") : "Card compartilhado com a equipe") + ". Chega em Mais › Cards compartilhados de quem recebe (sem login e senha).");
}
/* v2.0.1: grava o modelo (sem login e senha) e marca o card como meu modelo. para = [] → Todos. */
async function compartilharModelo(card, op) {
  op = op || {};
  const tid = card.modeloDono || ("m-" + card.id);
  const agora = new Date().toISOString();
  const m = modelosLocais();
  const antigo = m.itens.find((x) => x.id === tid);
  const novo = Object.assign({ id: tid, sharedBy: autor(), createdAt: (antigo && antigo.createdAt) || agora }, conteudoModelo(card), { updatedAt: agora, updatedBy: autor() });
  if (op.para && op.para.length) novo.sugeridoPara = op.para.slice(0, 20);
  if (op.parecidoCom) novo.parecidoCom = op.parecidoCom;
  m.itens = m.itens.filter((x) => x.id !== tid).concat([CadernoSync.limparModelo(novo)]);
  m.removidos = m.removidos.filter((t) => t.id !== tid);
  gravarModelosLocais(m);
  if (op.semMarcar) { save(); if (!op.semSync) await sincronizar(true); return; } // v3.0.0: envio de card da Equipe/arquivado não vira "meu modelo"
  const meus = meusModelos(); if (meus.indexOf(tid) < 0) meus.push(tid); Dados.gravarTexto(MEUS_MODELOS_KEY, JSON.stringify(meus));
  const base = lerJSON(MODELOS_BASE_KEY, {}); if (base[tid]) { delete base[tid]; Dados.gravarTexto(MODELOS_BASE_KEY, JSON.stringify(base)); }
  (atual(card) || card).modeloDono = tid;
  save();
  if (!op.semSync) await sincronizar(true);
}
/* v3.0.0 (item 2): só o Administrador. Escolhe cards (Meus, Equipe e Arquivados) e envia para um ou mais analistas. Vai como
 * card compartilhado (sem login e senha), o mesmo formato de sempre: quem recebe vê em Mais › Cards compartilhados e leva para Meus. */
async function selecionarEEnviar() {
  if (!podeAdminEquipe()) { toast(DICA_ADMIN); return; }
  const cards = itens.filter((it) => it && it.id !== "s12");
  const pessoas = lerPerfis().filter((p) => p.ativo && !p.excluido && p.papel !== "admin");
  if (!cards.length) { toast("Nenhum card para enviar"); return; }
  if (!pessoas.length) { toast("Nenhum analista cadastrado"); return; }
  const ok = await janela("dlgMod", (box, fim) => {
    box.dataset.dlg = "selecionar-enviar";
    dlgPadrao(box, "Selecionar e enviar", "Marque os cards e para quem enviar. Vai nome, link, sistema, escalonamento e observações; login e senha não vão.");
    const grupo = (tit, lista) => {
      if (!lista.length) return [];
      const fs = el("fieldset", "mod-para"); fs.appendChild(el("legend", "", tit + " (" + lista.length + ")"));
      const cbs = lista.map((it) => { const l = el("label", "mod-chk"); const cb = el("input"); cb.type = "checkbox"; cb.value = it.id; cb.dataset.envCard = "1"; l.appendChild(cb); l.appendChild(document.createTextNode(" " + (it.aplicacao || it.titulo || "(sem nome)") + (it.cliente ? " · " + it.cliente : ""))); fs.appendChild(l); return cb; });
      box.appendChild(fs); return cbs;
    };
    const cbCards = [].concat(
      grupo("Meus", cards.filter((it) => !compartilhado(it) && !it.arquivado_em)),
      grupo("Equipe", cards.filter((it) => compartilhado(it) && !it.arquivado_em)),
      grupo("Arquivados", cards.filter((it) => !!it.arquivado_em)));
    const fp = el("fieldset", "mod-para"); fp.appendChild(el("legend", "", "Para"));
    const cbP = pessoas.map((p) => { const l = el("label", "mod-chk"); const cb = el("input"); cb.type = "checkbox"; cb.value = p.nome; cb.dataset.envPara = "1"; l.appendChild(cb); l.appendChild(document.createTextNode(" " + p.nome + (p.matricula ? " · " + p.matricula : ""))); fp.appendChild(l); return cb; });
    box.appendChild(fp);
    const er = erroPadrao(box);
    botoesPadrao(box, "Cancelar", "Enviar", () => fim(false), () => {
      const ids = cbCards.filter((c) => c.checked).map((c) => c.value), para = cbP.filter((c) => c.checked).map((c) => c.value);
      if (!ids.length) { er.textContent = "Marque ao menos um card."; return; }
      if (!para.length) { er.textContent = "Marque ao menos um analista."; return; }
      fim({ ids: ids, para: para });
    });
  });
  if (!ok) return;
  let n = 0;
  for (const id of ok.ids) { const c = itens.find((x) => x.id === id); if (c) { await compartilharModelo(c, { para: ok.para, semSync: true, semMarcar: compartilhado(c) || !!c.arquivado_em }); n++; } }
  addHist({ id: "se-" + Date.now().toString(36), tipo: "texto", card: "", escopo: "Equipe", texto: "Administrador enviou " + n + (n === 1 ? " card" : " cards") + " para " + ok.para.join(", ") });
  await sincronizar(true);
  toast((n === 1 ? "1 card enviado" : n + " cards enviados") + " para " + ok.para.join(", ") + ". Chega em Mais › Cards compartilhados de quem recebe.");
}
/* v2.0.1 (item 4): analistas que já apareceram no arquivo da equipe (Histórico, quem atualizou, quem compartilhou, Lixeira).
 * Sem repetir (normTxt) e sem o analista atual. */
function nomesAnalistas() {
  const eu = normTxt(autor()); const vistos = new Map();
  const pega = (n) => { if (typeof n !== "string") return; const t = n.trim().slice(0, 120); const k = normTxt(t); if (k && k !== eu && !vistos.has(k)) vistos.set(k, t); };
  lerHist().filter((e) => e.escopo === "Equipe").forEach((e) => pega(e.quem));
  itens.filter(compartilhado).forEach((c) => { pega(c.updatedBy); });
  modelosAtivos().forEach((m) => { pega(m.sharedBy); pega(m.updatedBy); (m.sugeridoPara || []).forEach(pega); });
  try { lerLixeiraEq().itens.forEach((x) => { pega(x.excluidoPor); pega(x.card && x.card.updatedBy); }); } catch (e) { /* sem lixeira */ }
  try { lerPerfis().filter((p) => p.ativo).forEach((p) => pega(p.nome)); } catch (e) { /* sem perfis */ } // v2.3.0 (item 10): todos os perfis ativos
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
/* v2.0.1 (item 4): o aviso de card novo só aparece para os sugeridos (lista vazia = todos). O dono nunca recebe o próprio card. */
function paraMim(m) {
  const eu = normTxt(autor());
  if (eu && normTxt(m.sharedBy) === eu) return false;
  const l = Array.isArray(m.sugeridoPara) ? m.sugeridoPara : [];
  return !l.length || (!!eu && l.some((n) => normTxt(n) === eu));
}
async function pararCompartilhar(card) {
  const ok = await dialogo({ titulo: "Parar de compartilhar?", texto: "O modelo sai do arquivo da equipe. Quem já adicionou continua com o card dele.", ok: "Parar de compartilhar", cancelar: "Cancelar" });
  if (!ok) return;
  card = atual(card) || card;
  adotarModelosOrfaos(); // v2.0.1: o card restaurado de backup também sai do arquivo
  delete card.modeloDono; // atualizarMeusModelos() cria o tombstone
  save();
  toast("Card não é mais compartilhado");
}
function cardDoModelo(mod) { return itens.find((c) => c.modeloId === mod.id); }
/* Modelos que ainda não decidi (nem adicionei, nem ignorei) e que não são meus. */
function modelosNovos(incluirIgnorados) {
  const meus = new Set(meusModelos()), dec = decisoesModelos();
  // v1.9.9: o ignorado cujo link já está num card ativo de Meus some de vez (volta só se o card de Meus deixar de existir/ficar ativo).
  return modelosAtivos().filter((m) => !meus.has(m.id) && !cardDoModelo(m) && !itens.some((c) => c.modeloDono === m.id) && (!dec[m.id] || (incluirIgnorados && dec[m.id].acao === "ignorado" && !jaTenhoEmMeus(m))));
}
/* v1.9.9: card Individual ativo com o mesmo link (normUrl) do modelo. Link vazio nunca conta. */
function meuCardMesmoLink(m) { return selosModelo(m).meus[0] || null; }
function jaTenhoEmMeus(m) { return !!meuCardMesmoLink(m); }
function modelosComAtualizacao() {
  const dec = decisoesModelos();
  return modelosAtivos().map((m) => ({ m: m, c: cardDoModelo(m) })).filter((x) => x.c && CadernoSync.ts(x.m.updatedAt) > CadernoSync.ts(x.c.modeloVersao) &&
    (!dec[x.m.id] || dec[x.m.id].atualizacaoIgnorada !== x.m.updatedAt) &&
    (x.c.url || "") + JSON.stringify(niveisDe(x.c)) + (x.c.escalonamento || "") + (x.c.obs || "") !== (x.m.url || "") + JSON.stringify((x.m.escalonamentos || []).map(limparNivelEsc).filter(Boolean)) + (x.m.escalonamento || "") + (x.m.obs || ""));
}
function adicionarModelos(lista) {
  // v1.9.9: trava final. Modelo cujo link já está num card ativo de Meus nunca é adicionado, venha de onde vier.
  const bloqueados = [];
  lista = lista.filter((m) => { const c = meuCardMesmoLink(m); if (c) { bloqueados.push(c); return false; } return true; });
  if (bloqueados.length) aviso("Você já tem esse card em Meus: " + nomeDe(bloqueados[0]), (bloqueados.length > 1 ? "E mais " + (bloqueados.length - 1) + ". " : "") + "Ele não foi adicionado de novo.");
  lista.forEach((m) => {
    itens.push({ id: Math.random().toString(16).slice(2, 10), titulo: m.nome || m.sistema || "", aplicacao: m.sistema || m.nome || "", cliente: "", categoria: "Interno", visibilidade: "Individual",
      url: m.url || "", usuario: "", senha: "", ciclo: "90", ultima: hoje(), horario: "", escalonamento: m.escalonamento || "",
      escalonamentos: (m.escalonamentos || []).map((n) => Object.assign({}, n)), obs: m.obs || "", modeloId: m.id, modeloVersao: m.updatedAt || "", modeloPor: m.sharedBy || "" });
  });
  return lista;
}
let modelosAberto = false;
/* v1.9.8: o botão em Mais sempre abre a tela "Cards compartilhados"; depois da sincronização ela abre sozinha só se chegou card novo. */
async function verificarModelos(manual) {
  if (!window.CadernoSync || modelosAberto || document.body.classList.contains("travado") || trocaObrigatoria) return;
  if (!manual && document.querySelector(".sheet.on")) return;
  modelosAberto = true;
  try {
    if (manual || modelosNovos(false).some(paraMim)) { if ((await telaCompartilhados(!!manual)) === "abriu") return; }
    const atu = modelosComAtualizacao();
    if (atu.length) await atualizarModelosRecebidos(atu);
  } finally { modelosAberto = false; }
}
function listaMarcavel(box, lista, sub) {
  const marc = new Map();
  lista.forEach((x) => {
    const lab = el("label", "mod-item mod-chk");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = true; marc.set(x, cb);
    lab.appendChild(cb);
    const t = el("span", "mod-txt"); t.appendChild(el("strong", "", x.nome || (x.m && x.m.nome) || "")); t.appendChild(el("small", "", sub(x)));
    lab.appendChild(t); box.appendChild(lab);
  });
  return marc;
}
/* ---------- v1.9.8: tela "Cards compartilhados" (busca, selos de link igual, abas) ---------- */
// Normaliza texto guardando, para cada caractere do resultado, a posição no texto original (para destacar o trecho achado).
function normComMapa(s) {
  s = String(s || ""); let t = ""; const mapa = [];
  for (let i = 0; i < s.length; i++) { const n = s[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); for (let j = 0; j < n.length; j++) { t += n[j]; mapa.push(i); } }
  return { t: t, mapa: mapa };
}
function trechoAchado(texto, q) {
  if (!q) return null; const m = normComMapa(texto); const k = m.t.indexOf(q);
  if (k < 0) return null; return [m.mapa[k], m.mapa[k + q.length - 1] + 1];
}
function textoDestacado(texto, q) {
  const f = document.createDocumentFragment(); texto = String(texto || ""); const r = trechoAchado(texto, q);
  if (!r) { f.appendChild(document.createTextNode(texto)); return f; }
  f.appendChild(document.createTextNode(texto.slice(0, r[0]))); f.appendChild(el("mark", "rc-mk", texto.slice(r[0], r[1]))); f.appendChild(document.createTextNode(texto.slice(r[1])));
  return f;
}
// Procura nos cards locais ativos (Meus e Equipe) por nome, título, aplicação ou link. Nunca usa login nem senha.
function buscarCardsLocais(consulta) {
  const q = normTxt(consulta), qu = normUrl(consulta), r = { meus: [], equipe: [] };
  if (!q) return r;
  itens.forEach((c) => {
    if (c.arquivado_em) return;
    const campos = [c.titulo, c.aplicacao, c.url];
    const achou = campos.some((v) => normTxt(v).indexOf(q) >= 0) || (qu && normUrl(c.url).indexOf(qu) >= 0);
    if (achou) (compartilhado(c) ? r.equipe : r.meus).push(c);
  });
  return r;
}
function selosModelo(m) {
  const r = cardsMesmoLink(m.url, null);
  r.meus = r.meus.filter((c) => c.modeloId !== m.id);
  return r;
}
function nomesLista(l) { return nomeDe(l[0]) + (l.length > 1 ? " (+" + (l.length - 1) + ")" : ""); }
function telaCompartilhados(manual) {
  const dec = decisoesModelos();
  const novos = modelosNovos(true);
  const meus = new Set(meusModelos());
  const info = new Map(); const marc = new Map();
  novos.forEach((m) => {
    const s = selosModelo(m);
    const ignoradoAntes = !!(dec[m.id] && dec[m.id].acao === "ignorado");
    info.set(m, s);
    marc.set(m, !s.meus.length && !s.equipe.length && !m.parecidoCom && (manual || (!ignoradoAntes && paraMim(m))));
    // s.meus.length > 0: checkbox desabilitada (v1.9.9)
  });
  const verCard = (c, origem) => verModelo(conteudoModelo(c), origem + " · login e senha não aparecem aqui");
  return janela("dlgMod", (box, fim) => {
    box.classList.add("mod-receber", "rc");
    box.appendChild(el("h3", "", "📥 Cards compartilhados"));
    box.appendChild(el("p", "meta rc-sub", "Login e senha vêm em branco: você preenche os seus."));
    // Busca
    const lab = el("label", "rc-busca");
    lab.appendChild(el("span", "rc-busca-ph", "🔎 Procurar nos meus cards e nos da Equipe (nome ou link)"));
    const inp = el("input"); inp.type = "search"; inp.id = "rcBusca"; inp.autocomplete = "off"; inp.spellcheck = false; inp.setAttribute("aria-label", "Procurar nos meus cards e nos da Equipe (nome ou link)");
    lab.appendChild(inp); box.appendChild(lab);
    const res = el("div", "rc-res"); res.id = "rcRes"; res.hidden = true; box.appendChild(res);
    const MAX = 5;
    const grupo = (rotulo, lista, q, ehMeu) => {
      const g = el("div", "rc-res-g"); g.appendChild(el("b", "", rotulo + ": "));
      if (!lista.length) { g.appendChild(el("span", "rc-nada", "nenhum")); return g; }
      lista.slice(0, MAX).forEach((c) => {
        const it = el("div", "rc-res-it");
        it.appendChild(textoDestacado(nomeDe(c), q));
        if (c.url) { it.appendChild(document.createTextNode(" · ")); const u = el("span", "rc-res-url"); u.appendChild(textoDestacado(c.url, q)); it.appendChild(u); }
        g.appendChild(it);
      });
      if (lista.length > MAX) g.appendChild(el("div", "rc-mais", "+ " + (lista.length - MAX) + " outro(s). Refine a busca."));
      return g;
    };
    const buscar = () => {
      const q = normTxt(inp.value); res.textContent = "";
      if (!q) { res.hidden = true; return; }
      const r = buscarCardsLocais(inp.value);
      res.appendChild(grupo("Meus", r.meus, q, true)); res.appendChild(grupo("Equipe", r.equipe, q, false));
      res.hidden = false;
    };
    inp.addEventListener("input", buscar);
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ev.preventDefault(); });
    // Abas
    const abasEl = el("div", "rc-abas"); abasEl.setAttribute("role", "tablist"); box.appendChild(abasEl);
    const corpo = el("div", "rc-corpo"); box.appendChild(corpo);
    let abaAtual = "add";
    const jaAdicionados = () => modelosAtivos().filter((m) => !meus.has(m.id) && cardDoModelo(m) && !itens.some((c) => c.modeloDono === m.id));
    const queCompartilhei = () => { const at = new Set(modelosAtivos().map((m) => m.id)); return meusModelos().map((tid) => ({ tid: tid, card: itens.find((c) => c.modeloDono === tid), m: modelosAtivos().find((x) => x.id === tid) })).filter((x) => x.card && at.has(x.tid)); };
    const vazio = (t) => corpo.appendChild(el("p", "rc-vazio", t));
    const desenharAdd = () => {
      if (!novos.length) { vazio("Nada novo para adicionar. Quando alguém da equipe compartilhar um card, ele aparece aqui."); return; }
      novos.forEach((m) => {
        const s = info.get(m);
        const item = el("div", "mod-item mod-chk rc-item");
        const cb = el("input"); cb.type = "checkbox"; cb.checked = marc.get(m); cb.id = "rc-" + m.id; cb.setAttribute("aria-label", "Selecionar " + (m.nome || ""));
        if (s.meus.length) { cb.checked = false; cb.disabled = true; marc.set(m, false); item.classList.add("rc-travado"); cb.title = "Você já tem esse card em Meus"; }
        cb.addEventListener("change", () => { marc.set(m, cb.checked && !cb.disabled); conta(); });
        item.appendChild(cb);
        const t = el("div", "mod-txt");
        const l1 = el("label", "rc-l1"); l1.htmlFor = cb.id; l1.appendChild(el("span", "rc-nm", m.nome || m.sistema || "(sem nome)")); l1.appendChild(el("span", "rc-por", " · por " + (m.sharedBy || "alguém da equipe")));
        t.appendChild(l1);
        t.appendChild(el("div", "rc-lk", m.url || "sem link"));
        // v2.0.1 (item 6): card parecido com um card da Equipe (mesmo link); (item 4): para quem foi sugerido.
        if (m.parecidoCom) t.appendChild(el("div", "rc-selo s-ylw rc-parecido", "⚠️ Card parecido: mesmo link de " + m.parecidoCom));
        if (m.sugeridoPara && m.sugeridoPara.length) t.appendChild(el("div", "rc-selo s-inf rc-sugerido", "Sugerido para " + m.sugeridoPara.join(", ")));
        if (!s.meus.length && !s.equipe.length && !m.parecidoCom) t.appendChild(el("div", "rc-selo s-ok", "🟢 Novo: você não tem nada parecido"));
        if (s.meus.length) { const d = el("div", "rc-selo s-ylw"); d.appendChild(el("span", "", "🟡 Você já tem esse card em Meus: " + nomesLista(s.meus))); d.appendChild(botaoDlg("pequeno", "Abrir meu card", () => fim({ abrir: s.meus[0] }))); t.appendChild(d); }
        if (s.equipe.length) { const d = el("div", "rc-selo s-inf"); d.appendChild(el("span", "", "🔵 Já é card da Equipe: " + nomesLista(s.equipe))); d.appendChild(botaoDlg("pequeno", "Ver card da Equipe", () => verCard(s.equipe[0], "Card da Equipe"))); t.appendChild(d); }
        item.appendChild(t); corpo.appendChild(item);
      });
    };
    const desenharJa = () => {
      const l = jaAdicionados();
      if (!l.length) { vazio("Nenhum card compartilhado adicionado ainda."); return; }
      l.forEach((m) => {
        const c = cardDoModelo(m); const ln = el("div", "rc-ln");
        const d = el("div", ""); d.appendChild(document.createTextNode(m.nome || "")); d.appendChild(el("small", "", " (por " + (m.sharedBy || "alguém da equipe") + ")"));
        ln.appendChild(d); ln.appendChild(el("small", "", c && compartilhado(c) ? "já está na Equipe" : (c && c.arquivado_em ? "arquivado em Meus" : "já está em Meus")));
        corpo.appendChild(ln);
      });
    };
    const desenharMeus = () => {
      const l = queCompartilhei();
      if (!l.length) { vazio("Você ainda não compartilhou nenhum card. Use “Compartilhar meu card” num card de Meus."); return; }
      l.forEach((x) => {
        const ln = el("div", "rc-ln"); ln.appendChild(el("div", "", nomeDe(x.card)));
        ln.appendChild(botaoDlg("pequeno", "Parar de compartilhar", async () => { await pararCompartilhar(x.card); desenhar(); }));
        corpo.appendChild(ln);
      });
    };
    const desenhar = () => {
      const abas = [["add", "Para adicionar (" + novos.length + ")"], ["ja", "Já adicionados (" + jaAdicionados().length + ")"], ["meus", "Que eu compartilhei (" + queCompartilhei().length + ")"]];
      abasEl.textContent = "";
      abas.forEach(([k, txt]) => { const b = el("button", "rc-aba" + (k === abaAtual ? " on" : ""), txt); b.type = "button"; b.dataset.rcAba = k; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", k === abaAtual ? "true" : "false"); b.addEventListener("click", () => { abaAtual = k; desenhar(); }); abasEl.appendChild(b); });
      corpo.textContent = "";
      if (abaAtual === "add") desenharAdd(); else if (abaAtual === "ja") desenharJa(); else desenharMeus();
      aplicarIcones(corpo);
    };
    // Rodapé
    const bb = el("div", "rc-rod");
    const bSel = botaoDlg("pri", "", () => fim({ add: novos.filter((m) => marc.get(m)) }));
    bSel.id = "rcAdicionar";
    const bIgn = botaoDlg("", "Ignorar", () => fim({ add: [] })); bIgn.id = "rcIgnorar";
    const bFec = botaoDlg("", "Fechar", () => fim(false)); bFec.id = "rcFechar";
    function conta() { const n = novos.filter((m) => marc.get(m)).length; bSel.textContent = "Adicionar selecionados (" + n + ")"; bSel.disabled = !n; bIgn.disabled = !novos.length; }
    bb.appendChild(bSel); bb.appendChild(bIgn); bb.appendChild(bFec);
    desenhar(); conta();
    box.appendChild(bb);
    box.appendChild(el("p", "rc-nota", "Card com o mesmo link de um card seu em Meus não entra de novo. Os demais avisos não bloqueiam: você decide. (Na Equipe vale “um link = um card”.)"));
  }).then((r) => {
    if (!r) return; // fechou sem decidir: pergunta de novo na próxima vez
    if (r.abrir) { const c = atual(r.abrir); if (c) abrirFicha(c); return "abriu"; } // "Abrir meu card": fecha sem decidir e abre a ficha normal
    const d = decisoesModelos(); const agora = new Date().toISOString();
    // v1.9.9: modelo com o link em Meus nunca é adicionado; vira ignorado (e some de vez da lista enquanto o card de Meus existir).
    const descartados = novos.filter((m) => jaTenhoEmMeus(m));
    novos.forEach((m) => {
      const acao = r.add.indexOf(m) >= 0 && descartados.indexOf(m) < 0 ? "adicionado" : "ignorado";
      if (acao === "ignorado" && !(d[m.id] && d[m.id].acao === "ignorado")) addHist({ tipo: "ignorado", card: String(m.nome || m.sistema || "").slice(0, 200), escopo: "Meu", local: true });
      d[m.id] = { acao: acao, em: agora };
    });
    gravarDecisoes(d);
    if (r.add.length) { r.add = adicionarModelos(r.add); save(); toast(r.add.length + (r.add.length === 1 ? " card adicionado em Meus. Preencha seu login e senha." : " cards adicionados em Meus. Preencha seu login e senha.")); }
    else toast(descartados.length && descartados.length === novos.length ? "Cards compartilhados descartados: você já tem esses links em Meus." : "Cards compartilhados ignorados. Você pode vê-los de novo em Mais." + (descartados.length ? " Os que você já tem em Meus foram descartados." : ""));
  });
}
async function atualizarModelosRecebidos(lista) {
  const dec = decisoesModelos();
  const r = await janela("dlgMod", (box, fim) => {
    box.appendChild(el("h3", "", lista.length === 1 ? "1 card compartilhado foi atualizado" : lista.length + " cards compartilhados foram atualizados"));
    box.appendChild(el("p", "meta", "Atualiza link, escalonamento e observações. Seu login e sua senha continuam como estão."));
    const marc = listaMarcavel(box, lista, (x) => "por " + (x.m.updatedBy || x.m.sharedBy || "alguém da equipe") + " · " + dataHoraBR(x.m.updatedAt));
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Agora não", () => fim({ sel: [] })));
    bb.appendChild(botaoDlg("pri", "Atualizar selecionados", () => fim({ sel: lista.filter((x) => marc.get(x).checked) })));
    box.appendChild(bb);
  });
  if (!r) return;
  lista.forEach((x) => {
    if (r.sel.indexOf(x) >= 0) {
      Object.assign(x.c, { url: x.m.url || "", escalonamento: x.m.escalonamento || "", escalonamentos: (x.m.escalonamentos || []).map((n) => Object.assign({}, n)), obs: x.m.obs || "", modeloVersao: x.m.updatedAt });
    } else { dec[x.m.id] = Object.assign({ acao: "adicionado" }, dec[x.m.id], { atualizacaoIgnorada: x.m.updatedAt }); }
  });
  gravarDecisoes(dec);
  if (r.sel.length) { save(); toast(r.sel.length === 1 ? "Card atualizado (login e senha mantidos)" : r.sel.length + " cards atualizados (login e senha mantidos)"); }
}
function blocoModelos(box) {
  if (!syncEstado.vinculado) return;
  const ativos = modelosAtivos(), meus = new Set(meusModelos());
  const daEquipe = ativos.filter((m) => !meus.has(m.id));
  const disp = modelosNovos(true).length;
  const c = el("article", "card painel-mais");
  c.appendChild(el("h3", "", "Cards compartilhados"));
  const pend = modelosNovos(false).filter(paraMim).length;
  c.appendChild(el("p", "meta", (podeAdminEquipe() ? "Você compartilha " + meus.size + " · " : "") + "a equipe compartilha " + daEquipe.length + (disp ? " · " + disp + " ainda não adicionado(s)" : "") + "."));
  // v2.3.0 (item 11): como o card chega
  c.appendChild(el("p", "meta mod-chegada", "📥 Card compartilhado com você chega aqui, não direto em Meus. Abra “Ver cards compartilhados” e escolha “Adicionar selecionados” para levar para Meus (você preenche o seu login e senha)." + (podeAdminEquipe() ? " Para compartilhar, use “Compartilhar meu card” num card de Meus: vão nome, link, sistema, escalonamento e observações, nunca login e senha." : "")));
  if (pend) { const a = el("p", "se-aviso mod-pendentes"); a.id = "modPendentes"; a.textContent = pend === 1 ? "1 card compartilhado esperando você" : pend + " cards compartilhados esperando você"; c.appendChild(a); }
  const row = el("div", "acoes-mais");
  row.appendChild(btn("btn", "users", "Ver cards compartilhados", () => verificarModelos(true)));
  c.appendChild(row);
  box.appendChild(c);
}
