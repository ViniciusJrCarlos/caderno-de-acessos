/* Caderno de Acessos — sincronização do arquivo da equipe (v1.9; modelos v1.9.4; v2.0.0: identidade só pelo id,
 * cópia de conflito guardada, lixeira de 30 dias, datas saneadas, normUrl conservador)
 * Lógica de merge pura + adaptadores de armazenamento.
 * Interface de adaptador (para trocar no futuro por um servidor):
 *   { id, suportado(): bool, vinculado(): Promise<bool>, nome(): Promise<string>,
 *     permissao(pedir:bool): Promise<bool>, ler(): Promise<doc|null>, gravar(doc): Promise<void>,
 *     criar(nomeSugerido): Promise<bool>, abrir(): Promise<bool>, desvincular(): Promise<void> }
 */
(function (g) {
  "use strict";
  const TIPO = "caderno-equipe";
  const RETER_TOMBSTONE_DIAS = 180;

  function ts(v) { const n = Date.parse(v || ""); return isNaN(n) ? 0 : n; }
  // v2.0.0: baseAt (versão em que a edição se baseou) também é metadado: não conta como mudança de conteúdo.
  /* v2.0.0: comparação profunda (chaves ordenadas em todos os níveis). A fórmula da v1.9.9 (semMetaV1) passava a lista de chaves
   * do card como filtro também para os níveis de escalonamento, então mudar só o valor/canal de um nível passava despercebido
   * (a edição não era carimbada nem enviada à equipe). semMetaV1 fica só para migrar as marcas antigas sem recarimbar. */
  function canon(v) {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") { const o = {}; Object.keys(v).sort().forEach((k) => { if (v[k] !== undefined) o[k] = canon(v[k]); }); return o; }
    return v;
  }
  function semMeta(it) { const c = Object.assign({}, it); delete c.updatedAt; delete c.updatedBy; delete c.baseAt; return JSON.stringify(canon(c)); }
  function semMetaV1(it) { const c = Object.assign({}, it); delete c.updatedAt; delete c.updatedBy; delete c.baseAt; return JSON.stringify(c, Object.keys(c).sort()); }
  const LIXEIRA_DIAS = 30;

  /* v1.9.4: "Compartilhar meu card". Modelos ficam numa coleção separada ("modelos"), que versões antigas ignoram.
   * Lista branca: só estes campos podem sair. Login e senha NUNCA. */
  /* v2.0.1: sugeridoPara (lista de nomes que recebem o aviso de card novo; vazio = todos) e parecidoCom (nome do card da Equipe com o
   * mesmo link, para o selo "Card parecido"). Versões antigas descartam os dois: o card aparece para todos, como um compartilhado comum. */
  const CAMPOS_MODELO = ["id", "nome", "url", "sistema", "escalonamento", "escalonamentos", "obs", "sharedBy", "createdAt", "updatedAt", "updatedBy", "sugeridoPara", "parecidoCom"];
  const CAMPOS_NIVEL = ["nivel", "canal", "nome", "valor", "horario", "obs"];
  function limparModelo(m) {
    const o = {};
    CAMPOS_MODELO.forEach((k) => {
      if (m == null || m[k] == null) return;
      if (k === "escalonamentos") {
        if (!Array.isArray(m[k])) return;
        o[k] = m[k].map((n) => { const x = {}; CAMPOS_NIVEL.forEach((c) => { if (n && n[c] != null) x[c] = n[c]; }); return x; });
      } else if (k === "sugeridoPara") {
        if (!Array.isArray(m[k])) return;
        const vistos = new Set(); const l = [];
        m[k].forEach((n) => { if (typeof n !== "string") return; const t = n.trim().slice(0, 120); const c = t.toLowerCase(); if (t && !vistos.has(c) && l.length < 20) { vistos.add(c); l.push(t); } });
        if (l.length) o[k] = l;
      } else if (k === "parecidoCom") {
        if (typeof m[k] === "string" && m[k].trim()) o[k] = m[k].trim().slice(0, 200);
      } else o[k] = typeof m[k] === "string" || typeof m[k] === "number" ? m[k] : String(m[k]);
    });
    return o;
  }
  /* v1.9.7: todo card vindo de fora (importação, arquivo da equipe, cópia de conflito) passa por aqui.
   * Lista branca de campos, tudo vira texto com limite; chaves perigosas (__proto__ etc.) nunca entram. Devolve null se inválido. */
  const CAMPOS_CARD = { id: 64, titulo: 200, aplicacao: 200, cliente: 200, categoria: 20, visibilidade: 20, url: 2000, usuario: 500, senha: 500,
    ciclo: 10, ultima: 40, horario: 500, escalonamento: 5000, obs: 5000, arquivado_em: 40, senha_atualizada_em: 40, updatedAt: 40, updatedBy: 120,
    modeloId: 80, modeloDono: 80, modeloPor: 120, baseAt: 40 };
  /* v2.0.0: limites dos níveis de escalonamento (os mesmos da ficha). */
  const LIMITES_NIVEL = { max: 20, valor: 2000, nome: 200, horario: 200, obs: 1000 };
  /* v2.0.0: datas inválidas viram vazias (uma data como "ontem" derrubava a lista na v1.9.9). */
  const CAMPOS_DATA = ["ultima", "arquivado_em", "senha_atualizada_em"];
  function dataValida(v) {
    const t = String(v == null ? "" : v).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (!m) return "";
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (isNaN(d) || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3] || +m[1] < 1900 || +m[1] > 2200) return "";
    return m[0];
  }
  function cicloValido(v) {
    const t = String(v == null ? "" : v).trim();
    if (/^\d{1,4}$/.test(t) && +t > 0) return String(+t);
    return t ? "Nunca" : "";
  }
  function isoValido(v) { const t = String(v == null ? "" : v).trim(); return t && !isNaN(Date.parse(t)) ? t.slice(0, 40) : ""; }
  const PROIBIDAS = new Set(["__proto__", "constructor", "prototype"]);
  function txt(v, max) { if (v == null) return ""; if (typeof v === "object") return ""; return String(v).slice(0, max); }
  function normalizarNivel(n, info) {
    if (!n || typeof n !== "object" || Array.isArray(n)) return null;
    const nv = Number(n.nivel);
    const t = (v, k) => { const s = txt(v, LIMITES_NIVEL[k]); if (info && v != null && typeof v !== "object" && String(v).length > LIMITES_NIVEL[k]) info.cortados.push("escalonamento." + k); return s; };
    return { nivel: Number.isFinite(nv) && nv > 0 ? Math.min(Math.floor(nv), 99) : 1,
      canal: ["portal", "email", "telefone", "outro"].indexOf(n.canal) >= 0 ? n.canal : "outro",
      valor: t(n.valor, "valor"), nome: t(n.nome, "nome"), horario: t(n.horario, "horario"), obs: t(n.obs, "obs") };
  }
  /* v2.0.0: info (opcional) recebe { cortados: [campos], datasInvalidas: [campos] } para avisar na importação (nenhum corte silencioso). */
  function normalizarCard(raw, info) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const o = {};
    Object.keys(CAMPOS_CARD).forEach((k) => {
      if (PROIBIDAS.has(k) || !Object.prototype.hasOwnProperty.call(raw, k)) return;
      const v = raw[k];
      if (k === "arquivado_em" && (v == null || v === "")) { o[k] = null; return; }
      if (v == null) return;
      if (typeof v === "object") return; // tipo errado (objeto/array no lugar de texto): ignora o campo
      if (info && String(v).length > CAMPOS_CARD[k]) info.cortados.push(k);
      o[k] = txt(v, CAMPOS_CARD[k]);
    });
    // v2.0.0: datas e ciclo saneados (data inválida vira vazia; ciclo inválido vira "Nunca")
    CAMPOS_DATA.forEach((k) => {
      if (!(k in o) || o[k] == null || o[k] === "") return;
      const d = dataValida(o[k]);
      if (!d && info) info.datasInvalidas.push(k);
      o[k] = d || (k === "arquivado_em" ? null : "");
    });
    if ("arquivado_em" in o && o.arquivado_em === "") o.arquivado_em = null;
    if ("ciclo" in o) { const c = cicloValido(o.ciclo); if (c !== o.ciclo && o.ciclo !== "" && info) info.datasInvalidas.push("ciclo"); o.ciclo = c; }
    ["updatedAt", "baseAt"].forEach((k) => { if (k in o) o[k] = isoValido(o[k]); });
    const esc = Array.isArray(raw.escalonamentos) ? raw.escalonamentos : [];
    if (info && esc.length > LIMITES_NIVEL.max) info.cortados.push("escalonamentos (máx. " + LIMITES_NIVEL.max + " níveis)");
    // v2.0.0: escalonamentos sempre presente (lista vazia quando não há), para o card normalizado ser estável (sem recarimbos falsos)
    o.escalonamentos = esc.slice(0, LIMITES_NIVEL.max).map((n) => normalizarNivel(n, info)).filter(Boolean);
    if (!("arquivado_em" in o)) o.arquivado_em = null;
    if (o.id != null) o.id = o.id.trim();
    if (o.visibilidade && o.visibilidade !== "Individual") o.visibilidade = "Equipe";
    if (o.categoria && o.categoria !== "Externo") o.categoria = "Interno";
    return o;
  }
  /* v2.0.0: saneia as datas de um card guardado neste aparelho (no lugar), sem mexer em mais nada. Devolve true se mudou. */
  function sanearDatas(it) {
    if (!it || typeof it !== "object") return false;
    let mudou = false;
    CAMPOS_DATA.forEach((k) => {
      const v = it[k];
      if (v == null || v === "") return;
      const d = dataValida(v);
      const novo = d || (k === "arquivado_em" ? null : "");
      if (novo !== v) { it[k] = novo; mudou = true; }
    });
    if (it.ciclo != null && it.ciclo !== "") { const c = cicloValido(it.ciclo); if (c !== String(it.ciclo)) { it.ciclo = c; mudou = true; } }
    return mudou;
  }
  /* Separa itens válidos dos inválidos (sem id ou que não são objeto). */
  function filtrarItens(lista) {
    const ok = [], invalidos = [];
    (Array.isArray(lista) ? lista : []).forEach((raw, i) => {
      const c = normalizarCard(raw);
      if (!c || !c.id || !(c.titulo || c.aplicacao)) invalidos.push({ pos: i, titulo: c ? (c.titulo || c.aplicacao || c.id || "") : "" });
      else ok.push(c);
    });
    return { itens: ok, invalidos: invalidos };
  }
  /* Documento remoto limpo: itens normalizados, tombstones e histórico válidos. */
  function limparDoc(d) {
    if (!docValido(d)) return { doc: d, invalidos: [] };
    const f = filtrarItens(d.itens);
    const out = { tipo: TIPO, versao: d.versao, itens: f.itens,
      removidos: (Array.isArray(d.removidos) ? d.removidos : []).filter((t) => t && typeof t === "object" && (typeof t.id === "string" || typeof t.id === "number")).map((t) => ({ id: String(t.id).slice(0, 64), deletedAt: txt(t.deletedAt, 40), deletedBy: txt(t.deletedBy, 120), titulo: txt(t.titulo, 200) })) };
    if (Array.isArray(d.modelos)) out.modelos = d.modelos.filter((m) => m && typeof m === "object" && !Array.isArray(m));
    if (Array.isArray(d.modelosRemovidos)) out.modelosRemovidos = d.modelosRemovidos.filter((t) => t && typeof t === "object" && t.id != null);
    out.historico = limparHistorico(d.historico);
    out.lixeira = limparLixeira(d.lixeira);
    out.lixeiraRemovidos = limparRemocoes(d.lixeiraRemovidos);
    out.conflitos = limparConflitos(d.conflitos);
    out.conflitosResolvidos = limparRemocoes(d.conflitosResolvidos);
    return { doc: out, invalidos: f.invalidos };
  }
  /* v1.9.7: histórico estruturado { id, tipo, card, quem, quando, escopo }. Nunca guarda senhas. */
  const HIST_MAX = 100;
  const HIST_TIPOS = ["adicionado", "editado", "senha", "arquivado", "reativado", "excluido", "compartilhado", "parou", "importado", "se-ativada", "se-trocada", "primeiro", "conflito", "copia", "texto", "ignorado",
    "lixeira", "restaurado", "lixeira-apagado", "conflito-resolvido", "outra-operacao"];
  function limparEntrada(e) {
    if (!e || typeof e !== "object" || Array.isArray(e) || typeof e.id !== "string" || !e.id) return null;
    let tipo = HIST_TIPOS.indexOf(e.tipo) >= 0 ? e.tipo : "texto";
    // v2.0.1: a v2.0.0/v1.9.9 regravam "outra-operacao" como "texto"; o id "oo-" devolve o tipo.
    if (tipo === "texto" && /^oo-/.test(e.id) && e.card) tipo = "outra-operacao";
    const o = { id: e.id.slice(0, 120), tipo: tipo, card: txt(e.card, 200), quem: txt(e.quem, 120), quando: txt(e.quando, 40), escopo: e.escopo === "Meu" ? "Meu" : "Equipe" };
    if (e.texto) o.texto = txt(e.texto, 300);
    if (e.local) o.local = true;
    return o;
  }
  function limparHistorico(l) { return (Array.isArray(l) ? l : []).slice(0, 500).map(limparEntrada).filter(Boolean); }
  /* Junta listas pelo id (a primeira lista vence em caso de id repetido), mais recente primeiro, até "max". */
  function mesclarHistorico(listas, max) {
    const m = new Map();
    listas.forEach((l) => (l || []).forEach((e) => { if (e && e.id && !m.has(e.id)) m.set(e.id, e); }));
    return [...m.values()].sort((a, b) => ts(b.quando) - ts(a.quando)).slice(0, max || HIST_MAX);
  }
  function limparTomb(t) { return { id: t.id, deletedAt: t.deletedAt, deletedBy: t.deletedBy || "", titulo: t.titulo || "" }; }

  /* ---------- v2.0.0: Lixeira (30 dias) e cópias de conflito ----------
   * lixeira: [{ id, card, excluidoEm, excluidoPor }]  — só cards da Equipe vão para o arquivo (criptografado se houver senha da equipe).
   * lixeiraRemovidos: [{ id, em, por }]  — restaurados ou apagados de vez (para os outros aparelhos tirarem da lixeira).
   * conflitos: [{ id, cardId, titulo, perdedora, vencedoraAt, vencedorPor, perdedorPor, quando }]
   * conflitosResolvidos: [{ id, em, por }]
   * Versões antigas (v1.9.x) ignoram esses campos; cada aparelho v2.0.0 guarda uma cópia local e repõe no próximo envio. */
  function limparRemocoes(l) {
    return (Array.isArray(l) ? l : []).filter((t) => t && typeof t === "object" && t.id != null && typeof t.id !== "object")
      .map((t) => ({ id: String(t.id).slice(0, 120), em: isoValido(t.em), por: txt(t.por, 120) })).filter((t) => t.em).slice(0, 2000);
  }
  function limparLixeira(l) {
    return (Array.isArray(l) ? l : []).map((e) => {
      if (!e || typeof e !== "object" || Array.isArray(e)) return null;
      const c = normalizarCard(e.card);
      if (!c || !c.id || !(c.titulo || c.aplicacao)) return null;
      const em = isoValido(e.excluidoEm); if (!em) return null;
      return { id: c.id, card: c, excluidoEm: em, excluidoPor: txt(e.excluidoPor, 120) };
    }).filter(Boolean).slice(0, 2000);
  }
  function limparConflitos(l) {
    return (Array.isArray(l) ? l : []).map((e) => {
      if (!e || typeof e !== "object" || Array.isArray(e) || typeof e.id !== "string") return null;
      const p = normalizarCard(e.perdedora);
      if (!p || !p.id) return null;
      return { id: e.id.slice(0, 160), cardId: p.id, titulo: txt(e.titulo, 200), perdedora: p, vencedoraAt: isoValido(e.vencedoraAt), vencedorPor: txt(e.vencedorPor, 120), perdedorPor: txt(e.perdedorPor, 120), quando: isoValido(e.quando) || new Date().toISOString() };
    }).filter(Boolean).slice(0, 200);
  }
  function mesclarRemocoes(listas) {
    const m = new Map(); const lim = Date.now() - 2 * LIXEIRA_DIAS * 864e5;
    listas.forEach((l) => (l || []).forEach((t) => { if (!t || !t.id) return; const a = m.get(t.id); if (!a || ts(t.em) > ts(a.em)) m.set(t.id, t); }));
    return [...m.values()].filter((t) => ts(t.em) >= lim);
  }
  /* Junta as lixeiras: por card fica a versão mais recente; sai o que foi restaurado/apagado depois de excluído e o que passou de 30 dias. */
  function mesclarLixeira(listas, removidos, agora) {
    const lim = (agora || Date.now()) - LIXEIRA_DIAS * 864e5;
    const rem = new Map((removidos || []).map((t) => [t.id, t]));
    const m = new Map();
    listas.forEach((l) => (l || []).forEach((e) => {
      if (!e || !e.id || !e.card) return;
      const a = m.get(e.id);
      if (!a || ts(e.card.updatedAt) > ts(a.card.updatedAt) || (ts(e.card.updatedAt) === ts(a.card.updatedAt) && ts(e.excluidoEm) > ts(a.excluidoEm))) {
        // mantém a data de exclusão mais recente (o prazo de 30 dias conta da última exclusão)
        const ex = a && ts(a.excluidoEm) > ts(e.excluidoEm) ? a.excluidoEm : e.excluidoEm;
        m.set(e.id, Object.assign({}, e, { excluidoEm: ex }));
      } else if (ts(e.excluidoEm) > ts(a.excluidoEm)) m.set(e.id, Object.assign({}, a, { excluidoEm: e.excluidoEm, excluidoPor: e.excluidoPor }));
    }));
    return [...m.values()].filter((e) => { const r = rem.get(e.id); return ts(e.excluidoEm) >= lim && !(r && ts(r.em) >= ts(e.excluidoEm)); })
      .sort((a, b) => ts(b.excluidoEm) - ts(a.excluidoEm));
  }
  function mesclarConflitos(listas, resolvidos, agora) {
    const lim = (agora || Date.now()) - LIXEIRA_DIAS * 864e5;
    const res = new Set((resolvidos || []).map((t) => t.id));
    const m = new Map();
    listas.forEach((l) => (l || []).forEach((c) => { if (c && c.id && !m.has(c.id)) m.set(c.id, c); }));
    return [...m.values()].filter((c) => !res.has(c.id) && ts(c.quando) >= lim).sort((a, b) => ts(b.quando) - ts(a.quando)).slice(0, 50);
  }

  /* Documento do arquivo da equipe. "filtro" decide o que pode sair (só cards compartilhados).
   * extras (opcional): { modelos, modelosRemovidos } — cards Individuais compartilhados como modelo, sem login/senha. */
  function montarDoc(itens, removidos, autor, filtro, extras) {
    const agora = new Date().toISOString();
    const lim = Date.now() - RETER_TOMBSTONE_DIAS * 864e5;
    const d = {
      tipo: TIPO, versao: 1, atualizado_em: agora, atualizado_por: autor || "",
      itens: itens.filter(filtro).map((it) => Object.assign({}, it)),
      removidos: (removidos || []).filter((t) => ts(t.deletedAt) >= lim)
    };
    if (extras) {
      d.modelos = (extras.modelos || []).filter((m) => m && m.id).map(limparModelo);
      d.modelosRemovidos = (extras.modelosRemovidos || []).filter((t) => t && t.id && ts(t.deletedAt) >= lim).map(limparTomb);
    }
    if (extras && Array.isArray(extras.historico)) d.historico = extras.historico.filter((e) => e && e.escopo === "Equipe" && !e.local).slice(0, HIST_MAX);
    // v2.0.0: lixeira e conflitos (só cards da Equipe; o filtro garante que nada Individual entra)
    if (extras && Array.isArray(extras.lixeira)) d.lixeira = extras.lixeira.filter((e) => e && e.card && filtro(e.card));
    if (extras && Array.isArray(extras.lixeiraRemovidos)) d.lixeiraRemovidos = extras.lixeiraRemovidos.slice(0, 2000);
    if (extras && Array.isArray(extras.conflitos)) d.conflitos = extras.conflitos.filter((c) => c && c.perdedora && filtro(c.perdedora));
    if (extras && Array.isArray(extras.conflitosResolvidos)) d.conflitosResolvidos = extras.conflitosResolvidos.slice(0, 2000);
    return d;
  }
  function modelosDoDoc(d) { return d ? { tipo: TIPO, itens: Array.isArray(d.modelos) ? d.modelos.map(limparModelo) : [], removidos: Array.isArray(d.modelosRemovidos) ? d.modelosRemovidos : [] } : null; }
  function docValido(d) { return !!(d && d.tipo === TIPO && Array.isArray(d.itens)); }

  /* Merge por card: vence o updatedAt mais recente; exclusões via tombstones.
   * local: { itens (só compartilhados), removidos }, remoto: doc, ultimaSync: ISO.
   * v2.0.0: a identidade do card é SÓ o id (o 4º parâmetro, chave alternativa, é ignorado: fundia cards diferentes com o mesmo título).
   * Conflito = os dois lados mudaram desde a última versão comum. Com baseAt (versão em que cada edição se baseou) a detecção é exata:
   * r descende de l quando r.baseAt >= l.updatedAt (e vice-versa); sem baseAt (card gravado por versão antiga) usa a regra antiga (ultimaSync).
   * Retorna { itens, removidos, mudancasRemotas:[{tipo,item,por,em}], conflitos:[{local,remoto,vencedor,perdedor}], voltaram:[{item,tomb}], localMudou, remotoPrecisa } */
  function concorrentes(l, r, ult) {
    const tl = ts(l.updatedAt), tr = ts(r.updatedAt);
    if (tl === tr) return false;
    const temBase = Object.prototype.hasOwnProperty.call(l, "baseAt") && Object.prototype.hasOwnProperty.call(r, "baseAt");
    if (temBase) return ts(r.baseAt) < tl && ts(l.baseAt) < tr;
    if (tr > tl) return !!(ult && tl > ult);
    return !!(ult && tr > ult);
  }
  function mesclar(local, remoto, ultimaSync) {
    const ult = ts(ultimaSync);
    const tomb = new Map();
    (local.removidos || []).concat(remoto && remoto.removidos || []).forEach((t) => {
      if (!t || !t.id) return;
      const a = tomb.get(t.id);
      if (!a || ts(t.deletedAt) > ts(a.deletedAt)) tomb.set(t.id, Object.assign({}, t));
    });
    let localMudou = false, remotoPrecisa = false;
    const tombLocal = new Set((local.removidos || []).map((t) => t.id + "@" + t.deletedAt));
    const loc = new Map(local.itens.map((it) => [it.id, it]));
    const rem = new Map();
    ((remoto && remoto.itens) || []).forEach((r) => { if (r && r.id) rem.set(r.id, r); });
    const saida = []; const mudancas = []; const conflitos = []; const voltaram = [];
    const ids = new Set([...loc.keys(), ...rem.keys()]);
    ids.forEach((id) => {
      const l = loc.get(id), r = rem.get(id), t = tomb.get(id);
      let vence = null, origem = "";
      if (l && r) {
        const tl = ts(l.updatedAt), tr = ts(r.updatedAt);
        if (semMeta(l) === semMeta(r)) { vence = tl >= tr ? l : r; origem = tl >= tr ? "local" : "igual"; if (tl !== tr) { if (tl > tr) remotoPrecisa = true; else localMudou = true; } }
        else {
          if (tr > tl) { vence = r; origem = "remoto"; }
          else { vence = l; origem = "local"; remotoPrecisa = true; }
          if (concorrentes(l, r, ult)) conflitos.push({ local: l, remoto: r, vencedor: vence, perdedor: vence === l ? r : l });
        }
      } else if (r) { vence = r; origem = "remoto-novo"; }
      else { vence = l; origem = "local-novo"; }
      if (t && ts(t.deletedAt) >= ts(vence.updatedAt)) {
        if (l) { localMudou = true; mudancas.push({ tipo: "removido", item: l, por: t.deletedBy || "", em: t.deletedAt, remoto: !tombLocal.has(id + "@" + t.deletedAt) }); }
        if (r) remotoPrecisa = true;
        return;
      }
      if (t) { tomb.delete(id); voltaram.push({ item: vence, tomb: t }); } // card voltou (editado/restaurado depois da exclusão)
      if (origem === "remoto" || origem === "remoto-novo") { localMudou = true; mudancas.push({ tipo: l ? "atualizado" : "novo", item: r, por: r.updatedBy || "", em: r.updatedAt || "", remoto: true }); }
      if (origem === "local-novo") remotoPrecisa = true;
      saida.push(vence);
    });
    if (remoto && (remoto.removidos || []).length !== tomb.size) remotoPrecisa = true;
    if (!remoto) remotoPrecisa = true;
    return { itens: saida, removidos: [...tomb.values()], mudancasRemotas: mudancas.filter((m) => m.remoto), removidosAqui: mudancas.filter((m) => m.tipo === "removido"), conflitos: conflitos, voltaram: voltaram, localMudou: localMudou, remotoPrecisa: remotoPrecisa };
  }

  /* ---------- v2.0.0: normUrl conservador ----------
   * Iguais: esquema ignorado (http/https/qualquer xxx://), "//" inicial, host em minúsculas, "www." ignorado, porta padrão (:443/:80) removida,
   * #fragmento removido, barra final removida, "?" vazio removido, parâmetros da query em outra ordem.
   * Diferentes: valores de query diferentes, caminhos diferentes, hosts diferentes, maiúsculas no CAMINHO e na query
   * (a v1.9.9 punha tudo em minúsculas; a v2.0.0 só o host, por segurança, já que a trava agora é "um link = um card"). */
  function normUrl(u) {
    let s = String(u == null ? "" : u).trim();
    if (!s) return "";
    // só http:// e https:// são a mesma coisa; outro esquema (ftp://, ssh://…) fica no resultado, para não virar o mesmo link
    let esq = ""; const me = /^([a-z][a-z0-9+.-]*):\/\//i.exec(s);
    if (me) { s = s.slice(me[0].length); if (!/^https?$/i.test(me[1])) esq = me[1].toLowerCase() + "://"; } else s = s.replace(/^\/\//, "");
    const h = s.indexOf("#"); if (h >= 0) s = s.slice(0, h);
    let q = ""; const qi = s.indexOf("?"); if (qi >= 0) { q = s.slice(qi + 1); s = s.slice(0, qi); }
    const pi = s.indexOf("/");
    let host = pi >= 0 ? s.slice(0, pi) : s, path = pi >= 0 ? s.slice(pi) : "";
    host = host.toLowerCase().replace(/^www\./, "").replace(/:(443|80)$/, "").replace(/\.$/, "");
    path = path.replace(/\/+$/, "");
    const partes = q.split("&").filter((p) => p !== "").sort();
    if (!host && !path && !partes.length) return "";
    return esq + host + path + (partes.length ? "?" + partes.join("&") : "");
  }

  /* ---------- Retentativas (arquivo travado pelo OneDrive, leitura no meio da sincronização etc.) ---------- */
  const RETENTAVEIS = ["NotReadableError", "InvalidStateError", "NoModificationAllowedError", "InvalidModificationError", "AbortError", "SyntaxError", "VerificacaoFalhou", "TimeoutError", "UnknownError", "QuotaExceededError"];
  function retentavel(e) { return !!e && (RETENTAVEIS.indexOf(e.name) >= 0 || /lock|busy|in use|being used/i.test(String(e.message || ""))); }
  function esperar(ms) { return new Promise((ok) => setTimeout(ok, ms)); }
  /* Até 5 tentativas em ~10 s (0,5 / 1 / 2 / 3 / 4 s + variação aleatória). */
  async function comRetentativa(fn, opcoes) {
    const o = Object.assign({ tentativas: 5, atrasos: [500, 1000, 2000, 3000, 4000], aoFalhar: null }, opcoes || {});
    let ultimo;
    for (let i = 0; i < o.tentativas; i++) {
      try { return await fn(i); } catch (e) {
        ultimo = e;
        if (!retentavel(e) || i === o.tentativas - 1) break;
        if (o.aoFalhar) o.aoFalhar(e, i);
        await esperar((o.atrasos[i] || 4000) + Math.floor(Math.random() * 250));
      }
    }
    throw ultimo;
  }
  function erroVerificacao() { const e = new Error("O arquivo mudou durante a gravação (outra pessoa gravou ao mesmo tempo)."); e.name = "VerificacaoFalhou"; return e; }

  /* Fila: uma operação de cada vez nesta aba (nunca duas gravações simultâneas). */
  function Fila() {
    let cauda = Promise.resolve();
    return { rodar(fn) { const p = cauda.then(fn, fn); cauda = p.catch(() => {}); return p; } };
  }

  /* Cópias de conflito do OneDrive: caderno-equipe-<PC>.json, caderno-equipe-<PC>-2.json ... */
  const PRINCIPAL = "caderno-equipe.json";
  const LOG = "caderno-equipe-log.csv";
  function ehCopiaConflito(nome) { return /^caderno-equipe-.+\.json$/i.test(nome) && nome.toLowerCase() !== PRINCIPAL; }

  async function lerTexto(fh) { const f = await fh.getFile(); return await f.text(); }
  function parseDoc(txt) { if (!txt || !txt.trim()) return null; return JSON.parse(txt); }
  async function gravarTexto(fh, txt) { const w = await fh.createWritable(); try { await w.write(txt); await w.close(); } catch (e) { try { await w.abort(); } catch (x) {} throw e; } }
  async function gravarVerificado(fh, doc) {
    doc.gravacao = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await gravarTexto(fh, JSON.stringify(doc, null, 2));
    const volta = parseDoc(await lerTexto(fh));
    if (!volta || volta.gravacao !== doc.gravacao) throw erroVerificacao();
  }
  function csv(v) { const t = String(v == null ? "" : v).replace(/[\r\n]+/g, " "); return /[";,]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
  async function anexarLog(fh, campos) {
    const linha = campos.map(csv).join(";") + "\r\n";
    const f = await fh.getFile();
    const w = await fh.createWritable({ keepExistingData: true });
    try {
      if (f.size === 0) await w.write("\ufeffdata_hora;analista;acao;card;erro\r\n" + linha);
      else { await w.seek(f.size); await w.write(linha); }
      await w.close();
    } catch (e) { try { await w.abort(); } catch (x) {} throw e; }
  }

  /* ---------- IndexedDB para guardar o handle vinculado ---------- */
  const DB = "caderno-acessos-sync", STORE = "handles";
  function idb(modo, fn) {
    return new Promise((ok, erro) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onerror = () => erro(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction(STORE, modo); const st = tx.objectStore(STORE);
        const r = fn(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => erro(tx.error);
      };
    });
  }
  async function permissaoDe(h, pedir) {
    if (!h) return false;
    const o = { mode: "readwrite" };
    if (!h.queryPermission || (await h.queryPermission(o)) === "granted") return true;
    if (!pedir || !h.requestPermission) return false;
    return (await h.requestPermission(o)) === "granted";
  }

  /* ---------- Adaptador: PASTA da equipe (preferido; enxerga as cópias de conflito e grava o log) ----------
   * Interface comum dos adaptadores (um servidor pode implementar a mesma no futuro):
   *   modo, suportado(), vinculado(), nome(), permissao(pedir), ler(), lerCopias(), apagarCopia(nome),
   *   gravar(doc) [verifica relendo], registrarLog(campos), vincular(), criar(), abrir(), desvincular()
   */
  function AdaptadorPasta() {
    let dir = null;
    const a = {
      modo: "pasta",
      suportado: () => typeof g.showDirectoryPicker === "function" && !!g.indexedDB,
      async carregar() { if (!dir && a.suportado()) { try { dir = await idb("readonly", (s) => s.get("pasta-equipe")) || null; } catch (e) { dir = null; } } return dir; },
      usarHandle(h) { dir = h; },
      async vinculado() { return !!(await a.carregar()); },
      async nome() { const d = await a.carregar(); return d ? d.name + "/" + PRINCIPAL : ""; },
      async permissao(pedir) { return permissaoDe(await a.carregar(), pedir); },
      async principal() { return (await a.carregar()).getFileHandle(PRINCIPAL, { create: true }); },
      async ler() { return parseDoc(await lerTexto(await a.principal())); },
      async lerCopias() {
        const d = await a.carregar(); const out = [];
        for await (const [nome, h] of d.entries()) {
          if (h.kind !== "file" || !ehCopiaConflito(nome)) continue;
          try { out.push({ nome: nome, doc: parseDoc(await lerTexto(h)) }); } catch (e) { out.push({ nome: nome, erro: e }); }
        }
        return out;
      },
      async apagarCopia(nome) { await (await a.carregar()).removeEntry(nome); },
      async gravar(doc) { await gravarVerificado(await a.principal(), doc); },
      async registrarLog(campos) { const d = await a.carregar(); await anexarLog(await d.getFileHandle(LOG, { create: true }), campos); },
      async vincular() {
        const h = await g.showDirectoryPicker({ id: "caderno-equipe", mode: "readwrite" });
        dir = h; await idb("readwrite", (s) => s.put(h, "pasta-equipe")); return true;
      },
      async desvincular() { dir = null; try { await idb("readwrite", (s) => s.delete("pasta-equipe")); } catch (e) {} }
    };
    return a;
  }

  /* ---------- Adaptador: ARQUIVO único (navegadores sem seletor de pasta) ---------- */
  function AdaptadorArquivo() {
    let handle = null;
    const CH = "arquivo-equipe";
    const tipos = [{ description: "Arquivo da equipe (JSON)", accept: { "application/json": [".json"] } }];
    const a = {
      modo: "arquivo",
      suportado: () => typeof g.showSaveFilePicker === "function" && typeof g.showOpenFilePicker === "function" && !!g.indexedDB,
      async carregar() { if (!handle && a.suportado()) { try { handle = await idb("readonly", (s) => s.get(CH)) || null; } catch (e) { handle = null; } } return handle; },
      async vinculado() { return !!(await a.carregar()); },
      async nome() { const h = await a.carregar(); return h ? h.name : ""; },
      async permissao(pedir) { return permissaoDe(await a.carregar(), pedir); },
      async ler() { return parseDoc(await lerTexto(await a.carregar())); },
      async lerCopias() { return []; },
      async apagarCopia() {},
      async gravar(doc) { await gravarVerificado(await a.carregar(), doc); },
      async registrarLog() {},
      async criar(sugerido) {
        const h = await g.showSaveFilePicker({ suggestedName: sugerido || PRINCIPAL, types: tipos, id: "caderno-equipe" });
        handle = h; await idb("readwrite", (s) => s.put(h, CH)); return true;
      },
      async abrir() {
        const [h] = await g.showOpenFilePicker({ types: tipos, multiple: false, id: "caderno-equipe" });
        handle = h; await idb("readwrite", (s) => s.put(h, CH)); return true;
      },
      async desvincular() { handle = null; try { await idb("readwrite", (s) => s.delete(CH)); } catch (e) {} }
    };
    return a;
  }

  g.CadernoSync = { TIPO: TIPO, normalizarCard: normalizarCard, sanearDatas: sanearDatas, dataValida: dataValida, normUrl: normUrl, LIMITES_NIVEL: LIMITES_NIVEL, CAMPOS_CARD: CAMPOS_CARD, LIXEIRA_DIAS: LIXEIRA_DIAS,
    limparLixeira: limparLixeira, limparConflitos: limparConflitos, limparRemocoes: limparRemocoes, mesclarLixeira: mesclarLixeira, mesclarConflitos: mesclarConflitos, mesclarRemocoes: mesclarRemocoes, concorrentes: concorrentes, filtrarItens: filtrarItens, limparDoc: limparDoc, limparHistorico: limparHistorico, mesclarHistorico: mesclarHistorico, HIST_MAX: HIST_MAX, limparModelo: limparModelo, modelosDoDoc: modelosDoDoc, CAMPOS_MODELO: CAMPOS_MODELO, PRINCIPAL: PRINCIPAL, LOG: LOG, montarDoc: montarDoc, docValido: docValido, mesclar: mesclar, ts: ts, semMeta: semMeta, semMetaV1: semMetaV1,
    comRetentativa: comRetentativa, retentavel: retentavel, Fila: Fila, ehCopiaConflito: ehCopiaConflito, gravarVerificado: gravarVerificado, anexarLog: anexarLog,
    AdaptadorPasta: AdaptadorPasta, AdaptadorArquivo: AdaptadorArquivo };
})(typeof window !== "undefined" ? window : globalThis);
