/* Caderno de Acessos — js/politica.js (v3.0.3)
 * Regras de cadastro e de senha: nome da pessoa, matrícula só com números, política de senha (comuns, nome do app, nome e matrícula),
 * histórico das 3 últimas senhas (só hash), bloqueio temporário de 15 min depois de 5 senhas erradas (persistido no aparelho, vale
 * também para o Administrador e sobrevive ao F5) e uma linha de Log publicada direto no arquivo da equipe.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const HIST_SENHAS_MAX = 3;
const TRAVA_LOGIN_KEY = "caderno-login-trava";   // { "m:<matrícula>": { n: erros seguidos, ate: fim do bloqueio (ms) } }
const TRAVA_LOGIN_MS = 15 * 60000;
const TRAVA_LOGIN_MAX = 5;
const DIAS_REATIVAR_RESET = 7;
const MSG_LOGIN_GENERICA = "Matrícula ou senha inválida.";
const MSG_LOGIN_TRAVADO = "Muitas tentativas. Tente de novo em 15 minutos.";
const NOMES_APP = ["caderno", "acessos"];
const SENHAS_COMUNS = new Set(["123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "123123", "654321", "abc123", "qwerty", "qwerty123", "password", "password1", "password123", "passw0rd", "senha", "senha1", "senha12", "senha123", "senha1234", "senha12345", "admin", "admin1", "admin123", "admin1234", "administrador", "mudar123", "mudar1234", "trocar123", "teste123", "teste1234", "brasil", "brasil123", "bemvindo", "bemvindo1", "bemvindo123", "welcome", "welcome1", "welcome123", "iloveyou", "letmein", "mudarsenha", "novasenha", "minhasenha", "suporte123", "acesso123", "empresa123"]);
const PALAVRAS_COMUNS = new Set(["senha", "password", "admin", "administrador", "qwerty", "qwertyuiop", "asdfgh", "abc", "abcdef", "mudar", "trocar", "teste", "brasil", "bemvindo", "welcome", "iloveyou", "letmein", "mudarsenha", "novasenha", "minhasenha", "empresa", "suporte"]);
function semAcentoMin(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function soDigitosInput(i, max) {
  if (!i) return i;
  i.inputMode = "numeric"; i.maxLength = max || 7; i.setAttribute("pattern", "\\d*"); i.autocomplete = "off";
  i.addEventListener("input", () => { const v = i.value.replace(/\D/g, "").slice(0, max || 7); if (v !== i.value) i.value = v; });
  return i;
}
/* Nome: letras (com acento), espaço, hífen e apóstrofo; 2+ letras; até 40; nunca a senha temporária nem a matrícula. */
function validarNomePessoa(nome, o) {
  o = o || {};
  const v = String(nome || "").trim();
  if (!v) return "Digite o nome.";
  if (v.length > 40) return "Nome: no máximo 40 caracteres.";
  const t = String(o.temp || "");
  if (t && (v === t || v.indexOf(t) >= 0 || semAcentoMin(v).indexOf(semAcentoMin(t)) >= 0)) return "O nome não pode ser a senha temporária.";
  const m = String(o.matricula || "").trim();
  if (m && v.replace(/\s/g, "").indexOf(m) >= 0) return "O nome não pode conter a matrícula.";
  if (/^[\d\s.\-]+$/.test(v)) return "Nome: use letras (não só números).";
  if (!/^\p{L}[\p{L}\p{M} '’\-]*$/u.test(v)) return "Nome: use só letras e espaços (sem números, símbolos ou emoji).";
  if ((v.match(/\p{L}/gu) || []).length < 2) return "Nome: pelo menos 2 letras.";
  return "";
}
/* Política da senha nova (além de senhaForte): sem nome do app, sem matrícula, sem o nome da pessoa e fora da lista de comuns. */
function validarSenhaNova(nova, o) {
  o = o || {};
  if (!senhaForte(nova)) return REGRAS_SENHA;
  const s = semAcentoMin(nova);
  if (NOMES_APP.some((w) => s.indexOf(w) >= 0)) return "A senha não pode conter o nome do app ou da empresa (caderno, acessos).";
  const mat = String(o.matricula || "").trim();
  if (mat && s.indexOf(mat.toLowerCase()) >= 0) return "A senha não pode conter a sua matrícula.";
  const partes = semAcentoMin(o.nome).split(/[^a-z]+/).filter((w) => w.length >= 3);
  if (partes.some((w) => s.indexOf(w) >= 0)) return "A senha não pode conter o seu nome.";
  const leet = s.replace(/@/g, "a").replace(/4/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/\$|5/g, "s").replace(/7/g, "t");
  const leet2 = s.replace(/@/g, "a").replace(/4/g, "a").replace(/3/g, "e").replace(/0/g, "o").replace(/\$|5/g, "s").replace(/7/g, "t"); // sem trocar 1/! (ex.: P@ssw0rd!)
  const base = s.replace(/[^a-z0-9]/g, ""), letras = s.replace(/[^a-z]/g, ""), letrasLeet = leet.replace(/[^a-z]/g, ""), letrasLeet2 = leet2.replace(/[^a-z]/g, "");
  if (SENHAS_COMUNS.has(base) || SENHAS_COMUNS.has(leet.replace(/[^a-z0-9]/g, "")) || SENHAS_COMUNS.has(leet2.replace(/[^a-z0-9]/g, "")) || PALAVRAS_COMUNS.has(letras) || PALAVRAS_COMUNS.has(letrasLeet) || PALAVRAS_COMUNS.has(letrasLeet2) || /^(.)\1+$/.test(base)) return "Essa senha é muito comum ou fácil de adivinhar. Escolha outra.";
  return "";
}
/* Histórico: a senha atual (se não for temporária) + as 3 anteriores. Nunca guarda texto, só hash PBKDF2 com o sal de cada uma. */
function hashesUsados(c) {
  const l = [];
  if (c && c.senhaHash && c.senhaSalt && !c.senhaTemp) l.push({ h: c.senhaHash, s: c.senhaSalt, i: c.senhaIter });
  if (c && c.adminHash && c.adminSalt && !c.trocarSenha) l.push({ h: c.adminHash, s: c.adminSalt, i: c.adminIter });
  ((c && c.senhaHist) || []).forEach((x) => { if (x && x.h && x.s) l.push(x); });
  return l;
}
async function senhaJaUsada(c, nova) {
  for (const x of hashesUsados(c)) { try { if (hashIguais(await derivarSenha(nova, x.s, x.i || PERFIS_ITER), x.h)) return true; } catch (e) {} }
  return false;
}
const MSG_SENHA_REPETIDA = "A senha nova não pode repetir uma das suas últimas senhas.";
/* Chamado por alterarPerfil: quando o hash muda, o anterior (se não era temporário) entra no histórico (máx. 3). */
function empurrarHistSenha(antes, depois, mud) {
  const add = [];
  if (mud.senhaHash && antes.senhaHash && antes.senhaHash !== mud.senhaHash && !antes.senhaTemp && antes.senhaSalt) add.push({ h: antes.senhaHash, s: antes.senhaSalt, i: antes.senhaIter || PERFIS_ITER });
  if (mud.adminHash && antes.adminHash && antes.adminHash !== mud.adminHash && !antes.trocarSenha && antes.adminSalt) add.push({ h: antes.adminHash, s: antes.adminSalt, i: antes.adminIter || PERFIS_ITER });
  if (!add.length) return;
  depois.senhaHist = add.concat(antes.senhaHist || []).filter((x, i, l) => l.findIndex((y) => y.h === x.h) === i).slice(0, HIST_SENHAS_MAX);
}
/* ---------- Bloqueio temporário do login (item 14 e item 3) ----------
 * A chave é a matrícula digitada (exista ou não): a resposta é igual para matrícula existente e inexistente. */
function chaveTrava(mat) { return "m:" + normMat(mat); }
function lerTravas() { const o = lerJSON(TRAVA_LOGIN_KEY, {}); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
function saltAtual(p) { return p ? String((p.papel === "admin" ? p.adminSalt : p.senhaSalt) || "") : ""; }
/* O bloqueio vale até o fim dos 15 min, ou até o Administrador resetar a senha (a marca da senha atual muda e libera). */
function travaAte(mat) {
  const t = lerTravas()[chaveTrava(mat)]; if (!(t && t.ate && Date.now() < t.ate)) return 0;
  if (t.s) { const p = lerPerfis().find((x) => x.matricula && x.matricula === normMat(mat)); if (p && saltAtual(p) && saltAtual(p) !== t.s) return 0; }
  return t.ate;
}
function limparTrava(mat) { const o = lerTravas(); if (o[chaveTrava(mat)]) { delete o[chaveTrava(mat)]; Dados.gravarTexto(TRAVA_LOGIN_KEY, JSON.stringify(o)); } }
/* Devolve true quando este erro fechou o bloqueio de 15 min. */
function registrarErroLogin(mat, perfil) {
  const o = lerTravas(), k = chaveTrava(mat), agora = Date.now();
  Object.keys(o).forEach((x) => { if (o[x] && o[x].ate && o[x].ate < agora - TRAVA_LOGIN_MS) delete o[x]; });
  const t = o[k] && !(o[k].ate && agora >= o[k].ate) ? o[k] : { n: 0, ate: 0 };
  t.n = (t.n || 0) + 1; let travou = false;
  if (t.n >= TRAVA_LOGIN_MAX) { t.n = 0; t.ate = agora + TRAVA_LOGIN_MS; t.s = saltAtual(perfil); travou = true; }
  o[k] = t; Dados.gravarTexto(TRAVA_LOGIN_KEY, JSON.stringify(o));
  if (travou && perfil) publicarLinhaLog("Bloqueio temporário (" + TRAVA_LOGIN_MAX + " senhas erradas): " + perfil.nome, perfil.nome);
  return travou;
}
function limparTravaPerfil(p) { if (!p) return; if (p.matricula) limparTrava(p.matricula); limparTrava("id-" + p.id); }
/* Linha de Log: no histórico deste aparelho e, quando a pasta está liberada, direto no arquivo da equipe (o Administrador vê). Sem senha. */
async function publicarLinhaLog(texto, quem) {
  const linha = { id: "pl-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tipo: "texto", card: "", quem: quem || autor(), quando: new Date().toISOString(), escopo: "Equipe", texto: texto };
  try { addHist(linha); } catch (e) {}
  try {
    if (!window.CadernoSync || !syncEstado.vinculado) return false;
    const a = adaptador(); if (!a || !(await a.permissao(false))) return false;
    const bruto = await a.ler(); const d = await abrirDocEquipe(bruto, true);
    if (!d || !CadernoSync.docValido(d) || versaoArquivoNova(d)) return false;
    const doc = JSON.parse(JSON.stringify(d));
    doc.historico = CadernoSync.mesclarHistorico([doc.historico || [], [linha]], CadernoSync.HIST_MAX);
    delete doc.gravacao;
    await a.gravar(await fecharDocEquipe(doc, bruto));
    return true;
  } catch (e) { return false; }
}
/* ---------- Reativar (item 12) ---------- */
function diasDesde(iso) { const t = CadernoSync.ts(iso); return t ? (Date.now() - t) / 864e5 : Infinity; }
function reativarExigeReset(p) {
  if (!p) return false;
  if (p.inativoDesde && diasDesde(p.inativoDesde) >= DIAS_REATIVAR_RESET) return true; // inativo há 7+ dias
  if (!p.ultimoAcesso) return diasDesde(p.criadoEm || p.updatedAt) >= DIAS_REATIVAR_RESET; // nunca entrou e foi criado há 7+ dias
  return !p.inativoDesde && diasDesde(p.ultimoAcesso) >= DIAS_REATIVAR_RESET; // inativo de antes da v3.0.3 (sem a data): usa o último acesso
}
async function reativarPessoa(p) {
  if (reativarExigeReset(p)) return resetarSenha(p, { reativar: true });
  await alterarPerfil(p.id, { ativo: true }, "Perfil reativado: " + p.nome); toast(p.nome + " reativado(a)"); return true;
}
