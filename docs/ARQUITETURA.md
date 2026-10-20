# Arquitetura do Caderno de Acessos (v2.2.0)

O app é um site estático (PWA) sem servidor e sem ferramenta de build. O navegador baixa os arquivos como estão e o service worker (`sw.js`) os guarda para funcionar offline. Os dados ficam no aparelho (localStorage). Os cards da Equipe também vão para o arquivo da equipe (`caderno-equipe.json`), numa pasta do OneDrive escolhida por cada analista.

## Como o código é carregado
- **Scripts clássicos, sem módulos.** Cada arquivo de `js/` é um `<script src>` comum, carregado **em ordem** pelo `index.html`. Todos dividem o mesmo escopo global: uma função, `const` ou `let` declarada no topo de um arquivo é vista pelos outros e pelos testes, que chamam `itens`, `render()`, `abrirFicha()` etc. direto no console.
- **A ordem importa só na hora de carregar.** Os arquivos de assunto só **declaram** funções e constantes. Quem **executa** algo ao abrir (liga os eventos, chama `entrar()`, registra o service worker) é o `js/app.js`, carregado por último. Por isso uma função pode chamar outra de qualquer arquivo.
- **A única regra a respeitar:** uma constante cujo valor é calculado na hora (por exemplo `const ACOES = { exportar: exportarEquipe }`) precisa estar num arquivo carregado **depois** de tudo o que usa. Na dúvida, coloque-a no `app.js`.
- **CSP `'self'`.** Não há código nem estilo inline no `index.html`. Nada externo é carregado; as bibliotecas de planilha ficam em `js/vendor/`.

## Mapa dos arquivos (ordem de carregamento)
| Arquivo | O que faz |
|---|---|
| `js/tema-init.js` | Aplica o tema salvo antes de desenhar a página (no `<head>`). |
| `js/sync.js` | `CadernoSync`: normalizar cards, `normUrl`, mesclar (LWW, tombstones, conflitos), montar e ler o arquivo da equipe, modelos e histórico. Não depende da tela. |
| `js/cripto-equipe.js` | `CadernoCripto`: senha da equipe (PBKDF2 + AES-GCM) e o "olho" da senha. |
| `js/ui.js` | Ícones, `el()`, `btn()`, `toast()`, `dialogo()`, `aviso()`, `janela()`, `botaoDlg()`, abrir/fechar sheets, temas, copiar/abrir link. |
| `js/armazenamento.js` | Estado (`itens`, `aba`, `edit`), `load()`, `save()`, migrações, datas, `lerJSON()`. |
| `js/cards.js` | `nomeDe`, `atual`, `normTxt`, `normUrl`, mesmo link, "um link = um card", painel de duplicados. |
| `js/escalonamento.js` | Níveis e canais, resumo, texto antigo, editor da ficha (`renderEscEditor`, `renumerarNiveis`). |
| `js/lista.js` | `render()`, `cardDe()`, menu do card, seleção múltipla. |
| `js/lixeira.js` | Excluir → Lixeira (30 dias), restaurar, apagar de vez. |
| `js/conflitos.js` | Cópias de conflito, "Ver as duas versões", extras do arquivo. |
| `js/historico.js` | Histórico (Equipe/Meu), registros de Meus, bloco do Histórico. |
| `js/sincronizacao.js` | Adaptador da pasta, `carimbarMudancas`, `sincronizarAgora`, `aplicarResultado`. |
| `js/senha-equipe.js` | Arquivo da equipe cifrado: abrir, fechar, proteger, pedir e ver a senha. |
| `js/perfis.js` | v2.2.0: perfis Admin e Analista nos cards da Equipe: lista `perfis` (no arquivo cifrado e no cofre local cifrado), Configurar perfis, Entrar como admin (modo admin em memória), painel de perfis, escolha do nome, regras de permissão no `save()` (`guardarPermissoes`), no merge (`filtrarPermissoesRemoto`, `mesclarPerfisSync`) e na importação, cadeados da ficha. |
| `js/compartilhados.js` | "Compartilhar meu card" (modelos sem login e senha), "Só para…", adoção, Card parecido, tela Cards compartilhados. |
| `js/mais.js` | Aba Mais: vincular/criar/usar/desvincular o arquivo, `renderMais`, funções das novidades. |
| `js/gerador.js` | Gerador de senhas. |
| `js/importar-exportar.js` | JSON (equipe e backup pessoal) com prévia; carrega as bibliotecas de `js/vendor`. |
| `js/planilhas.js` | Excel: exportar, importar (formato do Caderno e de suporte), menu Excel ▾. |
| `js/ficha.js` | Ficha Novo/Editar, limites de texto, Descartar, trava "um link = um card", outra operação, Salvar em Meus e sugerir. |
| `js/login-bloqueio.js` | Login do aparelho, troca obrigatória de senha, sessão, bloqueio por inatividade. |
| `js/instalar.js` | Aviso para instalar o app. |
| `js/app.js` | `APP_VERSAO`, `NOVIDADES`, `LOGIN_PADRAO`, `ACOES` e toda a ligação de eventos e a inicialização (na ordem de sempre). |

