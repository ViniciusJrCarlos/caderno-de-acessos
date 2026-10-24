/* Caderno de Acessos — js/senha-equipe.js
 * Senha da equipe no arquivo caderno-equipe.json: abrir/fechar o documento cifrado, proteger, pedir e ver a senha (usa js/cripto-equipe.js).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- v1.9.5: senha da equipe no arquivo caderno-equipe.json (ver js/cripto-equipe.js) ---------- */
const SE_KEY = "caderno-acessos-senha-equipe";        // { atual: salt, por, em, acao } — nunca a senha
const SE_OLHO_KEY = "caderno-acessos-senha-equipe-olho"; // senha da equipe cifrada pela senha de login (botão "Ver")
const WRAP_SALT_KEY = "caderno-acessos-olho-salt";
const seEstado = { protegido: !!lerJSON(SE_KEY, {}).atual, precisaSenha: false, env: null, pendente: null, dispensado: false, abrindo: false };
let chaveLoginSessao = null;
function lerSE() { return lerJSON(SE_KEY, {}); }
function wrapSalt() { let s = Dados.texto(WRAP_SALT_KEY); if (!s) { s = CadernoCripto.b64(CadernoCripto.aleatorio(16)); Dados.gravarTexto(WRAP_SALT_KEY, s); } return s; }
function lembrarChaveLogin(senha) { if (window.CadernoCripto) CadernoCripto.chaveDeLogin(senha, wrapSalt()).then((k) => { chaveLoginSessao = k; }).catch(() => {}); }
async function guardarOlho(senhaEquipe, salt, chaveLogin) {
  if (!chaveLogin) return;
  const o = await CadernoCripto.embrulhar(chaveLogin, salt, senhaEquipe);
  Dados.gravarTexto(SE_OLHO_KEY, JSON.stringify({ salt: salt, iv: o.iv, ct: o.ct }));
}
async function reembrulharOlho(antiga, nova) {
  const rec = lerJSON(SE_OLHO_KEY, null);
  try {
    const kNova = await CadernoCripto.chaveDeLogin(nova, wrapSalt()); chaveLoginSessao = kNova;
    if (!rec) return;
    const senha = await CadernoCripto.desembrulhar(await CadernoCripto.chaveDeLogin(antiga, wrapSalt()), rec.salt, rec);
    await guardarOlho(senha, rec.salt, kNova);
  } catch (e) { Dados.remover(SE_OLHO_KEY); }
}
function erroSE(nome, env) { const e = new Error("O arquivo da equipe está protegido com a senha da equipe."); e.name = nome; e.env = env; return e; }
async function abrirDocEquipe(d, copia) {
  if (!window.CadernoCripto || !CadernoCripto.ehProtegido(d)) return d;
  const reg = await CadernoCripto.chaveGuardada(d.kdf.salt);
  if (!reg || !(await CadernoCripto.conferirChave(d, reg.chave))) throw erroSE(copia ? "SenhaEquipeCopia" : "SenhaEquipeNecessaria", d);
  const doc = await CadernoCripto.abrir(d, reg.chave);
  if (!copia) {
    seEstado.protegido = true; seEstado.precisaSenha = false;
    const se = lerSE();
    if (se.atual !== d.kdf.salt && !(se.atual && CadernoSync.ts(se.em) > CadernoSync.ts(d.senha_em) && await CadernoCripto.chaveGuardada(se.atual)))
      Dados.gravarTexto(SE_KEY, JSON.stringify({ atual: d.kdf.salt, por: d.senha_por || "", em: d.senha_em || "", acao: d.senha_acao || "" }));
  }
  return doc;
}
/* Protegido se: ativando/trocando agora, o arquivo já vinha protegido, ou este aparelho sabe que a equipe usa senha (arquivo recriado sem senha volta a ser protegido). */
function precisaCifrar(bruto) { const se = lerSE(); return !!(se.atual && bruto && !CadernoCripto.ehProtegido(bruto)); }
/* v2.3.0 (item 1): o envelope cifrado diz só SE há perfis (sem nomes), para um aparelho novo não ter acesso total antes de decifrar. */
function marcarPerfis(env, doc) { if (env && doc && Array.isArray(doc.perfis) && doc.perfis.some((p) => p && p.papel === "admin" && p.ativo !== false)) env.perfis = true; return env; }
async function fecharDocEquipe(doc, bruto) {
  if (!window.CadernoCripto) return doc;
  const p = seEstado.pendente;
  if (p) return marcarPerfis(await CadernoCripto.fechar(doc, p, p.info), doc);
  const se = lerSE();
  if (!se.atual) return doc;
  const reg = await CadernoCripto.chaveGuardada(se.atual);
  if (!reg) { if (CadernoCripto.ehProtegido(bruto)) throw erroSE("SenhaEquipeNecessaria", bruto); return doc; }
  return marcarPerfis(await CadernoCripto.fechar(doc, { salt: se.atual, iter: reg.iter, chave: reg.chave, verif: reg.verif }, { por: se.por, em: se.em, acao: se.acao }), doc);
}
async function concluirSenhaPendente(a) {
  const p = seEstado.pendente; if (!p) return;
  seEstado.pendente = null; seEstado.protegido = true; seEstado.precisaSenha = false;
  Dados.gravarTexto(SE_KEY, JSON.stringify({ atual: p.salt, por: p.info.por, em: p.info.em, acao: p.info.acao }));
  const txt = (p.info.acao === "ativada" ? "Arquivo da equipe protegido com senha da equipe por " : "Senha da equipe trocada por ") + p.info.por + " em " + dataHoraBR(p.info.em);
  registrarHistorico([txt]);
  try { addHist({ id: "se-" + p.salt, tipo: p.info.acao === "ativada" ? "se-ativada" : "se-trocada", card: "Arquivo da equipe", quem: p.info.por, quando: p.info.em, escopo: "Equipe" }); if (emPainel()) render(); } catch (e) {}
  try { if (a && a.registrarLog) await a.registrarLog([new Date().toLocaleString("pt-BR"), p.info.por, p.info.acao === "ativada" ? "senha da equipe ativada" : "senha da equipe trocada", "", ""]); } catch (e) {}
}
function textoSenhaEquipe() {
  const se = lerSE();
  if (seEstado.precisaSenha) return " 🔒 Arquivo protegido com senha da equipe: digite a senha da equipe para sincronizar.";
  if (seEstado.protegido) return " 🔒 Protegido com senha da equipe" + (se.por ? " · senha " + (se.acao === "ativada" ? "criada" : "alterada") + " por " + se.por + (se.em ? " em " + dataHoraBR(se.em) : "") : "") + ". Fora do app o arquivo fica ilegível.";
  return " Sem senha da equipe: quem abrir a pasta consegue ler os cards da Equipe.";
}
function botoesSenhaEquipe() {
  if (!window.CadernoCripto || !(window.crypto && crypto.subtle)) return [];
  if (seEstado.precisaSenha) return [btn("btn pri", "lock", "Digitar senha da equipe", () => pedirSenhaEquipe(seEstado.env))];
  if (!seEstado.protegido) return [btn("btn", "lock", "Proteger arquivo com senha da equipe", () => abrirProtegerEquipe(false))];
  const out = podeAdminEquipe() ? [btn("btn", "key", "Trocar senha da equipe", () => abrirProtegerEquipe(true))] : [];
  const olho = lerJSON(SE_OLHO_KEY, null);
  if (olho && olho.salt === lerSE().atual) out.push(btn("btn", "eye", "Ver senha da equipe", verSenhaEquipe));
  return out;
}
function campoSenha(box, id, rot, auto) {
  const l = el("label", "se-campo"); l.appendChild(el("span", "", rot));
  const i = el("input"); i.type = "password"; i.id = id; i.autocomplete = auto || "off"; i.spellcheck = false;
  l.appendChild(i); box.appendChild(l); return i;
}
function abrirProtegerEquipe(trocar) {
  if (!exigirNome()) return;
  if (!podeAdminEquipe()) { toast(DICA_ADMIN + " (senha da equipe)."); return; }
  return janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", trocar ? "Trocar senha da equipe" : "Proteger arquivo com senha da equipe"));
    box.appendChild(el("p", "meta", trocar ? "O arquivo é cifrado de novo com a senha nova. Cada analista vai digitar a senha nova uma vez. Passe a senha nova só para quem continua na equipe." : "O caderno-equipe.json passa a ficar ilegível fora do app. Cada analista digita esta senha uma vez por aparelho. A senha não fica gravada no arquivo: se a equipe inteira esquecer, o arquivo não abre (os cards continuam nos aparelhos)."));
    const s1 = campoSenha(box, "seNova", trocar ? "Nova senha da equipe" : "Senha da equipe", "new-password");
    const s2 = campoSenha(box, "seConf", "Digite de novo", "new-password");
    const ger = botaoDlg("", "Gerar frase fácil de lembrar", () => { const f = CadernoCripto.frase(); s1.value = s2.value = f; s1.type = s2.type = "text"; validar(); });
    box.appendChild(ger);
    const lg = campoSenha(box, "seLogin", "Sua senha de login (confirma que é você)", "current-password");
    const av = el("p", "se-aviso"); const er = el("p", "se-erro"); box.appendChild(av); box.appendChild(er);
    function validar() { const r = CadernoCripto.avaliar(s1.value); av.textContent = s1.value ? (r.ok ? r.aviso : r.msg) : "Dica: 3 ou 4 palavras e um número, como “cafe-azul-mesa-27”. Evite só números ou datas."; }
    s1.addEventListener("input", validar); validar();
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Cancelar", () => fim(false)));
    const ok = botaoDlg("pri", trocar ? "Trocar senha" : "Ativar", async () => {
      er.textContent = "";
      const r = CadernoCripto.avaliar(s1.value);
      if (!r.ok) { er.textContent = r.msg; s1.focus(); return; }
      if (s1.value !== s2.value) { er.textContent = "As duas senhas não são iguais."; s2.focus(); return; }
      ok.disabled = true;
      try {
        if (!(await conferirSenha(lg.value))) { er.textContent = "Senha de login incorreta."; lg.select(); return; }
        if (trocar && seEstado.precisaSenha) { er.textContent = "Desbloqueie o arquivo com a senha atual da equipe antes de trocar."; return; }
        const k = await CadernoCripto.novaChave(s1.value);
        await CadernoCripto.guardarChave(k.salt, { chave: k.chave, iter: k.iter, verif: k.verif });
        const kl = await CadernoCripto.chaveDeLogin(lg.value, wrapSalt()); chaveLoginSessao = kl;
        await guardarOlho(s1.value, k.salt, kl);
        k.info = { por: autor(), em: new Date().toISOString(), acao: trocar ? "trocada" : "ativada" };
        seEstado.pendente = k;
        s1.value = s2.value = lg.value = "";
        fim(true);
        const feito = await sincronizar(true);
        if (feito && !seEstado.pendente) toast(trocar ? "Senha da equipe trocada. Passe a senha nova para a equipe." : "Arquivo da equipe protegido com a senha da equipe");
        else toast("A senha da equipe será aplicada na próxima sincronização.");
        render();
      } catch (e) { er.textContent = "Não foi possível aplicar a senha (" + ((e && e.name) || "erro") + ")."; }
      finally { ok.disabled = false; }
    });
    bb.appendChild(ok); box.appendChild(bb);
  });
}
async function pedirSenhaEquipe(env) {
  if (!env || seEstado.abrindo || document.body.classList.contains("travado")) return;
  seEstado.abrindo = true;
  const desbloqueou = await janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", "Arquivo da equipe protegido"));
    box.appendChild(el("p", "meta", (lerSE().atual ? "A senha da equipe foi trocada" + (env.senha_por ? " por " + env.senha_por : "") + ". " : "") + "Digite a senha da equipe passada pelo gestor. Você só faz isso uma vez neste aparelho."));
    const s = campoSenha(box, "seSenha", "Senha da equipe", "off");
    const er = el("p", "se-erro"); box.appendChild(er);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Agora não", () => { seEstado.dispensado = true; fim(false); }));
    const ok = botaoDlg("pri", "Desbloquear", async () => {
      er.textContent = ""; ok.disabled = true;
      try {
        const chave = await CadernoCripto.abrirComSenha(env, s.value);
        await CadernoCripto.guardarChave(env.kdf.salt, { chave: chave, iter: env.kdf.iter, verif: env.verif });
        if (chaveLoginSessao) await guardarOlho(s.value, env.kdf.salt, chaveLoginSessao);
        Dados.gravarTexto(SE_KEY, JSON.stringify({ atual: env.kdf.salt, por: env.senha_por || "", em: env.senha_em || "", acao: env.senha_acao || "" }));
        if (env.senha_por) addHist({ id: "se-" + env.kdf.salt, tipo: env.senha_acao === "ativada" ? "se-ativada" : "se-trocada", card: "Arquivo da equipe", quem: env.senha_por, quando: env.senha_em || new Date().toISOString(), escopo: "Equipe" });
        if (env.senha_por) registrarHistorico([(env.senha_acao === "ativada" ? "Arquivo da equipe protegido com senha da equipe por " : "Senha da equipe trocada por ") + env.senha_por + (env.senha_em ? " em " + dataHoraBR(env.senha_em) : "")]);
        s.value = ""; fim(true);
      } catch (e) { er.textContent = e && e.name === "SenhaEquipeIncorreta" ? "Senha da equipe incorreta. Confira com o gestor." : "Não foi possível conferir a senha (" + ((e && e.name) || "erro") + ")."; s.select(); }
      finally { ok.disabled = false; }
    });
    s.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ok.click(); });
    bb.appendChild(ok); box.appendChild(bb);
    setTimeout(() => s.focus(), 60);
  });
  seEstado.abrindo = false;
  if (desbloqueou) { seEstado.precisaSenha = false; seEstado.dispensado = false; await sincronizar(true); toast("Arquivo da equipe desbloqueado neste aparelho"); }
  if (emPainel()) render();
}
function verSenhaEquipe() {
  let timer = null;
  return janela("dlgSE", (box, fim) => {
    box.appendChild(el("h3", "", "Ver senha da equipe"));
    box.appendChild(el("p", "meta", "Confirme sua senha de login. A senha da equipe aparece por 10 segundos."));
    const lg = campoSenha(box, "seVerLogin", "Sua senha de login", "current-password");
    const er = el("p", "se-erro"); box.appendChild(er);
    const out = el("div", "se-mostra"); out.hidden = true; box.appendChild(out);
    const bb = el("div", "dlg-botoes");
    bb.appendChild(botaoDlg("", "Fechar", () => { clearInterval(timer); fim(false); }));
    const ok = botaoDlg("pri", "Mostrar", async () => {
      er.textContent = ""; ok.disabled = true;
      try {
        if (!(await conferirSenha(lg.value))) { er.textContent = "Senha de login incorreta."; lg.select(); return; }
        const rec = lerJSON(SE_OLHO_KEY, null);
        const senha = await CadernoCripto.desembrulhar(await CadernoCripto.chaveDeLogin(lg.value, wrapSalt()), rec.salt, rec);
        lg.value = "";
        let n = 10; out.hidden = false; out.textContent = "";
        const code = el("code", "se-senha", senha); const cnt = el("small", "", " some em " + n + " s"); out.appendChild(code); out.appendChild(cnt);
        timer = setInterval(() => { n--; cnt.textContent = " some em " + n + " s"; if (n <= 0) { clearInterval(timer); out.textContent = ""; out.hidden = true; fim(true); } }, 1000);
      } catch (e) { er.textContent = "Não foi possível mostrar a senha neste aparelho."; }
      finally { ok.disabled = false; }
    });
    lg.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ok.click(); });
    bb.appendChild(ok); box.appendChild(bb);
    setTimeout(() => lg.focus(), 60);
  });
}
