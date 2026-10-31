/* Caderno de Acessos — js/ficha.js
 * Ficha Novo/Editar: abrir, ler, limites de texto, descartar, trava "um link = um card" (conferirLinkDuplicado), outra operação, Salvar em Meus e sugerir.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Formulário Novo / Editar ---------- */
const NOVO = "__novo__";
function preencherSelect(sel, valores, atual, rotuloNovo) {
  sel.innerHTML = "";
  const vazio = el("option", "", "Selecione...");
  vazio.value = "";
  sel.appendChild(vazio);
  valores.forEach((v) => { const o = el("option", "", v); o.value = v; sel.appendChild(o); });
  const n = el("option", "", rotuloNovo);
  n.value = NOVO;
  sel.appendChild(n);
  sel.value = atual && valores.includes(atual) ? atual : "";
}
function unicos(campo) {
  return Array.from(new Set(itens.map((it) => String(it[campo] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
function ligarNovo(sel, input) {
  const upd = () => { input.hidden = sel.value !== NOVO; if (!input.hidden) input.focus(); };
  sel.onchange = upd;
  input.hidden = true;
}
function abrirFicha(it) {
  fecharMenus();
  if (!it && negarAnalista()) return; // v3.0.1 (item 4): analista não cria card
  edit = it ? Object.assign({}, it) : { id: Math.random().toString(16).slice(2, 10), visibilidade: aba === "meu" ? "Individual" : "Equipe", categoria: "Interno", ciclo: "90", ultima: hoje() };
  $("fichaTitulo").textContent = it ? "Editar acesso" : "Novo acesso";
  $("fTitulo").value = edit.titulo || "";
  preencherSelect($("fAplicacao"), unicos("aplicacao"), edit.aplicacao, "+ Nova aplicação...");
  preencherSelect($("fCliente"), unicos("cliente"), edit.cliente, "+ Novo cliente / operação...");
  ligarNovo($("fAplicacao"), $("fAplicacaoNova"));
  ligarNovo($("fCliente"), $("fClienteNovo"));
  $("fAplicacaoNova").value = ""; $("fClienteNovo").value = "";
  $("fCategoria").value = edit.categoria === "Externo" ? "Externo" : "Interno";
  $("fVisibilidade").value = edit.visibilidade === "Individual" ? "Individual" : "Equipe";
  $("fUrl").value = edit.url || "";
  $("fUsuario").value = edit.usuario || "";
  $("fSenha").value = edit.senha || "";
  $("fSenha").type = "password";
  setOlho($("fOlho"), false);
  $("fCiclo").value = ["30", "60", "90", "Nunca"].includes(String(edit.ciclo)) ? String(edit.ciclo) : "90";
  $("fUltima").value = edit.ultima || "";
  $("fHorario").value = edit.horario || "";
  escDraft = niveisDe(edit).map((n) => Object.assign({}, n));
  if (!escDraft.length && edit.escalonamento) escDraft = parseEscalonamentoTexto(edit.escalonamento);
  renderEscEditor();
  $("fEscalonamento").value = edit.escalonamento || "";
  $("fObs").value = edit.obs || "";
  $("erroForm").textContent = "";
  $("avisoInd").hidden = $("fVisibilidade").value !== "Individual";
  atualizarContadores();
  aplicarTravasFicha(it); // v2.2.0: cadeados do analista nos cards da Equipe
  abrirSheet("sheet");
  fichaFoto = fotoFicha();
  setTimeout(() => $("fTitulo").focus(), 50);
}
/* v1.9.7: a ficha não fecha sozinha. Foto do formulário ao abrir; fechar com alterações pergunta antes. */
let fichaFoto = null, perguntandoDescarte = false;
function fotoFicha() { return JSON.stringify([...$("ficha").querySelectorAll("input, select, textarea")].map((x) => x.type === "checkbox" ? x.checked : x.value).concat([JSON.stringify(escDraft)])); }
function fichaSuja() { return $("sheet").classList.contains("on") && fichaFoto != null && fotoFicha() !== fichaFoto; }
async function pedirFecharFicha() {
  if (perguntandoDescarte) return false;
  if (!fichaSuja()) { fichaFoto = null; fecharSheet("sheet"); return true; }
  perguntandoDescarte = true;
  try {
    const sim = await dialogo({ titulo: "Descartar alterações?", texto: "Você tem alterações não salvas neste card.", ok: "Descartar", cancelar: "Continuar editando", perigo: true });
    if (sim) { fichaFoto = null; fecharSheet("sheet"); return true; }
    return false;
  } finally { perguntandoDescarte = false; }
}
const escAddBtn = $("escAdd");
/* ---------- v2.0.0 (item 5): limites de texto na ficha = os mesmos do arquivo da equipe (normalizarCard) ----------
 * maxlength em cada campo e contador visível perto do limite ("4.850 / 5.000"). Nada é cortado depois de salvo. */
const LIM = (function () {
  const C = (window.CadernoSync && CadernoSync.CAMPOS_CARD) || {}, N = (window.CadernoSync && CadernoSync.LIMITES_NIVEL) || {};
  return { titulo: C.titulo || 200, aplicacao: C.aplicacao || 200, cliente: C.cliente || 200, url: C.url || 2000, usuario: C.usuario || 500, senha: C.senha || 500, horario: C.horario || 500, escalonamento: C.escalonamento || 5000, obs: C.obs || 5000,
    niveis: N.max || 20, nValor: N.valor || 2000, nNome: N.nome || 200, nHorario: N.horario || 200, nObs: N.obs || 1000 };
})();
const CAMPOS_LIM = [["fTitulo", "titulo"], ["fAplicacaoNova", "aplicacao"], ["fClienteNovo", "cliente"], ["fUrl", "url"], ["fUsuario", "usuario"], ["fSenha", "senha"], ["fHorario", "horario"], ["fEscalonamento", "escalonamento"], ["fObs", "obs"]];
function fmtNum(n) { return Number(n).toLocaleString("pt-BR"); }
function ligarContador(inp, max) {
  if (!inp) return;
  inp.maxLength = max;
  let c = inp._contador;
  if (!c) {
    c = el("span", "contador"); c.id = (inp.id || "campo") + "-cont"; c.setAttribute("aria-live", "polite"); c.hidden = true;
    const ancora = inp.parentElement && inp.parentElement.classList.contains("senha-campo") ? inp.parentElement : inp;
    ancora.insertAdjacentElement("afterend", c); inp._contador = c;
    inp.addEventListener("input", () => atualizarContador(inp));
  }
  atualizarContador(inp);
}
function atualizarContador(inp) {
  const c = inp._contador; if (!c) return;
  const max = inp.maxLength > 0 ? inp.maxLength : 0, n = inp.value.length;
  const perto = max && n >= Math.floor(max * 0.8);
  c.hidden = !perto;
  c.textContent = perto ? fmtNum(n) + " / " + fmtNum(max) + (n >= max ? " · limite atingido" : "") : "";
  c.classList.toggle("no-limite", n >= max);
}
function atualizarContadores() { CAMPOS_LIM.forEach(([id, k]) => ligarContador($(id), LIM[k])); const b = $("escAdd"); if (b) { b.disabled = escDraft.length >= LIM.niveis; b.title = b.disabled ? "Máximo de " + LIM.niveis + " níveis" : ""; } }
/* ---------- v2.0.0 (item 13): no celular, o campo focado vai para o meio da área visível (teclado não cobre) ---------- */
function centralizarCampo(t) {
  if (!t || document.activeElement !== t || !t.isConnected) return;
  const vv = window.visualViewport; const r = t.getBoundingClientRect();
  const topo = vv ? vv.offsetTop : 0, alt = vv ? vv.height : window.innerHeight;
  const toque = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (toque || r.top < topo + 8 || r.bottom > topo + alt - 8) { try { t.scrollIntoView({ block: "center" }); } catch (e) { t.scrollIntoView(); } }
}
function lerFicha() {
  const valSel = (sel, nova) => sel.value === NOVO ? nova.value.trim() : sel.value;
  const o = Object.assign({}, edit, {
    titulo: $("fTitulo").value.trim(),
    aplicacao: valSel($("fAplicacao"), $("fAplicacaoNova")),
    cliente: valSel($("fCliente"), $("fClienteNovo")),
    categoria: $("fCategoria").value,
    visibilidade: $("fVisibilidade").value,
    url: $("fUrl").value.trim(),
    usuario: $("fUsuario").value.trim(),
    senha: $("fSenha").value,
    ciclo: $("fCiclo").value,
    ultima: $("fUltima").value,
    horario: $("fHorario").value.trim(),
    escalonamento: $("fEscalonamento").value.trim(),
    escalonamentos: lerEscDraft(),
    obs: $("fObs").value.trim()
  });
  if (!o.escalonamento && o.escalonamentos.length) o.escalonamento = resumoEscalonamentos(o.escalonamentos);
  // v2.0.0 (item 5): texto acima do limite (ex.: card antigo ou colado por script) não é cortado em silêncio: pede para encurtar
  const passou = excessoDeTexto(o);
  if (passou) { $("erroForm").textContent = passou; return null; }
  if (!o.titulo && !o.aplicacao) { $("erroForm").textContent = "Preencha pelo menos o Título ou a Aplicação."; return null; }
  if (!o.titulo) o.titulo = o.aplicacao + (o.cliente ? " " + o.cliente : "");
  if (!o.aplicacao) o.aplicacao = o.titulo;
  return o;
}
function excessoDeTexto(o) {
  const nomes = { titulo: "Título", aplicacao: "Aplicação", cliente: "Cliente / operação", url: "URL", usuario: "Usuário", senha: "Senha", horario: "Horário", escalonamento: "Resumo do escalonamento", obs: "Observação" };
  for (const k of Object.keys(nomes)) { const n = String(o[k] || "").length; if (n > LIM[k]) return nomes[k] + " passou do limite (" + fmtNum(n) + " / " + fmtNum(LIM[k]) + " caracteres). Encurte o texto para salvar."; }
  const nv = o.escalonamentos || [];
  if (nv.length > LIM.niveis) return "Escalonamento passou do limite de " + LIM.niveis + " níveis (" + nv.length + "). Exclua alguns níveis para salvar.";
  for (let i = 0; i < nv.length; i++) {
    const x = nv[i];
    for (const [k, lim, nm] of [["valor", LIM.nValor, "valor"], ["nome", LIM.nNome, "nome"], ["horario", LIM.nHorario, "horário"], ["obs", LIM.nObs, "obs."]]) {
      const n = String(x[k] || "").length; if (n > lim) return "Nível " + (i + 1) + ": " + nm + " passou do limite (" + fmtNum(n) + " / " + fmtNum(lim) + "). Encurte para salvar.";
    }
  }
  return "";
}
function gravar(o, msg) {
  const i = itens.findIndex((x) => x.id === o.id);
  if (i >= 0) itens[i] = o; else itens.push(o);
  fichaFoto = null;
  fecharSheet("sheet");
  save();
  toast(msg);
}
/* v1.9.8: ao salvar, avisa (sem bloquear) se outro card ativo já tem o mesmo link. Card novo: sempre confere.
 * Edição: só se o link mudou e passou a ser igual ao de outro card. Arquivados e link vazio não contam. */
let avisandoLink = false;
async function conferirLinkDuplicado(o) {
  const antes = itens.find((x) => x.id === o.id);
  // v2.0.0 (item 8): card da Equipe com o mesmo link de outro card da Equipe ativo não é salvo, seja qual for o título.
  // v2.0.1 (item 5): mesmo link com o mesmo cliente/operação (normTxt; vazio = vazio) continua travado; cliente diferente e preenchido
  // (de todos os cards com esse link) pode ser salvo como "outra operação", com confirmação. Em edição, só confere se o link, a
  // visibilidade ou o cliente mudou; mudar só o cliente trava apenas se ficar igual ao de outro card com o mesmo link.
  if (compartilhado(o) && !o.arquivado_em) {
    const linkMudou = !antes || !compartilhado(antes) || !!antes.arquivado_em || normUrl(antes.url) !== normUrl(o.url);
    const cliMudou = !!antes && normTxt(antes.cliente) !== normTxt(o.cliente);
    const dup = (linkMudou || cliMudou) ? duplicadosEquipe(o) : [];
    const mesmo = dup.filter((c) => mesmoCliente(c.cliente, o.cliente));
    if (dup.length && (linkMudou || mesmo.length)) {
      const alvo = mesmo[0] || dup[0];
      const podeOutra = podeAdminEquipe() && !mesmo.length && !!normTxt(o.cliente) && dup.every((c) => !!normTxt(c.cliente));
      const podeMeus = (!antes || !compartilhado(antes)) && podeAdminEquipe(); // v2.3.0 (item 9): o analista não sugere à equipe
      const extras = [];
      if (podeOutra) extras.push({ texto: "Salvar como outra operação", valor: "outra" });
      if (podeMeus) extras.push({ texto: "Salvar em Meus e sugerir à equipe", valor: "meus" });
      let r = false;
      avisandoLink = true; perguntandoDescarte = true;
      try {
        r = await dialogo({ titulo: "⛔ Já existe um card da Equipe com esse link: " + nomeDe(alvo) + " (" + rotuloCliente(alvo) + ")",
          texto: (mesmo.length ? "É o mesmo link e o mesmo cliente/operação: é o mesmo card. " : "") + "Na Equipe vale “um link = um card”: não pode haver dois cards ativos com o mesmo link para o mesmo cliente/operação." +
            (podeOutra ? " Se este card é de outra operação, use “Salvar como outra operação”." : (!mesmo.length && !normTxt(o.cliente) ? " Para salvar como outra operação, preencha o cliente/operação." : "")) +
            (podeMeus ? " Ou salve em Meus e sugira à equipe: cada um decide se adiciona." : "") + (dup.length > 1 ? " (Há " + dup.length + " cards com esse link.)" : ""),
          ok: "Abrir card existente", cancelar: "Voltar e editar", extras: extras, coluna: true });
      } finally { avisandoLink = false; perguntandoDescarte = false; }
      if (r === "outra") {
        let sim = false; perguntandoDescarte = true;
        try { sim = await dialogo({ titulo: "Salvar como outra operação?", texto: "Já existe um card com este link para o cliente " + rotuloClientes(dup) + ". Salvar este card para o cliente " + String(o.cliente).trim() + "?", ok: "Salvar como outra operação", cancelar: "Voltar e editar" }); }
        finally { perguntandoDescarte = false; }
        return sim ? "outra" : false;
      }
      if (r === "meus") return "meus";
      if (r !== true) return false;
      // v2.0.1 (item 1): pergunta própria. Nunca reaproveita pedirFecharFicha(), em que "Descartar" quer dizer só fechar.
      let ir = !fichaSuja();
      if (!ir) {
        perguntandoDescarte = true;
        try { ir = await dialogo({ titulo: "Abrir " + nomeDe(alvo) + " (card existente)?", texto: "O que você digitou nesta ficha não será salvo.", ok: "Abrir card existente", cancelar: "Voltar e editar" }); }
        finally { perguntandoDescarte = false; }
      }
      if (!ir) return false;
      fichaFoto = null; fecharSheet("sheet");
      const c = atual(alvo); if (c) { abrirFicha(c); toast("Abrindo o card existente: " + nomeDe(c)); }
      return "abrir";
    }
  }
  if (antes && normUrl(antes.url) === normUrl(o.url)) return true;
  const r = cardsMesmoLink(o.url, o.id);
  // v1.9.9 (item 2): mostra o cliente do card existente no aviso.
  const rot = (c, onde) => nomeDe(c) + " (" + onde + (c.cliente ? " · " + String(c.cliente).trim() : (onde === "Equipe" ? " · sem cliente" : "")) + ")";
  const todos = r.meus.map((c) => rot(c, "Meus")).concat(r.equipe.map((c) => rot(c, "Equipe")));
  if (!todos.length) return true;
  avisandoLink = true; perguntandoDescarte = true;
  // v2.2.0: com perfis, o analista (que só cria em Meus) também pode salvar em Meus e sugerir à equipe; nunca “outra operação”
  // v2.3.0 (item 9): o analista não compartilha nem sugere à equipe; cuida só dos próprios cards em Meus
  const sugerir = undefined;
  try {
    return await dialogo({ titulo: "⚠️ Já existe um card com esse link: " + todos[0], texto: (todos.length > 1 ? "Também: " + todos.slice(1, 4).join(", ") + (todos.length > 4 ? " e mais " + (todos.length - 4) : "") + ". " : "") + "Nada é bloqueado: você decide se salva mesmo assim.", ok: "Salvar mesmo assim", cancelar: "Voltar e editar", extras: sugerir, coluna: !!sugerir });
  } finally { avisandoLink = false; perguntandoDescarte = false; }
}
/* v2.0.1 (item 5): Histórico da Equipe "Card salvo com link repetido (outra operação) por Fulano". */
function registrarOutraOperacao(o) {
  const card = (String(nomeDe(o)).slice(0, 110) + (o.cliente ? " (" + String(o.cliente).trim().slice(0, 80) + ")" : "")).slice(0, 200);
  // "texto" vai junto: a v2.0.0/v1.9.9 não conhecem o tipo e mostram o texto (o tipo vira "texto" lá).
  addHist({ id: "oo-" + o.id + "-" + Date.now().toString(36), tipo: "outra-operacao", card: card, texto: "Card salvo com link repetido (outra operação): " + card, escopo: "Equipe" });
  render();
}
/* v2.0.1 (item 6): o card parecido vai para Meus (login e senha só de quem criou) e é sugerido à equipe como card compartilhado
 * (modelo sem login e senha), com o selo "Card parecido". A Equipe não recebe o duplicado direto. */
async function salvarEmMeusESugerir(o) {
  const parecido = duplicadosEquipe(Object.assign({}, o, { visibilidade: "Equipe" }))[0];
  o.visibilidade = "Individual";
  gravar(o, "Salvo em Meus");
  const card = atual(o) || o;
  void card; void parecido; // v3.0.2 (item 7): não sugere mais à equipe; envio só por Selecionar e enviar (Administrador)
  toast("Salvo em Meus. Para enviar a analistas: Selecionar e enviar (Administrador).");
}
