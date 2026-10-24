# Arquitetura do Caderno de Acessos (v2.4.0)

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
| `js/assinatura.js` | v2.3.0: assinatura ECDSA P-256 das ações de admin (card, tombstone, ação na Lixeira), chave pública fixada no aparelho (TOFU), verificação no merge (`ehAdminRemoto`, `papelRemoto`), fila de pendentes (`marcarAssinar`, `assinarPendentes`). Carregado antes do `js/perfis.js`. |
| `js/perfis.js` | v2.2.0: perfis Admin e Analista nos cards da Equipe: lista `perfis` (no arquivo cifrado e no cofre local cifrado), Configurar perfis, Entrar como admin (modo admin em memória), painel de perfis, escolha do nome, regras de permissão no `save()` (`guardarPermissoes`), no merge (`filtrarPermissoesRemoto`, `mesclarPerfisSync`) e na importação, cadeados da ficha. |
| `js/gestao.js` | v2.4.0: aba Gestão (só modo Administrador): cartões de pessoas (iniciais, nome, perfil, selo ativo/bloqueado/desativado), Novo analista, ações por pessoa (Resetar, Desbloquear, Tornar/Remover Administrador — o último é protegido —, Desativar/Reativar), bloco "Equipe" (fornecedor/exportar/importar da equipe), senha pessoal do analista (`confirmarSenhaPessoal`), `aplicarPapelNaTela`, guardas `podeArquivosEquipe`/`itensExportaveis` e helpers do diálogo padrão (`dlgPadrao`, `campoPadrao`…). Carregado depois do `js/perfis.js`. |
| `js/compartilhados.js` | "Compartilhar meu card" (modelos sem login e senha), "Só para…", adoção, Card parecido, tela Cards compartilhados. |
| `js/mais.js` | Aba Mais: vincular/criar/usar/desvincular o arquivo, `renderMais`, funções das novidades. |
| `js/gerador.js` | Gerador de senhas. |
| `js/importar-exportar.js` | JSON (equipe e backup pessoal) com prévia; carrega as bibliotecas de `js/vendor`. |
| `js/planilhas.js` | Excel: exportar, importar (formato do Caderno e de suporte), menu Excel ▾. |
| `js/ficha.js` | Ficha Novo/Editar, limites de texto, Descartar, trava "um link = um card", outra operação, Salvar em Meus e sugerir. |
| `js/login-bloqueio.js` | Login do aparelho, troca obrigatória de senha, sessão, bloqueio por inatividade. |
| `js/instalar.js` | v2.4.0: tela de instalação: `detectarAparelho` (Android Chrome/Edge/Samsung, PC Edge/Chrome, iOS Safari + aviso nos outros navegadores do iOS), botão principal "Instalar agora" (com `beforeinstallprompt`) ou "Ver como instalar", passos do aparelho atual primeiro (selo "este aparelho"), "Agora não" adia 7 dias (`caderno-instalar-adiado-ate`), estado "já instalado" em modo standalone. |
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

