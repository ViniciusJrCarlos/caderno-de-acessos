/* Caderno de Acessos — js/mais.js
 * Aba Mais: arquivo da equipe (vincular, criar, usar, desvincular), renderMais(), novidades (funções; o texto fica em js/app.js).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
function exigirNome() {
  if (autor()) return true;
  toast("Informe seu nome antes (ele aparece nas alterações para a equipe)");
  const i = $("syncNome"); if (i) i.focus();
  return false;
}
function carimbarSemData() {
  const agora = new Date().toISOString();
  itens.filter(compartilhado).forEach((it) => { if (!it.updatedAt) { it.updatedAt = agora; it.updatedBy = autor(); } });
  Dados.gravarTexto(KEY, JSON.stringify(todosItens()));
  const meta = syncMeta(); meta.ultimaSync = ""; gravarMeta(meta);
}
/* v2.3.0 (item 12): a pasta escolhida tem o arquivo da equipe? (sem criar nada) */
async function pastaTemArquivo(a) {
  try { const d = await a.carregar(); if (!d) return true; const h = await d.getFileHandle(SYNC_ARQUIVO); const f = await h.getFile(); return f.size > 0; }
  catch (e) { return !(e && e.name === "NotFoundError"); }
}
async function vincularPasta() {
  if (!exigirNome()) return;
  try {
    const a = window.__syncAdaptadorTeste || syncPasta;
    await a.vincular();
    if (!(await pastaTemArquivo(a))) {
      const comPerfis = perfisAtivos() || perfisNoArquivo();
      if (comPerfis && papelAtual() !== "admin") {
        await a.desvincular(); await atualizarEstadoSync();
        aviso("Esta pasta não tem o arquivo da equipe", "Com os perfis configurados, só o Administrador cria um arquivo da equipe novo. Confira se escolheu a pasta certa (json-caderno-acessos) ou peça ao Administrador.");
        if (emPainel()) render();
        return;
      }
      const criar = await dialogo({ titulo: "Esta pasta não tem o arquivo da equipe. Criar um novo?", texto: "Na pasta escolhida não existe o " + SYNC_ARQUIVO + ". Se a equipe já usa um arquivo, cancele e escolha a pasta certa. Criar um novo começa um arquivo da equipe vazio nesta pasta, com os cards da Equipe deste aparelho.", ok: "Criar um novo", cancelar: "Cancelar" });
      if (!criar) { await a.desvincular(); await atualizarEstadoSync(); toast("Nada foi vinculado"); if (emPainel()) render(); return; }
    }
    if (!window.__syncAdaptadorTeste && syncArquivo && await syncArquivo.vinculado()) await syncArquivo.desvincular(); // migra do modo arquivo
    Dados.gravarTexto(MIGRAR_KEY, "1");
    carimbarSemData();
    await atualizarEstadoSync();
    const ok = await sincronizar(true);
    if (ok) toast("Pasta da equipe vinculada: " + syncEstado.nome);
  } catch (e) { if (!e || e.name !== "AbortError") toast("Não foi possível vincular a pasta (" + ((e && e.name) || "erro") + ")."); }
  if (emPainel()) render();
}
async function criarArquivoEquipe() {
  if (!exigirNome()) return;
  if ((perfisAtivos() || perfisNoArquivo()) && papelAtual() !== "admin") { toast("Com os perfis configurados, só o Administrador cria um arquivo da equipe novo."); return; } // v2.3.0 (item 12)
  try {
    await syncArquivo.criar(SYNC_ARQUIVO);
    carimbarSemData();
    await atualizarEstadoSync();
    await sincronizar(true);
  } catch (e) { if (!e || e.name !== "AbortError") toast("Não foi possível criar o arquivo."); }
  if (emPainel()) render();
}
async function usarArquivoEquipe() {
  if (!exigirNome()) return;
  try {
    await syncArquivo.abrir();
    const meta = syncMeta(); meta.ultimaSync = ""; gravarMeta(meta);
    await atualizarEstadoSync();
    await sincronizar(true);
  } catch (e) { if (!e || e.name !== "AbortError") toast("Não foi possível abrir o arquivo."); }
  if (emPainel()) render();
}
async function desvincularArquivo() {
  const ok = await dialogo({ titulo: "Desvincular a pasta/arquivo da equipe?", texto: "Os cards continuam neste aparelho. Nada é apagado na pasta.", ok: "Desvincular", cancelar: "Cancelar" });
  if (!ok) return;
  const a = adaptador(); if (a) await a.desvincular();
  Dados.remover(PERFIS_NO_ARQUIVO_KEY); // v2.3.0: outra pasta pode não ter perfis
  syncEstado.pendente = false;
  await atualizarEstadoSync();
  render();
  toast("Desvinculado");
}
/* v1.9 → v1.9.1: quem só tinha o ARQUIVO vinculado recebe, uma vez, o convite para vincular a PASTA. */
async function sugerirPasta() {
  if (!syncEstado.vinculado || syncEstado.modo !== "arquivo" || !syncEstado.pastaSuportada || Dados.texto(MIGRAR_KEY)) return;
  Dados.gravarTexto(MIGRAR_KEY, "1");
  const ok = await dialogo({ titulo: "Vincular a pasta da equipe", texto: "Para evitar as cópias de conflito do OneDrive (caderno-equipe-NOMEDOPC.json), vincule a PASTA json-caderno-acessos em vez de só o arquivo. O Caderno passa a juntar essas cópias sozinho e a gravar um log de erros na pasta.", ok: "Vincular a pasta", cancelar: "Agora não" });
  if (ok) vincularPasta();
}
/* v2.4.0: modo "gestao" (aba Gestão do Administrador, ou sem perfis): tudo, com senha da equipe e Histórico.
 * Com perfis, no Mais: só Vincular, Sincronizar, Digitar/Ver senha da equipe e Desvincular (o resto foi para a Gestão). */
