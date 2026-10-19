/* Caderno de Acessos — js/escalonamento.js
 * Escalonamento: níveis, canais, resumo, leitura do texto antigo e o editor de níveis da ficha (renderEscEditor, renumerarNiveis).
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
/* ---------- Escalonamento ---------- */
const CANAIS_ESC = [
  { id: "portal", rotulo: "Portal" },
  { id: "email", rotulo: "E-mail" },
  { id: "telefone", rotulo: "Telefone" },
  { id: "outro", rotulo: "Outro" }
];
function canalRotulo(c) {
  const hit = CANAIS_ESC.find((x) => x.id === c);
  return hit ? hit.rotulo : (c || "Outro");
}
function nivelEscVazio(n) {
  return { nivel: n || 1, canal: "email", valor: "", nome: "", horario: "", obs: "" };
}
function limparNivelEsc(raw) {
  if (!raw || typeof raw !== "object") return null;
  const canal = ["portal", "email", "telefone", "outro"].includes(raw.canal) ? raw.canal : "outro";
  const nivel = Number(raw.nivel);
  return {
    nivel: Number.isFinite(nivel) && nivel > 0 ? Math.floor(nivel) : 1,
    canal: canal,
    valor: String(raw.valor || "").trim(),
    nome: String(raw.nome || "").trim(),
    horario: String(raw.horario || "").trim(),
    obs: String(raw.obs || "").trim()
  };
}
function resumoEscalonamentos(lista) {
  if (!lista || !lista.length) return "";
  return lista.map((n) => {
    const ped = ["N" + n.nivel, canalRotulo(n.canal)];
    if (n.nome) ped.push(n.nome);
    if (n.valor) ped.push(n.valor);
    return ped.join(" · ");
  }).join(" | ");
}
function parseEscalonamentoTexto(texto) {
  const t = String(texto || "").replace(/\u200b/g, "").trim();
  if (!t) return [];
  const linhas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const emailRe = /[\w.+-]+@[\w.-]+\.\w+/g;
  const phoneRe = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}|\b0800[\s.-]?\d{2,4}[\s.-]?\d{3,5}\b/g;
  const urlRe = /https?:\/\/[^\s)\]>]+/gi;
  const niveis = [];
  let atual = null;
  function flush() {
    if (!atual) return;
    if (!atual.valor && !atual.nome && !atual.obs) { atual = null; return; }
    if (!atual.valor && atual.obs) {
      const urls = atual.obs.match(urlRe);
      const emails = atual.obs.match(emailRe);
      const phones = atual.obs.match(phoneRe);
      if (urls && urls[0]) { atual.valor = urls[0]; atual.canal = "portal"; }
      else if (emails && emails[0]) { atual.valor = emails[0]; atual.canal = "email"; }
      else if (phones && phones[0]) { atual.valor = phones[0]; atual.canal = "telefone"; }
    }
    niveis.push(atual);
    atual = null;
  }
  function novoNivel(num, resto) {
    flush();
    atual = nivelEscVazio(num);
    const urls = resto.match(urlRe);
    const emails = resto.match(emailRe);
    const phones = resto.match(phoneRe);
    if (urls && urls[0]) { atual.canal = "portal"; atual.valor = urls[0]; }
    else if (emails && emails[0]) { atual.canal = "email"; atual.valor = emails[0]; }
    else if (phones && phones[0]) { atual.canal = "telefone"; atual.valor = phones[0]; }
    let nome = resto
      .replace(urlRe, " ")
      .replace(emailRe, " ")
      .replace(phoneRe, " ")
      .replace(/[-–—|:]+/g, " ")
      .replace(/\(\s*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    nome = nome.replace(/^(abrir chamado|ligar|enviar|contato|suporte|help\s*desk|plant[aã]o)\b[\s-]*/i, "").trim();
    if (nome && nome.length <= 60) atual.nome = nome;
    atual.obs = resto.trim();
  }
  if (!linhas.length) return [];
  linhas.forEach((line) => {
    const m = line.match(/^(?:n[ií]vel|escalonamento)\s*-?\s*(\d+)\s*[-–—:]?\s*(.*)$/i);
    if (m) { novoNivel(Number(m[1]), m[2] || ""); return; }
    if (!atual) {
      // sem marcador de nível: cria sequência
      novoNivel(niveis.length + 1, line);
      return;
    }
    const urls = line.match(urlRe);
    const emails = line.match(emailRe);
    const phones = line.match(phoneRe);
    if (!atual.valor) {
      if (urls && urls[0]) { atual.canal = "portal"; atual.valor = urls[0]; }
      else if (emails && emails[0]) { atual.canal = "email"; atual.valor = emails[0]; }
      else if (phones && phones[0]) { atual.canal = "telefone"; atual.valor = phones[0]; }
    } else if (emails && emails[0] && atual.canal !== "email") {
      // linha extra com outro contato → novo nível
      novoNivel(niveis.length + (atual ? 1 : 0) + 1, line);
      return;
    }
    if (!atual.nome) {
      let nome = line.replace(urlRe, " ").replace(emailRe, " ").replace(phoneRe, " ").replace(/[-–—|:()]+/g, " ").replace(/\s+/g, " ").trim();
      if (nome && nome.length <= 60) atual.nome = nome;
    }
    atual.obs = (atual.obs ? atual.obs + " | " : "") + line;
  });
  flush();
  // se parser gerou 1 nível genérico sem canal útil, ainda retorna
  return niveis.map((n, i) => { n.nivel = n.nivel || (i + 1); return limparNivelEsc(n); }).filter(Boolean);
}
function niveisDe(it) {
  if (!it) return [];
  if (Array.isArray(it.escalonamentos) && it.escalonamentos.length) {
    return it.escalonamentos.map(limparNivelEsc).filter(Boolean).sort((a, b) => a.nivel - b.nivel);
  }
  return parseEscalonamentoTexto(it.escalonamento);
}
function hrefEsc(nivel) {
  const v = (nivel.valor || "").trim();
  if (!v) return "";
  if (nivel.canal === "email" || /^[\w.+-]+@[\w.-]+\.\w+$/.test(v)) return "mailto:" + v;
  if (nivel.canal === "telefone" || /^[\d\s()+.-]{8,}$/.test(v)) return "tel:" + v.replace(/[^\d+]/g, "");
  if (nivel.canal === "portal" || /^https?:\/\//i.test(v) || /\./.test(v)) return urlSegura(v);
  return "";
}
/* ---------- Editor de escalonamento (formulário) ---------- */
let escDraft = [];
/* [1,2,3] tirando o 1 → [1,2]; [1,2,2,3] tirando um 2 → [1,2,3]; [1,2,2,3] tirando o 1 → [1,1,2]. Só mexe no rascunho da ficha:
 * nada é carimbado até o analista salvar. */
function renumerarNiveis(lista, removido) {
  if (!removido || lista.some((x) => Number(x.nivel) === removido)) return lista;
  lista.forEach((x) => { const n = Number(x.nivel); if (n > removido) x.nivel = n - 1; });
  return lista;
}
function renderEscEditor() {
  const box = $("escLista");
  if (!box) return;
  box.innerHTML = "";
  if (!escDraft.length) {
    box.appendChild(el("p", "esc-vazio", "Nenhum nível ainda. Toque em + Nível."));
    return;
  }
  escDraft.forEach((nv, idx) => {
    const row = el("div", "esc-row");
    row.dataset.idx = String(idx);

    const labN = el("span", "esc-lab", "Nível");
    const inpN = document.createElement("input");
    inpN.type = "number"; inpN.min = "1"; inpN.value = String(nv.nivel || idx + 1);
    inpN.addEventListener("input", () => { escDraft[idx].nivel = Number(inpN.value) || (idx + 1); });

    const labC = el("span", "esc-lab", "Canal");
    const selC = document.createElement("select");
    CANAIS_ESC.forEach((c) => { const o = el("option", "", c.rotulo); o.value = c.id; selC.appendChild(o); });
    selC.value = nv.canal || "email";
    selC.addEventListener("change", () => { escDraft[idx].canal = selC.value; });

    const labV = el("span", "esc-lab", "Valor");
    const inpV = document.createElement("input");
    inpV.type = "text"; inpV.placeholder = "URL, e-mail ou telefone";
    inpV.value = nv.valor || "";
    inpV.addEventListener("input", () => { escDraft[idx].valor = inpV.value; });

    const labNome = el("span", "esc-lab", "Nome");
    const inpNome = document.createElement("input");
    inpNome.type = "text"; inpNome.placeholder = "Contato / área";
    inpNome.value = nv.nome || "";
    inpNome.addEventListener("input", () => { escDraft[idx].nome = inpNome.value; });

    const labH = el("span", "esc-lab", "Horário");
    const inpH = document.createElement("input");
    inpH.type = "text"; inpH.placeholder = "Ex.: 24x7";
    inpH.value = nv.horario || "";
    inpH.addEventListener("input", () => { escDraft[idx].horario = inpH.value; });

    const labO = el("span", "esc-lab", "Obs.");
    const inpO = document.createElement("textarea");
    inpO.rows = 2; inpO.placeholder = "Observação do nível";
    inpO.value = nv.obs || "";
    inpO.addEventListener("input", () => { escDraft[idx].obs = inpO.value; });

    const acoes = el("div", "esc-row-acoes");
    acoes.appendChild(btn("btn pequeno", "trash", "Excluir", () => {
      const [fora] = escDraft.splice(idx, 1);
      escDraft.forEach((x, i) => { if (!x.nivel) x.nivel = i + 1; });
      // v2.0.1 (item 2): se o nível removido ficou vazio, os níveis acima descem 1. Contatos do mesmo nível continuam juntos.
      renumerarNiveis(escDraft, Number(fora && fora.nivel) || idx + 1);
      renderEscEditor();
    }, null, "Excluir este nível de escalonamento"));

    // Cada par rótulo+campo fica num .esc-campo: no celular vira "display:contents" (layout de 2 colunas como antes);
    // em telas largas forma uma grade 2 por linha (Nível+Canal, Valor inteiro, Nome+Horário, Obs inteiro).
    const campo = (lab, inp, cls) => { const d = el("div", "esc-campo" + (cls ? " " + cls : "")); d.appendChild(lab); d.appendChild(inp); return d; };
    const uid = "esc" + idx + "-";
    [[labN, inpN, "n"], [labC, selC, "c"], [labV, inpV, "v"], [labNome, inpNome, "nome"], [labH, inpH, "h"], [labO, inpO, "o"]].forEach(([l, i, k]) => { i.id = uid + k; l.setAttribute("id", uid + k + "-lab"); i.setAttribute("aria-labelledby", uid + k + "-lab"); });
    row.appendChild(campo(labN, inpN, "esc-nivel-campo"));
    row.appendChild(campo(labC, selC));
    row.appendChild(campo(labV, inpV, "cheio"));
    row.appendChild(campo(labNome, inpNome));
    row.appendChild(campo(labH, inpH));
    row.appendChild(campo(labO, inpO, "cheio"));
    ligarContador(inpV, LIM.nValor); ligarContador(inpNome, LIM.nNome); ligarContador(inpH, LIM.nHorario); ligarContador(inpO, LIM.nObs);
    row.appendChild(acoes);
    box.appendChild(row);
  });
  const b = $("escAdd"); if (b) { b.disabled = escDraft.length >= LIM.niveis; b.title = b.disabled ? "Máximo de " + LIM.niveis + " níveis" : ""; }
}
function lerEscDraft() {
  return escDraft.map((n, i) => limparNivelEsc(Object.assign({}, n, { nivel: n.nivel || i + 1 }))).filter((n) => n && (n.valor || n.nome || n.obs));
}