## Permissões e assinatura do admin (v2.3.0)
- **Aparelho novo:** o envelope cifrado leva só `perfis: true` (sem nomes). Ao ler, `notarPerfisNoArquivo()` grava `caderno-perfis-no-arquivo`, e `papelAtual()` devolve `analista` até a lista de perfis chegar. Sem perfis no arquivo, continua `livre`. Desvincular limpa a marca.
- **Quem é admin na sincronização:** não é mais o nome. Cada admin tem um par de chaves ECDSA P-256. A pública (`chavePub`) fica no perfil; a privada (`chavePriv`, `chaveSalt`) também, cifrada com AES-GCM e uma chave PBKDF2 (310.000) da senha de admin. A privada é aberta só em memória no "Entrar como admin" (`prepararChaveAdmin`). Admin vindo da v2.2.0 ganha a chave no primeiro "Entrar como admin"; até lá vale a regra antiga pelo nome (legado). Trocar a senha recifra a mesma chave; "Tornar admin" cria a chave com a senha temporária.
- **O que é assinado:** o card (`assin` = `perfilId:assinatura` sobre `c|id|updatedAt|conteúdo normalizado`), o tombstone (`t|id|deletedAt`, ou `origAt` quando a exclusão do admin é reafirmada) e a remoção da Lixeira (`l|id|em`). `carimbarMudancas()` e a Lixeira marcam o que foi feito no modo admin (`caderno-assinar-pendentes`); `assinarPendentes()` assina no começo de cada sincronização.
- **No merge (`filtrarPermissoesRemoto`, assíncrono):** sem assinatura válida de um admin ativo, a mudança é de analista: campos proibidos voltam (inclusive `arquivado_em`, item 8), exclusão de card da Equipe é desfeita, restaurar/editar card que um admin excluiu volta a ser exclusão, e "Excluir agora" da Lixeira da Equipe é ignorado. Tudo vai para o Histórico.
- **Fixação da chave (TOFU):** `caderno-perfis-chaves` guarda a chave pública de cada admin na primeira vez que o aparelho a vê. Chave trocada no arquivo não é aceita. Admin retirado perde a fixação; se voltar a ser admin, vem com chave nova.
- **Limites:** (1) quem tem o arquivo e a senha da equipe ainda pode editar o arquivo por fora e, por exemplo, criar um perfil admin falso com chave própria; aparelhos que ainda não fixaram as chaves (aparelho novo) aceitariam. (2) apps antigos (v2.2.0 ou anterior) não verificam nada e regravam o arquivo sem `assin`; mudanças do admin que passem por eles antes de chegar a um aparelho v2.3.0 são tratadas como de analista. Todos precisam atualizar. (3) a chave privada fica só em memória: se a página recarregar antes da sincronização, a mudança do admin sai sem assinatura e os outros aparelhos a desfazem (sincronize antes de fechar). (4) a proteção forte de verdade só vem com o servidor (versão web).
- **Nome:** o nome de um admin nunca é associado sozinho (`meuPerfil`); escolher o nome de um admin pede a senha de admin dele (`escolherPerfil`, `confirmarSenhaDoAdmin`). O analista já identificado não troca de nome. O último acesso de um admin só é atualizado por aparelho confirmado com a senha (`caderno-perfil-admin-confirmado`).
- **Componentes novos (BEM):** `.campo-senha` / `.campo-senha__linha` / `.campo-senha__olho`, `.forca-senha` / `__barra` / `__texto` / `--fraca|--media|--forte`, `.sel-bar__dica`, `.cont--compartilhados`.

## Gestão e senha pessoal (v2.4.0)
- Cada perfil pode ter `senhaSalt`/`senhaIter`/`senhaHash` (PBKDF2-SHA256, 310000 iterações), `senhaTemp` e `bloqueado`. O hash fica só no arquivo cifrado da equipe e no cofre local cifrado; a cópia pública dos perfis guarda apenas sal/iterações.
- Analista escolhe o nome → pede a senha pessoal. Senha temporária obriga a criar uma nova ("Crie sua senha"). 5 tentativas erradas bloqueiam (perfil `bloqueado`, papel vira leitura); só o Administrador desbloqueia (Gestão › Desbloquear, que gera nova temporária).
- O aparelho lembra a confirmação em `caderno-perfil-pessoal-confirmado` (`id|senhaSalt`); um reset troca o sal e pede a senha de novo. Não há mais associação só pelo nome.
- Migração da v2.3.0: perfis sem senha pessoal ficam "sem nome" até o Administrador definir uma temporária (Gestão › Resetar senha) e o analista fazer o primeiro acesso.
- Perfis assinados: `assinarPerfil` assina os campos de poder (`CAMPOS_PERFIL_PODER`); `filtrarPerfisRemoto` aceita mudança assinada pelo Administrador, a troca da própria senha temporária e o bloqueio por tentativas; o resto é desfeito (no modo Administrador a reversão é reassinada e propagada) e registrado no Histórico.
- Limites: é uma proteção de app sem servidor. Quem edita o próprio armazenamento local consegue mudar a cópia do próprio aparelho (não se propaga); a senha pessoal protege a identidade/autoria, não cifra os cards Individuais (previsto para v2.5.0); o bloqueio por tentativas é por perfil e depende de sincronizar.
- Mais do analista é enxuto; itens da equipe (exportar/importar/planilha da equipe) ficam no bloco "Equipe" da Gestão e também são barrados no código (`podeArquivosEquipe`).
- Todos os diálogos seguem o padrão "Crie sua senha" (`.dlg.dlg-senha.dlg-padrao`) com BEM `.dlg-padrao__*`; cartões `.gestao-pessoa*`; passos de instalação `.inst-passos*`.

