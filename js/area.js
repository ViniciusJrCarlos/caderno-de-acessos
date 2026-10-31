/* Caderno de Acessos — js/area.js (v2.5.0)
 * Casca nova (marinho): barra lateral no computador e barra de baixo no celular, botão da conta ("Administrador ▾" / "Nome ▾"),
 * status da sincronização, área do Administrador (Pessoas, Perfis, Logs, Configurações, Novidades) e a página "Arquivo e backup"
 * do analista. Login por matrícula + senha pessoal (o papel de Administrador vem do perfil), troca da senha temporária na própria
 * tela de entrada, "Trocar minha senha", receber no celular o arquivo que o Administrador envia (só leitura, mesmas regras da
 * sincronização) e gerar esse arquivo no computador do Administrador.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const ABAS_CARDS = ["equipe", "meu", "vencendo", "arquivo", "gerador"];
const ABAS_ADMIN = ["adm-pessoas", "adm-perfis", "adm-logs", "adm-config", "adm-novidades"];
let sessaoPapel = "";               // v2.5.1 (item 1): papel com que a sessão entrou
let sessaoPerfilId = null;           // perfil que entrou por matrícula nesta aba (null: aparelho sem perfis, senha do aparelho)
let loginPendente = null;            // { c: perfil completo, senha } enquanto cria a senha nova (senha temporária)
let tentativasLoginAdmin = 0, esperaLoginAte = 0;
function emAreaAdmin() { return ABAS_ADMIN.indexOf(aba) >= 0; }
function emPainel() { return aba === "gerador" || aba === "conta-arquivo" || emAreaAdmin(); }
function normMat(v) { return String(v || "").trim().toUpperCase(); }
/* ---------- Navegação ---------- */
function irPara(a) {
  if (ABAS_ADMIN.indexOf(a) >= 0 && !podeAdminEquipe()) { toast("Só o Administrador abre esta área"); a = "equipe"; }
  aba = a;
  fecharContaMenu();
  render();
  window.scrollTo(0, 0);
}
function aplicarShell() {
  if (emAreaAdmin() && !podeAdminEquipe()) aba = "equipe";
  const area = emAreaAdmin();
  const b = document.body;
  b.classList.toggle("area-admin", area);
  b.classList.toggle("pode-admin", podeAdminEquipe());
  const so = window.CadernoSync ? syncSoLeitura() : false;
  b.classList.toggle("so-leitura", so);
  document.querySelectorAll("#abas [data-aba]").forEach((x) => { const on = x.dataset.aba === aba; x.classList.toggle("on", on); if (on) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
  const na = $("navArea"); if (na) na.hidden = !podeAdminEquipe();
  const chip = $("chipSoVer"); if (chip) chip.hidden = !(so && aba === "equipe");
  desenharConta();
  desenharStatusSync();
}
function textoSync() {
  if (!window.CadernoSync) return { t: "Só neste aparelho", s: "" };
  const so = syncSoLeitura();
  const sub = so ? "Só recebe da equipe" : syncEstado.vinculado ? "Envia e recebe da equipe" : "";
  if (syncEstado.rodando) return { t: "Sincronizando…", s: sub };
  const ult = syncMeta().ultimaSync;
  if (!syncEstado.vinculado) return { t: ult ? "Recebido " + quandoRelativo(ult) : "Sem arquivo da equipe", s: so ? sub : "Só neste aparelho" };
  if (syncEstado.pendente) return { t: "Sincronização pendente", s: sub };
  return { t: ult ? "Sincronizado " + quandoRelativo(ult) : "Ainda não sincronizado", s: sub };
}
function quandoRelativo(iso) {
  const d = Date.now() - new Date(iso).getTime(); if (isNaN(d)) return "";
  const m = Math.floor(d / 60000);
  if (m < 1) return "agora";
  if (m < 60) return "há " + m + " min";
  const h = Math.floor(m / 60); if (h < 24) return "há " + h + " h";
  return "em " + dataHoraBR(iso);
}
function desenharStatusSync() {
  const x = textoSync();
  const a = $("navSync"), s = $("navSyncSub"), t = $("syncTopo");
  if (a) a.textContent = x.t; if (s) { s.textContent = x.s; s.hidden = !x.s; }
  if (t) t.textContent = x.t + (x.s && syncSoLeitura() ? " · " + x.s : "");
  const r = $("navRodape"); if (r) r.classList.toggle("pendente", !!(syncEstado && syncEstado.pendente));
}
setInterval(() => { try { if (!document.body.classList.contains("travado")) desenharStatusSync(); } catch (e) {} }, 30000);
/* ---------- Conta ---------- */
function nomeConta() {
  const p = perfisAtivos() ? meuPerfil() : null;
  if (modoAdmin && p) return "Administrador";
  if (p) return p.nome.split(/\s+/)[0];
  if (papelAtual() === "livre") return autor() ? autor().split(/\s+/)[0] : "Administrador";
  return autor() ? autor().split(/\s+/)[0] : "Analista";
}
function desenharConta() {
  const n = $("contaNome"); if (!n) return;
  n.textContent = nomeConta();
  const p = perfisAtivos() ? meuPerfil() : null;
  $("contaAv").textContent = iniciais(p ? p.nome : (autor() || nomeConta()));
}
function fecharContaMenu() { const m = $("contaMenu"); if (m && !m.hidden) { m.hidden = true; $("btnConta").setAttribute("aria-expanded", "false"); } }
function abrirContaMenu() {
  const m = $("contaMenu"); if (!m) return;
  if (!m.hidden) { fecharContaMenu(); return; }
  m.textContent = "";
  const p = perfisAtivos() ? meuPerfil() : null;
  const topo = el("div", "conta-menu__topo");
  topo.appendChild(el("b", "", p ? p.nome : (autor() || "Este aparelho")));
  topo.appendChild(el("small", "", p ? (modoAdmin && p.papel === "admin" ? "Administrador" : p.papel === "admin" ? "Administrador (sem modo admin)" : "Analista") + (p.matricula ? " · Matrícula " + p.matricula : "") : papelAtual() === "livre" ? "Sem perfis configurados" : "Analista"));
  m.appendChild(topo);
  const item = (ic, txt, fn, id) => { const b = btn("conta-menu__item", ic, txt, () => { fecharContaMenu(); fn(); }); b.setAttribute("role", "menuitem"); if (id) b.dataset.item = id; m.appendChild(b); return b; };
  if (podeAdminEquipe()) {
    if (emAreaAdmin()) item("folder", "Voltar aos cards", () => irPara("equipe"), "cards");
    else item("lock", "Área do administrador", () => irPara("adm-pessoas"), "area");
    item("share", "Selecionar e enviar", selecionarEEnviar, "enviar"); // v3.0.0 (item 2)
  }
  if (p) item("user", "Meu perfil", abrirMeuPerfil, "perfil");
  if (!podeAdminEquipe()) item("folder", "Arquivo e backup", () => irPara("conta-arquivo"), "arquivo");
  item("palette", "Tema: " + TEMAS[temaAtual()].nome, abrirTemaDlg, "tema");
  item("clock", "Bloqueio automático: " + (minutosBloqueio() ? minutosBloqueio() + " min" : "Nunca"), abrirBloqueioDlg, "bloqueio");
  item("download", appJaInstalado() ? "App instalado" : "Instalar app", () => abrirInstalar(true), "instalar");
  item("key", "Trocar minha senha", trocarMinhaSenha, "senha");
  item("info", "Sobre", abrirSobre, "sobre");
  item("logout", "Sair", sair, "sair");
  aplicarIcones(m);
  m.hidden = false; $("btnConta").setAttribute("aria-expanded", "true");
  setTimeout(() => { const f = m.querySelector("button"); if (f) f.focus(); }, 20);
}
function abrirSobre() {
  const box = $("sobreNovidades");
  if (box) {
    box.textContent = "";
    NOVIDADES.slice(0, 6).forEach((n, i) => {
      const d = el("div", "nv-l");
      const t = el("div", "nv-v", "v" + n.v + " "); t.appendChild(el("small", "", "· " + n.data));
      if (i === 0) t.appendChild(el("span", "nv-novo", "novo"));
      d.appendChild(t); novidadesItens(n, d); box.appendChild(d);
    });
  }
  abrirSheet("sobre");
}
function abrirMeuPerfil() {
  const p = meuPerfil(); if (!p) return Promise.resolve(false);
  return janela("dlgPerfis", (box, fim) => {
    dlgPadrao(box, "Meu perfil", "Só o Administrador muda o nome e a matrícula.");
    const n = campoPadrao(box, "mpNome", "Nome", { valor: p.nome }); n.readOnly = true;
    const m = campoPadrao(box, "mpMatricula", "Matrícula", { valor: p.matricula || "(ainda sem matrícula)" }); m.readOnly = true;
    const f = campoPadrao(box, "mpPerfil", "Perfil", { valor: p.papel === "admin" ? "Administrador" : "Analista" }); f.readOnly = true;
    botoesPadrao(box, "Fechar", null, () => fim(false));
  });
}
function opcoesDlg(titulo, texto, opcoes, atual, fn) {
  return janela("dlgMod", (box, fim) => {
    dlgPadrao(box, titulo, texto);
    const g = el("div", "opcoes-dlg"); g.setAttribute("role", "radiogroup");
    opcoes.forEach(([v, t]) => {
      const b = btn("opcao-dlg" + (v === atual ? " on" : ""), null, t, () => { fn(v); fim(true); });
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", v === atual ? "true" : "false"); b.dataset.valor = String(v);
      g.appendChild(b);
    });
    box.appendChild(g);
    botoesPadrao(box, "Fechar", null, () => fim(false));
  });
}
function abrirTemaDlg() { return opcoesDlg("Tema", "Aparência só deste aparelho. Vale também para a tela de entrada.", Object.keys(TEMAS).map((k) => [k, TEMAS[k].nome]), temaAtual(), (v) => definirTema(v)); }
function abrirBloqueioDlg() { return opcoesDlg("Bloqueio automático", "Volta para a tela de entrada depois de um tempo sem uso. Vale só para este aparelho.", BLOQ_OPCOES.map((n) => [n, n ? n + " min" : "Nunca"]), minutosBloqueio(), (v) => definirBloqueio(v)); }
/* ---------- Senha pessoal: conferir e trocar ---------- */
async function conferirSenhaPerfil(senha) {
  const c = (await perfisCompletos()).find((x) => x.id === sessaoPerfilId); if (!c) return false;
  const h = c.papel === "admin" ? c.adminHash : c.senhaHash, s = c.papel === "admin" ? c.adminSalt : c.senhaSalt, it = (c.papel === "admin" ? c.adminIter : c.senhaIter) || PERFIS_ITER;
  if (!h || !s) return false;
  return hashIguais(await derivarSenha(senha, s, it), h);
}
function trocarMinhaSenha() {
  if (!sessaoPerfilId) { abrirTrocaSenha(); return Promise.resolve(false); }
  return janela("dlgPerfis", (box, fim) => {
    dlgPadrao(box, "Trocar minha senha", "A senha é só sua e vale para entrar neste aparelho com a sua matrícula.");
    const a = campoPadrao(box, "msAtual", "Senha atual", { senha: true, auto: "current-password" });
    const n1 = campoPadrao(box, "msNova", "Nova senha", { senha: true, auto: "new-password" });
    medidorForca(box, n1);
    const n2 = campoPadrao(box, "msConf", "Confirmar nova", { senha: true, auto: "new-password" });
    regrasPadrao(box);
    const er = erroPadrao(box);
    const ok = botoesPadrao(box, "Cancelar", "Salvar", () => fim(false), async () => {
      er.textContent = "";
      if (!senhaForte(n1.value)) { er.textContent = REGRAS_SENHA; n1.focus(); return; }
      if (n1.value !== n2.value) { er.textContent = "As duas senhas novas não são iguais."; n2.focus(); return; }
      ok.disabled = true;
      try {
        if (!(await conferirSenhaPerfil(a.value))) { er.textContent = "Senha atual incorreta."; a.select(); return; }
        const r = await gravarSenhaNova((await perfisCompletos()).find((x) => x.id === sessaoPerfilId), a.value, n1.value);
        if (r) { er.textContent = r; return; }
        a.value = n1.value = n2.value = ""; fim(true); toast("Senha trocada");
      } catch (e) { er.textContent = "Não foi possível trocar a senha (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
  });
}
/* Grava a senha nova do perfil (admin: também reembrulha a chave que assina). Devolve "" ou a mensagem de erro. */
async function gravarSenhaNova(c, antiga, nova) {
  if (!c) return "Perfil não encontrado neste aparelho.";
  if (c.papel === "admin") {
    const ch = await prepararChaveAdmin(c, antiga, nova);
    if (ch.erro) return ch.erro;
    await alterarPerfil(c.id, Object.assign(await hashAdmin(nova), ch.campos || {}, { trocarSenha: false }), "Senha de Administrador definida: " + c.nome);
    Dados.gravarTexto(ADMIN_CONF_KEY, c.id);
  } else {
    const h = await hashPessoal(nova);
    const p = await alterarPerfil(c.id, Object.assign({}, h, { senhaTemp: false }), "");
    if (!p) return "Não foi possível gravar a senha.";
    Dados.gravarTexto(PESSOAL_CONF_KEY, c.id + "|" + h.senhaSalt);
  }
  try { await reembrulharOlho(antiga, nova); } catch (e) {}
  abrirSessaoPerfil(c.id);
  return "";
}
/* ---------- Login por matrícula ---------- */
function loginPorPerfil() { return perfisAtivos(); }
function prepararTelaLogin() {
  const comP = loginPorPerfil();
  const mw = $("loginMatWrap"); if (!mw) return;
  mw.hidden = !comP;
  $("loginSub").textContent = comP ? "Entre com a sua matrícula e a sua senha pessoal." : "Digite a senha deste aparelho.";
  $("loginSenha").placeholder = comP ? "Senha pessoal" : "Senha de acesso";
  $("loginSenha").setAttribute("aria-label", comP ? "Senha pessoal" : "Senha de acesso");
  $("loginDica").hidden = !comP;
  const pv = $("loginPrimeiraVez"); if (pv) pv.hidden = !aparelhoNovo(); // v2.5.1 (item 5)
  mostrarPassoLogin(1);
  if (comP) modoLoginNome(false);
  if (comP && sessaoPerfilId) { const p = lerPerfis().find((x) => x.id === sessaoPerfilId); if (p && p.matricula && $("loginMatricula").value === "") $("loginMatricula").value = p.matricula; }
}
/* v3.0.2 (item 4): perfil antigo sem matrícula ainda entra pelo nome, só se existir um assim (o Administrador deve cadastrar a matrícula). */
function modoLoginNome(nome) {
  const i = $("loginMatricula"); if (!i) return;
  const temAntigo = lerPerfis().some((p) => p.ativo && !p.excluido && !p.matricula);
  let a = $("loginPeloNome");
  if (!a && temAntigo) { a = el("button", "link-btn", ""); a.type = "button"; a.id = "loginPeloNome"; a.addEventListener("click", () => modoLoginNome(i.dataset.nome !== "1")); $("loginMatWrap").after(a); }
  if (a) { a.hidden = !temAntigo; a.textContent = nome ? "Entrar com a matrícula" : "Perfil antigo sem matrícula? Entrar pelo nome"; }
  i.dataset.nome = nome && temAntigo ? "1" : "";
  i.maxLength = i.dataset.nome ? 40 : 7; i.inputMode = i.dataset.nome ? "text" : "numeric"; i.placeholder = i.dataset.nome ? "Seu nome" : "Ex.: 1234567";
  i.value = "";
}
/* v2.5.1 (item 5): aparelho sem nada da equipe ainda (sem perfis, nunca sincronizou, nenhum card da Equipe). */
function aparelhoNovo() {
  try { return !perfisAtivos() && !perfisNoArquivo() && !syncMeta().ultimaSync && !(itens || []).some(compartilhado); } catch (e) { return false; }
}
function mostrarPassoLogin(n) {
  $("loginPasso1").hidden = n !== 1; $("loginPasso2").hidden = n !== 2; $("loginVoltar").hidden = n !== 2;
  $("loginBtn").textContent = n === 2 ? "Salvar e entrar" : loginPorPerfil() ? "Entrar" : "Abrir caderno";
  if (n === 1) loginPendente = null;
}
function acharPerfilLogin(v) {
  const m = normMat(v); if (!m) return null;
  const l = lerPerfis().filter((p) => !p.excluido);
  return l.find((p) => p.matricula && p.matricula === m) || l.find((p) => !p.matricula && normTxt(p.nome) === normTxt(v)) || null;
}
/* Passo 1: matrícula + senha. Devolve { ok } ou { erro } ou { trocar } (senha temporária: pede a nova). */
async function loginPasso1(mat, senha) {
  if (!normMat(mat)) return { erro: "Digite a sua matrícula." };
  // v3.0.0 (item 3): matrícula só com números (6 ou 7 dígitos). Perfil antigo sem matrícula (entra pelo nome) continua entrando.
  if (!matriculaValida(mat) && !lerPerfis().some((p) => !p.excluido && (p.matricula ? p.matricula === normMat(mat) : normTxt(p.nome) === normTxt(mat)))) return { erro: "Matrícula ou senha inválida." }; // v3.0.2 (item 4): mensagem genérica
  if (!senha) return { erro: "Digite a sua senha." };
  const p = acharPerfilLogin(mat);
  if (!p) return { erro: "Matrícula ou senha inválida." }; // v3.0.2 (item 4): não revela se a matrícula existe
  if (!p.ativo) return { erro: "Perfil desativado. Fale com o Administrador." };
  if (p.bloqueado) return { erro: "Conta bloqueada depois de " + MAX_TENTATIVAS + " senhas erradas. Peça ao Administrador para resetar a sua senha." };
  if (p.papel !== "admin" && await bloqueadoNoArquivo(p.id)) return { erro: "Conta bloqueada depois de " + MAX_TENTATIVAS + " senhas erradas. Peça ao Administrador para resetar a sua senha." }; // v2.5.2 (item 2)
  const c = (await perfisCompletos()).find((x) => x.id === p.id);
  if (p.papel === "admin") {
    if (Date.now() < esperaLoginAte) return { erro: "Muitas tentativas. Aguarde alguns segundos." };
    if (!c || !c.adminHash) return { erro: "A senha deste perfil ainda não chegou neste aparelho. Peça o arquivo da equipe ao Administrador." };
    const h = await derivarSenha(senha, c.adminSalt, c.adminIter || PERFIS_ITER);
    if (!hashIguais(h, c.adminHash)) { tentativasLoginAdmin++; if (tentativasLoginAdmin >= 5) { tentativasLoginAdmin = 0; esperaLoginAte = Date.now() + 30000; } return { erro: "Matrícula ou senha inválida." }; }
    tentativasLoginAdmin = 0;
    if (c.trocarSenha) return { trocar: true, c: c };
    const ch = await prepararChaveAdmin(c, senha, "");
    if (ch.erro) return { erro: ch.erro };
    if (ch.campos) await alterarPerfil(c.id, ch.campos, "");
    concluirLoginPerfil(c, true);
    return { ok: true };
  }
  if (!c || !c.senhaHash || !c.senhaSalt) return { erro: "Você ainda não tem senha neste aparelho. Peça ao Administrador para resetar a sua senha e enviar o arquivo da equipe." };
  const h = await derivarSenha(senha, c.senhaSalt, c.senhaIter || PERFIS_ITER);
  if (!hashIguais(h, c.senhaHash)) {
    const n = tentativasDe(c.id) + 1; gravarTentativas(c.id, n);
    if (n >= MAX_TENTATIVAS) { gravarTentativas(c.id, 0); await alterarPerfil(c.id, { bloqueado: true }, "Conta bloqueada (" + MAX_TENTATIVAS + " senhas erradas): " + c.nome); marcarBloqueioPendente(c.id); await publicarBloqueio(c.id); setTimeout(renderPessoasSeAberto, 0); return { erro: "Conta bloqueada depois de " + MAX_TENTATIVAS + " senhas erradas. Peça ao Administrador para resetar a sua senha." }; }
    return { erro: "Matrícula ou senha inválida. Restam " + (MAX_TENTATIVAS - n) + " tentativa(s)." };
  }
  gravarTentativas(c.id, 0);
  if (c.senhaTemp) return { trocar: true, c: c };
  Dados.gravarTexto(PESSOAL_CONF_KEY, c.id + "|" + c.senhaSalt);
  concluirLoginPerfil(c, false);
  return { ok: true };
}
async function loginPasso2(nova, conf) {
  const lp = loginPendente; if (!lp) return { erro: "Comece de novo." };
  if (!senhaForte(nova)) return { erro: REGRAS_SENHA };
  if (nova !== conf) return { erro: "As duas senhas não são iguais." };
  if (nova === lp.senha) return { erro: "A senha nova precisa ser diferente da temporária." };
  const c = lp.c;
  if (c.papel === "admin") {
    const ch = await prepararChaveAdmin(c, lp.senha, nova);
    if (ch.erro) return { erro: ch.erro };
    await alterarPerfil(c.id, Object.assign(await hashAdmin(nova), ch.campos || {}, { trocarSenha: false }), "Senha de Administrador definida: " + c.nome);
  } else {
    const h = await hashPessoal(nova);
    const p = await alterarPerfil(c.id, Object.assign({}, h, { senhaTemp: false }), "");
    if (!p) return { erro: "Não foi possível gravar a senha." };
    Dados.gravarTexto(PESSOAL_CONF_KEY, c.id + "|" + h.senhaSalt);
  }
  concluirLoginPerfil(c, c.papel === "admin", nova);
  return { ok: true };
}
function concluirLoginPerfil(c, admin, senhaFinal) {
  const trocou = sessaoPerfilId && sessaoPerfilId !== c.id;
  Dados.gravarTexto(PERFIL_ID_KEY, c.id); Dados.gravarTexto(AUTOR_KEY, c.nome);
  if (admin) { Dados.gravarTexto(ADMIN_CONF_KEY, c.id); modoAdmin = true; histPerfil("Entrou como Administrador: " + c.nome); }
  else modoAdmin = false;
  sessaoPerfilId = c.id; sessaoPapel = c.papel;
  separarOcultos(); // v2.5.2 (item 1): só os Meus desta pessoa
  if (admin) setTimeout(async () => { // v2.5.2 (item 2 e 3): confirma bloqueios feitos neste aparelho e redesenha Pessoas
    const n = await confirmarBloqueiosPendentes(); // antes da sincronização: o bloqueio já sai assinado nesta gravação
    if (syncEstado.vinculado) { try { await sincronizar(false); } catch (e) {} }
    if (n) toast(n === 1 ? "Bloqueio confirmado: vale em todos os aparelhos depois da sincronização" : n + " bloqueios confirmados: valem em todos os aparelhos depois da sincronização");
    renderPessoasSeAberto(true);
  }, 0);
  if (syncEstado.vinculado && !admin) setTimeout(() => sincronizar(false), 0); // v2.5.1 (item 4): todo login registra o último acesso (máx. 1 gravação a cada 15 min)
  if (trocou && travadoEmMemoria) { travadoEmMemoria = false; try { fecharSheet("sheet"); } catch (e) {} }
  abrirSessaoPerfil(c.id);
  if (senhaFinal) lembrarChaveLogin(senhaFinal);
  if (!admin && emAreaAdmin()) aba = "equipe";
  desenharSeloAdmin();
}
function abrirSessaoPerfil(id) {
  const p = lerPerfis().find((x) => x.id === id);
  try { sessionStorage.setItem(SESSAO, "p:" + id + ":" + ((p && p.senhaSalt) || "")); } catch (e) {}
}
/* v2.5.1 (item 1): a sincronização nunca troca quem está logado. Foto da identidade antes; depois, o id deste aparelho volta a ser
 * o da sessão (nunca adota outra pessoa) e, se o papel ou a senha do perfil mudaram, a sessão termina e pede o login de novo. */
function identidadeSessao() {
  if (!sessaoPerfilId) return null;
  let s = ""; try { s = sessionStorage.getItem(SESSAO) || ""; } catch (e) {}
  return { id: sessaoPerfilId, papel: sessaoPapel, perfilId: sessaoPerfilId, salt: s.split(":")[2] || "" }; // v3.0.0 (item 4): foto da sessão desta aba
}
function manterIdentidade(antes) {
  if (!antes) return false;
  let trocou = false;
  if (sessaoPerfilId !== antes.id) { sessaoPerfilId = antes.id; trocou = true; }
  const p = lerPerfis().find((x) => x.id === antes.id);
  if (p && antes.papel && p.papel !== antes.papel) trocou = true;
  if (p && p.papel !== "admin" && antes.salt !== (p.senhaSalt || "")) trocou = true;
  if (trocou && modoAdmin) modoAdmin = false;
  return trocou;
}
/* v3.0.0 (item 4): cada aba tem a própria identidade (sessionStorage). Se outra aba muda a identidade DESTE perfil (senha resetada
 * ou trocada, papel mudou), esta aba trava e pede o login de novo. Outra aba entrar com outra pessoa não muda quem está aqui. */
window.addEventListener("storage", (ev) => {
  try { if (ev.key === KEY && reconciliarAbas() && !document.body.classList.contains("travado")) render(); } catch (e) {} // v3.0.1 (item 1): outra aba gravou os cards
  try {
    if (!sessaoPerfilId || document.body.classList.contains("travado")) return;
    if ([PERFIL_ID_KEY, PERFIS_KEY, PESSOAL_CONF_KEY, AUTOR_KEY].indexOf(ev.key) < 0) return;
    const antes = identidadeSessao(); const era = modoAdmin;
    if (ev.key === PERFIL_ID_KEY && ev.newValue && ev.newValue !== sessaoPerfilId) { const o = lerPerfis().find((x) => x.id === ev.newValue); toast("Outra aba entrou como " + ((o && o.nome) || "outra pessoa") + ". Esta aba continua com o seu perfil."); }
    if (!manterIdentidade(antes)) { if (era && !modoAdmin) modoAdmin = era; return; }
    sessaoPerfilId = null; modoAdmin = false; try { sessionStorage.removeItem(SESSAO); } catch (e) {}
    bloquear(false);
    const er = $("loginErro"); if (er) er.textContent = "A identidade deste perfil mudou em outra aba. Entre de novo.";
  } catch (e) {}
});
/* Depois de receber o arquivo: se o Administrador desativou ou excluiu este perfil, a sessão termina. */
function verificarSessaoAtiva(trocouIdentidade) {
  if (!sessaoPerfilId || document.body.classList.contains("travado")) return;
  const p = lerPerfis().find((x) => x.id === sessaoPerfilId);
  const motivo = !p || p.excluido ? "Perfil excluído. Fale com o Administrador." : !p.ativo ? "Perfil desativado. Fale com o Administrador." : p.bloqueado && p.papel !== "admin" ? "Conta bloqueada depois de " + MAX_TENTATIVAS + " senhas erradas. Peça ao Administrador para resetar a sua senha." : trocouIdentidade === true ? "Os seus dados de acesso mudaram no arquivo da equipe. Entre de novo." : "";
  if (!motivo) return;
  sessaoPerfilId = null; try { sessionStorage.removeItem(SESSAO); } catch (e) {}
  separarOcultos();
  bloquear(false);
  const er = $("loginErro"); if (er) er.textContent = motivo;
}
/* Recarregou a página: o analista continua na sessão; o Administrador entra de novo (a chave que assina só fica em memória). */
function restaurarSessaoPerfil() {
  let v = ""; try { v = sessionStorage.getItem(SESSAO) || ""; } catch (e) {}
  if (!loginPorPerfil() || v.indexOf("p:") !== 0) return false;
  const id = v.split(":")[1]; const p = lerPerfis().find((x) => x.id === id); // v3.0.0 (item 4): o perfil DESTA aba
  if (!p || p.id !== id || p.papel === "admin" || !p.ativo || p.bloqueado || p.excluido) { try { sessionStorage.removeItem(SESSAO); } catch (e) {} return false; }
  if (v !== "p:" + id + ":" + (p.senhaSalt || "")) return false;
  sessaoPerfilId = id; sessaoPapel = p.papel; modoAdmin = false;
  return true;
}
async function enviarLogin() {
  const erro = $("loginErro"), btnL = $("loginBtn");
  erro.textContent = ""; btnL.disabled = true;
  try {
    if (!$("loginPasso2").hidden) {
      const r = await loginPasso2($("lnNova").value, $("lnConf").value);
      if (r.erro) { erro.textContent = r.erro; return; }
      $("lnNova").value = $("lnConf").value = ""; $("loginSenha").value = "";
      mostrarPassoLogin(1); resetarOlhos(["loginSenha", "lnNova", "lnConf"]);
      entrar(); toast("Senha criada. Bem-vindo(a)!");
      return;
    }
    if (syncEstado.vinculado && window.CadernoSync) await lerEquipeNoLogin(); // v3.0.0 (item 5): a permissão da pasta sai deste clique
    if (loginPorPerfil()) {
      const senha = $("loginSenha").value;
      const r = await loginPasso1($("loginMatricula").value, senha);
      if (r.erro) { erro.textContent = r.erro; $("loginSenha").select(); return; }
      if (r.trocar) {
        loginPendente = { c: r.c, senha: senha };
        mostrarPassoLogin(2);
        $("lnTitulo").textContent = "Crie sua senha";
        setTimeout(() => $("lnNova").focus(), 30);
        return;
      }
      lembrarChaveLogin(senha);
      $("loginSenha").value = ""; resetarOlhos(["loginSenha"]);
      entrar();
      return;
    }
    const inp = $("loginSenha");
    if (await conferirSenha(inp.value)) {
      abrirSessao(); lembrarChaveLogin(inp.value); inp.value = ""; resetarOlhos(["loginSenha"]); entrar();
    } else { erro.textContent = "Senha incorreta. Tente novamente."; inp.select(); }
  } catch (e) {
    erro.textContent = "Não foi possível verificar a senha neste navegador (abra pelo link https).";
  } finally { btnL.disabled = false; }
}
/* ---------- Arquivo da equipe no celular (receber) e no computador do Administrador (gerar para enviar) ---------- */
function adaptadorMemoria(doc, aoGravar) {
  return { modo: "importado", async vinculado() { return true; }, async nome() { return "arquivo recebido"; }, async permissao() { return true; },
    async ler() { return doc; }, async lerCopias() { return []; }, async gravar(d) { if (aoGravar) aoGravar(d); }, async apagarCopia() {}, async registrarLog() {} };
}
function ehDocEquipe(d) { return !!d && typeof d === "object" && ((window.CadernoCripto && CadernoCripto.ehProtegido(d)) || d.tipo === CadernoSync.TIPO); }
async function receberDocEquipe(d) {
  if (!ehDocEquipe(d)) { aviso("Arquivo inválido", "Esse arquivo não é o arquivo da equipe do Caderno. Nada foi alterado."); return false; }
  const antes = syncMeta().ultimaSync;
  const ok = await syncFila.rodar(() => sincronizarAgora(true, adaptadorMemoria(d, null)));
  if (!ok && seEstado.precisaSenha && window.CadernoCripto && CadernoCripto.ehProtegido(d)) {
    await pedirSenhaEquipe(d);
    if (await CadernoCripto.chaveGuardada(d.kdf.salt)) return receberDocEquipe(d);
    return false;
  }
  if (ok) { toast("Arquivo da equipe recebido" + (antes ? "" : " pela primeira vez")); render(); }
  return ok;
}
function escolherArquivoEquipe() { const i = $("impEquipe"); if (i) i.click(); }
function lerArquivoEquipe(ev) {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  if (f.size > IMPORT_MAX_BYTES) { aviso("Arquivo grande demais", "O limite é 5 MB. Nada foi alterado."); ev.target.value = ""; return; }
  const r = new FileReader();
  r.onload = async () => {
    ev.target.value = "";
    let d; try { d = JSON.parse(r.result); } catch (e) { aviso("Arquivo inválido", "Esse arquivo não é o arquivo da equipe do Caderno. Nada foi alterado."); return; }
    try { await receberDocEquipe(d); } catch (e) { registrarErro("receber arquivo da equipe", "", e, null); aviso("Falha ao receber", "Não foi possível ler esse arquivo. Nada foi alterado."); }
  };
  r.readAsText(f);
}
async function arquivoParaCelular() {
  if (!podeAdminEquipe()) { toast("Só o Administrador gera o arquivo da equipe"); return; }
  let doc = null;
  try {
    if (syncEstado.vinculado) { await sincronizar(true); doc = await adaptador().ler(); }
    else await syncFila.rodar(() => sincronizarAgora(true, adaptadorMemoria(null, (d) => { doc = d; })));
  } catch (e) { doc = null; }
  if (!doc) { aviso("Não deu para gerar", "Não foi possível montar o arquivo da equipe agora. Tente sincronizar e gere de novo."); return; }
  if (!(window.CadernoCripto && CadernoCripto.ehProtegido(doc))) { aviso("Proteja o arquivo primeiro", "O arquivo da equipe ainda não tem a senha da equipe. Ative a senha da equipe em Configurações › Arquivo da equipe antes de enviar para o celular (sem ela, os perfis não vão no arquivo e as senhas ficariam legíveis)."); return; }
  download("caderno-equipe.json", JSON.stringify(doc), "application/json");
  toast("Arquivo da equipe gerado. Envie pelo canal combinado; no celular: Arquivo e backup › Receber arquivo da equipe.");
}
/* ---------- Páginas ---------- */
function blocoCfg(box, titulo, texto, botoes, cls) {
  const c = el("article", "card painel-mais cfg-bloco" + (cls ? " " + cls : ""));
  c.appendChild(el("h3", "cfg-bloco__tit", titulo));
  if (texto) c.appendChild(el("p", "meta", texto));
  const row = el("div", "acoes-mais"); (botoes || []).forEach((b) => row.appendChild(b)); c.appendChild(row);
  box.appendChild(c); return c;
}
function tituloPagina(box, titulo, sub, extra) {
  const h = el("div", "pag-topo");
  const t = el("div", "pag-topo__tx"); t.appendChild(el("h2", "pag-tit", titulo)); if (sub) t.appendChild(el("p", "pag-sub", sub));
  h.appendChild(t); if (extra) extra.forEach((x) => h.appendChild(x));
  box.appendChild(h); return h;
}
function renderArea(box) {
  box.classList.add("area-pag");
  if (aba === "adm-pessoas") return renderPessoas(box);
  if (aba === "adm-perfis") return renderPerfisPag(box);
  if (aba === "adm-logs") return renderLogs(box);
  if (aba === "adm-config") return renderConfig(box);
  if (aba === "adm-novidades") return renderNovidadesPag(box);
  if (aba === "conta-arquivo") return renderContaArquivo(box);
}
function statusPessoa(p) {
  if (!p.ativo) return ["desativado", "Desativado"];
  if (p.bloqueado) return ["bloqueado", "Bloqueado"];
  if (p.papel !== "admin" && !p.senhaSalt) return ["sem-senha", "Sem senha pessoal"];
  return ["ativo", "Ativo"];
}
let pessoasBusca = "";
function renderPessoas(box) {
  const l = lerPerfis().filter((p) => !p.excluido);
  if (!perfisAtivos()) {
    tituloPagina(box, "Pessoas", "Perfis ainda não configurados neste aparelho");
    try { blocoPerfis(box); } catch (e) {}
    return;
  }
  const novo = btn("btn pri pag-acao", "plus", "Novo analista", novoAnalista); novo.id = "btnNovoAnalista";
  tituloPagina(box, "Pessoas", l.length + (l.length === 1 ? " pessoa" : " pessoas") + " · " + l.filter((p) => p.ativo).length + " ativas", [novo]);
  const adm = adminsAtivos(l);
  if (adm.length === 1) box.appendChild(el("p", "aviso-forte perfis-um-admin", "Recomendado: ter 2 Administradores. Hoje só " + adm[0].nome + " é Administrador."));
  const semMat = l.filter((p) => !p.matricula);
  if (semMat.length) box.appendChild(el("p", "aviso-forte pessoas__sem-mat", semMat.length + " pessoa(s) sem matrícula (vindas da v2.4.0): " + semMat.map((p) => p.nome).join(", ") + ". Use Editar para cadastrar a matrícula; até lá, essas pessoas entram digitando o nome no campo Matrícula."));
  const semMatAn = semMat.filter((p) => p.papel !== "admin" && p.ativo); // v2.5.1 (item 6): passo a passo para o analista migrado
  if (semMatAn.length) {
    const g = el("div", "info-faixa pessoas__guia"); g.id = "guiaMigrados";
    g.appendChild(el("b", "", "Analista vindo da v2.4.0 sem matrícula: como liberar o acesso"));
    const ol = el("ol", "pessoas__guia-passos");
    ["Clique em Editar na linha da pessoa e cadastre a matrícula.", "Clique em Resetar senha e passe a senha temporária pessoalmente (use Copiar).", "Na entrada, a pessoa digita a matrícula e a senha temporária e cria a própria senha."].forEach((t) => ol.appendChild(el("li", "", t)));
    g.appendChild(ol); box.appendChild(g);
  }
  avisosVersaoAntiga().forEach((nome) => box.appendChild(el("p", "aviso-forte perfis-antigo", nome + " ainda está numa versão antiga (não respeita as permissões). Peça para atualizar.")));
  const bw = el("div", "busca-wrap pessoas-busca"); bw.insertAdjacentHTML("beforeend", svg("search", 18));
  const bi = el("input"); bi.type = "search"; bi.id = "pBusca"; bi.placeholder = "Buscar por matrícula ou nome"; bi.setAttribute("aria-label", "Buscar por matrícula ou nome"); bi.value = pessoasBusca;
  bw.appendChild(bi); box.appendChild(bw);
  const ul = el("ul", "pessoas-lista"); ul.id = "pessoasLista";
  const eu = meuPerfil();
  l.forEach((p) => {
    const [st, stTxt] = statusPessoa(p);
    const li = el("li", "pessoa-linha pessoa-linha--" + st); li.dataset.id = p.id; li.dataset.busca = normTxt((p.matricula || "") + " " + p.nome);
    const av = el("span", "pessoa-av", iniciais(p.nome)); li.appendChild(av);
    const info = el("div", "pessoa-info");
    const l1 = el("div", "pessoa-l1"); l1.appendChild(el("b", "pessoa-nome", p.nome)); l1.appendChild(el("span", "chip-st chip-st--" + st, stTxt));
    if (p.papel === "admin") l1.appendChild(el("span", "chip-st chip-st--admin", "Administrador"));
    info.appendChild(l1);
    info.appendChild(el("small", "pessoa-sub", "Matrícula " + (p.matricula || "—") + " · Último acesso " + (p.ultimoAcesso ? dataHoraBR(p.ultimoAcesso) : "—")));
    li.appendChild(info);
    const ac = el("div", "pessoa-acoes");
    const souEu = eu && eu.id === p.id, ultimoAdmin = p.papel === "admin" && p.ativo && adm.length <= 1;
    const tg = el("button", "toggle" + (p.ativo ? " on" : "")); tg.type = "button"; tg.setAttribute("role", "switch"); tg.setAttribute("aria-checked", p.ativo ? "true" : "false");
    tg.setAttribute("aria-label", (p.ativo ? "Desativar " : "Ativar ") + p.nome); tg.dataset.acao = "toggle";
    tg.appendChild(el("span", "toggle__trilho")); tg.appendChild(el("span", "toggle__txt", p.ativo ? "Ativo" : "Inativo"));
    if (p.ativo && (souEu || ultimoAdmin)) { tg.disabled = true; tg.title = souEu ? "Você não pode desativar o seu próprio perfil" : "Não dá para desativar o último Administrador"; }
    tg.addEventListener("click", () => alternarAtivo(p));
    ac.appendChild(tg);
    const b1 = btn("btn pequeno", "key", "Resetar senha", () => resetarSenha(p).then(render)); b1.dataset.acao = "resetar"; b1.classList.add("rot-curto"); b1.dataset.curto = "Resetar";
    if (souEu) { b1.disabled = true; b1.title = "Para trocar a sua senha, use Trocar minha senha"; }
    ac.appendChild(b1);
    const b2 = btn("btn pequeno", "lock", "Desbloquear", async () => { gravarTentativas(p.id, 0); limparBloqueioPendente(p.id); await alterarPerfil(p.id, { bloqueado: false }, "Conta desbloqueada: " + p.nome); toast(p.nome + " desbloqueado(a)"); render(); }); b2.dataset.acao = "desbloquear"; b2.dataset.curto = "Desbloq.";
    if (!p.bloqueado) { b2.disabled = true; b2.title = "Só quando a conta está bloqueada"; }
    ac.appendChild(b2);
    const b3 = btn("btn pequeno", "edit", "Editar", () => editarPessoa(p)); b3.dataset.acao = "editar"; b3.dataset.curto = "Editar"; ac.appendChild(b3);
    if (!p.ativo) { const b4 = btn("btn pequeno perigo", "trash", "Excluir", () => excluirPessoa(p)); b4.dataset.acao = "excluir"; b4.dataset.curto = "Excluir"; ac.appendChild(b4); }
    li.appendChild(ac);
    ul.appendChild(li);
  });
  box.appendChild(ul);
  const vazio = el("p", "vazio pessoas-vazio", "Nenhuma pessoa encontrada para essa busca."); vazio.hidden = true; box.appendChild(vazio);
  const filtrar = () => { pessoasBusca = bi.value; const q = normTxt(bi.value); let n = 0; ul.querySelectorAll(".pessoa-linha").forEach((li) => { const v = !q || li.dataset.busca.indexOf(q) >= 0; li.hidden = !v; if (v) n++; }); vazio.hidden = n > 0; };
  bi.addEventListener("input", filtrar); filtrar();
  box.appendChild(el("p", "meta gestao__nota", "O analista só recebe o arquivo da equipe. Bloqueio por 5 senhas erradas: quando um Administrador entra no aparelho onde aconteceu, o bloqueio é confirmado e passa a valer em todos os aparelhos. Desbloquear ou Resetar senha libera em todos."));
}
async function alternarAtivo(p) {
  if (p.ativo) await confirmarAcao("Desativar " + p.nome + "?", p.nome + " não consegue mais entrar (aparece “Perfil desativado”). Pode ser reativado depois.", "Desativar", () => alterarPerfil(p.id, { ativo: false }, "Perfil desativado: " + p.nome));
  else { await alterarPerfil(p.id, { ativo: true }, "Perfil reativado: " + p.nome); toast(p.nome + " reativado(a)"); }
  render();
}
function excluirPessoa(p) {
  if (p.ativo) { toast("Desative a pessoa antes de excluir"); return Promise.resolve(false); }
  return janela("dlgSE", (box, fim) => {
    dlgPadrao(box, "Excluir " + p.nome + "?", "O perfil some da lista e a matrícula " + (p.matricula || "") + " deixa de entrar. Os cards e o histórico continuam. Não dá para desfazer.");
    avisoPadrao(box, "Para confirmar, digite EXCLUIR.");
    const c = campoPadrao(box, "pxConf", "Confirmação", { placeholder: "EXCLUIR", max: 10 });
    const er = erroPadrao(box);
    const ok = botoesPadrao(box, "Cancelar", "Excluir", () => fim(false), async () => {
      if (c.value.trim().toUpperCase() !== "EXCLUIR") { er.textContent = "Digite EXCLUIR para confirmar."; c.focus(); return; }
      ok.disabled = true;
      try { await alterarPerfil(p.id, { excluido: true, ativo: false, papel: "analista", senhaTemp: false, bloqueado: false, senhaHash: "", senhaSalt: "", trocarSenha: false }, "Perfil excluído: " + p.nome); fim(true); toast(p.nome + " excluído(a)"); render(); }
      finally { ok.disabled = false; }
    });
    ok.classList.remove("pri"); ok.classList.add("perigo");
  });
}
function matriculaValida(v) { return /^\d{6,7}$/.test(normMat(v)); } // v3.0.0 (item 3): só números, 6 ou 7 dígitos
function matriculaEmUso(v, exceto) { const m = normMat(v); return lerPerfis().some((p) => !p.excluido && p.id !== exceto && p.matricula === m); }
function editarPessoa(p) {
  return janela("dlgPerfis", (box, fim) => {
    dlgPadrao(box, "Editar " + p.nome, "Nome, matrícula e perfil. A matrícula é o que a pessoa digita para entrar.");
    const n = campoPadrao(box, "pxNome", "Nome", { valor: p.nome, max: 40 });
    const m = campoPadrao(box, "pxMatricula", "Matrícula", { valor: p.matricula || "", max: 20, placeholder: "Ex.: 1234567" });
    const pf = selectPadrao(box, "pxPerfil", "Perfil", [["analista", "Analista"], ["admin", "Administrador"]]); pf.value = p.papel === "admin" ? "admin" : "analista";
    const eu = meuPerfil(); if (eu && eu.id === p.id) { pf.disabled = true; pf.title = "Você não muda o seu próprio perfil"; }
    const er = erroPadrao(box);
    const ok = botoesPadrao(box, "Cancelar", "Salvar", () => fim(false), async () => {
      er.textContent = "";
      const nome = n.value.trim(), mat = normMat(m.value);
      if (!nome) { er.textContent = "Digite o nome."; n.focus(); return; }
      if (mat !== (p.matricula || "") && !matriculaValida(mat)) { er.textContent = "Matrícula: só números, de 6 ou 7 dígitos."; m.focus(); return; }
      if (matriculaEmUso(mat, p.id)) { er.textContent = "Essa matrícula já é de outra pessoa."; m.focus(); return; }
      const outro = perfilPorNome(nome); if (outro && outro.id !== p.id && !outro.excluido) { er.textContent = "Já existe um perfil com esse nome."; return; }
      ok.disabled = true;
      try {
        if (nome !== p.nome || mat !== (p.matricula || "")) await alterarPerfil(p.id, { nome: nome, matricula: mat }, "Perfil editado: " + p.nome + (nome !== p.nome ? " → " + nome : "") + (mat !== (p.matricula || "") ? " · matrícula " + mat : ""));
        if (nome !== p.nome && eu && eu.id === p.id) Dados.gravarTexto(AUTOR_KEY, nome);
        fim(true);
        const novoP = lerPerfis().find((x) => x.id === p.id) || p;
        if (!pf.disabled && pf.value !== (p.papel === "admin" ? "admin" : "analista")) { if (pf.value === "admin") await tornarAdmin(novoP); else await removerAdmin(novoP); }
        toast("Perfil salvo"); render();
      } catch (e) { er.textContent = "Não foi possível salvar (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
  });
}
function renderPerfisPag(box) {
  tituloPagina(box, "Perfis", "O que cada perfil pode fazer");
  if (!perfisAtivos()) { try { blocoPerfis(box); } catch (e) {} return; }
  const l = lerPerfis().filter((p) => !p.excluido);
  const card = (titulo, n, itensP, cls) => {
    const c = el("article", "card painel-mais perfil-card " + cls);
    const h = el("div", "perfil-card__topo"); h.appendChild(el("h3", "", titulo)); h.appendChild(el("span", "chip-st", n + (n === 1 ? " pessoa" : " pessoas"))); c.appendChild(h);
    const ul = el("ul", "perfil-card__lista"); itensP.forEach((t) => ul.appendChild(el("li", "", t))); c.appendChild(ul);
    box.appendChild(c);
  };
  card("Administrador", l.filter((p) => p.papel === "admin" && p.ativo).length, ["Cria, edita, arquiva, compartilha e exclui os cards da Equipe", "Cadastra pessoas, define a matrícula, reseta senhas, desbloqueia, desativa e exclui", "Publica o arquivo da equipe (as mudanças saem assinadas)", "Troca a senha da equipe, exporta e importa, vê os Logs"], "perfil-card--admin");
  card("Analista", l.filter((p) => p.papel !== "admin" && p.ativo).length, ["Vê os cards da Equipe e atualiza senha, ciclo, datas e escalonamento", "Cria e edita os próprios cards em Meus (ficam só no aparelho dele)", "Só recebe o arquivo da equipe: aceita apenas o que o Administrador assinou e nunca grava nele", "No celular, recebe o arquivo que o Administrador envia"], "perfil-card--analista");
  box.appendChild(el("p", "meta gestao__nota", textoHonestoPerfis()));
}
const LOGS_POR_PAG = 10;
let logsFiltro = { dias: 7, acao: "todas", pag: 1 };
function dataBRT(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  try { return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", ""); } catch (e) { return dataHoraBR(iso); }
}
function acaoDoLog(e) {
  if (e.tipo !== "texto") return (HIST_ROT[e.tipo] || HIST_ROT.texto)[1] || "Ação";
  const t = String(e.texto || "");
  const m = t.match(/^([^:]+):/); return m ? m[1].slice(0, 60) : "Ação";
}
function renderLogs(box) {
  tituloPagina(box, "Logs", "Ações da equipe e deste aparelho · horário de Brasília (BRT)");
  const todos = lerHist();
  const fil = el("div", "logs-filtros");
  const sd = el("select", "logs-sel"); sd.id = "logsDias"; sd.setAttribute("aria-label", "Período");
  [[1, "Hoje"], [7, "Últimos 7 dias"], [30, "Últimos 30 dias"], [0, "Tudo"]].forEach(([v, t]) => { const o = el("option", "", t); o.value = String(v); sd.appendChild(o); });
  sd.value = String(logsFiltro.dias);
  const acoes = []; todos.forEach((e) => { const a = acaoDoLog(e); if (acoes.indexOf(a) < 0) acoes.push(a); }); acoes.sort();
  const sa = el("select", "logs-sel"); sa.id = "logsAcao"; sa.setAttribute("aria-label", "Ação");
  const o0 = el("option", "", "Todas as ações"); o0.value = "todas"; sa.appendChild(o0);
  acoes.forEach((a) => { const o = el("option", "", a); o.value = a; sa.appendChild(o); });
  if (logsFiltro.acao !== "todas" && acoes.indexOf(logsFiltro.acao) < 0) logsFiltro.acao = "todas";
  sa.value = logsFiltro.acao;
  sd.addEventListener("change", () => { logsFiltro.dias = Number(sd.value); logsFiltro.pag = 1; render(); });
  sa.addEventListener("change", () => { logsFiltro.acao = sa.value; logsFiltro.pag = 1; render(); });
  fil.appendChild(sd); fil.appendChild(sa); box.appendChild(fil);
  const lim = logsFiltro.dias ? (logsFiltro.dias === 1 ? new Date(new Date().toDateString()).getTime() : Date.now() - logsFiltro.dias * 864e5) : 0;
  const l = todos.filter((e) => (!lim || new Date(e.quando).getTime() >= lim) && (logsFiltro.acao === "todas" || acaoDoLog(e) === logsFiltro.acao));
  const pags = Math.max(1, Math.ceil(l.length / LOGS_POR_PAG)); if (logsFiltro.pag > pags) logsFiltro.pag = pags;
  const pg = l.slice((logsFiltro.pag - 1) * LOGS_POR_PAG, logsFiltro.pag * LOGS_POR_PAG);
  const tab = el("div", "logs-tabela"); tab.id = "logsTabela"; tab.setAttribute("role", "table");
  const cab = el("div", "logs-linha logs-cab"); cab.setAttribute("role", "row");
  ["Data (BRT)", "Usuário", "Ação", "Detalhes"].forEach((t) => { const c = el("span", "", t); c.setAttribute("role", "columnheader"); cab.appendChild(c); });
  tab.appendChild(cab);
  if (!pg.length) tab.appendChild(el("p", "vazio logs-vazio", "Nenhuma ação neste período."));
  pg.forEach((e) => {
    const r = el("div", "logs-linha"); r.setAttribute("role", "row");
    const det = e.tipo === "texto" ? String(e.texto || "").replace(/^[^:]+:\s*/, "") : (e.card || "") + (e.escopo ? " · " + (e.escopo === "Meu" ? "Meus" : "Equipe") : "");
    [["Data", dataBRT(e.quando)], ["Usuário", e.quem || "—"], ["Ação", acaoDoLog(e)], ["Detalhes", det || "—"]].forEach(([k, v]) => { const c = el("span", "logs-cel", v); c.dataset.rot = k; c.setAttribute("role", "cell"); r.appendChild(c); });
    tab.appendChild(r);
  });
  box.appendChild(tab);
  const pn = el("div", "logs-pag");
  const ant = btn("btn pequeno", null, "‹ Anterior", () => { logsFiltro.pag--; render(); }); ant.disabled = logsFiltro.pag <= 1; ant.id = "logsAnt";
  const prox = btn("btn pequeno", null, "Próxima ›", () => { logsFiltro.pag++; render(); }); prox.disabled = logsFiltro.pag >= pags; prox.id = "logsProx";
  pn.appendChild(ant); pn.appendChild(el("span", "logs-pag__txt", "Página " + logsFiltro.pag + " de " + pags + " · " + l.length + " registro(s)")); pn.appendChild(prox);
  box.appendChild(pn);
  box.appendChild(el("p", "meta gestao__nota", "🔒 Os logs nunca mostram senhas, só que foram alteradas. As ações da Equipe viajam no arquivo da equipe; as dos cards Meus ficam só neste aparelho."));
}
function botoesTema() {
  const tema = temaAtual();
  return Object.keys(TEMAS).map((k) => { const b = btn("btn tema-op" + (k === tema ? " on" : ""), null, TEMAS[k].nome, () => definirTema(k)); b.dataset.tema = k; b.setAttribute("aria-pressed", k === tema ? "true" : "false"); b.insertAdjacentHTML("afterbegin", '<span class="amostra amostra-' + k.replace(/[^\w-]/g, "") + '"></span>'); return b; });
}
function botoesBloqueio() {
  const minAtual = minutosBloqueio();
  return BLOQ_OPCOES.map((n) => { const b = btn("btn tema-op" + (n === minAtual ? " on" : ""), null, n ? n + " min" : "Nunca", () => definirBloqueio(n)); b.setAttribute("aria-pressed", n === minAtual ? "true" : "false"); return b; });
}
function renderConfig(box) {
  tituloPagina(box, "Configurações", "Arquivo da equipe, preferências, exportar e importar");
  const info = el("div", "info-faixa"); info.id = "cfgInfo";
  info.appendChild(el("b", "", "Hoje: arquivo · Depois: servidor"));
  info.appendChild(el("span", "", "Os dados da equipe ficam no arquivo da pasta compartilhada (offline, sem servidor). No futuro, um servidor pode entrar no lugar sem mudar o uso."));
  box.appendChild(info);
  const bloco = (titulo, texto, botoes) => blocoCfg(box, titulo, texto, botoes);
  blocoArquivoEquipe(box, bloco, "config");
  blocoCfg(box, "Arquivo para o celular", "Gera o arquivo da equipe (protegido com a senha da equipe e assinado) para o analista receber no celular em Arquivo e backup › Receber arquivo da equipe.", [btn("btn", "download", "Gerar arquivo para o celular", arquivoParaCelular)]);
  blocoCfg(box, "Preferências", "Tema e bloqueio automático valem só para este aparelho.", botoesTema(), "cfg-pref");
  blocoCfg(box, "Bloqueio automático", "Volta para a tela de entrada depois de um tempo sem uso.", botoesBloqueio());
  blocoCfg(box, "Exportar e importar", "Os arquivos exportados levam as senhas da Equipe em texto aberto: guarde em lugar seguro e não envie por e-mail nem por chat. Senhas individuais nunca saem.", [
    btn("btn", "download", "Exportar JSON", exportarEquipe), btn("btn", "upload", "Importar JSON", () => $("imp").click()),
    btn("btn", "table", "Importar planilha", escolherPlanilha), btn("btn", "table", "Excel para importar", exportarExcelImportar),
    btn("btn", "book", "Excel para consulta", exportarExcelConsulta), btn("btn", "lock", "Backup pessoal (inclui minhas senhas)", backupPessoal)], "cfg-export");
  blocoCfg(box, "Cards da equipe", "Cria um card novo direto na Equipe.", [btn("btn pri", "plus", "Novo fornecedor da equipe", novoFornecedorEquipe)]);
  try { blocoAvisos(box); } catch (e) {}

  try { blocoLixeira(box); } catch (e) {}
  if (!perfisAtivos()) { try { blocoPerfis(box); } catch (e) {} blocoCfg(box, "Senha deste aparelho", "Sem perfis, cada aparelho tem a própria senha de entrada.", [btn("btn", "lock", "Trocar senha", abrirTrocaSenha)]); }
  blocoCfg(box, "Instalação e saída", "Instale o app uma vez com internet; depois funciona offline.", [btn("btn", "download", appJaInstalado() ? "App instalado" : "Instalar app", () => abrirInstalar(true)), btn("btn", "logout", "Sair (bloquear)", sair)]);
}
function renderNovidadesPag(box) {
  tituloPagina(box, "Novidades", "O que mudou nas últimas versões");
  const c = el("article", "card painel-mais nv-lista");
  NOVIDADES.forEach((n, i) => {
    const d = el("div", "nv-l"); const t = el("div", "nv-v", "v" + n.v + " "); t.appendChild(el("small", "", "· " + n.data));
    if (i === 0) t.appendChild(el("span", "nv-novo", "novo"));
    d.appendChild(t); novidadesItens(n, d); c.appendChild(d);
  });
  box.appendChild(c);
}
function renderContaArquivo(box) {
  tituloPagina(box, "Arquivo e backup", "Receber a equipe, cards compartilhados, Lixeira e o seu backup");
  const bloco = (titulo, texto, botoes) => blocoCfg(box, titulo, texto, botoes);
  blocoArquivoEquipe(box, bloco, "mais");
  blocoCfg(box, "Receber arquivo da equipe", "No celular (ou sem a pasta), escolha o arquivo que o Administrador enviou. O app só aceita o que o Administrador assinou, recusa e avisa se algo foi mexido e nunca apaga o que você já tem.", [btn("btn pri", "upload", "Receber arquivo da equipe", escolherArquivoEquipe)]);

  try { blocoLixeira(box); } catch (e) {}
  blocoCfg(box, "Backup pessoal (inclui minhas senhas)", "Arquivo completo com os seus cards de Meus. Use só para levar para outro aparelho seu. Não compartilhe.", [btn("btn", "lock", "Backup pessoal", backupPessoal), btn("btn", "upload", "Importar backup", () => $("imp").click())]);
  blocoCfg(box, "Planilha Excel (Meus)", "Só os seus cards (Meus). Senhas individuais saem em branco.", [btn("btn", "table", "Excel para importar", exportarExcelImportar), btn("btn", "book", "Excel para consulta", exportarExcelConsulta)]);
}
/* ---------- Ligação ---------- */
function ligarArea() {
  document.querySelectorAll("#abas [data-aba]").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.aba)));
  document.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.ir)));
  $("btnConta").addEventListener("click", (ev) => { ev.stopPropagation(); abrirContaMenu(); });
  document.addEventListener("click", (ev) => { if (!ev.target.closest("#contaMenu") && !ev.target.closest("#btnConta")) fecharContaMenu(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") fecharContaMenu(); });
  $("navRodape").addEventListener("click", () => { if (syncEstado.vinculado) sincronizar(true); });
  $("impEquipe").addEventListener("change", lerArquivoEquipe);
  $("loginVoltar").addEventListener("click", () => { mostrarPassoLogin(1); $("loginErro").textContent = ""; $("loginSenha").value = ""; $("loginSenha").focus(); });
  $("loginMatricula").addEventListener("input", (ev) => { // v3.0.2 (item 4): só números, até 7 (perfil antigo sem matrícula: modo nome)
    const i = ev.target; if (i.dataset.nome === "1") { i.value = i.value.toUpperCase(); return; }
    const v = i.value.replace(/\D/g, "").slice(0, 7); if (v !== i.value) i.value = v;
  });
  prepararTelaLogin();
}

/* v2.5.2 (item 2): o bloqueio por 5 senhas erradas vale em todos os aparelhos. Neste aparelho ele fica pendente até um Administrador
 * entrar aqui: o app confirma (assina) e publica no arquivo da equipe. Em outro aparelho, antes de conferir a senha, o login olha o
 * arquivo da equipe: bloqueio assinado por um Administrador conhecido (e mais novo que a cópia local) recusa a entrada. */
const BLOQ_PEND_KEY = "caderno-bloqueios-pendentes";
function marcarBloqueioPendente(id) { const m = lerJSON(BLOQ_PEND_KEY, {}); m[id] = new Date().toISOString(); Dados.gravarTexto(BLOQ_PEND_KEY, JSON.stringify(m)); }
function limparBloqueioPendente(id) { const m = lerJSON(BLOQ_PEND_KEY, {}); if (m[id]) { delete m[id]; Dados.gravarTexto(BLOQ_PEND_KEY, JSON.stringify(m)); } }
function bloqueiosPendentes() { return Object.keys(lerJSON(BLOQ_PEND_KEY, {})); }
async function confirmarBloqueiosPendentes() {
  if (!modoAdmin || !chaveAdmin) return 0;
  const ids = bloqueiosPendentes(); if (!ids.length) return 0;
  let n = 0;
  for (const id of ids) {
    const p = lerPerfis().find((x) => x.id === id);
    if (p && p.bloqueado && p.ativo && !p.excluido && p.papel !== "admin") { if (await alterarPerfil(id, { bloqueado: true }, "Bloqueio confirmado pelo Administrador (vale em todos os aparelhos): " + p.nome)) n++; }
    limparBloqueioPendente(id);
  }
  return n;
}
/* v3.0.0 (item 5): no "Entrar", com a pasta da equipe vinculada, o login lê o arquivo (pede a permissão com o clique) e junta os
 * perfis antes de conferir a senha. Reset ou desbloqueio assinado por um Administrador e mais novo que o bloqueio daqui limpa o
 * bloqueio local e as tentativas (o analista entra com a senha temporária depois do F5 + Entrar). */
async function lerEquipeNoLogin() {
  try {
    if (!window.CadernoSync || !syncEstado.vinculado) return false;
    const a = adaptador(); if (!a || !(await a.permissao(true))) return false;
    const bruto = await Promise.race([a.ler(), new Promise((r) => setTimeout(() => r(undefined), 5000))]);
    if (!bruto) return false;
    notarPerfisNoArquivo(bruto);
    const d = await abrirDocEquipe(bruto, true);
    if (!d || !CadernoSync.docValido(d) || !Array.isArray(d.perfis) || !d.perfis.length) return false;
    const remoto = CadernoSync.limparDoc(d).doc;
    const cache = await perfisCompletos();
    if (adminsAtivos(cache).length) { // reset/desbloqueio do admin vence o bloqueio local
      let troca = false;
      const novo = [];
      for (const loc of cache) {
        const rp = (remoto.perfis || []).find((x) => x && x.id === loc.id);
        if (rp && loc.bloqueado && !rp.bloqueado && rp.assinP && (rp.senhaSalt !== loc.senhaSalt || CadernoSync.ts(rp.updatedAt) > CadernoSync.ts(loc.updatedAt)) && await verificarAssin(rp.assinP, msgPerfil(rp), cache)) {
          novo.push(rp); troca = true; gravarTentativas(loc.id, 0); limparBloqueioPendente(loc.id);
          addHist({ id: "dl-" + loc.id + "-" + Date.now().toString(36), tipo: "texto", card: "", escopo: "Equipe", texto: "Desbloqueio do Administrador recebido no login: " + (rp.nome || "") });
        } else novo.push(loc);
      }
      if (troca) await gravarPerfis(novo);
    }
    const pf = await mesclarPerfisSync(remoto, d, []);
    await concluirPerfisSync(pf.itens);
    return true;
  } catch (e) { return false; }
}
/* v3.0.0 (item 5): no 5º erro, o bloqueio vai para o arquivo da equipe na hora (quando a pasta já está liberada). Só o campo
 * "bloqueado" muda no perfil, e os outros aparelhos já aceitam isso sem assinatura (mudancaPropria). */
async function publicarBloqueio(id) {
  try {
    if (!window.CadernoSync || !syncEstado.vinculado) return false;
    const a = adaptador(); if (!a || !(await a.permissao(false))) return false;
    const bruto = await a.ler(); const d = await abrirDocEquipe(bruto, true);
    if (!d || !CadernoSync.docValido(d) || versaoArquivoNova(d) || !Array.isArray(d.perfis)) return false;
    const i = d.perfis.findIndex((x) => x && x.id === id); if (i < 0 || d.perfis[i].bloqueado) return false;
    const doc = JSON.parse(JSON.stringify(d));
    doc.perfis[i].bloqueado = true; doc.perfis[i].updatedAt = new Date().toISOString(); doc.perfis[i].updatedBy = doc.perfis[i].nome || "";
    doc.historico = CadernoSync.mesclarHistorico([doc.historico || [], [{ id: "bq-" + id + "-" + Date.now().toString(36), tipo: "texto", card: "", quem: doc.perfis[i].nome || "", quando: new Date().toISOString(), escopo: "Equipe", texto: "Conta bloqueada (" + MAX_TENTATIVAS + " senhas erradas): " + (doc.perfis[i].nome || "") }]], CadernoSync.HIST_MAX);
    delete doc.gravacao;
    await a.gravar(await fecharDocEquipe(doc, bruto));
    return true;
  } catch (e) { return false; }
}
async function bloqueadoNoArquivo(id) {
  try {
    if (!window.CadernoSync || !syncEstado.vinculado) return false;
    const a = adaptador(); if (!a || !(await a.permissao(false))) return false;
    const d = await Promise.race([abrirDocEquipe(await a.ler(), false), new Promise((r) => setTimeout(() => r(null), 4000))]);
    const rp = d && Array.isArray(d.perfis) ? d.perfis.find((x) => x && x.id === id) : null;
    if (!rp || !rp.bloqueado || !rp.assinP) return false;
    const cache = await perfisCompletos(); const loc = cache.find((x) => x.id === id);
    if (loc && CadernoSync.ts(loc.updatedAt) > CadernoSync.ts(rp.updatedAt)) return false; // o desbloqueio daqui é mais novo
    return !!(await verificarAssin(rp.assinP, msgPerfil(rp), cache));
  } catch (e) { return false; }
}
/* v2.5.2 (item 3): Pessoas e o status Bloqueado se redesenham sozinhos (login do Administrador, fim da sincronização, bloqueio gravado). */
function renderPessoasSeAberto(forcar) {
  try {
    if (document.body.classList.contains("travado")) return;
    if (!forcar && !(typeof aba !== "undefined" && String(aba).indexOf("adm-") === 0)) return;
    if (typeof podeRenderAgora === "function" && !podeRenderAgora()) { renderPendente = true; return; }
    render();
  } catch (e) {}
}
/* v2.5.2 (item 1): cards Individuais de antes da v2.5.2 (sem dono) ficam escondidos até alguém dizer que são seus. Pergunta uma vez por
 * pessoa neste aparelho, sem mostrar o conteúdo. */
const LEGADO_DONO_KEY = "caderno-meus-sem-dono-resposta";
function perguntarCardsSemDono() { /* v3.0.0 (item 2): removido ("São meus?" não existe mais) */ }
