const CACHE = "caderno-web-v41";
const FILES = ["./", "./index.html", "./css/temas.css", "./css/base.css", "./css/layout.css", "./css/cards.css", "./css/telas.css", "./css/componentes.css", "./css/shell.css", "./js/tema-init.js", "./js/sync.js", "./js/cripto-equipe.js", "./js/dados.js", "./js/ui.js", "./js/armazenamento.js", "./js/cards.js", "./js/escalonamento.js", "./js/lista.js", "./js/lixeira.js", "./js/conflitos.js", "./js/historico.js", "./js/sincronizacao.js", "./js/senha-equipe.js", "./js/assinatura.js", "./js/perfis.js", "./js/gestao.js", "./js/compartilhados.js", "./js/mais.js", "./js/gerador.js", "./js/importar-exportar.js", "./js/planilhas.js", "./js/ficha.js", "./js/login-bloqueio.js", "./js/instalar.js", "./js/area.js", "./js/app.js", "./manifest.webmanifest", "./favicon.ico", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-192.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png", "./js/vendor/xlsx.full.min.js", "./js/vendor/exceljs.min.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Rede primeiro: com internet pega a versão nova e guarda; sem internet/VPN usa a guardada.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then((resp) => {
        if (resp && resp.ok && new URL(e.request.url).origin === self.location.origin) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html")))
  );
});
