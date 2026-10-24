/* Caderno de Acessos — js/dados.js (v2.5.0)
 * Camada única de dados: toda leitura e gravação local passa por aqui (Dados.*). Hoje grava no localStorage deste navegador;
 * o arquivo da equipe continua no adaptador trocável de js/sincronizacao.js (Dados.equipe()). Quando existir um servidor,
 * só esta camada e o adaptador mudam: o resto do app não sabe onde os dados ficam.
 * Script clássico (sem módulos): tudo fica no escopo global, carregado em ordem pelo index.html. Ver docs/ARQUITETURA.md. */
const Dados = (function () {
  const loja = (function () { try { return window.localStorage; } catch (e) { return null; } })();
  const memoria = new Map(); // reserva quando o navegador bloqueia o armazenamento (modo privado restrito)
  function texto(k) { try { if (loja) return loja.getItem(k); } catch (e) {} return memoria.has(k) ? memoria.get(k) : null; }
  function gravarTexto(k, v) { v = String(v); try { if (loja) { loja.setItem(k, v); return true; } } catch (e) { if (e && /quota/i.test(e.name || "")) throw e; } memoria.set(k, v); return true; }
  function remover(k) { try { if (loja) loja.removeItem(k); } catch (e) {} memoria.delete(k); }
  function ler(k, pad) { try { const v = JSON.parse(texto(k) || "null"); return v == null ? pad : v; } catch (e) { return pad; } }
  function gravar(k, v) { return gravarTexto(k, JSON.stringify(v)); }
  function chaves() { const out = []; try { if (loja) for (let i = 0; i < loja.length; i++) out.push(loja.key(i)); } catch (e) {} memoria.forEach((v, k) => { if (out.indexOf(k) < 0) out.push(k); }); return out; }
  /* Arquivo da equipe: o adaptador ativo (pasta, arquivo ou o de memória do celular). */
  function equipe() { return typeof adaptador === "function" ? adaptador() : null; }
  return { texto: texto, gravarTexto: gravarTexto, remover: remover, ler: ler, gravar: gravar, chaves: chaves, equipe: equipe };
})();
