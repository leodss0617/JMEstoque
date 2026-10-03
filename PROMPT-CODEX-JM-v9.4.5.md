# JM Estoque — v9.4.5

Objetivos desta versão:
1. Corrigir a observação das notificações do WhatsApp de ponta a ponta.
2. Adicionar os totais físicos fixos de Gás e Água em Config.
3. Melhorar a fluidez/desempenho do sistema.
4. Preservar todas as regras já validadas da v9.4.4.
5. Testar, compilar, atualizar docs/RELATORIO-CODEX.md, commitar e fazer push para main.

Projeto local: ~/JMEstoque
Repo: leodss0617/JMEstoque

REGRAS GERAIS
- Faça backup antes de alterar.
- Preserve dados existentes.
- Preserve assinatura atual.
- Não apague histórico, pendências, nuvem, WhatsApp, configurações ou dados.
- Não reescreva o app inteiro sem necessidade.
- Não exponha keystore/secrets.
- Trabalhe de forma autônoma e não pare para perguntar decisões simples.

## 1. CORRIGIR OBSERVAÇÃO DAS NOTIFICAÇÕES

Audite ponta a ponta:
- AndroidManifest
- NotificationListenerService
- permissão/acesso
- filtro de pacote
- extração das mensagens
- deduplicação
- agrupamento de mensagens fragmentadas
- persistência
- ponte Android -> WebView/JS
- fila de entregas
- confirmação antes de lançar estoque

### Manifest/serviço
Garanta um NotificationListenerService válido com:
- android.permission.BIND_NOTIFICATION_LISTENER_SERVICE
- action android.service.notification.NotificationListenerService
- exported compatível
- classe/package corretos

Não usar AccessibilityService e não tentar conceder permissão automaticamente.

### Estado do acesso
Em Config > WhatsApp e entregas mostrar:
- 🟢 Observação de notificações ativa
ou
- 🔴 Acesso às notificações desligado

Adicionar botão:
Abrir acesso às notificações

Abrir Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS.
Não abrir sozinho e não exibir popups repetitivos.

### Reconexão
Implementar corretamente:
- onListenerConnected()
- onListenerDisconnected()
- requestRebind(ComponentName(...)) com proteção contra loop

Registrar:
- última conexão
- última desconexão
- última notificação WhatsApp capturada
- último erro

### Pacotes
Suportar:
- com.whatsapp
- com.whatsapp.w4b somente quando configurado

Ignorar outros apps.

### Extração robusta
Não depender apenas de EXTRA_TEXT.
Ler quando existirem:
- EXTRA_TITLE
- EXTRA_TEXT
- EXTRA_BIG_TEXT
- EXTRA_SUB_TEXT
- EXTRA_TEXT_LINES
- EXTRA_MESSAGES
- MessagingStyle.Message
- remetente/pessoa
- título da conversa
- timestamp

Tratar notificações agrupadas e atualizações da mesma notificação.
Não transformar resumos como “X novas mensagens” em pedido.

### Deduplicação
Evitar processar várias vezes a mesma atualização.
Usar chave baseada em:
- package
- conversa/remetente
- texto normalizado
- notification key/id/tag
- timestamp aproximado

Não eliminar mensagens iguais de pedidos realmente diferentes.

### Mensagens fragmentadas
Exemplos:
1 gás
na kasa
Luciana
pix

ou:
1 gas portao pix

Agrupar fragmentos do mesmo remetente/conversa em uma sessão temporária persistente, com janela de ~60–90 s, complementando o mesmo pedido.

Reconhecer variações:
gas/gás/gaz
agua/água
botijao/botijão
kasa/casa
portao/portão
pix
dinheiro
debito/débito
credito/crédito
gas do povo/gás do povo
nomes de clientes
endereço

Não exigir ordem fixa.

Estrutura mínima:
id
conversationId
sender
customerName
product
quantity
isGasDoPovo
address
paymentMethod
rawMessages[]
createdAt
updatedAt
status
deliveryConfirmedAt

Status:
collecting
waiting_info
ready
out_for_delivery
delivered
cancelled

### Regra de entrega
Receber pedido NÃO altera estoque/venda/histórico final.
Somente depois de confirmação do entregador (“entregue”, “já entreguei”, “foi entregue” ou botão Confirmar entrega) criar o lançamento definitivo.

Garantir idempotência: confirmar duas vezes não baixa estoque duas vezes.

Se faltar endereço, pagamento, cliente ou dado essencial, mostrar claramente na fila. Não inventar dados.

Enquanto houver pedido pronto/saindo para entrega não confirmado:
- manter alerta no app
- usar notificação local agrupada
- parar alerta quando entregue

### Diagnóstico
Adicionar em Config > WhatsApp e entregas:
Diagnóstico da observação

Mostrar:
- acesso concedido
- listener conectado
- última conexão
- última notificação WhatsApp
- último remetente/conversa identificado
- eventos capturados hoje
- descartados como duplicados
- último erro

Adicionar botão Testar parser com exemplos sintéticos:
- 1 gás
- na casa
- Luciana
- pix
- 1 gas portao pix
- gas do povo casa Maria dinheiro

## 2. TOTAL FÍSICO FIXO EM CONFIG

