# JM Estoque v9.4 — relatório de implementação

## Diagnóstico e mapa do projeto

O aplicativo Android é um contêiner WebView. A interface e as regras de negócio estão em `app/src/main/assets/index.html`; não existe um ViewModel Kotlin separado para estoque.

- **Estado/persistência:** `loadCfg`/`saveCfgObj` em `jm_cfg` e `loadLan`/`saveLanArr` em `jm_lan`, no localStorage da WebView. Há fallback em memória quando o armazenamento falha.
- **Motor ativo:** `calcV84`, instalado pelo bloco `jm-v84-core`; soma os movimentos posteriores ao conjunto de IDs `jm_v84_base_ids`. O wrapper `jm-v85-water-fix` corrige os separados de água. Existem motores antigos no arquivo, substituídos durante a inicialização; foram preservados para não reescrever migrações antigas.
- **Pendências por cliente:** `calcPendentes81`, com histórico, saldos informados e cortes de exclusão anteriores. Fornece os separados cadastrados ao estoque.
- **Início:** seção `cfg`, `fill84`, `fillInicioFromCalc` e `saveCfg`. Salvar consolida o estoque e os IDs do histórico.
- **Resumo:** seção `dash`, `renderDash`, wrappers v81/v84/v85. Usa `calc()` e o mesmo estado do Início.
- **Lançar:** seção `lan`, `addLan`, parser `jm-v86-chat` e `interpretarFraseZap`. O chat fica em `chatLancamentos`; a fila WhatsApp é outro elemento, `jm92QueueCard`.
- **Relatório diário/imagem:** `gerarImgRelatorio`, desenhado em Canvas, usa `calc()`. Relatórios individuais de pendências possuem rotinas próprias e mantêm seus saldos por cliente.
- **Backup/sincronização:** `collectBackup`, restauração e sincronização Supabase; transportam configurações, lançamentos e chaves extras `jm_*`, inclusive checkpoints.
- **Android/WhatsApp:** `MainActivity.kt` hospeda a WebView e as pontes de compartilhamento/configuração; `WhatsAppNotificationService.kt` recebe notificações. A fila e os estados de entrega estão no bloco `jm-v92-whatsapp-cloud`; o monitor é conectado no bloco v93. A consolidação remota das mensagens fica no gateway externo, cujo código não está neste projeto.
- **Build:** wrapper Gradle 9.3.1, AGP 9.1.1, AAPT2 local já configurado em `gradle.properties`. Os testes Kotlin existentes são exemplos; a validação operacional foi feita com Node, executando JavaScript de produção.

## Causas dos erros

1. O motor preservava `cheios` negativos, mas os cartões e a imagem usavam diretamente `gs`, que representa reservas cadastradas. Um detalhe calculava cobertura separadamente, sem alimentar o número principal.
2. O saldo de empréstimos era parcialmente calculado, sem área operacional própria. Devoluções aplicavam clamp a cada movimento de uma lista em ordem inversa; isso podia produzir saldo incorreto.
3. Ao salvar ajustes no Início, todos os IDs eram consolidados, mas `empG`/`empA` não eram atualizados na base. O saldo dos movimentos consolidados podia desaparecer.
4. Devolução de empréstimo à empresa podia ser interpretada como pendência de vazio de cliente. No chat, a regra genérica de devolução também precedia a regra específica de devolução à empresa.
5. O chat não tinha preferência de visibilidade. A imagem compartilhável em cache podia ficar desatualizada após alterações de dados.

## Regras implementadas

`operacional.js` contém a função pura `JMOperacional.calcular(cheios, separados, saldo)` e os textos operacionais compartilhados por Resumo e imagem. `calcV84` retorna `operacionalGas` junto aos demais saldos.

- Déficit = `max(0, -cheios)`; separados em uso = `min(déficit, cadastrados)`; livres = cadastrados − uso.
- Após os separados, o déficit usa empréstimos até o saldo disponível; o restante gera aviso de falta de cobertura.
- Cartão principal e imagem exibem **SEPARADOS DISPONÍVEIS**. O detalhe conserva cadastrados, em uso e livres. Os avisos aparecem no Resumo e na imagem, incluindo um alerta destacado quando falta cobertura.
- `cheios` pode permanecer negativo. Cada entrada soma sua quantidade uma única vez. Nenhuma segunda movimentação de recomposição é gravada.
- Empréstimos recebidos e devolvidos são eventos em `jm_lan`, com ID, data, quantidade, tipo e empresa opcional. A seção **Config → Empréstimos de gás** apresenta formulário, saldo e histórico. Não soma empréstimos ao total físico próprio.
- O saldo em uso/disponível é derivado; a dívida só diminui com devolução registrada. Empréstimo recebido anteriormente e consolidado em `empG` é preservado, sem inventar empresa/data para esse saldo antigo.
- A persistência valida devoluções/exclusões que tornariam o saldo negativo e rejeita quantidades não inteiras/positivas. Não grava parcialmente. A interface própria apresenta erro claro para devolução acima do saldo.
- Salvar no Início consolida também `empG`/`empA`. Abrir Config carrega os valores atuais antes de salvar totais, evitando utilizar cheios antigos.
- Empréstimos de outra empresa não criam pendências de vasilhames de clientes.
- `mostrarChatLancamentos` fica em `jm_cfg`, padrão `true`. Config permite desativar; Lançar oferece **💬 Mostrar chat** quando oculto. O campo e o parser continuam presentes; a fila WhatsApp continua independente. Usa os estilos existentes para claro/escuro.
- Salvar configuração ou movimentos invalida a imagem em cache.

