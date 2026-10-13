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

  /* ---------- Adaptador: arquivo em pasta sincronizada (File System Access API) ---------- */
  const DB = "caderno-acessos-sync", STORE = "handles", CH = "arquivo-equipe";
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
  function AdaptadorArquivo() {
    let handle = null;
    const tipos = [{ description: "Arquivo da equipe (JSON)", accept: { "application/json": [".json"] } }];
    const a = {
      id: "arquivo",
      suportado: () => typeof g.showSaveFilePicker === "function" && typeof g.showOpenFilePicker === "function" && !!g.indexedDB,
      async carregar() { if (!handle && a.suportado()) { try { handle = await idb("readonly", (s) => s.get(CH)) || null; } catch (e) { handle = null; } } return handle; },
      async vinculado() { return !!(await a.carregar()); },
      async nome() { const h = await a.carregar(); return h ? h.name : ""; },
      async permissao(pedir) {
        const h = await a.carregar(); if (!h) return false;
        const o = { mode: "readwrite" };
        if (h.queryPermission && (await h.queryPermission(o)) === "granted") return true;
        if (!pedir || !h.requestPermission) return false;
        return (await h.requestPermission(o)) === "granted";
      },
      async ler() {
        const h = await a.carregar(); const f = await h.getFile(); const txt = await f.text();
        if (!txt.trim()) return null;
        return JSON.parse(txt);
      },
      async gravar(doc) {
        const h = await a.carregar(); const w = await h.createWritable();
        await w.write(JSON.stringify(doc, null, 2)); await w.close();
      },
      async criar(sugerido) {
        const h = await g.showSaveFilePicker({ suggestedName: sugerido || "caderno-equipe.json", types: tipos, id: "caderno-equipe" });
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

  g.CadernoSync = { TIPO: TIPO, montarDoc: montarDoc, docValido: docValido, mesclar: mesclar, AdaptadorArquivo: AdaptadorArquivo, ts: ts, semMeta: semMeta };
})(typeof window !== "undefined" ? window : globalThis);
