/* Caderno de Acessos — sincronização do arquivo da equipe (v1.9; modelos v1.9.4)
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
  function semMeta(it) { const c = Object.assign({}, it); delete c.updatedAt; delete c.updatedBy; return JSON.stringify(c, Object.keys(c).sort()); }

  /* v1.9.4: "Compartilhar meu card". Modelos ficam numa coleção separada ("modelos"), que versões antigas ignoram.
   * Lista branca: só estes campos podem sair. Login e senha NUNCA. */
  const CAMPOS_MODELO = ["id", "nome", "url", "sistema", "escalonamento", "escalonamentos", "obs", "sharedBy", "createdAt", "updatedAt", "updatedBy"];
  const CAMPOS_NIVEL = ["nivel", "canal", "nome", "valor", "horario", "obs"];
  function limparModelo(m) {
    const o = {};
    CAMPOS_MODELO.forEach((k) => {
      if (m == null || m[k] == null) return;
      if (k === "escalonamentos") {
        if (!Array.isArray(m[k])) return;
        o[k] = m[k].map((n) => { const x = {}; CAMPOS_NIVEL.forEach((c) => { if (n && n[c] != null) x[c] = n[c]; }); return x; });
      } else o[k] = typeof m[k] === "string" || typeof m[k] === "number" ? m[k] : String(m[k]);
    });
    return o;
  }
  /* v1.9.7: todo card vindo de fora (importação, arquivo da equipe, cópia de conflito) passa por aqui.
   * Lista branca de campos, tudo vira texto com limite; chaves perigosas (__proto__ etc.) nunca entram. Devolve null se inválido. */
  const CAMPOS_CARD = { id: 64, titulo: 200, aplicacao: 200, cliente: 200, categoria: 20, visibilidade: 20, url: 2000, usuario: 500, senha: 500,
    ciclo: 10, ultima: 40, horario: 500, escalonamento: 5000, obs: 5000, arquivado_em: 40, senha_atualizada_em: 40, updatedAt: 40, updatedBy: 120,
    modeloId: 80, modeloDono: 80, modeloPor: 120 };
  const PROIBIDAS = new Set(["__proto__", "constructor", "prototype"]);
  function txt(v, max) { if (v == null) return ""; if (typeof v === "object") return ""; return String(v).slice(0, max); }
  function normalizarNivel(n) {
    if (!n || typeof n !== "object" || Array.isArray(n)) return null;
    const nv = Number(n.nivel);
    return { nivel: Number.isFinite(nv) && nv > 0 ? Math.min(Math.floor(nv), 99) : 1,
      canal: ["portal", "email", "telefone", "outro"].indexOf(n.canal) >= 0 ? n.canal : "outro",
      valor: txt(n.valor, 2000), nome: txt(n.nome, 200), horario: txt(n.horario, 200), obs: txt(n.obs, 1000) };
  }
  function normalizarCard(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const o = {};
    Object.keys(CAMPOS_CARD).forEach((k) => {
      if (PROIBIDAS.has(k) || !Object.prototype.hasOwnProperty.call(raw, k)) return;
      const v = raw[k];
      if (k === "arquivado_em" && (v == null || v === "")) { o[k] = null; return; }
      if (v == null) return;
      if (typeof v === "object") return; // tipo errado (objeto/array no lugar de texto): ignora o campo
      o[k] = txt(v, CAMPOS_CARD[k]);
    });
    if (Object.prototype.hasOwnProperty.call(raw, "escalonamentos")) o.escalonamentos = Array.isArray(raw.escalonamentos) ? raw.escalonamentos.slice(0, 20).map(normalizarNivel).filter(Boolean) : [];
    if (!("arquivado_em" in o)) o.arquivado_em = null;
    if (o.id != null) o.id = o.id.trim();
    if (o.visibilidade && o.visibilidade !== "Individual") o.visibilidade = "Equipe";
    if (o.categoria && o.categoria !== "Externo") o.categoria = "Interno";
    return o;
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
    return { doc: out, invalidos: f.invalidos };
  }
  /* v1.9.7: histórico estruturado { id, tipo, card, quem, quando, escopo }. Nunca guarda senhas. */
  const HIST_MAX = 100;
  const HIST_TIPOS = ["adicionado", "editado", "senha", "arquivado", "reativado", "excluido", "compartilhado", "parou", "importado", "se-ativada", "se-trocada", "primeiro", "conflito", "copia", "texto", "ignorado"];
  function limparEntrada(e) {
    if (!e || typeof e !== "object" || Array.isArray(e) || typeof e.id !== "string" || !e.id) return null;
    const tipo = HIST_TIPOS.indexOf(e.tipo) >= 0 ? e.tipo : "texto";
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
    return d;
  }
  function modelosDoDoc(d) { return d ? { tipo: TIPO, itens: Array.isArray(d.modelos) ? d.modelos.map(limparModelo) : [], removidos: Array.isArray(d.modelosRemovidos) ? d.modelosRemovidos : [] } : null; }
  function docValido(d) { return !!(d && d.tipo === TIPO && Array.isArray(d.itens)); }

  /* Merge por card: vence o updatedAt mais recente; exclusões via tombstones.
   * local: { itens (só compartilhados), removidos }, remoto: doc, ultimaSync: ISO, chave(it): chave alternativa de casamento.
   * Retorna { itens, removidos, mudancasRemotas:[{tipo,item,por,em}], conflitos:[{local,remoto}], localMudou, remotoPrecisa } */
  function mesclar(local, remoto, ultimaSync, chave) {
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
    const porChave = new Map();
    local.itens.forEach((it) => { const k = chave && chave(it); if (k && !porChave.has(k)) porChave.set(k, it.id); });
    const remIds = new Set(((remoto && remoto.itens) || []).map((r) => r && r.id));
    ((remoto && remoto.itens) || []).forEach((r) => {
      if (!r || !r.id) return;
      if (!loc.has(r.id) && chave) {
        // id diferente mas mesmo card (ex.: importado em dois aparelhos): adota o id do arquivo, sem duplicar
        const k = chave(r); const idLocal = k && porChave.get(k);
        if (idLocal && loc.has(idLocal) && !remIds.has(idLocal)) {
          const l = loc.get(idLocal); loc.delete(idLocal); loc.set(r.id, Object.assign({}, l, { id: r.id }));
          porChave.delete(k); localMudou = true;
        }
      }
      rem.set(r.id, r);
    });
    const saida = []; const mudancas = []; const conflitos = [];
    const ids = new Set([...loc.keys(), ...rem.keys()]);
    ids.forEach((id) => {
      const l = loc.get(id), r = rem.get(id), t = tomb.get(id);
      let vence = null, origem = "";
      if (l && r) {
        const tl = ts(l.updatedAt), tr = ts(r.updatedAt);
        if (semMeta(l) === semMeta(r)) { vence = tl >= tr ? l : r; origem = tl >= tr ? "local" : "igual"; if (tl !== tr) { if (tl > tr) remotoPrecisa = true; else localMudou = true; } }
        else if (tr > tl) { vence = r; origem = "remoto"; if (ult && tl > ult) conflitos.push({ local: l, remoto: r }); }
        else { vence = l; origem = "local"; remotoPrecisa = true; if (ult && tr > ult && tr !== tl) conflitos.push({ local: l, remoto: r }); }
      } else if (r) { vence = r; origem = "remoto-novo"; }
      else { vence = l; origem = "local-novo"; }
      if (t && ts(t.deletedAt) >= ts(vence.updatedAt)) {
        if (l) { localMudou = true; mudancas.push({ tipo: "removido", item: l, por: t.deletedBy || "", em: t.deletedAt, remoto: !tombLocal.has(id + "@" + t.deletedAt) }); }
        if (r) remotoPrecisa = true;
        return;
      }
      if (t) tomb.delete(id); // card voltou (mais novo que a exclusão)
      if (origem === "remoto" || origem === "remoto-novo") { localMudou = true; mudancas.push({ tipo: l ? "atualizado" : "novo", item: r, por: r.updatedBy || "", em: r.updatedAt || "", remoto: true }); }
      if (origem === "local-novo") remotoPrecisa = true;
      saida.push(vence);
    });
    if (remoto && (remoto.removidos || []).length !== tomb.size) remotoPrecisa = true;
    if (!remoto) remotoPrecisa = true;
    return { itens: saida, removidos: [...tomb.values()], mudancasRemotas: mudancas.filter((m) => m.remoto), conflitos: conflitos, localMudou: localMudou, remotoPrecisa: remotoPrecisa };
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

  g.CadernoSync = { TIPO: TIPO, normalizarCard: normalizarCard, filtrarItens: filtrarItens, limparDoc: limparDoc, limparHistorico: limparHistorico, mesclarHistorico: mesclarHistorico, HIST_MAX: HIST_MAX, limparModelo: limparModelo, modelosDoDoc: modelosDoDoc, CAMPOS_MODELO: CAMPOS_MODELO, PRINCIPAL: PRINCIPAL, LOG: LOG, montarDoc: montarDoc, docValido: docValido, mesclar: mesclar, ts: ts, semMeta: semMeta,
    comRetentativa: comRetentativa, retentavel: retentavel, Fila: Fila, ehCopiaConflito: ehCopiaConflito, gravarVerificado: gravarVerificado, anexarLog: anexarLog,
    AdaptadorPasta: AdaptadorPasta, AdaptadorArquivo: AdaptadorArquivo };
})(typeof window !== "undefined" ? window : globalThis);
