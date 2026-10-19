/* Caderno de Acessos — js/gerador.js
 * Gerador de senhas (aleatória ou a partir de palavra) e força da senha.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Aba Mais ---------- */
/* ---------- Gerador de senhas ---------- */
const GEN_KEY = "caderno-acessos-gerador";
const GEN_PAD = { modo: "aleatoria", tam: 16, mai: true, min: true, num: true, sim: true, parecidos: true };
const GEN_SETS = { mai: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", min: "abcdefghijklmnopqrstuvwxyz", num: "0123456789", sim: "!@#$%&*?-_=+.:;" };
const PARECIDOS = /[O0oIl1|]/g;
function genOpcoes() {
  try { return Object.assign({}, GEN_PAD, JSON.parse(localStorage.getItem(GEN_KEY) || "{}")); } catch (e) { return Object.assign({}, GEN_PAD); }
}
function genSalvar(o) { const c = Object.assign({}, o); delete c.palavra; localStorage.setItem(GEN_KEY, JSON.stringify(c)); }
function rnd(n) {
  const lim = Math.floor(0x100000000 / n) * n; const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= lim);
  return a[0] % n;
}
function escolher(str) { return str[rnd(str.length)]; }
function embaralhar(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
function genConjuntos(o) {
  return ["mai", "min", "num", "sim"].filter((k) => o[k]).map((k) => o.parecidos ? GEN_SETS[k].replace(PARECIDOS, "") : GEN_SETS[k]);
}
function gerarAleatoria(o) {
  const sets = genConjuntos(o.mai || o.min || o.num || o.sim ? o : Object.assign({}, o, { min: true }));
  const tam = Math.max(sets.length, Math.min(64, (o.tam | 0) || 16));
  const todos = sets.join("");
  const out = sets.map(escolher);
  while (out.length < tam) out.push(escolher(todos));
  return embaralhar(out).join("");
}
const LEET = { a: "4@", e: "3", i: "1!", o: "0", s: "5$", t: "7", g: "9", b: "8", l: "1", z: "2" };
function gerarDePalavra(o) {
  const base = String(o.palavra || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  if (!base) return "";
  const w = base.split("").map((ch) => {
    const lc = ch.toLowerCase();
    if (LEET[lc] && rnd(100) < 45) return escolher(LEET[lc]);
    return rnd(2) ? ch.toUpperCase() : lc;
  });
  const extra = GEN_SETS.num + GEN_SETS.sim + GEN_SETS.mai;
  const alvo = Math.max((o.tam | 0) || 16, w.length + 4);
  const meio = 1 + rnd(2);
  for (let i = 0; i < meio; i++) w.splice(1 + rnd(Math.max(1, w.length - 1)), 0, escolher(extra));
  while (w.length < alvo) { if (rnd(3) === 0) w.unshift(escolher(extra)); else w.push(escolher(extra)); }
  let s = w.join("");
  if (o.parecidos) s = s.replace(PARECIDOS, () => escolher("23456789"));
  if (!/[A-Z]/.test(s)) s += escolher("ABCDEFGHJKMNPQRSTUVWXYZ");
  if (!/\d/.test(s)) s += escolher("23456789");
  if (!/[^A-Za-z0-9]/.test(s)) s += escolher(GEN_SETS.sim);
  return s;
}
function gerarSenha(o) { o = o || genOpcoes(); return o.modo === "palavra" ? gerarDePalavra(o) : gerarAleatoria(o); }
function forcaSenha(s) {
  if (!s) return { n: 0, rot: "—" };
  let pool = 0;
  if (/[a-z]/.test(s)) pool += 26;
  if (/[A-Z]/.test(s)) pool += 26;
  if (/\d/.test(s)) pool += 10;
  if (/[^A-Za-z0-9]/.test(s)) pool += 15;
  const bits = s.length * Math.log2(pool || 1);
  if (bits < 40) return { n: 1, rot: "Fraca" };
  if (bits < 60) return { n: 2, rot: "Média" };
  if (bits < 80) return { n: 3, rot: "Forte" };
  return { n: 4, rot: "Muito forte" };
}
let genAtual = "";
let genPalavra = "";
function renderGerador(box) {
  const o = genOpcoes(); o.palavra = genPalavra;
  const c = el("article", "card painel-mais gerador");
  c.appendChild(el("h3", "", "Gerador de senhas"));
  c.appendChild(el("p", "meta", "Gera senhas fortes neste aparelho, sem internet. Só as opções ficam salvas."));
  const modos = el("div", "acoes-mais gen-modos");
  const corpo = el("div", "gen-corpo");
  const val = el("code", "gen-valor", "");
  const barra = el("div", "gen-forca"); const fill = el("span", "gen-forca-fill"); barra.appendChild(fill);
  const rot = el("span", "gen-forca-rot", "");
  const mostrar = (s) => { genAtual = s; val.textContent = s || "Digite uma palavra base"; const f = forcaSenha(s); fill.className = "gen-forca-fill f" + f.n; rot.textContent = "Força: " + f.rot; };
  const atualizar = () => { genSalvar(o); mostrar(gerarSenha(o)); };
  const desenhar = () => {
    modos.textContent = ""; corpo.textContent = "";
    [["aleatoria", "Aleatória"], ["palavra", "A partir de uma palavra"]].forEach(([k, t]) => {
      const b = btn("btn tema-op" + (o.modo === k ? " on" : ""), null, t, () => { o.modo = k; desenhar(); atualizar(); });
      b.setAttribute("aria-pressed", o.modo === k ? "true" : "false"); modos.appendChild(b);
    });
    if (o.modo === "palavra") {
      const lab = el("label", "gen-lab", "Palavra base");
      const inp = el("input"); inp.type = "text"; inp.id = "genPalavra"; inp.value = genPalavra; inp.placeholder = "Ex.: girassol"; inp.autocomplete = "off"; inp.spellcheck = false;
      inp.addEventListener("input", () => { genPalavra = o.palavra = inp.value; atualizar(); });
      lab.appendChild(inp); corpo.appendChild(lab);
      corpo.appendChild(el("p", "hint", "Troca algumas letras por números/símbolos, mistura maiúsculas e acrescenta caracteres aleatórios. Cada “Gerar” cria uma variação."));
    }
    const lt = el("label", "gen-lab");
    const tTxt = el("span", "", "Tamanho: " + o.tam);
    const sl = el("input"); sl.type = "range"; sl.id = "genTam"; sl.min = "8"; sl.max = "40"; sl.value = String(o.tam);
    sl.addEventListener("input", () => { o.tam = +sl.value; tTxt.textContent = "Tamanho: " + o.tam; atualizar(); });
    lt.appendChild(tTxt); lt.appendChild(sl); corpo.appendChild(lt);
    const tg = el("div", "gen-toggles");
    const opts = o.modo === "palavra" ? [["parecidos", "Evitar parecidos (O 0 l 1 I)"]] :
      [["mai", "Maiúsculas"], ["min", "Minúsculas"], ["num", "Números"], ["sim", "Símbolos"], ["parecidos", "Evitar parecidos (O 0 l 1 I)"]];
    opts.forEach(([k, t]) => {
      const l = el("label", "gen-chk"); const cb = el("input"); cb.type = "checkbox"; cb.dataset.op = k; cb.checked = !!o[k];
      cb.addEventListener("change", () => {
        o[k] = cb.checked;
        if (!o.mai && !o.min && !o.num && !o.sim) { o[k] = true; cb.checked = true; toast("Deixe pelo menos um tipo marcado"); }
        atualizar();
      });
      l.appendChild(cb); l.appendChild(el("span", "", t)); tg.appendChild(l);
    });
    corpo.appendChild(tg);
  };
  c.appendChild(modos); c.appendChild(corpo);
  const saida = el("div", "gen-saida"); saida.appendChild(val); c.appendChild(saida);
  const fr = el("div", "gen-forca-linha"); fr.appendChild(barra); fr.appendChild(rot); c.appendChild(fr);
  const ac = el("div", "acoes-mais");
  ac.appendChild(btn("btn pri", "refresh", "Gerar", atualizar));
  ac.appendChild(btn("btn", "copy", "Copiar", () => copiar(genAtual, "Senha")));
  c.appendChild(ac);
  box.appendChild(c);
  desenhar(); atualizar();
}
