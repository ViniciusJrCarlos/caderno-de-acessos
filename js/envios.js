/* Caderno de Acessos — js/envios.js (v3.0.9)
 * Aba Envios (só do Administrador): a mesma regra do "Selecionar e enviar" (cardEnviavel) e o mesmo envio (enviarSelecionados),
 * com busca, filtros de Aplicação e Cliente/Operação gerados dos próprios cards, "marcar todos do filtro" e páginas de 25.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const ENV_POR_PAG = 25;
const envEstado = { q: "", app: "", cli: "", pag: 0, cards: new Set(), para: new Set() };
function envApp(it) { return String(it.aplicacao || it.titulo || "").trim(); }
function envCli(it) { return String(it.cliente || "").trim(); }
function envOpcoes(lista, fn) {
  const m = new Map(); lista.forEach((it) => { const v = fn(it); if (v && !m.has(normTxt(v))) m.set(normTxt(v), v); });
  return Array.from(m.values()).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}
function renderEnvios(box) {
  if (!podeAdminEquipe()) { box.appendChild(el("p", "vazio", DICA_ADMIN)); return; }
  const todos = itens.filter(cardEnviavel);
  const pessoas = lerPerfis().filter((p) => p.ativo && !p.excluido && p.papel !== "admin");
  const ids = new Set(todos.map((c) => c.id));
  envEstado.cards.forEach((id) => { if (!ids.has(id)) envEstado.cards.delete(id); });
  const pids = new Set(pessoas.map((p) => p.id));
  envEstado.para.forEach((id) => { if (!pids.has(id)) envEstado.para.delete(id); });
  const wrap = el("div", "envios");
  const cab = el("article", "card painel-mais env-cab");
  cab.appendChild(el("h3", "", "Envios"));
  cab.appendChild(el("p", "meta", "Seus cards de Meus. Quem você marcar recebe direto em Meus e preenche o próprio login e senha (login e senha não vão). Quem já tem o card não recebe de novo. Cards da Equipe não aparecem: todos já veem."));
  wrap.appendChild(cab);
  const grade = el("div", "env-grade");
  const colCards = el("article", "card painel-mais env-cards");
  const colPara = el("article", "card painel-mais env-para");
  grade.appendChild(colCards); grade.appendChild(colPara); wrap.appendChild(grade);
  box.appendChild(wrap);
  if (!todos.length) { colCards.appendChild(el("p", "vazio", "Nenhum card de Meus para enviar.")); }
  // Filtros
  const filtros = el("div", "env-filtros");
  const busca = el("label", "env-busca"); busca.insertAdjacentHTML("beforeend", svg("search", 18));
  const inp = el("input"); inp.type = "search"; inp.id = "envBusca"; inp.placeholder = "Buscar por título, aplicação ou cliente"; inp.value = envEstado.q; inp.autocomplete = "off"; inp.setAttribute("aria-label", "Buscar cards");
  busca.appendChild(inp); filtros.appendChild(busca);
  const mkSel = (id, rot, opcoes, val) => {
    const l = el("label", "env-sel"); l.appendChild(el("span", "env-sel__rot", rot));
    const s = el("select"); s.id = id; s.appendChild(new Option("Todas", ""));
    opcoes.forEach((o) => s.appendChild(new Option(o, o)));
    s.value = opcoes.indexOf(val) >= 0 ? val : ""; l.appendChild(s); return [l, s];
  };
  const [lApp, sApp] = mkSel("envApp", "Aplicação", envOpcoes(todos, envApp), envEstado.app);
  const [lCli, sCli] = mkSel("envCli", "Cliente/Operação", envOpcoes(todos, envCli), envEstado.cli);
  envEstado.app = sApp.value; envEstado.cli = sCli.value;
  filtros.appendChild(lApp); filtros.appendChild(lCli);
  if (todos.length) colCards.appendChild(filtros);
  const barra = el("div", "env-barra"); const lista = el("div", "env-lista"); const pag = el("div", "env-pag");
  if (todos.length) { colCards.appendChild(barra); colCards.appendChild(lista); colCards.appendChild(pag); }
  // Para
  colPara.appendChild(el("h3", "", "Para"));
  const listaP = el("div", "env-pessoas");
  const cbP = pessoas.map((p) => {
    const l = el("label", "mod-chk env-pessoa"); const cb = el("input"); cb.type = "checkbox"; cb.value = p.nome; cb.dataset.envPara = "1"; cb.dataset.pid = p.id; cb.checked = envEstado.para.has(p.id);
    cb.addEventListener("change", () => { if (cb.checked) envEstado.para.add(p.id); else envEstado.para.delete(p.id); resumo(); });
    l.appendChild(cb);
    const tx = el("span", "env-pessoa__tx"); tx.appendChild(el("b", "", p.nome)); if (p.matricula) tx.appendChild(el("small", "", "RE " + p.matricula));
    const j = el("small", "env-ja-pessoa", ""); tx.appendChild(j); cb._ja = j; l.appendChild(tx);
    listaP.appendChild(l); return cb;
  });
  if (!pessoas.length) listaP.appendChild(el("p", "meta", "Nenhum analista cadastrado."));
  colPara.appendChild(listaP);
  const res = el("p", "env-resumo meta", "");
  const er = el("p", "erro", ""); er.setAttribute("role", "alert");
  const bEnv = btn("btn pri env-enviar", "send", "Enviar", async () => {
    er.textContent = "";
    const cs = Array.from(envEstado.cards).filter((id) => ids.has(id)), ps = Array.from(envEstado.para).filter((id) => pids.has(id));
    if (!cs.length) { er.textContent = "Marque ao menos um card."; return; }
    if (!ps.length) { er.textContent = "Marque ao menos um analista."; return; }
    const eu = meuPerfil();
    if (eu && eu.chavePub && !chaveAdmin) { aviso("Entre de novo como Administrador", "Para enviar, o app precisa assinar o envio com a sua senha de Administrador. Saia e entre de novo como Administrador."); return; }
    bEnv.disabled = true;
    try { await enviarSelecionados({ ids: cs, para: ps }); envEstado.cards.clear(); envEstado.para.clear(); }
    finally { bEnv.disabled = false; if (aba === "envios") render(); }
  });
  bEnv.id = "envEnviar";
  colPara.appendChild(res); colPara.appendChild(er); colPara.appendChild(bEnv);
  function filtrados() {
    const q = normTxt(envEstado.q);
    return todos.filter((it) => (!envEstado.app || envApp(it) === envEstado.app) && (!envEstado.cli || envCli(it) === envEstado.cli) &&
      (!q || normTxt([it.titulo, it.aplicacao, it.cliente].join(" ")).indexOf(q) >= 0));
  }
  function resumo() {
    const marc = todos.filter((it) => envEstado.cards.has(it.id));
    cbP.forEach((cb) => { const ja = marc.length > 0 && marc.every((it) => destinatariosDe(it).indexOf(cb.dataset.pid) >= 0); cb.disabled = ja; if (ja) { cb.checked = false; envEstado.para.delete(cb.dataset.pid); } cb._ja.textContent = ja ? "já recebeu" : ""; cb.parentNode.classList.toggle("env-desab", ja); });
    const nc = marc.length, np = envEstado.para.size;
    res.textContent = nc + (nc === 1 ? " card marcado" : " cards marcados") + " · " + np + (np === 1 ? " pessoa" : " pessoas");
  }
  function desenhar() {
    const f = filtrados(); const tot = Math.max(1, Math.ceil(f.length / ENV_POR_PAG));
    if (envEstado.pag >= tot) envEstado.pag = tot - 1; if (envEstado.pag < 0) envEstado.pag = 0;
    const pg = f.slice(envEstado.pag * ENV_POR_PAG, envEstado.pag * ENV_POR_PAG + ENV_POR_PAG);
    barra.textContent = ""; lista.textContent = ""; pag.textContent = "";
    const lt = el("label", "mod-chk env-todos"); const ct = el("input"); ct.type = "checkbox"; ct.id = "envTodos";
    const nm = f.filter((it) => envEstado.cards.has(it.id)).length;
    ct.checked = f.length > 0 && nm === f.length; ct.indeterminate = nm > 0 && nm < f.length; ct.disabled = !f.length;
    ct.addEventListener("change", () => { f.forEach((it) => { if (ct.checked) envEstado.cards.add(it.id); else envEstado.cards.delete(it.id); }); desenhar(); });
    lt.appendChild(ct); lt.appendChild(el("span", "", "Marcar todos do filtro (" + f.length + ")"));
    barra.appendChild(lt); barra.appendChild(el("span", "env-cont", f.length + " de " + todos.length));
    if (!f.length) lista.appendChild(el("p", "vazio", "Nenhum card para esse filtro."));
    pg.forEach((it) => {
      const l = el("label", "mod-chk env-card"); const cb = el("input"); cb.type = "checkbox"; cb.value = it.id; cb.dataset.envCard = "1"; cb.checked = envEstado.cards.has(it.id);
      cb.addEventListener("change", () => { if (cb.checked) envEstado.cards.add(it.id); else envEstado.cards.delete(it.id); l.classList.toggle("on", cb.checked); atualizarTodos(); resumo(); });
      l.classList.toggle("on", cb.checked); l.appendChild(cb);
      const tx = el("span", "env-card__tx");
      tx.appendChild(el("b", "", it.titulo || it.aplicacao || "(sem nome)"));
      const sub = [it.aplicacao && it.aplicacao !== it.titulo ? it.aplicacao : "", it.cliente || ""].filter(Boolean).join(" · ");
      if (sub) tx.appendChild(el("small", "", sub));
      const ja = destinatariosDe(it).map(nomePerfil).filter(Boolean);
      tx.appendChild(el("small", "env-ja" + (ja.length ? " env-ja--sim" : ""), ja.length ? "já recebeu: " + ja.join(", ") : "ainda não enviado"));
      l.appendChild(tx); lista.appendChild(l);
    });
    function atualizarTodos() { const k = f.filter((it) => envEstado.cards.has(it.id)).length; ct.checked = f.length > 0 && k === f.length; ct.indeterminate = k > 0 && k < f.length; }
    if (tot > 1) {
      const ant = btn("btn pequeno", "back", "Anterior", () => { envEstado.pag--; desenhar(); }); ant.disabled = envEstado.pag === 0; ant.id = "envAnt";
      const prox = btn("btn pequeno", null, "Próxima", () => { envEstado.pag++; desenhar(); }); prox.disabled = envEstado.pag >= tot - 1; prox.id = "envProx";
      pag.appendChild(ant); pag.appendChild(el("span", "env-pag__tx", "Página " + (envEstado.pag + 1) + " de " + tot)); pag.appendChild(prox);
    }
    resumo();
  }
  inp.addEventListener("input", () => { envEstado.q = inp.value; envEstado.pag = 0; desenhar(); });
  sApp.addEventListener("change", () => { envEstado.app = sApp.value; envEstado.pag = 0; desenhar(); });
  sCli.addEventListener("change", () => { envEstado.cli = sCli.value; envEstado.pag = 0; desenhar(); });
  desenhar();
}
