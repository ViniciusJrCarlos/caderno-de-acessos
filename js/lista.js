/* Caderno de Acessos — js/lista.js
 * Lista de cards: render(), cardDe(), menu do card, abas, seleção múltipla (aba Arquivo).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Seleção múltipla (só na aba Arquivo) ---------- */
let selecao = null;
let ignorarClique = false;
function entrarSelecao(id) {
  if (aba !== "arquivo") return;
  if (!selecao) selecao = new Set();
  selecao.add(id);
  render();
}
function alternarSelecao(id) {
  if (!selecao) return;
  if (selecao.has(id)) selecao.delete(id); else selecao.add(id);
  if (!selecao.size) { sairSelecao(); return; }
  render();
}
function sairSelecao(rerender) {
  selecao = null;
  if (rerender !== false) render();
}
function selecionados() { return selecao ? itens.filter((it) => selecao.has(it.id)) : []; }
function ligarPressao(c, it) {
  let timer = null, x0 = 0, y0 = 0;
  const cancelar = () => { clearTimeout(timer); timer = null; };
  c.addEventListener("pointerdown", (ev) => {
    if (aba !== "arquivo" || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    x0 = ev.clientX; y0 = ev.clientY;
    cancelar();
    timer = setTimeout(() => { timer = null; ignorarClique = true; entrarSelecao(it.id); if (navigator.vibrate) navigator.vibrate(30); }, 500);
  });
  c.addEventListener("pointermove", (ev) => { if (timer && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) cancelar(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => c.addEventListener(t, cancelar));
  c.addEventListener("contextmenu", (ev) => {
    if (aba !== "arquivo") return;
    ev.preventDefault();
    cancelar();
    if (!selecao || !selecao.has(it.id)) entrarSelecao(it.id);
  });
  c.addEventListener("click", (ev) => {
    if (ignorarClique) { ignorarClique = false; ev.preventDefault(); ev.stopPropagation(); return; }
    if (selecao && aba === "arquivo") { ev.preventDefault(); ev.stopPropagation(); alternarSelecao(it.id); }
  }, true);
}
function atualizarBarraSelecao() {
  const bar = $("selBar");
  const on = !!(selecao && aba === "arquivo");
  bar.hidden = !on;
  document.body.classList.toggle("selecionando", on);
  if (on) $("selQtd").textContent = selecao.size + (selecao.size === 1 ? " selecionado" : " selecionados");
  // v2.3.0 (item 3): com cards da Equipe na seleção, o analista não vê Reativar nem Excluir (só o admin)
  const travado = on && !podeAdminEquipe() && selecionados().some(compartilhado);
  $("selReativar").hidden = travado; $("selExcluir").hidden = travado;
  let dica = $("selDica");
  if (travado && !dica) { dica = el("small", "sel-bar__dica"); dica.id = "selDica"; dica.textContent = "🔒 Reativar e excluir cards da Equipe: " + DICA_ADMIN; $("selCancelar").insertAdjacentElement("beforebegin", dica); }
  if (dica) dica.hidden = !travado;
}
/* ---------- Lista ---------- */
function visiveis() {
  const q = (document.getElementById("busca").value || "").trim().toLowerCase();
  // v2.0.0: um card com dado estragado nunca derruba a lista: na dúvida ele aparece (como aviso) em vez de quebrar tudo
  const filtro = (it) => {
    const arq = !!it.arquivado_em;
    if (aba === "equipe" && (it.visibilidade !== "Equipe" || arq)) return false;
    if (aba === "meu" && (it.visibilidade !== "Individual" || arq)) return false;
    if (aba === "vencendo") { let st = ""; try { st = statusDe(it); } catch (e) { st = ""; } if (arq || ["Vencendo", "Vencido"].indexOf(st) < 0) return false; }
    if (aba === "arquivo" && !arq) return false;
    if (aba === "mais" || aba === "gerador" || aba === "gestao") return false;
    const blob = [it.titulo, it.aplicacao, it.cliente, it.usuario, it.url, it.categoria, it.visibilidade, it.escalonamento, resumoEscalonamentos(niveisDe(it))].join(" ").toLowerCase();
    return !q || blob.indexOf(q) >= 0;
  };
  const S = (v) => { try { return String(v == null ? "" : v); } catch (e) { return ""; } };
  return itens.filter((it) => { try { return filtro(it); } catch (e) { return !q && aba !== "mais" && aba !== "gerador" && aba !== "vencendo"; } }).sort((a, b) => S(a.aplicacao || a.titulo).localeCompare(S(b.aplicacao || b.titulo)) || S(a.cliente).localeCompare(S(b.cliente)) || S(a.titulo).localeCompare(S(b.titulo)));
}
function render() {
  const box = document.getElementById("lista");
  box.innerHTML = "";
  fecharMenus();
  if (aba !== "arquivo") selecao = null;
  if (selecao) { const ids = new Set(itens.map((x) => x.id)); selecao.forEach((id) => { if (!ids.has(id)) selecao.delete(id); }); if (!selecao.size) selecao = null; }
  atualizarBarraSelecao();
  box.classList.toggle("modo-sel", !!selecao);
  // v2.0.0: um card com dado estragado nunca derruba a lista (cada card é isolado)
  const nVenc = itens.filter((it) => { try { return !it.arquivado_em && ["Vencendo", "Vencido"].indexOf(statusDe(it)) >= 0; } catch (e) { return false; } }).length;
  document.getElementById("contVenc").textContent = nVenc ? String(nVenc) : "";
  // v2.3.0 (item 11): cards compartilhados esperando você decidir (adicionar em Meus ou ignorar)
  const cm = document.getElementById("contMais");
  if (cm) { let n = 0; try { n = syncEstado.vinculado ? modelosNovos(false).filter(paraMim).length : 0; } catch (e) { n = 0; } cm.textContent = n ? String(n) : ""; cm.title = n ? n + (n === 1 ? " card compartilhado esperando você (Mais › Cards compartilhados)" : " cards compartilhados esperando você (Mais › Cards compartilhados)") : ""; }
  try { aplicarPapelNaTela(); } catch (e) {} // v2.4.0: menus por papel e aba Gestão
  const painel = aba === "mais" || aba === "gerador" || aba === "gestao";
  document.getElementById("buscaWrap").classList.toggle("oculto", painel);
  document.getElementById("novo").classList.toggle("oculto", painel);
  box.classList.toggle("mais", painel);
  if (aba === "mais") { renderMais(box); return; }
  if (aba === "gestao") { renderGestao(box); return; }
  if (aba === "gerador") { renderGerador(box); return; }
  if (aba === "equipe") { try { faixaAvisos(box); } catch (e) { /* aviso é melhor esforço */ } }
  const list = visiveis();
  if (!list.length) {
    box.appendChild(el("p", "vazio", document.getElementById("busca").value ? "Nenhum acesso encontrado para essa busca." : "Nenhum card nesta aba."));
    return;
  }
  const grupos = [];
  list.forEach((it) => {
    let nome = "Sem aplicação"; try { nome = String(it.aplicacao || it.titulo || "Sem aplicação"); } catch (e) {}
    let g = grupos.find((x) => x.nome === nome);
    if (!g) { g = { nome: nome, itens: [] }; grupos.push(g); }
    g.itens.push(it);
  });
  grupos.forEach((g) => {
    const sec = el("section", "grupo");
    const h = el("h2", "grupo-topo");
    h.insertAdjacentHTML("beforeend", svg("folder", 20));
    h.appendChild(el("span", "", g.nome));
    if (g.itens.length > 1) h.appendChild(el("span", "grupo-qtd", g.itens.length + " acessos"));
    sec.appendChild(h);
    g.itens.forEach((it) => { try { sec.appendChild(cardDe(it)); } catch (e) { sec.appendChild(cardComErro(it, e)); } });
    box.appendChild(sec);
  });
}
const cardsComErroLog = new Set();
function cardComErro(it, e) {
  const c = el("article", "card c-ok card-erro"); c.dataset.id = it && it.id || "";
  let nome = "(card com erro)"; try { nome = String((it && (it.titulo || it.aplicacao)) || nome); } catch (x) {}
  c.appendChild(el("h3", "", nome));
  c.appendChild(el("p", "meta", "Este card tem um dado com formato errado e não pôde ser mostrado por completo. Abra e salve de novo para corrigir."));
  const row = el("div", "acoes-mais");
  row.appendChild(btn("btn pequeno", "edit", "Abrir", () => { const x = atual(it); if (x) abrirFicha(x); }));
  c.appendChild(row);
  try { const k = (it && it.id) + "|" + (e && e.message); if (!cardsComErroLog.has(k)) { cardsComErroLog.add(k); registrarErro("mostrar card", String((it && it.id) || ""), e, null); } } catch (x) {}
  return c;
}
function statusBadge(it) {
  const st = statusDe(it);
  const d = diasRestantes(it);
  if (st === "Arquivado") return el("span", "st st-arq", "Arquivado");
  if (st === "Vencido") { const b = el("span", "st st-vencido"); b.insertAdjacentHTML("beforeend", svg("alert", 14)); b.appendChild(el("span", "", "Vencido")); b.title = "Vencido há " + Math.abs(d) + " dia(s)"; return b; }
  if (st === "Vencendo") { const b = el("span", "st st-vencendo"); b.insertAdjacentHTML("beforeend", svg("clock", 14)); b.appendChild(el("span", "", "Vencendo")); b.title = "Vence em " + d + " dia(s)"; return b; }
  if (st === "Sem expiração") return el("span", "st st-ok", "Não expira");
  const b = el("span", "st st-ok"); b.insertAdjacentHTML("beforeend", svg("check", 14)); b.appendChild(el("span", "", "OK")); return b;
}
function linhaSecreta(rotulo, valor, card, tipo) {
  const row = el("div", "linha");
  row.appendChild(el("span", "linha-rot", rotulo));
  const val = el("span", "linha-val secreto", valor ? MASCARA : "—");
  val.dataset.tipo = tipo;
  row.appendChild(val);
  if (valor) {
    const olho = btn("olho", "eye", "", () => alternar(), "Mostrar " + rotulo.toLowerCase());
    function alternar(forcar) {
      const ver = forcar != null ? forcar : !val.classList.contains("aberto");
      val.classList.toggle("aberto", ver);
      val.textContent = ver ? valor : MASCARA;
      olho.innerHTML = svg(ver ? "eyeOff" : "eye", 18);
      olho.setAttribute("aria-label", (ver ? "Ocultar " : "Mostrar ") + rotulo.toLowerCase());
      olho.title = olho.getAttribute("aria-label");
      clearTimeout(alternar._t);
      if (ver) alternar._t = setTimeout(() => { if (val.classList.contains("aberto")) alternar(false); }, OCULTAR_MS);
    }
    row.appendChild(olho);
    card._alternadores = (card._alternadores || []).concat([alternar]);
  } else {
    row.appendChild(el("span", "olho-vazio"));
  }
  return row;
}
function cardDe(it) {
  const st = statusDe(it);
  const c = el("article", "card c-" + ({ Vencendo: "vencendo", Vencido: "vencido", Arquivado: "arq" }[st] || "ok"));
  c.dataset.id = it.id;
  if (aba === "arquivo") {
    ligarPressao(c, it);
    if (selecao) {
      const marcado = selecao.has(it.id);
      c.classList.toggle("selecionado", marcado);
      c.setAttribute("aria-selected", marcado ? "true" : "false");
      const chk = el("span", "sel-check");
      if (marcado) chk.innerHTML = svg("check", 16);
      c.appendChild(chk);
    }
  }
  const topo = el("div", "card-topo");
  const av = el("span", "avatar");
  av.style.background = corDe(it);
  av.innerHTML = svg(it.categoria === "Externo" ? "globe" : "building", 22);
  topo.appendChild(av);
  const tt = el("div", "card-tit");
  tt.appendChild(el("h3", "", it.titulo || it.aplicacao || "(sem título)"));
  const ind = it.visibilidade === "Individual";
  tt.appendChild(el("div", "card-sub", (ind ? "Acesso individual" : "Acesso compartilhado") + (it.cliente ? " · " + it.cliente : "")));
  const tags = el("div", "tags");
  const tv = el("span", "tag " + (ind ? "tag-ind" : "tag-eq"));
  tv.insertAdjacentHTML("beforeend", svg(ind ? "user" : "users", 13));
  tv.appendChild(el("span", "", ind ? "Individual" : "Equipe"));
  tags.appendChild(tv);
  tags.appendChild(el("span", "tag " + (it.categoria === "Externo" ? "tag-ext" : "tag-int"), it.categoria || "Interno"));
  tt.appendChild(tags);
  topo.appendChild(tt);
  const dir = el("div", "card-dir");
  dir.appendChild(statusBadge(it));
  dir.appendChild(btn("ico-mini mais-btn", "more", "", (ev) => abrirMenuCard(it, ev.currentTarget), "Mais ações"));
  topo.appendChild(dir);
  c.appendChild(topo);

  const linhas = el("div", "linhas");
  linhas.appendChild(linhaSecreta("Usuário", it.usuario, c, "usuario"));
  linhas.appendChild(linhaSecreta("Senha", it.senha, c, "senha"));
  const lu = el("div", "linha");
  lu.appendChild(el("span", "linha-rot", "URL"));
  if (it.url) {
    const a = el("a", "linha-val url", it.url.replace(/^https?:\/\//, ""));
    const hu = urlSegura(it.url);
    if (hu) a.href = hu;
    a.target = "_blank"; a.rel = "noopener";
    lu.appendChild(a);
    lu.appendChild(btn("olho", "external", "", () => abrirUrl(it.url), "Abrir URL"));
  } else { lu.appendChild(el("span", "linha-val", "—")); lu.appendChild(el("span", "olho-vazio")); }
  linhas.appendChild(lu);
  const d = diasRestantes(it);
  let info = it.arquivado_em ? "Arquivado em " + it.arquivado_em : (it.ciclo === "Nunca" || !it.ciclo) ? "Ciclo: não expira" : "Ciclo " + it.ciclo + " dias · " + (d < 0 ? "vencido há " + Math.abs(d) + " dia(s)" : "vence em " + d + " dia(s)");
  if (ind && !it.senha && !it.usuario && !it.modeloId) info += " · usuário/senha não compartilhados";
  linhas.appendChild(el("div", "card-info", info));
  if (ind && it.modeloId && !it.usuario && !it.senha) {
    const h = el("div", "mod-hint");
    h.appendChild(el("strong", "", "✏️ Preencha seu login e senha"));
    h.appendChild(el("small", "", "Adicionado do card compartilhado por " + (it.modeloPor || "alguém da equipe")));
    h.appendChild(btn("btn pequeno", "edit", "Editar e preencher", () => abrirFicha(it)));
    linhas.appendChild(h);
  }
  c.appendChild(linhas);

  const niveis = niveisDe(it);
  if (niveis.length || (it.escalonamento && String(it.escalonamento).trim())) {
    const esc = el("div", "esc-bloco");
    const tog = el("button", "esc-toggle");
    tog.type = "button";
    tog.title = "Ver ou esconder os contatos de escalonamento";
    tog.insertAdjacentHTML("beforeend", svg("users", 16));
    tog.appendChild(el("span", "", "Escalonamento" + (niveis.length ? " (" + niveis.length + ")" : "")));
    const chev = el("span", "esc-chev");
    chev.innerHTML = svg("plus", 16);
    tog.appendChild(chev);
    const corpo = el("div", "esc-corpo");
    if (niveis.length) {
      niveis.forEach((nv) => {
        const item = el("div", "esc-item");
        const topoN = el("div", "esc-item-topo");
        topoN.appendChild(el("span", "esc-nivel", "N" + nv.nivel));
        topoN.appendChild(el("span", "esc-canal", canalRotulo(nv.canal)));
        item.appendChild(topoN);
        if (nv.nome) item.appendChild(el("div", "esc-nome", nv.nome));
        const val = el("div", "esc-valor");
        const href = hrefEsc(nv);
        if (href && nv.valor) {
          const a = el("a", "", nv.valor);
          a.href = href;
          if (href.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; }
          val.appendChild(a);
        } else {
          val.textContent = nv.valor || "—";
        }
        item.appendChild(val);
        const meta = [nv.horario, nv.obs].filter(Boolean).join(" · ");
        if (meta) item.appendChild(el("div", "esc-meta", meta));
        corpo.appendChild(item);
      });
    } else {
      corpo.appendChild(el("div", "esc-vazio", it.escalonamento));
    }
    tog.addEventListener("click", (ev) => {
      ev.stopPropagation();
      esc.classList.toggle("aberto");
      chev.innerHTML = svg(esc.classList.contains("aberto") ? "x" : "plus", 16);
    });
    esc.appendChild(tog);
    esc.appendChild(corpo);
    c.appendChild(esc);
  }

  const acoes = el("div", "acoes");
  const bMostrar = btn("acao", "eye", "Mostrar", () => {
    const abrir = !c.classList.contains("revelado");
    c.classList.toggle("revelado", abrir);
    (c._alternadores || []).forEach((f) => f(abrir));
    bMostrar.querySelector("span").textContent = abrir ? "Ocultar" : "Mostrar";
    bMostrar.title = abrir ? "Ocultar usuário e senha" : "Mostrar usuário e senha";
    bMostrar.querySelector("svg").outerHTML = svg(abrir ? "eyeOff" : "eye", 18);
    clearTimeout(c._ocultarT);
    if (abrir) {
      c._ocultarT = setTimeout(() => { if (c.classList.contains("revelado")) bMostrar.click(); }, OCULTAR_MS);
      toast("A senha será ocultada em " + (OCULTAR_MS / 1000) + " s");
    }
  }, null, "Mostrar usuário e senha");
  if (!it.senha && !it.usuario) bMostrar.disabled = true;
  acoes.appendChild(bMostrar);
  const bCop = btn("acao", "copy", "Copiar", () => copiar(it.senha, "Senha"), null, "Copiar a senha");
  if (!it.senha) bCop.disabled = true;
  acoes.appendChild(bCop);
  const bAb = btn("acao", "external", "Abrir", () => abrirUrl(it.url), null, "Abrir a URL em nova aba");
  if (!it.url) bAb.disabled = true;
  acoes.appendChild(bAb);
  c.appendChild(acoes);
  if (ind && !it.arquivado_em && aba !== "arquivo" && (it.modeloDono || podeAdminEquipe())) { // v2.3.0 (item 9): só o admin compartilha
    if (it.modeloDono) c.appendChild(el("div", "mod-compartilhado", "Compartilhado com a equipe (sem login e senha)"));
    else c.appendChild(btn("btn mod-share", "share", "Compartilhar meu card", () => compartilharMeuCard(it), null, "Envia nome, link, sistema, escalonamento e observações para a equipe, sem login e senha"));
  }
  return c;
}
function fecharMenus() { document.querySelectorAll(".menu-card").forEach((m) => m.remove()); }
function abrirMenuCard(it, ancora) {
  const jaAberto = ancora.parentNode.querySelector(".menu-card");
  fecharMenus();
  if (jaAberto) return;
  const m = el("div", "menu-card");
  m.setAttribute("role", "menu");
  const id = it.id;
  const cur = (fn) => () => { fecharMenus(); const c = atual({ id: id }); if (!c) { toast("Este card não existe mais"); render(); return; } fn(c); };
  m.appendChild(btn("mi", "edit", "Editar", cur((c) => abrirFicha(c)), null, "Editar este acesso"));
  m.appendChild(btn("mi", "copy", "Copiar usuário", cur((c) => copiar(c.usuario, "Usuário"))));
  if (it.visibilidade === "Individual" && !it.arquivado_em) {
    if (it.modeloDono) m.appendChild(btn("mi", "x", "Parar de compartilhar", () => { fecharMenus(); pararCompartilhar(atual(it) || it); }));
    else if (podeAdminEquipe()) m.appendChild(btn("mi", "share", "Compartilhar meu card", cur((c) => compartilharMeuCard(c))));
  }
  if (it.arquivado_em && compartilhado(it) && !podeAdminEquipe()) m.appendChild(el("p", "mi-dica", "🔒 Reativar e excluir: " + DICA_ADMIN));
  else if (it.arquivado_em) {
    m.appendChild(btn("mi ok", "restore", "Reativar", cur((c) => { c.arquivado_em = null; save(); toast("Card reativado"); avisarDuplicadosReativados([c]); })));
    m.appendChild(btn("mi warn", "trash", "Excluir", cur((c) => excluir([c]))));
  }
  else if (compartilhado(it) && !podeAdminEquipe()) m.appendChild(el("p", "mi-dica", "🔒 Arquivar: " + DICA_ADMIN)); // v2.3.0 (item 8)
  else m.appendChild(btn("mi warn", "archive", "Arquivar", cur((c) => { c.arquivado_em = hoje(); save(); toast("Card arquivado"); })));
  ancora.parentNode.appendChild(m);
}
