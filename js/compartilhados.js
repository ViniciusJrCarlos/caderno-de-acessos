/* Caderno de Acessos — js/compartilhados.js
 * v3.0.2: Selecionar e enviar (só Administrador) com entrega obrigatória. Saíram: Compartilhar meu card, Parar de compartilhar,
 * tela Cards compartilhados (Ignorar / Adicionar selecionados), Card parecido no envio.
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
  return CadernoSync.limparModelo({ nome: card.titulo || card.aplicacao || "", url: card.url || "", sistema: card.aplicacao || "", cliente: card.cliente || "", categoria: card.categoria || "", horario: card.horario || "", escalonamento: card.escalonamento || "", /* v3.0.3 (item 9): cliente/operação, categoria e horário também vão */
    escalonamentos: niveisDe(card).map((n) => ({ nivel: n.nivel, canal: n.canal, nome: n.nome, valor: n.valor, horario: n.horario, obs: n.obs })), obs: card.obs || "" });
}
function mesmoConteudo(a, b) { const k = ["nome", "url", "sistema", "cliente", "categoria", "horario", "escalonamento", "escalonamentos", "obs"]; return k.every((c) => JSON.stringify(a[c] == null ? "" : a[c]) === JSON.stringify(b[c] == null ? "" : b[c])); }
/* Chamada em carimbarMudancas(): o dono atualiza o modelo quando edita o card; card excluído vira tombstone. */
const MODELOS_BASE_KEY = "caderno-acessos-meus-modelos-base";
/* v2.0.1 (item 3): card de Meus com modeloDono cujo modelo ativo foi compartilhado por mim (mesmo nome, normTxt) volta para a
 * lista dos meus modelos (ex.: backup pessoal restaurado em outro navegador). Idempotente; não mexe no card (sem recarimbo).
 * Guarda a foto do conteúdo na adoção: o modelo só muda quando eu editar o card de verdade. */