**CSS**, em ordem (é a mesma ordem do antigo `app.css`, que foi cortado em pedaços sem mudar uma linha):

| Arquivo | O que tem |
|---|---|
| `css/temas.css` | Variáveis de cor dos temas Claro, Escuro e Suave. |
| `css/base.css` | Base geral. |
| `css/layout.css` | Topo, abas e busca. |
| `css/cards.css` | Lista, card e botões. |
| `css/telas.css` | Mais, FAB, drawer, ficha, toast, larguras de tela, login, seleção. |
| `css/componentes.css` | Diálogos, escalonamento, menus, compartilhados, Histórico, Lixeira, conflitos, duplicados etc. |

Em CSS vale a última regra de mesma força, por isso **não mude a ordem dos arquivos**.

## Fluxo da sincronização (resumo)
1. Um `save()` grava no aparelho e chama `carimbarMudancas()`. Os cards da Equipe que mudaram de verdade (comparados por `semMeta`) ganham `updatedAt`/`updatedBy`/`baseAt`. Os modelos compartilhados do dono são atualizados (`atualizarMeusModelos`).
2. `agendarSync()` chama `sincronizarAgora()`, que lê o `caderno-equipe.json` da pasta e o decifra com a senha da equipe, se houver (`abrirDocEquipe`).
3. `CadernoSync.mesclar()` junta o que está no aparelho com o arquivo e com as cópias de conflito do OneDrive. Vence a edição mais nova (LWW). Edições ao mesmo tempo viram cópia de conflito, e os tombstones impedem que um card excluído volte.
4. Modelos, Lixeira, conflitos e Histórico são juntados à parte. A cópia local repõe o que uma versão antiga tenha apagado.
5. Se algo mudou, `montarDoc()` monta o arquivo (nunca com nada Individual, nunca com login ou senha nos modelos), e `fecharDocEquipe()` cifra e grava.
6. `aplicarResultado()` traz para a tela o que chegou, e `verificarModelos()` avisa se chegou card compartilhado novo.

## Perfis (v2.2.0)
- **Sem admin no arquivo, nada muda** (`papelAtual()` = `livre`). Com perfis: `admin` (só no modo admin), `analista` ou `leitura` (analista desativado).
- **Onde ficam:** coleção `perfis` no topo do arquivo da equipe, que só é gravada se o arquivo for cifrado. No aparelho: `caderno-perfis` (sem hashes) e `caderno-perfis-cofre` (lista completa, cifrada com a chave da equipe). Apps antigos descartam `perfis` ao regravar; a v2.2.0 repõe a partir do cofre e registra quem gravou (`caderno-perfis-antigos`) para o aviso "ainda está numa versão antiga".
- **Merge dos perfis:** `CadernoSync.mesclarPerfis` junta pelo id, vence o `updatedAt` mais novo, nunca apaga (só desativa) e nunca perde o hash de um admin por causa de uma cópia sem hash.
- **Camada de dados:** `guardarPermissoes()` no começo do `save()` compara com a foto `baseEquipe` (tirada no `load()`, depois de cada `save()` e do `aplicarResultado()`) e desfaz o que o analista não pode mudar (`CAMPOS_ANALISTA`). No merge, `filtrarPermissoesRemoto()` desfaz mudanças proibidas cujo `updatedBy` não é admin. Para liberar observações ou horário ao analista, basta incluir `obs`/`horario` em `CAMPOS_ANALISTA` e tirar `fObs`/`fHorario` de `CAMPOS_FICHA_ADMIN`.
- **É proteção de tela**: quem tem o arquivo e a senha da equipe pode alterá-lo por fora; apps antigos não respeitam as permissões.

## Convenção para código novo
- **Onde colocar:** no arquivo do assunto. Se não houver, crie um arquivo novo e inclua-o **no `index.html` (antes do `js/app.js`) e na lista `FILES` do `sw.js`**, subindo a versão do cache (`caderno-web-vNN`). Sem isso, o app offline quebra.
- **Cabeçalho:** cada arquivo começa com um comentário curto dizendo o que contém.
- **Execução:** nada roda no topo dos arquivos de assunto. Ligações de evento e chamadas de início vão no `js/app.js`.
- **Nomes:** funções e textos em português, como no resto do código. Evite nomes genéricos no escopo global (prefixe pelo assunto quando houver risco de colisão).
- **Nenhum `alert`/`confirm`:** use `dialogo()`, `janela()` e `toast()`.
- **Segurança:** nada Individual no arquivo da equipe; modelos só com os campos de `CAMPOS_MODELO`; nada externo (CSP `'self'`).
- **Classes CSS (BEM, só para componentes novos):** `bloco`, `bloco__elemento`, `bloco--variante`, por exemplo `.painel-x`, `.painel-x__titulo`, `.painel-x--alerta`. As classes que já existem (`.card`, `.dlg`, `.rc-item`, `.lix-tag` etc.) **não** são renomeadas: testes e código dependem delas. O CSS de um componente novo vai no fim de `css/componentes.css`, ou num arquivo novo carregado depois dele.
- **Versão:** `APP_VERSAO` e `NOVIDADES` (em `js/app.js`), o rodapé e o Sobre (`index.html`) e o `CACHE` do `sw.js` mudam juntos.
