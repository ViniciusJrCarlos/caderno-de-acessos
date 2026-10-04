const KEY = "caderno-acessos-web-v1";
let aba = "equipe";
let itens = [];
let edit = null;

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function addDias(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function statusDe(it) {
  if (it.arquivado_em) return "Arquivado";
  if (!it.ciclo || it.ciclo === "Nunca") return "Sem expiração";
  if (!it.ultima) return "Ativo";
  const dias = Math.round((new Date(addDias(it.ultima, Number(it.ciclo)) + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 86400000);
  if (dias < 0) return "Vencido";
  if (dias <= 7) return "Vencendo";
  return "Ativo";
}
function rotulo(it) {
  const st = statusDe(it);
  if (st === "Arquivado" || st === "Sem expiração" || st === "Ativo" && (!it.ultima || it.ciclo === "Nunca")) return st === "Sem expiração" ? "Não expira" : st;
  if (!it.ultima || it.ciclo === "Nunca") return st;
  const dias = Math.round((new Date(addDias(it.ultima, Number(it.ciclo)) + "T12:00:00") - new Date(hoje() + "T12:00:00")) / 86400000);
  if (dias < 0) return "Vencido há " + Math.abs(dias) + " dia(s)";
  return "Vence em " + dias + " dias";
}
function exemplos() {
  return [
    { id: "f1", titulo: "Painel Nuvem Azul", aplicacao: "Nuvem Azul", cliente: "Nuvem Azul Tecnologia", categoria: "Interno", visibilidade: "Equipe", url: "https://painel.nuvemazul.example", usuario: "ops.nuvem", senha: "exemplo", ciclo: "60", ultima: hoje(), horario: "Seg–Sex 08–18", escalonamento: "N1 0800", obs: "" },
    { id: "f2", titulo: "Gestor Ponto Certo", aplicacao: "Ponto Certo", cliente: "Ponto Certo Sistemas", categoria: "Interno", visibilidade: "Equipe", url: "https://app.pontocerto.example", usuario: "ops.ponto", senha: "exemplo", ciclo: "60", ultima: hoje(), horario: "", escalonamento: "", obs: "" },
    { id: "f3", titulo: "Portal Fornecedor Alfa", aplicacao: "Alfa Suprimentos", cliente: "Alfa Suprimentos", categoria: "Externo", visibilidade: "Equipe", url: "https://portal.alfasuprimentos.example", usuario: "svc.alfa", senha: "exemplo", ciclo: "30", ultima: addDias(hoje(), -26), horario: "09–17", escalonamento: "Carla", obs: "" }
  ];
}
function load() {
  try { itens = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { itens = []; }
  itens = itens.filter((it) => !(["j1", "j2", "a1"].includes(it.id) && it.senha === "exemplo"));
  if (!itens.length) itens = exemplos();
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(itens));
  render();
}
function visiveis() {
  const q = (document.getElementById("busca").value || "").toLowerCase();
  return itens.filter((it) => {
    const arq = !!it.arquivado_em;
    if (aba === "equipe" && (it.visibilidade !== "Equipe" || arq)) return false;
    if (aba === "meu" && (it.visibilidade !== "Individual" || arq)) return false;
    if (aba === "vencendo" && (arq || ["Vencendo", "Vencido"].indexOf(statusDe(it)) < 0)) return false;
    if (aba === "arquivo" && !arq) return false;
    if (aba === "mais") return false;
    const blob = [it.titulo, it.aplicacao, it.cliente, it.usuario, it.url, it.categoria].join(" ").toLowerCase();
    return !q || blob.indexOf(q) >= 0;
  }).sort((a, b) => (a.aplicacao || "").localeCompare(b.aplicacao || "") || (a.titulo || "").localeCompare(b.titulo || ""));
}
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function render() {
  const box = document.getElementById("lista");
  box.innerHTML = "";
  document.getElementById("sub").textContent = aba === "mais" ? "Exportar, importar, instalar" : "Dados deste aparelho · sem banco";
  document.getElementById("novo").style.display = aba === "mais" ? "none" : "block";
  document.getElementById("busca").style.display = aba === "mais" ? "none" : "block";
  if (aba === "mais") { renderMais(box); return; }
  const list = visiveis();
  if (!list.length) { box.appendChild(el("p", "meta", "Nenhum card nesta aba.")); return; }
  let g = null;
  list.forEach((it) => {
    const nome = it.aplicacao || it.titulo;
    if (nome !== g) { g = nome; box.appendChild(el("div", "grupo", g)); }
    const st = statusDe(it);
    const c = el("article", "card" + (st === "Vencendo" ? " vencendo" : st === "Vencido" ? " vencido" : it.arquivado_em ? " arq" : ""));
    c.appendChild(el("h2", "", it.titulo + (it.cliente ? " · " + it.cliente : "")));
    c.appendChild(el("div", "meta", (it.visibilidade || "") + " · " + (it.categoria || "") + " · ciclo " + (it.ciclo || "Nunca")));
    c.appendChild(el("div", "url", it.url || "—"));
    c.appendChild(el("div", "meta", "Usuário " + (it.usuario || "—") + " · " + rotulo(it)));
    const row = el("div", "acoes");
    addBtn(row, "Mostrar", () => alert(it.senha || "(vazia)"));
    addBtn(row, "Copiar", () => copiar(it.senha || ""));
    addBtn(row, "Abrir", () => { if (it.url) window.open(it.url, "_blank"); });
    addBtn(row, "Editar", () => abrirFicha(it));
    if (it.arquivado_em) addBtn(row, "Reativar", () => { it.arquivado_em = null; save(); }, "ok");
    else addBtn(row, "Arquivar", () => { it.arquivado_em = hoje(); save(); }, "warn");
    c.appendChild(row);
    box.appendChild(c);
  });
}
function addBtn(parent, text, fn, cls) {
  const b = el("button", cls || "", text);
  b.type = "button";
  b.addEventListener("click", fn);
  parent.appendChild(b);
}
function copiar(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).catch(() => {});
  else alert(texto);
}
function renderMais(box) {
  const c = el("article", "card");
  c.appendChild(el("h2", "", "Levar para outro aparelho"));
  c.appendChild(el("p", "meta", "O JSON guarda todos os cards. Na versão nova, importe o arquivo e os campos voltam preenchidos."));
  const row = el("div", "acoes");
  addBtn(row, "Exportar JSON", exportarJson);
  addBtn(row, "Importar JSON", () => document.getElementById("imp").click());
  addBtn(row, "Excel Interno/Externo", exportarExcel);
  c.appendChild(row);
  const inp = document.createElement("input");
  inp.type = "file";
  inp.id = "imp";
  inp.accept = ".json,application/json";
  inp.style.display = "none";
  inp.addEventListener("change", importarJson);
  c.appendChild(inp);
  box.appendChild(c);
  const d = el("article", "card");
  d.appendChild(el("h2", "", "Offline"));
  d.appendChild(el("p", "meta", "Abra pelo Chrome. Se o site estiver publicado, o menu pode oferecer Adicionar à tela inicial. Sem internet, os cards já salvos continuam neste aparelho."));
  box.appendChild(d);
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type }));
  a.download = name;
  a.click();
}
function exportarJson() {
  download("caderno-acessos.json", JSON.stringify({ versao: "web-1", itens: itens }, null, 2), "application/json");
}
function importarJson(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const data = JSON.parse(r.result);
    itens = Array.isArray(data) ? data : (data.itens || []);
    save();
    alert("Importado: " + itens.length + " card(s).");
  };
  r.readAsText(f);
}
function exportarExcel() {
  const head = ["Titulo", "Aplicacao", "Cliente", "Categoria", "Visibilidade", "URL", "Usuario", "Senha", "Ciclo", "UltimaTroca", "Horario", "Escalonamento", "Obs", "Arquivado"];
  function tabela(lista, titulo) {
    let html = "<h2>" + titulo + "</h2><table border='1'><tr>";
    head.forEach((h) => { html += "<th>" + h + "</th>"; });
    html += "</tr>";
    lista.forEach((it) => {
      const vals = [it.titulo, it.aplicacao, it.cliente, it.categoria, it.visibilidade, it.url, it.usuario, it.senha, it.ciclo, it.ultima, it.horario, it.escalonamento, it.obs, it.arquivado_em || ""];
      html += "<tr>";
      vals.forEach((v) => { html += "<td>" + String(v == null ? "" : v).replace(/</g, "") + "</td>"; });
      html += "</tr>";
    });
    return html + "</table>";
  }
  const ext = itens.filter((i) => i.categoria === "Externo");
  const inn = itens.filter((i) => i.categoria !== "Externo");
  download("caderno-acessos.xls", "<html><meta charset='utf-8'><body>" + tabela(ext, "Fornecedores externos") + tabela(inn, "Ferramentas internas") + "</body></html>", "application/vnd.ms-excel");
}
const CAMPOS = [
  ["titulo", "Título"], ["aplicacao", "Aplicação"], ["cliente", "Cliente"],
  ["categoria", "Categoria", ["Externo", "Interno"]],
  ["visibilidade", "Visibilidade", ["Equipe", "Individual"]],
  ["url", "URL do portal"], ["usuario", "Usuário"], ["senha", "Senha"],
  ["ciclo", "Ciclo", ["30", "60", "90", "Nunca"]],
  ["ultima", "Última troca AAAA-MM-DD"],
  ["horario", "Horário"], ["escalonamento", "Escalonamento"], ["obs", "Observação"]
];
function abrirFicha(it) {
  edit = it ? Object.assign({}, it) : { id: Math.random().toString(16).slice(2, 10), visibilidade: aba === "meu" ? "Individual" : "Equipe", categoria: "Externo", ciclo: "90", ultima: hoje() };
  document.getElementById("fichaTitulo").textContent = it ? "Editar acesso" : "Novo acesso";
  const box = document.getElementById("campos");
  box.innerHTML = "";
  CAMPOS.forEach((def) => {
    const lab = el("label", "", def[1]);
    let input;
    if (def[2]) {
      input = document.createElement("select");
      def[2].forEach((o) => {
        const op = document.createElement("option");
        op.value = o;
        op.textContent = o;
        if ((edit[def[0]] || def[2][0]) === o) op.selected = true;
        input.appendChild(op);
      });
    } else if (def[0] === "obs" || def[0] === "escalonamento") {
      input = document.createElement("textarea");
      input.value = edit[def[0]] || "";
    } else {
      input = document.createElement("input");
      input.value = edit[def[0]] || "";
    }
    input.dataset.k = def[0];
    lab.appendChild(input);
    box.appendChild(lab);
  });
  document.getElementById("sheet").classList.add("on");
}
function fechar() { document.getElementById("sheet").classList.remove("on"); }
document.getElementById("fechar").addEventListener("click", fechar);
document.getElementById("salvar").addEventListener("click", () => {
  document.querySelectorAll("#campos [data-k]").forEach((input) => { edit[input.dataset.k] = input.value.trim(); });
  const i = itens.findIndex((x) => x.id === edit.id);
  if (i >= 0) itens[i] = edit; else itens.push(edit);
  fechar();
  save();
});
document.getElementById("ciclo").addEventListener("click", () => {
  const input = document.querySelector("#campos [data-k=ultima]");
  if (input) input.value = hoje();
});
document.getElementById("novo").addEventListener("click", () => abrirFicha(null));
document.querySelectorAll(".nav button").forEach((b) => {
  b.addEventListener("click", () => {
    aba = b.dataset.aba;
    document.querySelectorAll(".nav button").forEach((x) => x.classList.toggle("on", x === b));
    render();
  });
});
document.getElementById("busca").addEventListener("input", render);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
load();
render();