## Convenção para código novo
- **Onde colocar:** no arquivo do assunto. Se não houver, crie um arquivo novo e inclua-o **no `index.html` (antes do `js/app.js`) e na lista `FILES` do `sw.js`**, subindo a versão do cache (`caderno-web-vNN`). Sem isso, o app offline quebra.
- **Cabeçalho:** cada arquivo começa com um comentário curto dizendo o que contém.
- **Execução:** nada roda no topo dos arquivos de assunto. Ligações de evento e chamadas de início vão no `js/app.js`.
- **Nomes:** funções e textos em português, como no resto do código. Evite nomes genéricos no escopo global (prefixe pelo assunto quando houver risco de colisão).
- **Nenhum `alert`/`confirm`:** use `dialogo()`, `janela()` e `toast()`.
- **Segurança:** nada Individual no arquivo da equipe; modelos só com os campos de `CAMPOS_MODELO`; nada externo (CSP `'self'`).
- **Classes CSS (BEM, só para componentes novos):** `bloco`, `bloco__elemento`, `bloco--variante`, por exemplo `.painel-x`, `.painel-x__titulo`, `.painel-x--alerta`. As classes que já existem (`.card`, `.dlg`, `.rc-item`, `.lix-tag` etc.) **não** são renomeadas: testes e código dependem delas. O CSS de um componente novo vai no fim de `css/componentes.css`, ou num arquivo novo carregado depois dele.
- **Versão:** `APP_VERSAO` e `NOVIDADES` (em `js/app.js`), o rodapé e o Sobre (`index.html`) e o `CACHE` do `sw.js` mudam juntos.

## v2.5.0 — casca nova, área do Administrador e login por matrícula

- **Arquivos novos:** `js/dados.js` (camada única de armazenamento `Dados.*`), `js/area.js` (navegação, menu da conta, login por matrícula, área do Administrador: Pessoas, Perfis, Logs, Configurações, Novidades; arquivo da equipe para o celular), `css/shell.css` (topo, barra lateral ≥1000px, barra de baixo no celular). Tema padrão `marinho`.
- **Login:** matrícula + senha pessoal. Senha temporária abre o passo 2 (criar senha pessoal). 5 erros bloqueiam a conta neste aparelho; perfil desativado/excluído não entra e, se estiver com a sessão aberta, ela termina na próxima sincronização.
- **Analista:** só recebe o arquivo da equipe (nunca grava). Cards da Equipe em ficha só leitura; Meus ficam só no aparelho. Mudanças sem assinatura do Administrador são recusadas com o aviso "Dados recusados". No celular: Arquivo e backup › Receber arquivo da equipe (o Administrador gera em Configurações; exige senha da equipe).
- **Limitação conhecida:** como o analista não grava, bloqueio por senhas erradas e último acesso do analista não chegam ao Administrador. Resetar senha também desbloqueia.
- Service worker: cache `v39`.