function adotarModelosOrfaos() {
  if (!window.CadernoSync || (typeof analistaPuro === "function" && analistaPuro())) return 0; // v3.0.2: só quem envia (admin)
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
    ["sugeridoPara", "parecidoCom", "destinatarios", "assin"].forEach((k) => { if (l[k] != null && it[k] == null) it[k] = l[k]; });
    const r = rem.get(it.id);
    if (r && ["sugeridoPara", "parecidoCom", "destinatarios", "assin"].some((k) => it[k] != null && r[k] == null)) precisa = true;
  });
  return precisa;
}
function atualizarMeusModelos() {
  if (!window.CadernoSync || (typeof analistaPuro === "function" && analistaPuro())) return false; // v3.0.2: a aba do analista nunca mexe nos envios do admin (mesmo navegador)
  adotarModelosOrfaos();
  try { adotarEscRecebidos(); } catch (e) {} // v3.0.4 (item 6)
  const meus = meusModelos(); if (!meus.length) return false;
  const base = lerJSON(MODELOS_BASE_KEY, {}); let baseMudou = false;
  const m = modelosLocais(); const agora = new Date().toISOString(); const quem = autor();
  let mudou = false; const ficam = [];
  meus.forEach((tid) => {
    const card = todosItens().find((c) => c.modeloDono === tid);
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
    if (!mesmoConteudo(novo, escNovo(m.itens[i]) ? Object.assign({}, m.itens[i], { escalonamentos: m.itens[i].escComp.l, escalonamento: resumoEfetivo(m.itens[i]) }) : m.itens[i])) { // v3.0.7 (item 6): o Resumo compartilhado também já vale // v3.0.4 (item 6): o escalonamento compartilhado já vale
      const em = new Date(Math.max(Date.now(), CadernoSync.ts(escVer(m.itens[i])) + 1)).toISOString();
      m.itens[i] = Object.assign({}, m.itens[i], novo, { id: tid, updatedAt: em, updatedBy: quem });
      mudou = true;
    }
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

/* ---------- v3.0.2: Selecionar e enviar (entrega obrigatória) ----------
 * O envio é o modelo do card de Meus do Administrador (sem login e senha) com destinatarios = ids de perfil, assinado pelo admin.
 * Quem está em destinatarios recebe o card direto em Meus (sem aceitar/ignorar), com dono = o próprio perfil.
 * Card + perfil nunca se repete: quem já recebeu não recebe de novo; dá para enviar a quem ainda não recebeu. */
function msgEnvio(m) { return "e|" + m.id + "|" + (m.sharedBy || "") + "|" + (Array.isArray(m.destinatarios) ? m.destinatarios.slice().sort().join(",") : ""); }
function nomePerfil(id) { const p = lerPerfis().find((x) => x.id === id); return p ? p.nome : ""; }
function modeloDoCard(card) { const tid = card.modeloDono || ("m-" + card.id); return modelosLocais().itens.find((x) => x.id === tid) || null; }
function destinatariosDe(card) { const m = modeloDoCard(card); return m && Array.isArray(m.destinatarios) ? m.destinatarios : []; }
function cardEnviavel(it) { return !!it && it.id !== "s12" && !compartilhado(it) && !it.arquivado_em && individualVisivel(it) && !(it.modeloId && it.dono && it.dono !== sessaoPerfilId); } // v3.0.8: mesmo critério da aba Meus do admin (fora: s12, Equipe, arquivados e recebidos de outro perfil). v3.0.7 (item 3): "dono" legado (v2.5.2) sem modeloId não é card recebido. v3.0.5 (item e): todos os Meus ativos do admin (fora: Equipe, arquivados, recebidos com dono e s12)
function cardDoModelo(mod) { return itens.find((c) => c.modeloId === mod.id); }
function modelosNovos() { return []; } // v3.0.2: não existe mais "esperando você decidir"
function paraMim(m) { const eu = typeof meuPerfil === "function" ? meuPerfil() : null; return !!eu && Array.isArray(m.destinatarios) && m.destinatarios.indexOf(eu.id) >= 0; }
async function compartilharModelo(card, op) {
  if (negarAnalista()) return 0;
  op = op || {};
  const tid = card.modeloDono || ("m-" + card.id);
  const agora = new Date().toISOString();
  const m = modelosLocais();
  const antigo = m.itens.find((x) => x.id === tid);
  const ja = Array.isArray(antigo && antigo.destinatarios) ? antigo.destinatarios.slice() : [];
  const novos = (op.ids || []).filter((id, i, l) => id && ja.indexOf(id) < 0 && l.indexOf(id) === i);
  if (!novos.length) return 0;
  // v3.0.7 (item 2): o reenvio parte da última edição de quem recebeu (escalonamento e Resumo), nunca da versão antiga do admin
  if (antigo && escNovo(antigo)) { try { adotarEscRecebidos(); } catch (e) {} }
  const dest = ja.concat(novos);
  const novo = Object.assign({ id: tid, sharedBy: autor(), createdAt: (antigo && antigo.createdAt) || agora }, conteudoModelo(card),
    { updatedAt: agora, updatedBy: autor(), destinatarios: dest, sugeridoPara: dest.map(nomePerfil).filter(Boolean) });
  if (antigo && antigo.escComp) novo.escComp = antigo.escComp; // v3.0.7 (item 2): mantém o histórico da edição compartilhada
  if (chaveAdmin) novo.assin = await assinar(msgEnvio(novo));
  m.itens = m.itens.filter((x) => x.id !== tid).concat([CadernoSync.limparModelo(novo)]);
  m.removidos = m.removidos.filter((t) => t.id !== tid);
  gravarModelosLocais(m);
  const meus = meusModelos(); if (meus.indexOf(tid) < 0) meus.push(tid); Dados.gravarTexto(MEUS_MODELOS_KEY, JSON.stringify(meus));
  const base = lerJSON(MODELOS_BASE_KEY, {}); if (base[tid]) { delete base[tid]; Dados.gravarTexto(MODELOS_BASE_KEY, JSON.stringify(base)); }
  (atual(card) || card).modeloDono = tid;
  save();
  if (!op.semSync) await sincronizar(true);
  return novos.length;
}
async function selecionarEEnviar() {
  if (!podeAdminEquipe()) { toast(DICA_ADMIN); return; }
  const eu = meuPerfil();
  if (eu && eu.chavePub && !chaveAdmin) { aviso("Entre de novo como Administrador", "Para enviar, o app precisa assinar o envio com a sua senha de Administrador. Saia e entre de novo como Administrador."); return; }
  const cards = itens.filter(cardEnviavel);
  const pessoas = lerPerfis().filter((p) => p.ativo && !p.excluido && p.papel !== "admin");
  if (!cards.length) { toast("Nenhum card de Meus para enviar (cards da Equipe todos já veem)"); return; }
  if (!pessoas.length) { toast("Nenhum analista cadastrado"); return; }
  const ok = await janela("dlgMod", (box, fim) => {
    box.dataset.dlg = "selecionar-enviar";
    dlgPadrao(box, "Selecionar e enviar", "Cards de Meus: quem você marcar recebe direto em Meus e preenche o próprio login e senha. Login e senha não vão. Quem já tem o card não recebe de novo. Cards da Equipe não são enviados: todos já veem.");
    const fs = el("fieldset", "mod-para"); fs.appendChild(el("legend", "", "Meus (" + cards.length + ")"));
    const cbCards = cards.map((it) => {
      const l = el("label", "mod-chk"); const cb = el("input"); cb.type = "checkbox"; cb.value = it.id; cb.dataset.envCard = "1"; l.appendChild(cb);
      l.appendChild(document.createTextNode(" " + (it.aplicacao || it.titulo || "(sem nome)") + (it.cliente ? " · " + it.cliente : "")));
      const ja = destinatariosDe(it).map(nomePerfil).filter(Boolean);
      l.appendChild(el("span", "meta env-ja", ja.length ? " — já recebeu: " + ja.join(", ") : " — ainda não enviado"));
      fs.appendChild(l); return cb;
    });
    box.appendChild(fs);
    const fp = el("fieldset", "mod-para"); fp.appendChild(el("legend", "", "Para"));
    const cbP = pessoas.map((p) => { const l = el("label", "mod-chk"); const cb = el("input"); cb.type = "checkbox"; cb.value = p.nome; cb.dataset.envPara = "1"; cb.dataset.pid = p.id; l.appendChild(cb); l.appendChild(document.createTextNode(" " + p.nome + (p.matricula ? " · " + p.matricula : ""))); const j = el("span", "meta env-ja-pessoa", ""); l.appendChild(j); cb._ja = j; fp.appendChild(l); return cb; });
    box.appendChild(fp);
    // v3.0.3 (item 10): quem já recebeu TODOS os cards marcados aparece desabilitado com "já recebeu"
    const atualizarPara = () => {
      const marc = cbCards.filter((c) => c.checked).map((c) => itens.find((x) => x.id === c.value)).filter(Boolean);
      cbP.forEach((cb) => { const ja = marc.length > 0 && marc.every((it) => destinatariosDe(it).indexOf(cb.dataset.pid) >= 0); cb.disabled = ja; if (ja) cb.checked = false; cb._ja.textContent = ja ? " — já recebeu" : ""; cb.parentNode.classList.toggle("env-desab", ja); });
    };
    cbCards.forEach((c) => c.addEventListener("change", atualizarPara));
    const er = erroPadrao(box);
    botoesPadrao(box, "Cancelar", "Enviar", () => fim(false), () => {
      const ids = cbCards.filter((c) => c.checked).map((c) => c.value), para = cbP.filter((c) => c.checked).map((c) => c.dataset.pid);
      if (!ids.length) { er.textContent = "Marque ao menos um card."; return; }
      if (!para.length) { er.textContent = "Marque ao menos um analista."; return; }
      fim({ ids: ids, para: para });
    });
  });
  if (!ok) return;
  return enviarSelecionados(ok);
}
/* v3.0.9: o mesmo envio do "Selecionar e enviar", reaproveitado pela aba Envios (sem mudar a lógica). ok = { ids, para } */
async function enviarSelecionados(ok) {
  let n = 0; const pulos = [], linhas = [], enviados = [];
  for (const id of ok.ids) {
    const c = itens.find((x) => x.id === id); if (!c || !cardEnviavel(c)) continue;
    const ja = destinatariosDe(c);
    ok.para.filter((p) => ja.indexOf(p) >= 0).forEach((p) => pulos.push(nomePerfil(p) + " já tem esse card" + (ok.ids.length > 1 ? " (" + nomeDe(c) + ")" : "") + "."));
    const k = await compartilharModelo(c, { ids: ok.para, semSync: true });
    if (k) { const qs = ok.para.filter((p) => ja.indexOf(p) < 0).map(nomePerfil); n += k; linhas.push(nomeDe(c) + " → " + qs.join(", ")); enviados.push(nomeDe(c) + " enviado para " + listaE(qs) + "."); }
  }
  linhas.forEach((t) => addHist({ id: "se-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipo: "texto", card: "", escopo: "Equipe", texto: "Administrador enviou: " + t }));
  if (n) await sincronizar(true);
  // v3.0.4 (item 5): primeiro o que foi enviado, depois quem foi pulado; o título acompanha o resultado
  if (pulos.length) aviso(n ? "Enviado (alguns já tinham recebido)" : "Já recebeu", enviados.concat(pulos.slice(0, 10)).join(" ") + (pulos.length > 10 ? " E mais " + (pulos.length - 10) + "." : ""));
  else toast(linhas.length ? "Enviado: " + linhas.join("; ") + ". Chega direto em Meus." : "Nenhum card novo para enviar");
}
function listaE(l) { return l.length <= 1 ? (l[0] || "") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]; }
/* ---------- v3.0.4 (item 6): escalonamento compartilhado do card enviado ----------
 * O modelo leva "escComp" { l: níveis, em, por }: a última edição do escalonamento feita pelo Administrador ou por um destinatário.
 * Vale quando é mais nova que o modelo (updatedAt). Usuário, senha e o resto do card continuam individuais. Só o Administrador cria,
 * arquiva ou exclui o envio; o destinatário só muda os níveis (com o nome dele no Log). */
function fmtNiveis(l) { return JSON.stringify((l || []).map(limparNivelEsc).filter(Boolean).sort((a, b) => a.nivel - b.nivel).map((n) => ({ nivel: n.nivel, canal: n.canal || "", nome: n.nome || "", valor: n.valor || "", horario: n.horario || "", obs: n.obs || "" }))); }
function escNovo(m) { return !!(m && m.escComp && CadernoSync.ts(m.escComp.em) > CadernoSync.ts(m.updatedAt)); }
function escEfetivo(m) { return escNovo(m) ? m.escComp.l : (m && m.escalonamentos) || []; }
function resumoEfetivo(m) { return escNovo(m) && m.escComp.r != null ? m.escComp.r : (m && m.escalonamento) || ""; } // v3.0.7 (item 6): Resumo compartilhado
const escAdotados = new Set(); // v3.0.7 (item 5): ids de cards do admin atualizados pela cópia automática (sem "Card editado" falso no Log)
function escVer(m) { return escNovo(m) ? m.escComp.em : (m && m.updatedAt) || ""; }
function podeEditarEsc(m, nome) { // Administrador ativo ou destinatário do envio (pelo nome do perfil)
  const n = normTxt(nome || ""); if (!n || !m) return false;
  return lerPerfis().some((p) => p.ativo && !p.excluido && normTxt(p.nome) === n && (p.papel === "admin" || (Array.isArray(m.destinatarios) && m.destinatarios.indexOf(p.id) >= 0)));
}
/* Na sincronização: o escComp mais novo (cópia local, arquivo, cópias de conflito) vale para o modelo. */
function mesclarEscComp(rm, fontes) {
  let mudou = false;
  rm.itens.forEach((it) => {
    let melhor = it.escComp && podeEditarEsc(it, it.escComp.por) ? it.escComp : null;
    fontes.forEach((f) => { const x = ((f && f.itens) || []).find((y) => y && y.id === it.id); const e = x && x.escComp; if (e && podeEditarEsc(it, e.por) && (!melhor || CadernoSync.ts(e.em) > CadernoSync.ts(melhor.em))) melhor = e; });
    if (JSON.stringify(melhor || null) !== JSON.stringify(it.escComp || null)) { if (melhor) it.escComp = JSON.parse(JSON.stringify(melhor)); else delete it.escComp; mudou = true; }
  });
  return mudou;
}
/* Em carimbarMudancas(): edição do escalonamento no card recebido (destinatário) vira escComp do modelo. */
function capturarEscRecebidos() {
  const eu = typeof meuPerfil === "function" ? meuPerfil() : null; if (!eu || !window.CadernoSync) return false;
  const m = modelosLocais(); let mudou = false; const quem = autor();
  todosItens().forEach((c) => {
    if (!c.modeloId || c.dono !== eu.id || compartilhado(c)) return;
    const mod = m.itens.find((x) => x.id === c.modeloId); if (!mod || !paraMim(mod)) return;
    const ver = escVer(mod), visto = (c.escVersao || c.modeloVersao) === ver;
    if (!visto || (fmtNiveis(niveisDe(c)) === fmtNiveis(escEfetivo(mod)) && (c.escalonamento || "") === resumoEfetivo(mod))) return; // v3.0.7 (item 6): Resumo também
    const em = new Date(Math.max(Date.now(), CadernoSync.ts(ver) + 1)).toISOString();
    mod.escComp = { l: niveisDe(c).map((n) => ({ nivel: n.nivel, canal: n.canal, nome: n.nome, valor: n.valor, horario: n.horario, obs: n.obs })), r: c.escalonamento || "", em: em, por: quem };
    c.escVersao = em; mudou = true;
    addHist({ id: "ec-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tipo: "texto", card: nomeDe(c), escopo: "Equipe", texto: "Escalonamento do card enviado editado: " + nomeDe(c) + " (por " + quem + ")" });
  });
  if (mudou) { gravarModelosLocais(m); modelosPendentesEnvio = true; try { save(); } catch (e) {} setTimeout(() => { try { agendarSync(); } catch (e) {} }, 0); }
  return mudou;
}
/* Administrador: a edição do destinatário entra no card de origem (o modelo acompanha em atualizarMeusModelos). */
function adotarEscRecebidos() {
  if (!window.CadernoSync || (typeof analistaPuro === "function" && analistaPuro())) return false;
  const m = modelosLocais(); let mudou = false;
  meusModelos().forEach((tid) => {
    const mod = m.itens.find((x) => x.id === tid); const card = todosItens().find((c) => c.modeloDono === tid);
    if (!mod || !card || !escNovo(mod) || card.escVersao === mod.escComp.em) return;
    card.escVersao = mod.escComp.em;
    const r = mod.escComp.r, mudaR = r != null && (card.escalonamento || "") !== r;
    if (fmtNiveis(niveisDe(card)) !== fmtNiveis(mod.escComp.l) || mudaR) { card.escalonamentos = mod.escComp.l.map((n) => Object.assign({}, n)); if (mudaR) card.escalonamento = r; card.updatedAt = new Date().toISOString(); card.updatedBy = mod.escComp.por; }
    escAdotados.add(card.id);
    mudou = true;
  });
  if (mudou) { try { save(); render(); } catch (e) {} }
  return mudou;
}
/* Analista: todo envio para o meu perfil, assinado pelo Administrador, vira card em Meus (dono = eu). Nunca duplica (modelo + dono). */
const RECUSA_ENVIO_KEY = "caderno-envios-recusados";
async function entregarEnvios() {
  if (!window.CadernoSync || typeof perfisAtivos !== "function" || !perfisAtivos()) return 0;
  const eu = meuPerfil(); if (!eu || !eu.ativo || !sessaoPerfilId || eu.id !== sessaoPerfilId) return 0;
  const perfis = lerPerfis(); const todos = todosItens(); const agora = new Date().toISOString();
  const recusa = lerJSON(RECUSA_ENVIO_KEY, {}); let novos = 0, atu = 0, recMud = false; const mexidos = []; const porQuem = []; // v3.0.7 (item 4)
  for (const m of modelosAtivos()) {
    if (!Array.isArray(m.destinatarios) || m.destinatarios.indexOf(eu.id) < 0) continue;
    if (!(await ehAdminRemoto(m.sharedBy, m.assin, msgEnvio(m), perfis))) {
      if (recusa[m.id] !== m.updatedAt) { recusa[m.id] = m.updatedAt; recMud = true; addHist({ id: "er-" + m.id + "-" + Date.now().toString(36), tipo: "texto", card: m.nome || "", escopo: "Equipe", texto: "Envio sem a assinatura do Administrador recusado (" + (m.sharedBy || "sem nome") + "): " + (m.nome || m.id) }); }
      continue;
    }
    let c = todos.find((x) => !compartilhado(x) && x.modeloId === m.id && x.dono === eu.id);
    if (!c) { c = todos.find((x) => !compartilhado(x) && x.modeloId === m.id && !x.dono); if (c) { c.dono = eu.id; mexidos.push(c); } } // cópia antiga (antes da v3.0.2): vira a minha, mantém login e senha
    if (!c) {
      c = { id: "r-" + m.id + "-" + eu.id, titulo: m.nome || m.sistema || "", aplicacao: m.sistema || m.nome || "", cliente: m.cliente || "", categoria: m.categoria === "Externo" ? "Externo" : "Interno", visibilidade: "Individual",
        url: CadernoSync.urlPermitida(m.url || ""), usuario: "", senha: "", ciclo: "90", ultima: hoje(), horario: m.horario || "", /* v3.0.3 (item 9): chega preenchido */ escalonamento: resumoEfetivo(m),
        escalonamentos: escEfetivo(m).map((n) => Object.assign({}, n)), obs: m.obs || "", modeloId: m.id, modeloVersao: m.updatedAt || "", escVersao: escVer(m), modeloPor: m.sharedBy || "", dono: eu.id, updatedAt: agora, updatedBy: autor() };
      itensOcultos.push(c); novos++; mexidos.push(c);
      addHist({ id: "rc-" + c.id, tipo: "texto", card: c.titulo, escopo: "Individual", texto: "Recebido do Administrador (" + (m.sharedBy || "") + "): " + (c.titulo || "card") + " — preencha seu login e senha" });
      continue;
    }
    if (CadernoSync.ts(m.updatedAt) <= CadernoSync.ts(c.modeloVersao) && escNovo(m) && c.escVersao !== m.escComp.em) { // v3.0.4 (item 6)
      c.escVersao = m.escComp.em;
      const r = m.escComp.r, mudaR = r != null && (c.escalonamento || "") !== r;
      if (fmtNiveis(niveisDe(c)) !== fmtNiveis(m.escComp.l) || mudaR) { c.escalonamentos = m.escComp.l.map((n) => Object.assign({}, n)); if (mudaR) c.escalonamento = r; atu++; porQuem.push(m.escComp.por || ""); }
      if (mexidos.indexOf(c) < 0) mexidos.push(c);
      continue;
    }
    if (CadernoSync.ts(m.updatedAt) > CadernoSync.ts(c.modeloVersao)) {
      c.escVersao = escVer(m);
      Object.assign(c, { titulo: m.nome || c.titulo, aplicacao: m.sistema || c.aplicacao, cliente: m.cliente || "", categoria: m.categoria === "Externo" ? "Externo" : "Interno", url: CadernoSync.urlPermitida(m.url || ""), /* v3.0.3: horário do analista é mantido */ escalonamento: resumoEfetivo(m), escalonamentos: escEfetivo(m).map((n) => Object.assign({}, n)), obs: m.obs || "", modeloVersao: m.updatedAt });
      atu++; porQuem.push(m.updatedBy || m.sharedBy || ""); if (mexidos.indexOf(c) < 0) mexidos.push(c);
    }
  }
  if (recMud) Dados.gravarTexto(RECUSA_ENVIO_KEY, JSON.stringify(recusa));
  if (!mexidos.length) return 0;
  separarOcultos();
  if (typeof baseMeus !== "undefined" && baseMeus) mexidos.forEach((c) => baseMeus.set(c.id, JSON.parse(JSON.stringify(c))));
  save(); render();
  if (novos) toast(novos === 1 ? "1 card novo do Administrador em Meus: preencha seu login e senha" : novos + " cards novos do Administrador em Meus: preencha seu login e senha");
  else if (atu) { // v3.0.7 (item 4): diz quem mudou de verdade
    const ps = porQuem.filter(Boolean).filter((x, i, l) => l.indexOf(x) === i);
    const quem = ps.length ? "por " + listaE(ps) : "pelo Administrador";
    toast(atu === 1 ? "1 card de Meus atualizado " + quem + " (login e senha mantidos)" : atu + " cards de Meus atualizados " + quem + " (login e senha mantidos)");
  }
  return novos + atu;
}
async function verificarModelos() { try { await entregarEnvios(); } catch (e) { /* tenta de novo na próxima sincronização */ } }
function blocoModelos() { /* v3.0.2: tela "Cards compartilhados" removida (a entrega é direta em Meus) */ }
/* v3.0.2 (item 3): limpeza única de repetidos neste navegador: cópia em Meus de card da Equipe e cópias repetidas do mesmo envio.
 * Vão para a Lixeira de Meus (30 dias, com login e senha), com registro no Histórico. */
const LIMPEZA_302_KEY = "caderno-limpeza-v302";
function limparRepetidos302() {
  if (Dados.texto(LIMPEZA_302_KEY)) return 0;
  const todos = todosItens(); const eqIds = new Set(todos.filter(compartilhado).map((x) => x.id));
  const fora = [];
  todos.forEach((x) => { if (!compartilhado(x) && x.modeloId && /^m-/.test(x.modeloId) && eqIds.has(x.modeloId.slice(2)) && !x.senha) fora.push(x); }); // com senha própria fica (não perde credencial)
  const grupos = new Map();
  todos.forEach((x) => { if (compartilhado(x) || !x.modeloId || fora.indexOf(x) >= 0) return; const k = x.modeloId + "|" + (x.dono || ""); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); });
  grupos.forEach((l) => { if (l.length < 2) return; l.sort((a, b) => (!!b.senha - !!a.senha) || (CadernoSync.ts(b.updatedAt) - CadernoSync.ts(a.updatedAt))); l.slice(1).forEach((x) => { if (!x.senha || x.senha === l[0].senha) fora.push(x); }); });
  Dados.gravarTexto(LIMPEZA_302_KEY, new Date().toISOString());
  if (!fora.length) return 0;
  const agora = new Date().toISOString(), lix = lerLixeiraMeus(), ids = new Set(fora.map((x) => x.id));
  fora.forEach((c) => { lix.unshift({ id: c.id, card: Object.assign({}, c), excluidoEm: agora, excluidoPor: "Limpeza v3.0.2" }); });
  gravarLixeiraMeus(lix);
  itens = itens.filter((x) => !ids.has(x.id)); itensOcultos = itensOcultos.filter((x) => !ids.has(x.id));
  addHist({ id: "lp-" + Date.now().toString(36), tipo: "texto", card: "", escopo: "Individual", texto: "Limpeza v3.0.2: " + fora.length + (fora.length === 1 ? " card repetido foi" : " cards repetidos foram") + " para a Lixeira de Meus: " + fora.slice(0, 8).map(nomeDe).join(", ") });
  save();
  return fora.length;
}