### Entradas e prioridade de cobertura

Aplicadas literalmente as fórmulas solicitadas, sem uma segunda contabilidade de reposição:

- Caso A: `-8/17/0` → entrada de 5 → `cheios=-3`, usando 3 separados, livres 14.
- Caso B: `-20/17/5` → usando 17 separados e 3 emprestados. Entrada de 5 → `cheios=-15`, usando 15 separados, livres 2 e emprestados em uso 0. A dívida continua 5.

Há uma diferença entre a frase “recompor primeiro separados” e o resultado matemático das fórmulas quando há empréstimos: ao diminuir o déficit, a parcela coberta por empréstimos cai primeiro, porque os separados continuam tendo prioridade na cobertura restante. Foi mantida a fórmula expressamente pedida e a representação por `cheios` negativo. Não foi criado um saldo paralelo que duplicasse unidades.

## Água e WhatsApp preservados

A regra de água continua no wrapper v85: 23 pendências, das quais 2 já em vazios, resultam em 21 separados cheios. O histórico de cada cliente permanece disponível.

Não foram alterados `MainActivity.kt`, `WhatsAppNotificationService.kt`, permissões, pacote ou assinatura de instalação. O fluxo local continua exigindo `delivered` antes de registrar estoque e só depois solicita `mark_registered`. O processamento remoto de fragmentos e a deduplicação do serviço não foram modificados. A única alteração no parser foi priorizar a devolução explicitamente dirigida à empresa sobre a devolução genérica pelo cliente.

## Migração de dados

Migração aditiva por defaults: preferência ausente vira `true`; `empG`/`empA` ausentes viram zero. Nenhum reset de estoque, pendências, histórico ou configurações é executado pela v9.4. As migrações e checkpoints anteriores continuam existentes.

Novos empréstimos usam o histórico já incluído no backup. A preferência e saldos consolidados usam a configuração já incluída no backup; não há banco paralelo. Histórico consolidado não é reaplicado. O identificador Android foi mantido: `com.aistudio.jmestoque.bqkrvz`. Versão atual: `versionCode=94`, `versionName=9.4`.

## Arquivos alterados/criados

- `app/src/main/assets/index.html`: integração do cálculo, UI Config/chat, motor ativo, consolidação, Canvas, validação na persistência, classificação de empréstimos e parser.
- `app/src/main/assets/operacional.js`: cálculo puro e linhas operacionais comuns.
- `app/src/main/assets/operacional-ui.js`: preferência, formulário, histórico e validação de empréstimos.
- `app/build.gradle.kts`: versão 9.4/código 94.
- `tests/operacional-v94.cjs`: rotina determinística sem dependências externas.
- `tests/resultado-v94.log`: resultado da rotina.
- `build-v94.log`: resultado do build final.
- `docs/RELATORIO-CODEX.md`: este relatório.

## Testes realizados

Comando: `node tests/operacional-v94.cjs` — **22 testes aprovados**.

1. Os seis exemplos obrigatórios de cobertura, incluindo `-25/17/5 → falta 3`.
2. Entradas nos casos A/B, sem duplicar unidades nem quitar dívida automaticamente.
3. Recebimento/devolução com histórico em ordem inversa e total próprio constante.
4. Devolução excessiva e exclusão de recebimento rejeitadas sem alterar armazenamento.
5. Preferência do chat persistida/recarregada e fila mantida independente.
6. Água: 23 pendências menos 2 já vazias = 21.
7. Execução do renderizador real do Resumo e do Canvas real com contexto gráfico simulado: mesmos saldos, avisos e conteúdo dentro da altura da imagem.
8. Empréstimos e falta de cobertura na imagem.
9. Devolução à empresa sem criar dívida de vazio de cliente.
10. Backup preservando configuração, movimentos e checkpoint.
11. Defaults seguros sem zerar cheios negativos.
12. Salvar Início sem perder empréstimos ou reaplicar histórico.
13. Controlador WhatsApp e parser reais, com rede simulada: `awaiting_delivery` não lança; `delivered` lança mesmo com chat oculto e depois marca registrado; pedido registrado sai da fila e não é relançado.
14. Parser distinguindo devolução à empresa.

