/* Caderno de Acessos — sincronização do arquivo da equipe (v1.9)
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

  /* Documento do arquivo da equipe. "filtro" decide o que pode sair (só cards compartilhados). */
  function montarDoc(itens, removidos, autor, filtro) {
    const agora = new Date().toISOString();
    const lim = Date.now() - RETER_TOMBSTONE_DIAS * 864e5;
    return {
      tipo: TIPO, versao: 1, atualizado_em: agora, atualizado_por: autor || "",
      itens: itens.filter(filtro).map((it) => Object.assign({}, it)),
      removidos: (removidos || []).filter((t) => ts(t.deletedAt) >= lim)
    };
  }
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

  g.CadernoSync = { TIPO: TIPO, PRINCIPAL: PRINCIPAL, LOG: LOG, montarDoc: montarDoc, docValido: docValido, mesclar: mesclar, ts: ts, semMeta: semMeta,
    comRetentativa: comRetentativa, retentavel: retentavel, Fila: Fila, ehCopiaConflito: ehCopiaConflito, gravarVerificado: gravarVerificado, anexarLog: anexarLog,
    AdaptadorPasta: AdaptadorPasta, AdaptadorArquivo: AdaptadorArquivo };
})(typeof window !== "undefined" ? window : globalThis);
