/* Caderno de Acessos — js/app.js
 * Início do app: versão (APP_VERSAO), novidades (NOVIDADES), senha padrão de login (LOGIN_PADRAO) e toda a ligação de eventos e a
 * inicialização, na mesma ordem de antes. Carregado por último.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
// Um novo toque/clique começa: descarta o "engolir clique" do long-press anterior (o DOM pode ter sido redesenhado).
document.addEventListener("pointerdown", () => { ignorarClique = false; }, true);
document.addEventListener("click", (ev) => { if (!ev.target.closest(".menu-card")) fecharMenus(); });
document.addEventListener("click", () => { if (renderPendente) setTimeout(renderSePendente, 50); });
/* ---------- v1.9.3+: Novidades (texto vai junto com o app; mais recente primeiro) ---------- */
const APP_VERSAO = "3.0.1";
const NOVIDADES_VISTA = "caderno-novidades-vista";
const NOVIDADES = [
  { v: "3.0.1", data: "31/10/2026", itens: [
    "⏰ Duas abas no mesmo navegador: antes uma aba desfazia a senha trocada na outra; agora uma junta o que a outra salvou (ex.: o Admin troca a senha do Coy crm numa aba e a aba do José recebe a nova, sem voltar a antiga).",
    "⏰ Analista: antes criava, compartilhava e excluía cards em Meus; agora em Meus ficam só os cards que o Administrador enviou (Selecionar e enviar), e ele preenche login, senha, datas e escalonamento. Arquivados ficam só para ver. Criar, compartilhar, arquivar, excluir e reativar são do Administrador.",
    "Analista trocando senha não gera mais “Edição ao mesmo tempo” falso, e o log de conflito mostra o nome de quem fez a versão que ficou."] },
  { v: "3.0.0", data: "28/10/2026", itens: [
    "Analista edita senha, datas/ciclo e escalonamento dos cards da Equipe e isso vai para o arquivo da equipe (URL, tipo e arquivar seguem só do Administrador).",
    "Sem a pergunta “São meus?”: os Meus deste navegador voltam a aparecer. Novo: Administrador › Selecionar e enviar (cards para um ou mais analistas).",
    "Matrícula só com números (6 ou 7 dígitos).",
    "Cada aba tem a sua identidade: admin e analista em abas diferentes não se misturam (menu, log e último acesso).",
    "Entrar lê o arquivo da equipe: reset do Administrador libera o analista depois do F5 + Entrar; o bloqueio por 5 erros vai na hora para o arquivo.",
    "Aviso “Arquivo gravado por uma versão mais nova” com saída segura do Administrador (confirma a senha, fica no log).",
    "Último acesso do analista gravado na sincronização."
  ] },
  { v: "2.5.4", data: "28/10/2026", itens: [
    "v2.5.4: corrige sincronização travada após a volta da v2.5.3 (mesmo código da v2.5.2)."
  ] },
  { v: "2.5.2", data: "28/10/2026", itens: [
    "Cards individuais (Meus) agora têm dono: cada pessoa só vê os seus, mesmo usando o mesmo navegador. Cards de antes desta versão aparecem uma vez com a pergunta \u201cSão seus?\u201d.",
    "Bloqueio por 5 senhas erradas vale em todos os aparelhos: o Administrador confirma o bloqueio ao entrar e ele vai assinado no arquivo da equipe. Desbloquear também vale para todos.",
    "A tela Pessoas e o status Bloqueado se atualizam sozinhos depois do login do Administrador e de cada sincronização."
  ] },
  { v: "2.5.1", data: "25/10/2026", itens: [
    "A sincronização nunca troca quem está logado: se os seus dados de acesso mudarem no arquivo da equipe, o app pede para entrar de novo.",
    "App mais antigo que o arquivo da equipe só lê, nunca grava por cima, e avisa para atualizar.",
    "O analista agora registra o próprio último acesso no arquivo da equipe (só isso; o resto continua só do Administrador).",
    "Último acesso atualizado a cada entrada, com no máximo uma gravação a cada 15 minutos.",
    "Aparelho novo: a primeira tela explica como trazer os cards da equipe (vincular a pasta ou receber o arquivo).",
    "Pessoas: passo a passo para o analista vindo da v2.4.0 sem matrícula (cadastrar a matrícula e Resetar senha).",
    "Botão Copiar ao lado do olho na senha temporária (Novo analista e Resetar senha).",
    "No celular, a mensagem de erro fica visível acima do teclado.",
    "Temas Claro e Suave: itens do menu lateral e da barra de baixo legíveis sobre o azul."
  ], fazer: "Nada a fazer: é só atualizar. Peça para todos atualizarem, porque um app antigo passa a só ler o arquivo da equipe." },
  { v: "2.5.0", data: "24/10/2026", itens: [
    "Novo visual azul-marinho: barra lateral no computador e barra de baixo no celular.",
    "Entrada por matrícula e senha pessoal. Só entra quem o Administrador cadastrou e está ativo; perfil desativado não entra.",
    "Senha temporária: na primeira entrada, o app pede para criar a sua senha ali mesmo.",
    "Administrador: menu “Administrador ▾” com Pessoas, Perfis, Logs, Configurações e Novidades. A aba Mais e o selo amarelo saíram.",
    "Pessoas: busca por matrícula, ativar/desativar, Resetar senha, Desbloquear, Editar e Excluir (só depois de desativar).",
    "Analista: atualiza senha, ciclo, datas e escalonamento na Equipe; Meus continua só no aparelho. A sincronização só recebe o que o Administrador assinou, recusa e avisa o resto e nunca apaga nada.",
    "No celular: receba o arquivo que o Administrador envia em Arquivo e backup › Receber arquivo da equipe.",
    "Nova tela de instalação com o passo a passo do seu aparelho."
  ], fazer: "Entre com a matrícula que o Administrador cadastrou. Quem veio da v2.4.0 sem matrícula entra digitando o nome no campo Matrícula até o Administrador cadastrar." },
  { v: "2.4.0", data: "20/10/2026", itens: [
    "Nova aba Gestão, só para o Administrador (aparece depois de “Entrar como administrador”): pessoas com situação ativo, bloqueado ou desativado, Novo analista, Resetar senha, Desbloquear, Tornar ou Remover administrador, Desativar e Reativar.",
    "Cada analista entra com a própria senha pessoal. A senha temporária é trocada no primeiro acesso, e 5 senhas erradas bloqueiam a conta até o Administrador desbloquear.",
    "Mais do analista mais enxuto: Exportar JSON da equipe, Importar para a Equipe, Excel da equipe, Histórico e a senha da equipe foram para a Gestão. O analista importa o backup só em Meus e exporta o Excel só dos próprios cards.",
    "O perfil de gestão passa a se chamar “Administrador” em todas as telas.",
    "Tela nova de instalação: reconhece Android, computador e iPhone/iPad, mostra o passo a passo do seu aparelho primeiro e o botão “Instalar agora” quando o navegador permite."
  ], fazer: "Analista: em Mais › Meu perfil, escolha o seu nome e digite a senha que o Administrador passar. Administrador: defina a senha temporária de quem ainda não tem (Gestão › pessoa › Resetar senha)." },
  { v: "2.3.0", data: "20/10/2026", itens: [
    "Só o Administrador arquiva, compartilha e sugere cards à equipe. O analista cuida dos próprios cards em Meus e atualiza senha, datas, ciclo e escalonamento da Equipe.",
    "As ações de Administrador saem assinadas com a chave do Administrador: na sincronização, o nome sozinho não dá permissão. Exclusões e ações na Lixeira de quem não é Administrador são desfeitas, inclusive vindas de apps antigos.",
    "O analista não troca mais de nome, e ninguém usa o nome de um Administrador sem a senha de Administrador.",
    "Senha de Administrador com confirmação, medidor de força e botão de olho para mostrar ou ocultar.",
    "Card compartilhado chega em Mais › Cards compartilhados, com contador na aba Mais. A lista “Só para…” mostra todos os perfis ativos.",
    "Pasta sem o arquivo da equipe: o app pergunta antes de criar um novo (com perfis, só o Administrador cria).",
    "Quando chega uma versão nova, as abas abertas recarregam sozinhas."
  ] },
  { v: "2.2.0", data: "19/10/2026", itens: [
    "Perfis Administrador e Analista nos cards da Equipe (Mais › Perfis da equipe). Sem perfis configurados, tudo funciona como antes.",
    "Administrador: cria cards da Equipe, muda link e identificação, reativa, exclui, resolve conflitos, troca a senha da equipe e cuida dos perfis (Entrar como administrador).",
    "Analista: atualiza senha, data da troca, ciclo e escalonamento e arquiva. Campos bloqueados aparecem com cadeado: Só o Administrador pode alterar.",
    "Proteção de tela, não um controle forte: apps antigos não respeitam as permissões. Peça para todos atualizarem."
  ] },
  { v: "2.1.0", data: "19/10/2026", itens: ["Organização interna do código para facilitar as próximas melhorias; nada muda no uso."] },
  { v: "2.0.1", data: "18/10/2026", itens: [
    "“Descartar” só fecha a ficha. Na trava de link repetido, “Abrir card existente” agora pergunta antes e avisa qual card está abrindo.",
    "Mesmo link para outra operação: com cliente diferente e preenchido, dá para salvar como outra operação (fica no Histórico).",
    "Card parecido: na trava, “Salvar em Meus e sugerir à equipe” guarda o card em Meus e sugere à equipe, com o selo “Card parecido”.",
    "Compartilhar meu card: escolha Todos ou “Só para…” alguns analistas (só muda quem recebe o aviso de card novo).",
    "Ao excluir um nível do escalonamento, os níveis acima descem um. Card compartilhado restaurado de backup volta a ser seu."
  ] },
  { v: "2.0.0", data: "18/10/2026", itens: [
    "Nova Lixeira em Mais: card excluído fica lá por 30 dias e pode ser restaurado. Os da Equipe voltam para todos.",
    "Quando duas pessoas editam o mesmo card ao mesmo tempo, nada se perde: o app avisa e mostra as duas versões para você escolher.",
    "Na Equipe vale “um link = um card”: não dá para salvar dois cards da Equipe com o mesmo link. Se aparecerem repetidos, o app avisa e ajuda a arquivar um deles.",
    "Ao importar um arquivo antigo, o app não troca os seus cards mais novos sem perguntar, e avisa sobre datas inválidas e textos longos demais.",
    "Uma data errada numa planilha não deixa mais o app em branco.",
    "O bloqueio automático cobre a tela na hora e o card que você estava editando continua lá depois da senha.",
    "Os campos mostram quantos caracteres faltam perto do limite. No celular, o campo em que você está digitando fica sempre visível."] },
  { v: "1.9.9", data: "18/10/2026", itens: ["Card da Equipe repetido (mesmo link e mesmo cliente/operação) não é mais salvo: o app oferece abrir o card que já existe.", "Mesmo link com outro cliente continua só com aviso, que agora mostra o cliente do card existente.", "Em Cards compartilhados, o card que você já tem em Meus não pode ser adicionado de novo e, ao ignorar, some da lista.", "O Histórico mostra os cards compartilhados que você ignorou (só neste aparelho)."] },
  { v: "1.9.8", data: "18/10/2026", itens: ["Nova tela “Cards compartilhados” em Mais: procure nos seus cards e nos da Equipe e veja o que é novo, o que já foi adicionado e o que você compartilhou.", "Selos mostram se o link do card recebido já existe em Meus ou na Equipe.", "Aviso de card repetido só quando o link é exatamente igual, também ao criar ou editar um card. Nada é bloqueado."] },
  { v: "1.9.7", data: "16/10/2026", itens: ["Histórico em Mais mostra as últimas 100 ações: quem adicionou, editou, arquivou ou excluiu cards.", "O card não fecha mais sozinho ao clicar fora: o app pergunta antes de descartar.", "Importação mais segura, com prévia antes de aplicar."] },
  { v: "1.9.6", data: "15/10/2026", itens: ["Corrigido: cards da Equipe arquivados agora podem ser excluídos normalmente.", "Transições mais suaves ao salvar, excluir, entrar e pesquisar."] },
  { v: "1.9.5", data: "15/10/2026", itens: ["O arquivo da equipe pode ser protegido com uma senha da equipe: fora do app ele fica ilegível.", "Cada analista digita a senha da equipe só uma vez por aparelho.", "O gestor pode trocar a senha da equipe e ver a senha atual depois de confirmar a própria senha de login."], fazer: "Quando o app pedir, digite a senha da equipe passada pelo gestor." },
  { v: "1.9.4", data: "15/10/2026", itens: ["Novo botão “Compartilhar meu card”: envia link e escalonamento para a equipe, sem login e senha.", "Quem recebe escolhe adicionar ou ignorar e só preenche a própria senha.", "Sobre (i) com explicação do app e regras de uso."] },
  { v: "1.9.3", data: "14/10/2026", itens: ["Agora, sempre que o app for atualizado, aparece esta tela uma vez com as novidades.", "Em Mais, a lista “Últimas novidades” guarda o que mudou nas versões recentes."] },
  { v: "1.9.2", data: "14/10/2026", itens: ["Novos analistas começam com apenas 1 card de exemplo, que pode ser apagado.", "A exportação e importação do Excel usam só arquivos do próprio app, sem depender da internet."] },
  { v: "1.9.1", data: "14/10/2026", itens: ["Corrige as cópias duplicadas que apareciam na sincronização.", "Agora você vincula a pasta inteira da equipe, e não um arquivo só.", "Novo “Log de erros” em Mais para ver falhas de sincronização."], fazer: "Vincule a pasta da equipe uma vez, em Mais › Arquivo da equipe." },
  { v: "1.9", data: "13/10/2026", itens: ["Os cards da Equipe passam a ser sincronizados entre os analistas por uma pasta compartilhada.", "Cards Individuais continuam só no seu aparelho."] }
];
window.addEventListener("beforeunload", (ev) => { if (!semAvisoAoSair && !document.body.classList.contains("travado") && fichaSuja()) { ev.preventDefault(); ev.returnValue = ""; } });
$("fVisibilidade").addEventListener("change", () => { $("avisoInd").hidden = $("fVisibilidade").value !== "Individual"; });
$("fOlho").dataset.alvo = "fSenha";
ligarOlho($("fOlho"));
if (escAddBtn) escAddBtn.addEventListener("click", () => {
  if (escDraft.length >= LIM.niveis) { toast("Máximo de " + LIM.niveis + " níveis de escalonamento"); return; }
  escDraft.push(nivelEscVazio(escDraft.length + 1));
  renderEscEditor();
});
CAMPOS_LIM.forEach(([id, k]) => ligarContador($(id), LIM[k]));
document.addEventListener("focusin", (ev) => {
  const t = ev.target;
  if (!t || !t.closest || !t.closest(".sheet") || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  setTimeout(() => centralizarCampo(t), 250);
});
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => { const a = document.activeElement; if (a && a.closest && a.closest(".sheet") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) setTimeout(() => centralizarCampo(a), 60); });
$("ficha").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (avisandoLink) return;
  const o = lerFicha();
  if (!o) return;
  const ok = await conferirLinkDuplicado(o);
  if (ok === "abrir") return;
  if (!ok) { setTimeout(() => $("fUrl").focus(), 40); return; }
  if (ok === "meus") { await salvarEmMeusESugerir(o); return; }
  gravar(o, "Acesso salvo");
  if (ok === "outra") registrarOutraOperacao(o);
});
$("atualizarSenha").addEventListener("click", async () => {
  if (avisandoLink) return;
  const o = lerFicha();
  if (!o) return;
  const ok = await conferirLinkDuplicado(o);
  if (ok === "abrir") return;
  if (!ok) { setTimeout(() => $("fUrl").focus(), 40); return; }
  o.ultima = hoje();
  o.senha_atualizada_em = hoje();
  if (ok === "meus") { await salvarEmMeusESugerir(o); return; }
  gravar(o, "Senha atualizada hoje" + (o.ciclo !== "Nunca" ? " · próxima troca em " + o.ciclo + " dias" : ""));
  if (ok === "outra") registrarOutraOperacao(o);
});
$("fechar").addEventListener("click", () => pedirFecharFicha());
document.addEventListener("pointerdown", (ev) => { fundoDown = ev.target; }, true);
window.addEventListener("focus", () => { focoJanelaEm = Date.now(); });
document.querySelectorAll("[data-fecha]").forEach((b) => b.addEventListener("click", () => fecharSheet(b.dataset.fecha)));
document.querySelectorAll(".sheet:not(#dlg):not(#dlgSenha):not(#dlgInstalar):not(#dlgMod):not(#dlgVer), .drawer").forEach((s) => s.addEventListener("click", (ev) => { if (!cliqueNoFundo(ev, s)) return; if (s.id === "sheet") pedirFecharFicha(); else fecharSheet(s.id); }));
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (perguntandoDescarte) return;
  const abertos = [...document.querySelectorAll(".sheet.on, .drawer.on")].filter((s) => !(trocaObrigatoria && s.id === "dlgSenha") && s.id !== "dlgMod" && s.id !== "dlgVer");
  if (abertos.some((s) => s.id === "sheet") && fichaSuja()) { abertos.filter((s) => s.id !== "sheet").forEach((s) => fecharSheet(s.id)); fecharMenus(); pedirFecharFicha(); return; }
  abertos.forEach((s) => fecharSheet(s.id));
  fecharMenus();
  if (!abertos.length && selecao) sairSelecao();
});
$("btnSync").addEventListener("click", () => sincronizar(true));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && syncEstado.vinculado) sincronizar(false); });
const ACOES = { novo: () => abrirFicha(null), exportar: exportarEquipe, backup: backupPessoal, importar: () => $("imp").click(), "importar-xls": escolherPlanilha, "excel-importar": exportarExcelImportar, "excel-consulta": exportarExcelConsulta, sair: sair, trocar: abrirTrocaSenha, tema: () => { const ks = Object.keys(TEMAS); definirTema(ks[(ks.indexOf(temaAtual()) + 1) % ks.length]); } };
$("selExcluir").addEventListener("click", () => excluir(selecionados()));
$("selReativar").addEventListener("click", () => {
  const l = selecionados();
  if (bloqueadoEquipe(l)) return;
  l.forEach((it) => { it.arquivado_em = null; });
  selecao = null;
  save();
  toast(l.length + (l.length === 1 ? " card reativado" : " cards reativados"));
  avisarDuplicadosReativados(l);
});
$("selCancelar").addEventListener("click", () => sairSelecao());
$("dNovo").addEventListener("click", () => abrirFicha(null));
if ($("dImportXls")) $("dImportXls").addEventListener("click", escolherPlanilha);
ligarMenuExcel();
$("imp").addEventListener("change", importarJson);
if ($("impXls")) $("impXls").addEventListener("change", (ev) => { importarPlanilha(ev); });
$("novo").addEventListener("click", () => abrirFicha(null));
$("fGerar").addEventListener("click", () => {
  const o = genOpcoes(); if (o.modo === "palavra") o.modo = "aleatoria";
  const s = gerarSenha(o); const inp = $("fSenha");
  inp.value = s; inp.type = "text"; setOlho($("fOlho"), true);
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  toast("Senha gerada. Ela será gravada ao salvar o card.");
});
$("busca").addEventListener("input", render);
(function iniciarBloqueioAuto() {
  const salvo = parseInt(sessionStorage.getItem(ATIVIDADE_KEY) || "", 10);
  if (salvo) ultimaAtividade = salvo;
  verificarInatividade();
  ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "input"].forEach((ev) =>
    document.addEventListener(ev, () => marcarAtividade(), { passive: true, capture: true }));
  setInterval(verificarInatividade, 15000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verificarInatividade(); });
  window.addEventListener("focus", verificarInatividade);
  window.addEventListener("pageshow", verificarInatividade);
  if (sessionStorage.getItem("caderno-acessos-bloqueado-auto")) {
    sessionStorage.removeItem("caderno-acessos-bloqueado-auto");
    setTimeout(() => toast("Bloqueado por inatividade. Entre novamente."), 300);
  }
})();
aplicarTema(temaAtual());
aplicarIcones();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  // v2.3.0 (item 4): quando a versão nova assume (controllerchange), a aba recarrega. Com a ficha sendo editada, espera fechar.
  const tinhaControle = !!navigator.serviceWorker.controller; let recarregando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!tinhaControle || recarregando) return;
    recarregando = true;
    const tentar = () => { if (typeof fichaSuja === "function" && fichaSuja()) { setTimeout(tentar, 2000); return; } location.reload(); };
    if (typeof fichaSuja === "function" && fichaSuja()) toast("Versão nova instalada: a página recarrega quando você salvar ou fechar a ficha.");
    tentar();
  });
}
// Tela de login: senha padrão (hash no código) ou senha customizada só deste aparelho (localStorage).
const LOGIN_PADRAO = { iter: 310000, salt: "015d5ac2a5ab08fdac13e98dd8b789fc", hash: "033d6adcf778bd29c7199d684d705ecebbd10bb47d86ecd732a0d225ffa2e9b8" };
document.getElementById("loginForm").addEventListener("submit", (ev) => { ev.preventDefault(); enviarLogin(); });
ligarArea();
$("formTrocaSenha").addEventListener("submit", salvarTrocaSenha);
$("tsCancelar").addEventListener("click", () => { if (trocaObrigatoria) sair(); else fecharSheet("dlgSenha"); });
$("dlgSenha").addEventListener("click", (ev) => { if (cliqueNoFundo(ev, $("dlgSenha")) && !trocaObrigatoria) fecharSheet("dlgSenha"); });
document.querySelectorAll(".olho[data-alvo]").forEach(ligarOlho);
aplicarIcones(document.getElementById("login"));
aplicarIcones(document.getElementById("dlgSenha"));
$("nvEntendi").addEventListener("click", () => fecharSheet("dlgNovidades"));
if (restaurarSessaoPerfil()) entrar();
else if (!loginPorPerfil() && sessionStorage.getItem(SESSAO) === tokenSessao()) entrar();
else document.getElementById(loginPorPerfil() ? "loginMatricula" : "loginSenha").focus();
window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  deferredInstall = ev;
  atualizarLinkInstalar();
  if ($("dlgInstalar").classList.contains("on")) desenharInstalar(); // v2.4.0: o botão vira "Instalar agora"
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  marcarInstallHint();
  fecharSheet("dlgInstalar");
  atualizarLinkInstalar();
});
ligarInstalar(); // v2.4.0: tela nova de instalação (js/instalar.js)