Todos os scripts inline passaram pela compilação sintática de JavaScript. Os testes usam DOM/Canvas simulados e não enviam mensagens reais nem acessam a nuvem de produção.

## Build e APK

Comando: `./gradlew --offline assembleDebug`.

**BUILD SUCCESSFUL in 48s** — 35 tarefas, 14 executadas e 21 atualizadas. A compilação Kotlin foi executada, incluindo o serviço WhatsApp. Usado o AAPT2 local configurado; permissões inalteradas.

- Original: `app/build/outputs/apk/debug/app-debug.apk`
- Cópia final: `/storage/emulated/0/Download/JM-Estoque-v9.4-Operacional.apk`
- Tamanho: 3.534.795 bytes.
- SHA-256 de ambos: `2bfbe878fa5fda83a602611696da015b83d6d0be52b85483db1b12b85933b943`
- Integridade ZIP: `unzip -t` sem erros.
- Assinatura: `apksigner verify --verbose` aprovado, esquema v2, um signatário.
- Os três assets JavaScript/HTML extraídos do APK têm os mesmos hashes dos arquivos finais de produção.

## Pendências reais / limites da verificação

Não houve instalação/execução visual do APK em dispositivo nem teste ponta a ponta com notificações WhatsApp reais. Não havia ADB disponível nesta sessão. A geração, integridade, assinatura, empacotamento e lógica operacional foram verificados; toque, renderização WebView nos dois temas e integração com o gateway externo precisam de conferência no aparelho. Não foram alterados dados reais do usuário para executar os testes.

## Correção pontual — Histórico de Hoje e confirmação do chat (28/09/2026)

Esta seção complementa o relatório original acima. A versão continua **9.4 / código 94**.

### Diagnóstico e implementação

- `renderLista()` usava todo o resultado de `loadLan()`, apesar do título “Histórico de Hoje”. Agora filtra `data === todayStr()`, usando ano, mês e dia locais do aparelho. Não usa UTC nem últimas 24 horas. Os três contadores permanecem visíveis quando não há registros e Todos = Gás + Água em qualquer filtro.
- O filtro é somente visual: nenhum movimento é excluído, regravado ou consolidado. Histórico geral, relatórios e cálculo de estoque continuam recebendo a lista completa. O botão Excluir conserva o índice na lista completa, evitando excluir um registro antigo por engano após a filtragem.
- Um temporizador agenda a próxima meia-noite pelo calendário local. Abertura, entrada em Lançar, retorno à visibilidade, foco e `pageshow` atualizam a lista e reagendam o temporizador. Uma checagem de data a cada segundo cobre ajustes manuais de data/fuso; ela só renderiza quando o dia muda.
- `MainActivity.onResume()` emite `jm:resume` à WebView para atualizar também no retorno do segundo plano, independentemente do evento de visibilidade. Se a página ainda não carregou, a inicialização do script faz a atualização.
- O botão compacto abre o modal existente com o título, mensagem e botões solicitados. Cancelar/fechar não grava nada. Apenas confirmar chama a persistência já existente da preferência. Toques repetidos enquanto a confirmação está aberta não abrem outro modal.
- Não houve mudanças nos motores de estoque, separados, negativos, empréstimos, água, pendências, parser, serviço WhatsApp, confirmação de entrega, relatórios ou sincronização Início/Resumo.

### Arquivos desta correção

- `app/src/main/assets/index.html`: filtro diário, contadores zerados, índice de exclusão e ligação do botão/modal e script diário.
- `app/src/main/assets/historico-hoje.js`: atualização do dia e eventos de ciclo de vida, sem persistência.
- `app/src/main/assets/operacional-ui.js`: confirmação para mostrar chat.
- `app/src/main/java/com/example/MainActivity.kt`: aviso de retorno à WebView.
- `tests/historico-chat-v94.cjs`: testes determinísticos da renderização e modal reais, com relógio/DOM simulados.
- `tests/resultado-historico-chat-v94.log`: resultado dos novos testes.
- `tests/resultado-v94.log`: nova execução da regressão v9.4.
- `build-historico-chat-v94.log`: log da compilação desta correção.
- `docs/RELATORIO-CODEX.md`: este complemento.

### Testes e resultado

Antes das correções, os oito cenários novos falharam pelos comportamentos ausentes. Após implementar:

- `node tests/historico-chat-v94.cjs`: **8 aprovados, 0 falhas**. Cobre ontem/hoje/futuro; 28/09 às 23:59 local (UTC já em 29/09); meia-noite de 29/09 com Todos/Gás/Água zerados; igualdade dos contadores; índices de exclusão; abertura/retorno/aba; mudança manual de data; textos do modal, cancelar, confirmar e persistência; registros e fila preservados.
- `node tests/operacional-v94.cjs`: **22 aprovados**, incluindo estoque negativo, separados, empréstimos, água, backup, Início/Resumo, relatórios e fluxo WhatsApp com confirmação de entrega. Todos os scripts inline passam pela compilação sintática JavaScript.