Hoje Início informa que o total físico fica em Config, mas não existe campo claro.

Adicionar em Config > Estoque e alertas:

📦 Total físico do estoque

Total físico de Gás (13kg)
Total físico de Água (20L)

Migrar os valores existentes, sem zerar nada.
Reutilize chaves existentes se já houver fonte equivalente; caso contrário:
- gasPhysicalTotal
- waterPhysicalTotal

Regras:
- inteiro >= 0
- persistente
- carregar ao abrir
- Início, Resumo e Relatório usam a MESMA fonte
- backup/nuvem incluem esses valores
- restauração restaura esses valores
- sem estado duplicado

Ao alterar:
- pedir confirmação
- não apagar lançamentos
- não apagar pendências
- não inventar movimentação
- recalcular somente derivados
- registrar ajuste com data/hora, produto, anterior, novo, origem

### GÁS
Preservar lógica:
- separados de gás fazem parte dos vazios físicos
- cheios operacional pode ficar negativo como déficit
- separados cobrem primeiro
- separados livres = cadastrados - usando separados
- depois podem existir emprestados
- emprestados NÃO entram no total físico próprio
- não usar “-8 cheios + 211 vazios = 203” como balanço físico literal
- separar déficit operacional do estoque físico real

### ÁGUA
Preservar:
- separados ainda cheios são subconjunto dos cheios
- não somar separados duas vezes
- itens já convertidos para regra de vazio seguem a regra validada
- total físico = cheios físicos + vazios físicos
- não quebrar os 21 separados já validados

## 3. FLUIDEZ / DESEMPENHO

Primeiro encontre gargalos reais.

Medir em diagnóstico:
- tempo para abrir cada aba
- render Resumo
- render Pendentes
- processar notificação
- gerar relatório
- quantidade de itens renderizados

Auditar JS/WebView:
- innerHTML gigante e rerender completo
- JSON.parse/stringify em loops
- localStorage repetido
- listeners duplicados
- timers/intervalos duplicados
- chamadas bridge Android-JS repetidas
- geração de relatório fora de hora

Aplicar onde fizer sentido:
- cache de estado
- fonte única
- atualização incremental
- debounce
- requestAnimationFrame
- event delegation
- cancelar timers antigos
- memoizar cálculos derivados
- gerar relatório só quando solicitado

Listas grandes:
- paginação/lotes, virtualização ou “Mostrar mais”
- busca continua considerando todos os dados
- não perder registros

CSS:
- reduzir sombras/blur/filtros/animações que causem repaint
- manter identidade visual

Android:
- processamento pesado fora da main thread
- IO sem travar UI
- não recriar WebView ao trocar aba
- não recarregar index.html desnecessariamente
- evitar bridge síncrona pesada
- evitar polling agressivo

Critérios:
- troca de aba sem tela branca
- scroll fluido
- digitação sem atraso
- notificação não congela UI
- relatório não trava a interface

## 4. TESTES

Criar/atualizar testes para:
1 parser 1 gás
2 parser 1 gas portao pix
3 sequência 1 gás / na kasa / Luciana / pix
4 deduplicação
5 mensagens iguais em pedidos diferentes
6 pedido não altera estoque antes de delivered
7 confirmação dupla não duplica venda
8 outros pacotes ignorados
9 WhatsApp normal
10 Business só quando habilitado
11 total gás persistido
12 total água persistido
13 Início=Resumo=Relatório nos totais
14 backup/restauração preserva totais
15 água separada não soma duas vezes
16 gás negativo usa separados corretamente
17 emprestados fora do total físico próprio
18 sem listeners/timers duplicados
19 sem cards duplicados em rerender
20 histórico diário por dia calendário
21 relatório de pendências continua compartilhando a imagem correta

## 5. CONFIG

Organizar:
📦 Estoque e alertas
- Total físico Gás
- Total físico Água
- estoque mínimo
- alertas

💬 WhatsApp e entregas
- ativar/desativar observação
- WhatsApp normal/Business
- contato/número autorizado
- status do listener
- botão Abrir acesso às notificações
- Diagnóstico
- lembretes

Não duplicar opções.

## 6. VERSÃO / BUILD / GITHUB

Atualizar para v9.4.5.
Preservar assinatura.
Rodar testes.
Rodar:
./gradlew :app:assembleDebug --no-daemon

Atualizar:
docs/RELATORIO-CODEX.md

Depois:
git add .
git commit -m "JM Estoque v9.4.5 - notificações, totais e desempenho"
git push origin main

Verificar que o GitHub Actions Build Android APK iniciou.
Não alterar/remover a configuração de assinatura já funcionando.

## 7. RELATORIO-CODEX

Registrar:
- causa raiz da captura de notificações
- Manifest e classe do listener
- fluxo Android -> persistência -> bridge -> UI
- deduplicação
- agrupamento de fragmentos
- confirmação de entrega
- chaves dos totais físicos
- fórmulas finais gás/água
- gargalos encontrados
- otimizações aplicadas
- arquivos alterados
- testes
- build
- commit
- push
- status do GitHub Actions
- pendências reais

Não escrever apenas “corrigido”; mostrar causa e evidências.
