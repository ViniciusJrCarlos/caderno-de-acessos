/* Caderno de Acessos — js/dados/repositorio.js (v3.0.6, etapa 1 da camada de dados)
 * Interface fina e única (Repo.*) que, por enquanto, só repassa para o que já existe: Dados.* (js/dados.js) e as funções de
 * sincronização atuais (js/sincronizacao.js). Nenhuma tela usa Repo ainda (isso é a etapa 2); o comportamento é o mesmo.
 * As funções de sincronização são buscadas na hora da chamada, porque este arquivo carrega antes de sincronizacao.js. */
const Repo = (function () {
  function fn(nome) { const f = window[nome]; if (typeof f !== "function") throw new Error("Repo: " + nome + " indisponível"); return f; }
  return Object.freeze({
    modo: function () { return DadosConfig.modo; },
    // armazenamento local (repasse direto de Dados.*)
    texto: function (k) { return Dados.texto(k); },
    gravarTexto: function (k, v) { return Dados.gravarTexto(k, v); },
    remover: function (k) { return Dados.remover(k); },
    ler: function (k, pad) { return Dados.ler(k, pad); },
    gravar: function (k, v) { return Dados.gravar(k, v); },
    chaves: function () { return Dados.chaves(); },
    // arquivo da equipe / sincronização atual
    equipe: function () { return Dados.equipe(); },
    adaptador: function () { return fn("adaptador")(); },
    sincronizar: function (interativo) { return fn("sincronizar")(interativo); },
    sincronizarAgora: function (interativo, fixo) { return fn("sincronizarAgora")(interativo, fixo); },
    agendarSync: function () { return fn("agendarSync")(); }
  });
})();