Os testes executam código de produção com DOM, relógio e rede simulados. Não acessam nem modificam os dados reais. A validação visual e o ciclo de vida em aparelho físico não foram executados nesta sessão.

### Compilação desta correção

Com Java 17 local: `./gradlew --offline assembleDebug` — **BUILD SUCCESSFUL in 1m 44s**, 35 tarefas (6 executadas, 29 atualizadas), incluindo compilação Kotlin. Log: `build-historico-chat-v94.log`.

APK: `app/build/outputs/apk/debug/app-debug.apk`. Integridade ZIP aprovada por `unzip -t`; os quatro assets (HTML e JavaScript) extraídos do APK são idênticos aos arquivos de produção. SHA-256: `7c949c570cde2869489057b0697eb76bd5afca05c88117c7e8786bf2856e624c`. Não foi instalado no aparelho nem copiado para Downloads nesta correção; o APK citado na seção original corresponde à compilação anterior.

## v9.4.2 — balanço físico e preferências do relatório

Backup anterior às alterações: `backup-v942-1790644678742/`, preservando caminhos dos arquivos. Nenhum dado de usuário foi removido, nenhuma migração nova foi criada e nenhuma operação de nuvem foi executada nos testes.

### Causa e fórmula

A imagem usava `${s.gc} cheios + ${s.gv + s.gs} vazios = ${s.totG}`: com -8/17/194, somava 194+17=211 e compensava com -8. O Resumo repetia essa interpretação. O motor calculava `gv=totG-gc-gs`; além do limite dos separados, isso também aumentava indevidamente o pátio.

`JMOperacional.calcular(gc, gs, empG, totG)` agora fornece, além da cobertura já validada, cheios operacionais, cheios físicos, separados cadastrados/em uso/livres, pátio, saldo/em uso emprestado, falta de cobertura e total físico próprio. Cheios físicos = max(0, gc); uso de separados = min(max(0,-gc),gs); livres = gs-uso; pátio = total próprio fixo-cheios físicos-livres; total físico = cheios físicos+livres+pátio. Empréstimos cobrem somente o déficit remanescente e não entram no total próprio. O total fixo não é ajustado para fechar contas. Início, Resumo e imagem recebem o mesmo resultado pelo motor ativo. Água mantém seu cálculo anterior.

Caso obrigatório: **0 cheios físicos + 9 separados livres + 194 vazios no pátio = 203**, com déficit operacional 8 e 17 separados cadastrados. Cartão continua exibindo -8 como déficit. Resumo não apresenta mais a soma 211.

### Auditoria de configurações

| Controle | Persistência | Diagnóstico / correção |
| --- | --- | --- |
| optSep | jm_cfg.relSep | Carregamento correto; imagem ignorava. Agora controla somente separados aguardando entrega. |
| optVazio | jm_cfg.relVazio | Carregamento correto; imagem ignorava. Agora controla somente faltaVazioAgua/Gas positiva. |
| optLan | jm_cfg.relLan | Carregamento correto; seção ausente. Agora controla ENTREGAS DE HOJE. |
| iCorGas / iCorAgua | jm_cfg.corGas / corAgua | Canvas tinha cores fixas; agora usa as salvas nas faixas dos produtos. |
| iCorHeader / iCorFundo | jm_cfg.corHeader / corFundo | Agora usados no título e fundo da imagem. |
| Tema do relatório | jm_rel_tema | Já persistia; continua controlando cartões/textos claro/escuro, com cores personalizadas aplicadas. |
| Chat | jm_cfg.mostrarChatLancamentos | Salvamento imediato e releitura corretos; confirmação e fila preservadas. |
| Aparência do app | jm_cfg.dark | Caminho prefs preservado; independente do tema da imagem. |
| Regra da água | jm_cfg.aguaSepSoId | Caminho prefs preservado; sem mudança nas regras de água. |

Os botões “Salvar cores” e “Salvar opções do relatório” chamavam saveCfg() sem modo; wrappers ativos desviavam para consolidação do estoque e não gravavam as preferências. Agora chamam `salvarPreferenciasRelatorio`, que atualiza apenas as sete chaves de imagem na configuração existente. Valores false não são sobrescritos pelos defaults. loadCfg/fillCfgUI continuam lendo as mesmas chaves. Se uma categoria habilitada estiver vazia, seu bloco é omitido. Pendências não se misturam e não são limitadas aos três primeiros clientes.

Compartilhar e baixar sempre regeneram pelo mesmo gerador, lendo configuração e dados atuais, inclusive após a virada de data. O cache deixa de decidir se a imagem será atualizada.

### Entregas