function blocoArquivoEquipe(box, bloco, modo) {
  const completo = modo === "gestao" || modo === "config" || !comPerfis();
  if (!syncEstado.suportado) {
    bloco("Arquivo da equipe", "Este navegador não permite usar a pasta sincronizada (comum no celular e no Firefox). Continue usando Exportar/Importar JSON normalmente.", []);
    return;
  }
  const nome = el("input"); nome.type = "text"; nome.id = "syncNome"; nome.placeholder = "Seu nome"; nome.value = autor(); nome.maxLength = 40; nome.autocomplete = "name";
  const salvarNome = btn("btn", "check", "Salvar nome", () => {
    const v = nome.value.trim(); if (!v) { toast("Digite seu nome"); return; }
    if (!nomeLivre(v)) return; // v2.3.0 (item 5)
    Dados.gravarTexto(AUTOR_KEY, v); toast("Nome salvo"); render();
  });
  const linhaNome = el("div", "sync-nome"); linhaNome.appendChild(nome); linhaNome.appendChild(salvarNome);
  // v2.3.0 (item 5): com perfil, o nome vem do perfil (só o admin renomeia, no Painel de perfis)
  const meu = perfisAtivos() ? meuPerfil() : null;
  if (meu) { nome.disabled = true; salvarNome.disabled = true; nome.title = salvarNome.title = "O seu nome vem do seu perfil. Só o Administrador renomeia (Painel de perfis)."; linhaNome.hidden = true; }
  let botoes;
  if (syncEstado.vinculado) {
    botoes = [btn("btn pri", "refresh", "Sincronizar agora", () => sincronizar(true))];
    if (syncEstado.modo === "arquivo" && syncEstado.pastaSuportada) botoes.push(btn("btn", "folder", "Vincular a pasta da equipe", vincularPasta));
    botoesSenhaEquipe().filter((b) => completo || /Digitar senha da equipe|Ver senha da equipe/.test(b.textContent)).forEach((b) => botoes.push(b));
    botoes.push(btn("btn", "x", "Desvincular", desvincularArquivo));
  } else if (syncEstado.pastaSuportada) {
    botoes = [btn("btn pri", "folder", "Vincular a pasta da equipe", vincularPasta)];
  } else {
    botoes = completo ? [btn("btn pri", "download", "Criar arquivo da equipe", criarArquivoEquipe), btn("btn", "upload", "Usar arquivo existente", usarArquivoEquipe)] : [btn("btn pri", "upload", "Usar arquivo existente", usarArquivoEquipe)];
  }
  const ult = syncMeta().ultimaSync;
  bloco("Arquivo da equipe", syncEstado.vinculado
    ? (syncEstado.modo === "pasta" ? "Pasta vinculada: " : "Arquivo vinculado: ") + syncEstado.nome + (ult ? " · Última sincronização " + dataHoraBR(ult) : "") + "." + (syncEstado.modo === "arquivo" && syncEstado.pastaSuportada ? " Recomendado: vincule a pasta para juntar as cópias de conflito do OneDrive." : "") + " Só cards de Equipe vão para o arquivo; cards Individuais e suas senhas nunca saem deste aparelho." + textoSenhaEquipe()
    : syncEstado.pastaSuportada
      ? "Escolha a pasta do OneDrive da equipe (json-caderno-acessos). O Caderno usa o arquivo caderno-equipe.json (se a pasta não tiver, pergunta antes de criar), junta as cópias de conflito do OneDrive e grava um log de erros na pasta. Só cards de Equipe vão para o arquivo."
      : "Use um arquivo na pasta do OneDrive (ex.: json-caderno-acessos). Uma pessoa cria o arquivo; as outras usam o arquivo existente. Só cards de Equipe vão para o arquivo.",
    [linhaNome].concat(botoes));
  if (completo && modo !== "config") blocoHistorico(box); // v2.4.0: com perfis, o Histórico fica na Gestão
  if (modo === "gestao" && comPerfis()) return;
  const le = lerJSON(LOGERR_KEY, []);
  const c2 = el("article", "card painel-mais historico log-erros");
  c2.appendChild(el("h3", "", "Log de erros"));
  if (!le.length) c2.appendChild(el("p", "meta", "Nenhum erro de sincronização registrado neste aparelho."));
  else {
    c2.appendChild(el("p", "meta", syncEstado.modo === "pasta" ? "Também gravado em caderno-equipe-log.csv na pasta da equipe. Não inclui senhas." : "Não inclui senhas."));
    const ul = el("ul", "hist-lista");
    le.slice(0, 20).forEach((x) => { const li = el("li"); li.appendChild(el("span", "hist-quando", dataHoraBR(x[0]))); li.appendChild(el("span", "", x[1] + " · " + x[2] + (x[3] ? " · " + x[3] : "") + " — " + x[4])); ul.appendChild(li); });
    c2.appendChild(ul);
    const row = el("div", "acoes-mais");
    row.appendChild(btn("btn", "trash", "Limpar log deste aparelho", () => { Dados.remover(LOGERR_KEY); render(); }));
    c2.appendChild(row);
  }
  box.appendChild(c2);
}
function renderMais(box) {
  const bloco = (titulo, texto, botoes) => {
    const c = el("article", "card painel-mais");
    c.appendChild(el("h3", "", titulo));
    c.appendChild(el("p", "meta", texto));
    const row = el("div", "acoes-mais");
    botoes.forEach((b) => row.appendChild(b));
    c.appendChild(row);
    box.appendChild(c);
  };
  const tema = temaAtual();
  const bt = Object.keys(TEMAS).map((k) => {
    const b = btn("btn tema-op" + (k === tema ? " on" : ""), null, TEMAS[k].nome, () => definirTema(k));
    b.dataset.tema = k;
    b.setAttribute("aria-pressed", k === tema ? "true" : "false");
    b.insertAdjacentHTML("afterbegin", '<span class="amostra amostra-' + String(k).replace(/[^\w-]/g, "") + '"></span>');
    return b;
  });
  blocoNovidades(box);
  bloco("Tema", "Aparência só deste aparelho. Vale também para a tela de login.", bt);
  try { blocoAvisos(box); } catch (e) {}
  const equipe = podeArquivosEquipe() && !comPerfis(); // v2.4.0: sem perfis, tudo como antes; com perfis, os itens da equipe estão na Gestão
  if (comPerfis()) { try { blocoPerfis(box); } catch (e) {} }
  blocoArquivoEquipe(box, bloco, comPerfis() ? "mais" : "");
  if (!comPerfis()) { try { blocoPerfis(box); } catch (e) {} }
  blocoModelos(box);
  try { blocoLixeira(box); } catch (e) {}
  if (equipe) bloco("Compartilhar com a equipe", "Gera o JSON para os outros analistas. Cards Individuais vão sem usuário e sem senha (só título, aplicação, cliente, URL etc.).",
    [btn("btn pri", "download", "Exportar JSON", exportarEquipe)]);
  bloco("Novo acesso", "Cria um card seu em Meus" + (equipe ? " ou da Equipe." : ". Login e senha ficam só neste aparelho."), [btn("btn", "plus", "Novo acesso", () => abrirFicha(null))]);
  bloco("Backup pessoal (inclui minhas senhas)", "Arquivo completo, com os usuários e senhas dos seus acessos Individuais. Use só para levar para outro aparelho seu. Não compartilhe.",
    [btn("btn", "lock", "Backup pessoal (inclui minhas senhas)", backupPessoal)]);
  if (equipe) bloco("Importar", "Junta os cards do arquivo com os deste aparelho, só pelo id (cards diferentes com o mesmo nome não se juntam). Cards que só existem aqui continuam. Se o arquivo tiver uma versão mais antiga de um card seu, o app pergunta antes (o padrão é manter o seu). Um usuário ou senha vazio no arquivo nunca apaga o que você já tem; um preenchido substitui o seu se você escolher substituir.",
    [btn("btn", "upload", "Importar JSON", () => document.getElementById("imp").click()),
     btn("btn", "table", "Importar planilha Excel", escolherPlanilha)]);
  else bloco("Importar backup", "Traz os cards de um backup pessoal seu para Meus. Cards da Equipe do arquivo ficam de fora (chegam pela sincronização).",
    [btn("btn", "upload", "Importar backup", () => document.getElementById("imp").click())]);
  if (equipe) bloco("Planilha Excel", "“Excel para importar”: formato simples em abas (externos, internos, arquivados e escalonamento), para subir em “Importar planilha”. “Excel para consulta”: com navegação e escalonamento em blocos, somente leitura. Senhas individuais saem em branco.",
    [btn("btn", "table", "Excel para importar", exportarExcelImportar, null, "Formato simples para importar no app"),
     btn("btn", "book", "Excel para consulta", exportarExcelConsulta, null, "Com navegação e escalonamento, somente leitura")]);
  else bloco("Planilha Excel (Meus)", "Só os seus cards (Meus). “Para importar”: formato simples em abas. “Para consulta”: com navegação e escalonamento, somente leitura.",
    [btn("btn", "table", "Excel dos meus cards (para importar)", exportarExcelImportar),
     btn("btn", "book", "Excel dos meus cards (para consulta)", exportarExcelConsulta)]);
  const minAtual = minutosBloqueio();
  const bb = BLOQ_OPCOES.map((n) => {
    const b = btn("btn tema-op" + (n === minAtual ? " on" : ""), null, n ? n + " min" : "Nunca", () => definirBloqueio(n));
    b.setAttribute("aria-pressed", n === minAtual ? "true" : "false");
    return b;
  });
  bloco("Bloqueio automático", "Volta para a tela de login depois de um tempo sem uso. Vale só para este aparelho.", bb);
  bloco("Senha deste aparelho", "Altera a senha de acesso salva só neste navegador. Outros aparelhos continuam com a senha padrão até alguém trocar lá também.",
    [btn("btn", "lock", "Trocar senha", abrirTrocaSenha)]);
  bloco("Offline e instalação", "Instale o app uma vez com internet (fora da VPN). Depois funciona sem internet; quando houver internet, a versão nova chega sozinha.",
    [btn("btn", "download", appJaInstalado() ? "App instalado" : "Como instalar", () => abrirInstalar(true)), btn("btn", "logout", "Sair (bloquear)", sair)]);
}
function novidadesItens(n, box) {
  const ul = el("ul", "");
  n.itens.forEach((t) => ul.appendChild(el("li", "", t)));
  box.appendChild(ul);
  if (n.fazer) {
    const f = el("div", "nv-f");
    f.appendChild(el("b", "", "O que fazer: "));
    f.appendChild(document.createTextNode(n.fazer));
    box.appendChild(f);
  }
}
function blocoNovidades(box) {
  const c = el("article", "card painel-mais nv-lista");
  c.appendChild(el("h3", "", "Últimas novidades"));
  NOVIDADES.slice(0, 5).forEach((n, i) => {
    const d = el("div", "nv-l");
    const t = el("div", "nv-v", "v" + n.v + " ");
    t.appendChild(el("small", "", "· " + n.data));
    if (i === 0) t.appendChild(el("span", "nv-novo", "novo"));
    d.appendChild(t);
    novidadesItens(n, d);
    c.appendChild(d);
  });
  box.appendChild(c);
}
function mostrarNovidadesSePendente() {
  let vista = null;
  try { vista = Dados.texto(NOVIDADES_VISTA); } catch (e) {}
  if (vista === APP_VERSAO) return;
  if (trocaObrigatoria || document.body.classList.contains("travado")) return;
  if ($("dlgInstalar").classList.contains("on") || $("dlgSenha").classList.contains("on")) return;
  const n = NOVIDADES[0];
  $("nvTitulo").textContent = "Novidades da v" + n.v;
  $("nvData").textContent = n.data;
  const corpo = $("nvCorpo");
  corpo.textContent = "";
  novidadesItens(n, corpo);
  try { Dados.gravarTexto(NOVIDADES_VISTA, APP_VERSAO); } catch (e) {}
  abrirSheet("dlgNovidades");
  setTimeout(() => $("nvEntendi").focus(), 40);
}
