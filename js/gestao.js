/* Caderno de Acessos — js/gestao.js (v2.4.0)
 * Aba "Gestão" (só no modo Administrador): pessoas (cards com iniciais, perfil e situação), Novo analista, ações por pessoa
 * (Resetar senha, Desbloquear, Tornar/Remover administrador, Desativar/Reativar, Renomear) e o bloco "Equipe" (arquivo e senha da
 * equipe, Novo fornecedor da equipe, Exportar/Importar da equipe, Excel da equipe, Histórico).
 * Senha pessoal do analista (PBKDF2, só o hash, dentro do arquivo cifrado): confirmação ao escolher o perfil, troca obrigatória da
 * senha temporária, bloqueio depois de 5 erros. Regras de tela por papel (Mais enxuto e menus do topo do analista).
 * Todo diálogo novo usa o padrão da tela "Crie sua senha" (.dlg-senha: título azul, rótulo + campo com olho, aviso laranja,
 * regras, Cancelar contornado e Salvar azul-escuro).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const REGRAS_SENHA = "A senha precisa ter: no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.";
/* ---------- Diálogo padrão (o mesmo da tela "Crie sua senha") ---------- */
function dlgPadrao(box, titulo, texto) {
  box.classList.add("dlg-senha", "dlg-padrao");
  box.appendChild(el("h3", "", titulo));
  if (texto) box.appendChild(el("p", "dlg-padrao__texto", texto));
}
function campoPadrao(box, id, rot, o) {
  o = o || {};
  const l = el("label", "dlg-padrao__rotulo"); l.appendChild(document.createTextNode(rot));
  const w = el("span", "senha-campo");
  const i = el("input"); i.id = id; i.type = o.senha ? "password" : "text"; i.autocomplete = o.auto || "off"; i.spellcheck = false;
  if (o.valor) i.value = o.valor; if (o.placeholder) i.placeholder = o.placeholder; if (o.max) i.maxLength = o.max;
  w.appendChild(i);
  if (o.senha) { const b = el("button", "olho"); b.type = "button"; b.dataset.alvo = id; b.setAttribute("aria-label", "Mostrar senha"); b.dataset.ic = "eye"; w.appendChild(b); setTimeout(() => ligarOlho(b), 0); }
  if (o.copiar) { const c = el("button", "btn-copiar"); c.type = "button"; c.id = id + "Copiar"; c.textContent = "Copiar"; c.setAttribute("aria-label", "Copiar a senha temporária"); c.addEventListener("click", () => copiarTexto(i.value, c)); w.appendChild(c); w.classList.add("senha-campo--copiar"); } // v2.5.1 (item 7)
  l.appendChild(w); box.appendChild(l);
  return i;
}
function selectPadrao(box, id, rot, opcoes) {
  const l = el("label", "dlg-padrao__rotulo"); l.appendChild(document.createTextNode(rot));
  const s = el("select", "dlg-padrao__select"); s.id = id;
  opcoes.forEach(([v, t]) => { const o = el("option", "", t); o.value = v; s.appendChild(o); });
  l.appendChild(s); box.appendChild(l); return s;
}
/* v2.5.1 (item 7): copia com a Clipboard API; sem ela (http, navegador antigo), usa um campo oculto + execCommand. Feedback curto "Copiado". */
async function copiarTexto(txt, botao) {
  let ok = false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); ok = true; } } catch (e) { ok = false; }
  if (!ok) {
    const t = document.createElement("textarea"); t.value = txt; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0"; t.style.top = "0";
    document.body.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (e) { ok = false; } t.remove();
  }
  if (botao) { const antes = "Copiar"; botao.textContent = ok ? "Copiado" : "Não copiou"; botao.classList.toggle("copiado", ok); clearTimeout(botao._t); botao._t = setTimeout(() => { botao.textContent = antes; botao.classList.remove("copiado"); }, 1800); }
  return ok;
}
function avisoPadrao(box, txt) { const p = el("p", "aviso-forte", txt); box.appendChild(p); return p; }
function regrasPadrao(box, txt) { const p = el("p", "hint", txt || REGRAS_SENHA); box.appendChild(p); return p; }
function erroPadrao(box) { const p = el("p", "erro-form"); p.setAttribute("role", "alert"); box.appendChild(p); return p; }
function botoesPadrao(box, cancelar, salvar, fnCancelar, fnSalvar) {
  const bb = el("div", "dlg-botoes");
  const c = botaoDlg("", cancelar, fnCancelar); bb.appendChild(c);
  const s = salvar ? botaoDlg("pri", salvar, fnSalvar) : null; if (s) bb.appendChild(s); else c.classList.add("dlg-padrao__unico");
  box.appendChild(bb); return s;
}
function gerarSenhaTemporaria() {
  const G = "ABCDEFGHJKLMNPQRSTUVWXYZ", P = "abcdefghijkmnpqrstuvwxyz", D = "23456789", S = "#@!$%&*?";
  const r = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const a = [r(G), r(G), r(P), r(P), r(P), r(P), r(P), r(D), r(D), r(D), r(S), r(P)];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a.join("");
}
async function hashPessoal(senha) { const salt = saltAleatorio(); return { senhaHash: await derivarSenha(senha, salt, PERFIS_ITER), senhaSalt: salt, senhaIter: PERFIS_ITER }; }
/* ---------- Papel na tela ---------- */
function comPerfis() { return perfisAtivos() || perfisNoArquivo(); }
/* Arquivos da equipe (Exportar JSON da equipe, Importar para a Equipe, Excel da equipe): sem perfis, todos; com perfis, só o Administrador. */
function podeArquivosEquipe() { const p = papelAtual(); return p === "livre" || p === "admin"; }
/* Excel: o analista só leva os próprios cards (Meus). */
function itensExportaveis() { return podeArquivosEquipe() ? itens : itens.filter((x) => !compartilhado(x)); }
function negarArquivosEquipe(o) { toast("Só o Administrador " + (o || "exporta os dados da equipe") + " (Gestão › Equipe)."); return false; }
/* Menus do topo e do menu lateral: o analista não vê as opções da equipe. */
function aplicarPapelNaTela() {
  const so = !podeArquivosEquipe();
  document.querySelectorAll("[data-so-equipe]").forEach((x) => { x.hidden = so; });
  const imp = $("dImport"); if (imp) { imp.textContent = so ? "Importar backup" : "Importar JSON"; imp.title = so ? "Juntar os cards de um backup pessoal em Meus" : "Juntar os cards de um arquivo JSON"; }
  const di = document.querySelector('.dr-item[data-acao="importar"] .dr-rot'); if (di) di.textContent = so ? "Importar backup (Meus)" : "Importar JSON";
  const nota = $("excelNota"); if (nota) nota.textContent = so ? "Só os seus cards (Meus). Senhas individuais saem em branco." : "Senhas individuais saem em branco.";
  const restr = typeof analistaPuro === "function" && analistaPuro(); // v3.0.2 (item 6): analista não cria card
  ["dNovo", "novo"].forEach((i) => { const b = $(i); if (b) b.hidden = restr; });
  document.querySelectorAll('[data-acao="novo"]').forEach((x) => { x.hidden = restr; });
  const dn = $("drExcelNota"); if (dn) dn.textContent = so ? "Excel: só os seus cards (Meus). Senhas individuais saem em branco." : "Senhas individuais saem em branco.";
}
/* ---------- Senha pessoal do analista ---------- */
function tentativasDe(id) { return (lerJSON(TENTATIVAS_KEY, {})[id]) || 0; }
function gravarTentativas(id, n) { const o = lerJSON(TENTATIVAS_KEY, {}); if (n) o[id] = n; else delete o[id]; Dados.gravarTexto(TENTATIVAS_KEY, JSON.stringify(o)); }
function confirmarSenhaPessoal(p0) {
  const p = lerPerfis().find((x) => x.id === p0.id) || p0;
  if (p.bloqueado) return aviso("Conta bloqueada", "A conta de " + p.nome + " foi bloqueada depois de " + MAX_TENTATIVAS + " senhas erradas. Peça ao Administrador para desbloquear.").then(() => false);
  if (!p.ativo) return aviso("Perfil desativado", "O perfil de " + p.nome + " está desativado. Fale com o Administrador.").then(() => false);
  if (!p.senhaSalt) return aviso("Primeiro acesso", "O Administrador ainda não definiu a sua senha temporária. Peça para ele em Gestão › " + p.nome + " › Resetar senha. Depois sincronize e escolha o seu nome de novo. Até lá você usa como analista, sem nome.").then(() => false);
  return janela("dlgPerfis", (box, fim) => {
    const etapa1 = () => {
      box.textContent = ""; box.className = "dlg dlg-mod";
      dlgPadrao(box, "Digite a sua senha", "Para usar o perfil " + p.nome + " neste aparelho, digite a sua senha pessoal (é a que o Administrador passou, se for o primeiro acesso).");
      const s = campoPadrao(box, "pesSenha", "Senha pessoal", { senha: true, auto: "current-password" });
      regrasPadrao(box, "Depois de " + MAX_TENTATIVAS + " senhas erradas a conta é bloqueada e só o Administrador desbloqueia.");
      const er = erroPadrao(box);
      const ok = botoesPadrao(box, "Cancelar", "Entrar", () => fim(false), async () => {
        er.textContent = ""; ok.disabled = true;
        try {
          const c = (await perfisCompletos()).find((x) => x.id === p.id);
          if (!c || !c.senhaHash) { er.textContent = "A sua senha ainda não chegou neste aparelho. Sincronize e tente de novo."; return; }
          if (c.bloqueado) { er.textContent = "Conta bloqueada. Peça ao Administrador para desbloquear."; return; }
          const h = await derivarSenha(s.value, c.senhaSalt, c.senhaIter || PERFIS_ITER);
          if (!hashIguais(h, c.senhaHash)) {
            const n = tentativasDe(p.id) + 1;
            if (n >= MAX_TENTATIVAS) {
              gravarTentativas(p.id, 0);
              await alterarPerfil(p.id, { bloqueado: true }, "Conta bloqueada por " + MAX_TENTATIVAS + " senhas erradas: " + p.nome);
              er.textContent = "Conta bloqueada depois de " + MAX_TENTATIVAS + " senhas erradas. Peça ao Administrador para desbloquear.";
              s.disabled = true; ok.hidden = true; return;
            }
            gravarTentativas(p.id, n);
            er.textContent = "Senha incorreta. Restam " + (MAX_TENTATIVAS - n) + " tentativa(s)."; s.select(); return;
          }
          gravarTentativas(p.id, 0); s.value = "";
          if (c.senhaTemp) { etapa2(c); return; }
          concluir(c);
        } catch (e) { er.textContent = "Não foi possível conferir a senha (" + ((e && e.name) || "erro") + ")."; }
        finally { ok.disabled = false; }
      });
      setTimeout(() => s.focus(), 60);
    };
    const etapa2 = (c) => {
      box.textContent = ""; box.className = "dlg dlg-mod";
      dlgPadrao(box, "Crie sua senha", p.nome + ", a senha que o Administrador passou é temporária. Crie a sua senha pessoal agora.");
      const s1 = campoPadrao(box, "pesNova", "Nova senha", { senha: true, auto: "new-password", placeholder: "Nova senha" });
      const s2 = campoPadrao(box, "pesConf", "Confirmar nova", { senha: true, auto: "new-password", placeholder: "Repita a nova senha" });
      avisoPadrao(box, "Por segurança, troque a senha temporária antes de continuar. Ela deixa de funcionar depois disso.");
      regrasPadrao(box, "A nova senha precisa ter: no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial. Não use a senha de login nem a da equipe.");
      const er = erroPadrao(box);
      const ok = botoesPadrao(box, "Sair", "Salvar", () => fim(false), async () => {
        er.textContent = "";
        if (!senhaForte(s1.value)) { er.textContent = REGRAS_SENHA; return; }
        if (s1.value !== s2.value) { er.textContent = "As duas senhas não são iguais."; return; }
        ok.disabled = true;
        try {
          const np = await alterarPerfil(c.id, Object.assign(await hashPessoal(s1.value), { senhaTemp: false }), "Senha pessoal criada: " + c.nome);
          s1.value = s2.value = "";
          if (np) concluir(np);
        } finally { ok.disabled = false; }
      });
      setTimeout(() => s1.focus(), 60);
    };
    const concluir = (c) => {
      const atual = lerPerfis().find((x) => x.id === c.id) || c;
      if (modoAdmin) sairModoAdmin(true);
      Dados.gravarTexto(PERFIL_ID_KEY, c.id); Dados.gravarTexto(PESSOAL_CONF_KEY, c.id + "|" + (atual.senhaSalt || ""));
      Dados.gravarTexto(AUTOR_KEY, c.nome);
      histPerfil("Perfil confirmado com a senha pessoal: " + c.nome);
      fim(true); toast("Você entrou como " + c.nome); render();
    };
    etapa1();
  });
}
/* ---------- Aba Gestão ---------- */
function iniciais(n) { const p = String(n || "").trim().split(/\s+/).filter(Boolean); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); }
function situacaoDe(p) { return !p.ativo ? "desativado" : p.bloqueado ? "bloqueado" : "ativo"; }
function abrirGestao() {
  if (papelAtual() !== "admin") { toast("Entre como administrador para abrir a Gestão"); return Promise.resolve(false); }
  irPara("adm-pessoas"); return Promise.resolve(true);
}
function renderGestao(box) {
  if (papelAtual() !== "admin") { aba = "equipe"; render(); return; }
  const c = el("article", "card painel-mais gestao"); c.id = "blocoGestao";
  c.appendChild(el("h3", "", "Pessoas"));
  c.appendChild(el("p", "meta", "Só o Administrador vê esta aba. Toque numa pessoa para resetar a senha, desbloquear, mudar o perfil ou desativar."));
  const l = lerPerfis(), adm = adminsAtivos(l);
  if (adm.length === 1) c.appendChild(el("p", "aviso-forte perfis-um-admin", "Recomendado: ter 2 Administradores. Hoje só " + adm[0].nome + " é Administrador."));
  const sem = l.filter((p) => p.ativo && p.papel !== "admin" && !p.senhaSalt);
  if (sem.length) c.appendChild(el("p", "aviso-forte gestao__sem-senha", sem.length + " analista(s) ainda sem senha pessoal (vindos da v2.3.0): " + sem.map((p) => p.nome).join(", ") + ". Toque na pessoa › Resetar senha para definir a senha temporária do primeiro acesso."));
  avisosVersaoAntiga().forEach((nome) => c.appendChild(el("p", "aviso-forte perfis-antigo", nome + " ainda está numa versão antiga (não respeita as permissões). Peça para atualizar.")));
  const row = el("div", "acoes-mais");
  row.appendChild(btn("btn pri", "plus", "Novo analista", novoAnalista));
  row.appendChild(btn("btn", "x", "Sair do modo Administrador", () => sairModoAdmin(false)));
  c.appendChild(row);
  const ul = el("ul", "gestao-pessoas");
  l.forEach((p) => {
    const li = el("li", "gestao-pessoas__item");
    const b = el("button", "gestao-pessoa gestao-pessoa--" + situacaoDe(p)); b.type = "button"; b.dataset.id = p.id;
    b.appendChild(el("span", "gestao-pessoa__avatar", iniciais(p.nome)));
    const tx = el("span", "gestao-pessoa__info");
    tx.appendChild(el("b", "gestao-pessoa__nome", p.nome));
    tx.appendChild(el("span", "gestao-pessoa__perfil", p.papel === "admin" ? "Administrador" : "Analista"));
    const sub = [];
    if (p.papel !== "admin") sub.push(!p.senhaSalt ? "sem senha pessoal" : p.senhaTemp ? "senha temporária" : "senha própria");
    else if (p.trocarSenha) sub.push("senha temporária");
    sub.push("último acesso: " + (p.ultimoAcesso ? dataHoraBR(p.ultimoAcesso) : "—") + (p.versao ? " · v" + p.versao : ""));
    tx.appendChild(el("small", "gestao-pessoa__sub", sub.join(" · ")));
    b.appendChild(tx);
    b.appendChild(el("span", "gestao-pessoa__selo gestao-pessoa__selo--" + situacaoDe(p), situacaoDe(p)));
    b.addEventListener("click", () => acoesPessoa(p.id));
    li.appendChild(b); ul.appendChild(li);
  });
  c.appendChild(ul);
  box.appendChild(c);
  // Bloco Equipe: o que saiu do Mais do analista
  const e = el("article", "card painel-mais gestao-equipe"); e.id = "blocoGestaoEquipe";
  e.appendChild(el("h3", "", "Equipe"));
  e.appendChild(el("p", "meta", "Cards e arquivos da equipe. Os arquivos exportados levam as senhas da Equipe em texto aberto: guarde em lugar seguro e não envie por e-mail nem por chat."));
  const r2 = el("div", "acoes-mais");
  r2.appendChild(btn("btn pri", "plus", "Novo fornecedor da equipe", novoFornecedorEquipe));
  r2.appendChild(btn("btn", "download", "Exportar JSON da equipe", exportarEquipe));
  r2.appendChild(btn("btn", "upload", "Importar para a Equipe (JSON)", () => $("imp").click()));
  r2.appendChild(btn("btn", "table", "Importar planilha para a Equipe", escolherPlanilha));
  r2.appendChild(btn("btn", "table", "Excel da equipe (para importar)", exportarExcelImportar));
  r2.appendChild(btn("btn", "book", "Excel da equipe (para consulta)", exportarExcelConsulta));
  e.appendChild(r2);
  box.appendChild(e);
  const bloco = (titulo, texto, botoes) => {
    const k = el("article", "card painel-mais"); k.appendChild(el("h3", "", titulo)); k.appendChild(el("p", "meta", texto));
    const rr = el("div", "acoes-mais"); botoes.forEach((x) => rr.appendChild(x)); k.appendChild(rr); box.appendChild(k);
  };
  blocoArquivoEquipe(box, bloco, "gestao");
  box.appendChild(el("p", "meta gestao__nota", textoHonestoPerfis()));
}
function novoFornecedorEquipe() {
  if (papelAtual() !== "admin") { toast(DICA_ADMIN + " (cards da Equipe)."); return; }
  abrirFicha(null);
  const v = $("fVisibilidade"); if (v) { v.value = "Equipe"; $("avisoInd").hidden = true; if (edit) edit.visibilidade = "Equipe"; }
  $("fichaTitulo").textContent = "Novo fornecedor da equipe";
}
function novoAnalista() {
  if (papelAtual() !== "admin") { toast("Só o Administrador cadastra pessoas"); return Promise.resolve(false); }
  return janela("dlgPerfis", (box, fim) => {
    dlgPadrao(box, "Novo analista", "Cadastre a pessoa e passe a senha temporária pessoalmente, nunca por e-mail ou chat.");
    const nome = campoPadrao(box, "gNome", "Nome", { placeholder: "Nome do colaborador", max: 40, auto: "off" });
    const mat = campoPadrao(box, "gMatricula", "Matrícula", { placeholder: "Ex.: 1234567", max: 20, auto: "off" });
    mat.addEventListener("input", () => { mat.value = mat.value.toUpperCase(); });
    const perfil = selectPadrao(box, "gPerfil", "Perfil", [["analista", "Analista"], ["admin", "Administrador"]]);
    const s = campoPadrao(box, "gSenha", "Senha temporária", { senha: true, valor: gerarSenhaTemporaria(), auto: "new-password", copiar: true });
    const av = avisoPadrao(box, "O analista troca a senha no primeiro acesso.");
    perfil.addEventListener("change", () => { av.textContent = perfil.value === "admin" ? "O Administrador troca a senha no primeiro acesso." : "O analista troca a senha no primeiro acesso."; });
    regrasPadrao(box);
    const er = erroPadrao(box);
    const ok = botoesPadrao(box, "Cancelar", "Salvar", () => fim(false), async () => {
      er.textContent = "";
      const v = nome.value.trim();
      if (!v) { er.textContent = "Digite o nome."; nome.focus(); return; }
      if (perfilPorNome(v)) { er.textContent = "Já existe um perfil com esse nome."; return; }
      const m = normMat(mat.value);
      if (!matriculaValida(m)) { er.textContent = "Matrícula: só números, de 6 ou 7 dígitos."; mat.focus(); return; }
      if (matriculaEmUso(m, "")) { er.textContent = "Essa matrícula já é de outra pessoa."; mat.focus(); return; }
      if (!senhaForte(s.value)) { er.textContent = REGRAS_SENHA; return; }
      ok.disabled = true;
      try {
        const agora = new Date().toISOString(), eu = autor();
        const p = { id: novoIdPerfil(), nome: v, papel: perfil.value === "admin" ? "admin" : "analista", ativo: true, matricula: m, criadoPor: eu, criadoEm: agora, updatedAt: agora, updatedBy: eu };
        if (p.papel === "admin") Object.assign(p, await hashAdmin(s.value), await gerarChavesAdmin(s.value), { trocarSenha: true });
        else Object.assign(p, await hashPessoal(s.value), { senhaTemp: true });
        await assinarPerfil(p);
        const l = await perfisCompletos(); l.push(p);
        if (p.papel === "admin" && p.chavePub) { const pn = pinsChaves(); pn[p.id] = p.chavePub; Dados.gravarTexto(CHAVES_PIN_KEY, JSON.stringify(pn)); }
        await gravarPerfis(l);
        histPerfil((p.papel === "admin" ? "Administrador cadastrado: " : "Analista cadastrado: ") + v);
        s.value = ""; fim(true); agendarSync(); render();
        toast(v + " cadastrado(a) com senha temporária");
      } catch (e) { er.textContent = "Não foi possível cadastrar (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
    setTimeout(() => nome.focus(), 60);
  });
}
function acoesPessoa(id) {
  const p = lerPerfis().find((x) => x.id === id); if (!p) return Promise.resolve(false);
  const adm = adminsAtivos(), ultimoAdmin = p.papel === "admin" && p.ativo && adm.length <= 1, eu = meuPerfil();
  return janela("dlgPerfis", (box, fim) => {
    dlgPadrao(box, p.nome, (p.papel === "admin" ? "Administrador" : "Analista") + " · " + situacaoDe(p) + " · último acesso: " + (p.ultimoAcesso ? dataHoraBR(p.ultimoAcesso) : "—"));
    box.classList.add("gestao-acoes");
    const lista = el("div", "gestao-acoes__lista"); box.appendChild(lista);
    const acao = (rot, fn, o) => { const b = botaoDlg(o && o.perigo ? "perigo" : "", rot, async () => { fim(true); await fn(); render(); }); b.dataset.acao = o && o.id || ""; if (o && o.off) { b.disabled = true; b.title = o.off; } lista.appendChild(b); return b; };
    const souEu = eu && eu.id === p.id;
    acao("Resetar senha", () => resetarSenha(p), { id: "resetar", off: souEu ? "Para trocar a sua senha, use Entrar como administrador" : "" });
    if (p.bloqueado) acao("Desbloquear", async () => { gravarTentativas(p.id, 0); await alterarPerfil(p.id, { bloqueado: false }, "Conta desbloqueada: " + p.nome); toast(p.nome + " desbloqueado(a)"); }, { id: "desbloquear" });
    if (p.papel !== "admin" && p.ativo) acao("Tornar administrador", () => tornarAdmin(p), { id: "tornar" });
    if (p.papel === "admin") acao("Remover administrador", () => removerAdmin(p), { id: "remover", off: ultimoAdmin ? "Não dá para remover o último Administrador" : "" });
    if (p.ativo) acao("Desativar", () => confirmarAcao("Desativar " + p.nome + "?", "Nos cards da Equipe, " + p.nome + " fica só leitura. Pode ser reativado depois.", "Desativar", () => alterarPerfil(p.id, { ativo: false }, "Perfil desativado: " + p.nome)), { id: "desativar", perigo: true, off: ultimoAdmin ? "Não dá para desativar o último Administrador" : "" });
    else acao("Reativar", () => alterarPerfil(p.id, { ativo: true }, "Perfil reativado: " + p.nome), { id: "reativar" });
    acao("Renomear", async () => { const v = await pedirTexto("Renomear " + p.nome, "Novo nome", p.nome); if (v && v !== p.nome) { if (perfilPorNome(v) && perfilPorNome(v).id !== p.id) toast("Já existe um perfil com esse nome"); else await alterarPerfil(p.id, { nome: v }, "Perfil renomeado: " + p.nome + " → " + v); } }, { id: "renomear" });
    botoesPadrao(box, "Fechar", null, () => fim(false));
  });
}
function confirmarAcao(titulo, texto, rotOk, fn) {
  return janela("dlgSE", (box, fim) => {
    dlgPadrao(box, titulo, texto);
    const ok = botoesPadrao(box, "Cancelar", rotOk, () => fim(false), async () => { ok.disabled = true; try { await fn(); } finally { fim(true); } });
  });
}
function resetarSenha(p) {
  return janela("dlgSE", (box, fim) => {
    dlgPadrao(box, "Resetar senha de " + p.nome, "A senha atual de " + p.nome + " deixa de valer, a conta é desbloqueada e os aparelhos de " + p.nome + " pedem a senha de novo.");
    const s = campoPadrao(box, "gResetSenha", "Senha temporária", { senha: true, valor: gerarSenhaTemporaria(), auto: "new-password", copiar: true });
    avisoPadrao(box, (p.papel === "admin" ? "O Administrador troca a senha no primeiro acesso." : "O analista troca a senha no primeiro acesso.") + " Passe a senha pessoalmente, nunca por e-mail ou chat.");
    regrasPadrao(box);
    const er = erroPadrao(box);
    const ok = botoesPadrao(box, "Cancelar", "Salvar", () => fim(false), async () => {
      er.textContent = ""; if (!senhaForte(s.value)) { er.textContent = REGRAS_SENHA; return; }
      ok.disabled = true;
      try {
        const mud = p.papel === "admin" ? Object.assign(await hashAdmin(s.value), await gerarChavesAdmin(s.value), { trocarSenha: true, bloqueado: false }) : Object.assign(await hashPessoal(s.value), { senhaTemp: true, bloqueado: false });
        gravarTentativas(p.id, 0);
        if (typeof limparBloqueioPendente === "function") limparBloqueioPendente(p.id); // v2.5.2 (item 2)
        await alterarPerfil(p.id, mud, "Senha resetada (temporária): " + p.nome);
        s.value = ""; fim(true); toast("Senha de " + p.nome + " resetada (temporária)");
      } catch (e) { er.textContent = "Não foi possível resetar (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
  });
}
async function removerAdmin(p) {
  if (adminsAtivos().length <= 1 && p.ativo) { toast("Não dá para remover o último Administrador"); return; }
  await confirmarAcao("Remover administrador de " + p.nome + "?", p.nome + " passa a ser analista. Para entrar como analista, " + p.nome + " vai precisar de uma senha pessoal (Resetar senha).", "Remover", async () => {
    await alterarPerfil(p.id, { papel: "analista", trocarSenha: false }, "Administrador removido: " + p.nome);
    if (p.id === (meuPerfil() || {}).id) sairModoAdmin(true);
  });
}