A seleção usa `data === todayStr()` (calendário local), e os classificadores existentes de entrega normal, entrega de separado e venda completa. Separar, empréstimos e outros movimentos não entram. Deduplicação por ID, ordenação por hora e, em empate/ausência de hora, inversão da lista de inserção mais recente primeiro. Sem ID não se fundem entregas legítimas semelhantes. Água e gás aparecem em subseções; Gás do Povo é identificado pelo produto registrado. Nome vem somente de cliente, nunca de endereço. Nome ausente vira “Cliente não informado”; pagamento ausente ou '-' vira “Não informado”. Pagamentos agregados também passaram a considerar somente entregas de hoje, pois antes somavam todo o histórico. A altura cresce com as linhas e nomes são quebrados para caber na imagem.

### Arquivos e testes

Alterados: `app/src/main/assets/index.html`, `app/src/main/assets/operacional.js`, `app/build.gradle.kts` e este documento. Criados: `tests/relatorio-v942.cjs`, logs `tests/resultado-v942.log`, `tests/resultado-regressao-v942.log`, `tests/resultado-historico-v942.log` e `build-v942.log`. Versão Android 9.4.2, código 95; pacote e assinatura mantidos.

- `node tests/relatorio-v942.cjs`: 23 testes aprovados, incluindo os casos negativos/positivos, falta de cobertura, combinações dos três checkboxes, nome/produto/quantidade/pagamento, ausência de endereço como nome, dia local, deduplicação, ordem, entrega de separado, salvamento sem alterar estoque, releitura e regeneração ao compartilhar/baixar.
- `node tests/operacional-v94.cjs`: 22 aprovados, incluindo WhatsApp, empréstimos, backup, água e sincronização.
- `node tests/historico-chat-v94.cjs`: 8 aprovados, incluindo meia-noite e confirmação do chat.
- Scripts inline compilados sintaticamente pela suíte. O teste inicial de balanço falhou antes da correção por ausência do resultado físico central.

Limites: testes executam código de produção com DOM/Canvas/localStorage/ponte simulados. Releitura das preferências foi validada, mas fechar/reabrir o aplicativo real, compartilhamento Android, download pela WebView e inspeção visual no aparelho não foram executados. Não afirmar esses testes manuais como concluídos. WhatsApp e nuvem reais não foram acionados.

### Build final v9.4.2

`./gradlew --offline assembleDebug`: **BUILD SUCCESSFUL in 1m 42s**, 35 tarefas (14 executadas, 21 atualizadas). APK: `app/build/outputs/apk/debug/app-debug.apk`. Metadados confirmam versão 9.4.2/código 95. `unzip -t` sem erros; `apksigner verify --verbose` aprovado com assinatura v2 e um signatário. Os quatro assets HTML/JavaScript extraídos são byte a byte iguais aos fontes finais.

SHA-256: `0ed0c618c71fc7ea53ec7e176ee32ff61d824003c72668ce56827f62c2d58796`.

## v9.4.3 — relatório compacto e Config organizada (29/09/2026)

### Backup e preservação

Backup anterior às edições em `backup-v943/`, com os caminhos de `index.html`, `app/build.gradle.kts`, deste documento e uma cópia de `tests/relatorio-v942.cjs`. Não foram acessados/modificados dados reais do aplicativo. Não há migração destrutiva. Motores de pendências, água, separados, empréstimos, histórico diário e sincronização Início/Resumo foram preservados. No WhatsApp, somente o destino visual dos cartões mudou; regras, API, serviço e ponte Android permanecem iguais.

### Relatório

O Canvas tem largura real de 840 px, sem multiplicador de densidade. As faixas eram o fundo `corFundo` (padrão #FAFAFA), exposto pelas margens laterais de **36 px**, topo de **28 px**, distância cabeçalho/cartões de **26 px**, intervalos entre cartões de **22 px** (operacional: 16 px) e pela altura com parcelas fixas `650 + opAltura + blocos + 220`.

Agora: margens laterais e superior **8 px**, cartões **824 px** (antes 768), intervalos **8 px**, contornos **1 px** (antes 1,5), faixa de destaque **4 px** (antes 7). Cabeçalho mantém 112 px e cartões de estoque 220 px. Altura é a soma exata dos cartões presentes, intervalos e rodapé de 24 px mais margem inferior de 8 px. O rodapé conserva sua linha de identificação. Não existe reserva de altura para blocos ocultos.

Linhas operacionais passam de 40 px por item para 22 px por linha efetivamente medida. Nomes e textos usam a mesma família/tamanho de fonte na medição e no desenho; palavras maiores que a largura também quebram. Não se limita quantidade de clientes/entregas. O filtro global de paleta v60 agora ignora apenas o Canvas deste relatório (`jmReportExactColors`), para não substituir cores explicitamente salvas pelo usuário.

Condição final, sobre **o mesmo `calc().operacionalGas` usado pelo Resumo**:

```js
op.usingSeparated > 0 || op.borrowedInUse > 0 ||
op.emprestadosADevolver > 0 || op.uncoveredDeficit > 0
```

`emprestadosADevolver` é o nome real da propriedade equivalente a `borrowedToReturn` neste projeto. Não foi criado outro cálculo de saldo.

Nova preferência **`jm_cfg.reportShowSalesPayments`**, padrão `false` somente quando ausente. UI `optSalesPayments`; salvar conteúdo grava booleano; `fillCfgUI` recarrega; Canvas exibe somente com `=== true`. Prévia, baixar e compartilhar continuam chamando o mesmo gerador com os dados atuais. A opção controla o bloco VENDAS E PAGAMENTOS; os indicadores de vendas nos cartões de estoque existentes permanecem.

A seleção de entregas da v9.4.2 foi mantida literalmente: dia-calendário local, classificadores de entregas concluídas, separação Água/Gás, cliente, quantidade, produto e pagamento, deduplicação por ID e ordem horária. Nenhum pedido aguardando confirmação foi adicionado ao histórico.

### Config e auditoria de preferências

Seis grupos: **📋 Relatório**, **✍️ Lançamentos**, **📦 Estoque e alertas**, **💬 WhatsApp e entregas**, **☁️ Dados e sincronização** e **ℹ️ Sobre**. Conteúdo fica antes de aparência no relatório, com seu botão logo abaixo dos checkboxes. `Salvar opções do relatório` grava apenas conteúdo; `Salvar cores` grava apenas cores. Tema usa salvamento imediato existente. Rótulos usam `var(--text)` para legibilidade no escuro. Aparência geral fica em Sobre. Mínimos saíram de Extras para Estoque e alertas, sem duplicação. Empréstimos (saldo/formulário/histórico) e totais físicos foram movidos para Início, preservando IDs e ações. Cartões WhatsApp, inclusive controles de diagnóstico e lembretes, ficam dentro do grupo próprio, mesmo sendo criados dinamicamente.

| Configuração | Chave persistida / consumidor | Verificação |
| --- | --- | --- |
| Separados / faltam entregar | `jm_cfg.relSep` | Checkbox, save de conteúdo e Canvas usam a mesma chave; false preservado. |
| Devolver vasilhame | `jm_cfg.relVazio` | Mesmo fluxo independente. |
| Entregas / lançamentos | `jm_cfg.relLan` | Mesmo fluxo; entregas de hoje mantidas. |
| Vendas e pagamentos | `jm_cfg.reportShowSalesPayments` | Default false, gravação, novo contexto de execução e composição testados. |
| Cores | `jm_cfg.corGas`, `corAgua`, `corHeader`, `corFundo` | UI e Canvas usam as quatro; removida interferência da paleta v60 no relatório. |
| Tema da imagem | `jm_rel_tema` | Seletor Config adicionado; mesma chave de `setRelTema` e gerador. |
| Chat | `jm_cfg.mostrarChatLancamentos` | `jmMostrarChat`, UI e consumidor preservados; ocultação/retorno/persistência testados. |
| Tema do app | `jm_cfg.dark` | `fillCfgUI`, `toggleDark` e save prefs preservados. |
| Regra de água | `jm_cfg.aguaSepSoId` | UI, save e motor preservados; nenhuma regra alterada. |
| Estoque mínimo | `jm_minGas`, `jm_minAgua` | Corrigido carregamento dos valores persistidos ao abrir Config. Novo salvamento grava somente mínimos, sem sobrescrever metas/favoritos/som de Extras; zero preservado. Resumo lê as mesmas chaves. |
| Nuvem | `jm_cfg.fbUrl`, `jm_cfg.syncId`, `jm_sync_pass`, `jm_sync_enabled`, `jm_cloud_stamp`, `jm_device_id` | Carregamento/save/consumidores inspecionados; backup existente transporta configurações e extras jm_*. Nenhuma operação de nuvem real foi feita. |
| WhatsApp remoto | `authorized_sender`, `ask_after_seconds`, `delivery_reminder_minutes`, `draft_window_seconds` | `jm92Config` carrega da API; `jm92Save` grava os mesmos nomes. Persistência é do gateway, não local; não validada contra produção. |
| Contato do monitor | SharedPreferences `jm_whatsapp_monitor.authorized_title`; remoto `authorized_notification_title` | Ponte carrega/salva mesma chave local; serviço consome. Permissão de notificações é configuração do Android. Código preservado. |
| Backup/restauração/instalar/testar conexão | Ações, não preferências | Botões e handlers preservados; não existem chaves novas para essas ações. |

### Arquivos e testes

Alterados: `app/src/main/assets/index.html`, `app/build.gradle.kts`, `tests/relatorio-v942.cjs` (teste adaptado aos dois salvamentos independentes), `docs/RELATORIO-CODEX.md`. Criados: `tests/relatorio-v943.cjs`, logs `tests/resultado-v943.log`, `tests/resultado-v942-v943.log`, `tests/resultado-operacional-v943.log`, `tests/resultado-historico-v943.log` e `build-v943.log`.

- `node tests/relatorio-v943.cjs`: **31 testes aprovados**, incluindo 23 da v9.4.2 e oito novos cenários: controle condicional (inclusive dívida sem uso), default false, saves independentes, novo contexto com armazenamento preservado, composição idêntica de prévia/download/share, margens/intervalos/altura/textos longos, grupos e IDs únicos, mínimos persistidos sem alterar outras preferências.
- `node tests/operacional-v94.cjs`: **22 aprovados**, incluindo WhatsApp confirmado/aguardando, empréstimos, água, backup e Início/Resumo.
- `node tests/historico-chat-v94.cjs`: **8 aprovados**, incluindo virada de data local, índices de exclusão e confirmação do chat.
- Scripts inline compilados sintaticamente. Asserções de geometria executam o gerador real com contexto Canvas simulado: todos os cartões externos têm margens de 8 px e intervalos de 8 px; remover vendas reduz exatamente 158 px; nomes extensos quebram sem exceder a largura medida.

**Limites:** não há navegador/ADB disponível para inspeção visual da WebView, reinício físico do app ou compartilhamento real no WhatsApp. Persistência foi testada em novo contexto JavaScript sobre armazenamento simulado; composição e geometria, em Canvas simulado. Esses testes não substituem conferência visual no celular nem teste do gateway externo. Nenhuma notificação/mensagem real foi enviada.

### Build final v9.4.3 e APK

Java 17 local, `sh gradlew --offline assembleDebug`: **BUILD SUCCESSFUL in 2m 48s**, 35 tarefas (14 executadas, 21 atualizadas). Versão **9.4.3 / código 96**, confirmada no metadata; versão visível atualizada no cabeçalho e em Sobre. Pacote e assinatura de atualização preservados.

- Original: `app/build/outputs/apk/debug/app-debug.apk`.
- Cópia solicitada concluída: **`/storage/emulated/0/Download/JM-Estoque-v9.4.3.apk`**.
- SHA-256: `5891bd7ead5baf0a2441dd689ea898363140ff2c4b5e011e3ceb15da04a19260`.
- Integridade ZIP aprovada (`unzip -t`). Assinatura validada (`apksigner`, esquema v2, um signatário).
- Assets `index.html`, `operacional.js`, `operacional-ui.js` e `historico-hoje.js` extraídos do APK são byte a byte idênticos aos fontes finais.

---

## v9.4.4 — compartilhamento e GitHub Actions

### Diagnóstico e correção

Causa confirmada por teste de regressão antes da alteração: `compartilharPend()` chamava `compartilharRelatorioImg()`, que sempre chamava `gerarImgRelatorio()`. Essa regeneração substituía `_ultimoRelatorioImgData` pela imagem geral, embora `pendImgOut.src` ainda exibisse pendências. Não foi encontrado cache de URI nativa global: o erro estava no roteamento JavaScript e no dado global compartilhado.

Agora `relatoriosPreview.geral` e `relatoriosPreview.pendencias` guardam artefatos imutáveis da respectiva prévia. `shareReport(report)` recebe o artefato explicitamente. O renderer ativo de pendências registra o PNG correto; o botão usa esse registro, sem consultar seletor novamente e sem chamar a geração geral. Uma nova geração inválida limpa a prévia pendente e impede envio da anterior. O download também usa o artefato explícito, inclusive no fallback assíncrono do navegador.

Na ponte Android, `saveReport(dataUrl, requestedName)` salva exatamente os bytes PNG, antes de mostrar a prévia, em `cacheDir/images`. Usa prefixos `relatorio-geral-`, `pendencias-todos-` ou `pendencias-cliente-`, timestamp, sequência e sufixo exclusivo de `File.createTempFile`. Para cliente usa `clienteId`/`id` quando disponível, senão o nome; o modelo atual de pendências agrega por nome, sem cadastro de ID estável de cliente. Não foram alterados a seleção por nome nem o motor de histórico.

`shareReport(reportUri, title)` recebe diretamente a URI retornada por `FileProvider`, verifica autoridade e leitura do arquivo e monta ACTION_SEND com `image/png`, EXTRA_STREAM, ClipData e FLAG_GRANT_READ_URI_PERMISSION. O manifesto já permite concessão de leitura e `file_paths.xml` já cobre `images/`; nenhum dos dois precisou mudar. A prévia WebView continua usando o data URL, mas seus bytes são os mesmos escritos no arquivo da URI, sem recompressão.

O símbolo `_ultimoRelatorioImgData` permanece em renderers legados e na geração geral, mas nenhuma ação de compartilhamento/download o consulta. O renderer final ativo de pendências deixou de escrevê-lo. Cálculos, ordenação, agrupamento diário sem hora, deduplicação, lista de todos os pendentes, tema e desenho foram preservados.

### Arquivos e preservação

Backup anterior às edições: `backup-v944-1790733792312/`, incluindo os testes antigos adaptados. Nenhum dado de aplicativo foi apagado, migrado ou instalado por esta tarefa. Versão visível e versionName: 9.4.4; versionCode: 97.

Adicionados `.github/workflows/android-apk.yml`, `docs/GITHUB-BUILD.md` e `tests/compartilhamento-v944.cjs`. Workflow manual e em push para main, Ubuntu, Java 17, SDK Android, assembleDebug e artifact JM-Estoque-debug. Remove o override AAPT2 do AndroidIDE apenas no runner. `.gitignore` ampliado para builds, IDE, keystores, logs e backups, mantendo todos os arquivos do wrapper elegíveis ao Git.

### Assinatura

O módulo usa `debugConfig` com `debug.keystore` local; essa chave foi preservada. O APK local anterior tem certificado Android Debug e SHA-256 `5ddd1dfb90c132a677800df1ccfd6164cb931e41ada2a1eeaedcbcb61461038b` (impressão pública do certificado, não chave privada). Sem o arquivo local, o build CI usa a configuração debug padrão; seu APK não deve ser considerado compatível para atualização sobre o app atual. Nenhuma keystore ou segredo foi enviado. O guia explica a futura restauração via Base64/Secrets e leitura das senhas por variáveis de ambiente. A pasta não continha repositório `.git`; não houve commit ou push.

### Testes

- Regressão nova falhou antes da correção por regenerar o geral ao compartilhar pendências e passou após a correção.
- Cenários automatizados: geral → todos → Maria Júlia → outro → geral; igualdade do data URL da prévia com os bytes passados à persistência da URI; isolamento de cliente; nome com ID disponível; seleção inexistente bloqueia envio antigo.
- Web Share e fallback testados com troca de artefato durante operação assíncrona; preservam a imagem original. Cancelamento não dispara download.
- Suítes JavaScript: operacional 22/22, histórico 8/8, relatório v9.4.2 23/23, relatório v9.4.3 31/31 (esta última também executa os 23 cenários da v9.4.2). Os testes antigos que exigiam regeneração foram adaptados para exigir composição preservada sem novo desenho.
- Os testes de canvas usam contexto simulado e verificam conteúdo/fluxo; não são testes visuais em WebView real.
- ADB sem dispositivos conectados: recebimento real no WhatsApp e em outro app Android, concessão da URI no dispositivo e inspeção visual final continuam pendentes. Roteiro no guia GitHub. Não houve envio de mensagens reais.
- Workflow revisado localmente, ainda não executado no GitHub.

### Build local

A primeira execução Gradle foi bloqueada por ANDROID_HOME e ANDROID_SDK_ROOT apontarem para grafias distintas do SDK. A execução seguinte usa ambos em `/data/data/com.itsaky.androidide/files/home/android-sdk`, com Java 17 local. Resultado final registrado abaixo.

A tarefa `:app:testDebugUnitTest` foi executada, mas falhou em `:app:compileDebugUnitTestKotlin`: os arquivos preexistentes `ExampleUnitTest.kt` e `ExampleRobolectricTest.kt` importam JUnit, AndroidX Test e Robolectric, sem dependências de teste declaradas no módulo. Não foram removidos ou desativados testes para ocultar essa falha. A correção da infraestrutura desses testes permanece pendente; as cinco suítes JavaScript passaram.

O APK novo foi inspecionado com `apksigner verify --print-certs`: certificado SHA-256 idêntico ao APK local anterior (`5ddd1dfb90c132a677800df1ccfd6164cb931e41ada2a1eeaedcbcb61461038b`). `output-metadata.json` confirma applicationId preservado, versionName 9.4.4 e versionCode 97. Isso confirma continuidade entre os dois APKs locais, sem afirmar que o APK instalado foi inspecionado.

Execução isolada final: `./gradlew :app:assembleDebug --no-daemon` — **BUILD SUCCESSFUL in 59s**, saída 0 (35 tarefas atualizadas). Log: `build-v944-apk.log`. O aviso experimental de AAPT2 é o override local já existente.

APK copiado para `/storage/emulated/0/Download/JM-Estoque-v9.4.4.apk`, 3.538.937 bytes. SHA-256 da origem e da cópia: `aedb7c309e4de54a31bc698a9b82592db52c3228e8db3d9671b22e8913573280`. Não houve instalação, limpeza de dados ou troca da chave local.

Pendências reais: testes Kotlin de exemplo sem dependências; validação de recebimento WhatsApp/genérico em aparelho; execução do workflow no GitHub; futura configuração de Secrets para assinatura CI compatível. O APK local e o workflow foram entregues, mas essas validações externas não são declaradas aprovadas.
