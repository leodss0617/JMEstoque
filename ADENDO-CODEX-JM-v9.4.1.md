# ADENDO JM Estoque v9.4.1 — histórico diário e confirmação do chat

Aplicar estas correções no projeto `~/JMEstoque`, preservando todas as regras já implementadas.

## 1) HISTÓRICO DE HOJE DEVE ZERAR À MEIA-NOITE

O bloco `Histórico de Hoje` deve considerar somente lançamentos cuja DATA LOCAL seja a data atual do aparelho.

Regra:
- o dia começa em 00:00:00;
- o dia termina em 23:59:59.999;
- às 00:00 de um novo dia, o contador visual deve zerar automaticamente;
- `Todos`, `Gás` e `Água` devem recalcular juntos;
- os registros antigos NÃO devem ser apagados;
- eles apenas deixam de aparecer em `Histórico de Hoje`;
- o histórico completo continua preservado para relatórios/filtros por data;
- não usar “últimas 24 horas”;
- usar comparação por dia-calendário local.

Exemplo:
- lançamento em 28/09/2026 23:59 pertence ao dia 28;
- ao chegar 29/09/2026 00:00, `Histórico de Hoje` deve iniciar em 0;
- lançamento em 29/09/2026 00:01 pertence ao dia 29.

A tela deve atualizar:
- ao abrir o app;
- ao voltar do segundo plano;
- ao trocar para a aba Lançar;
- e quando detectar mudança de data enquanto o app estiver aberto.

Criar uma função única, por exemplo:
`isSameLocalCalendarDay(timestamp, now)`
e reutilizar no cálculo dos contadores e na lista.

## 2) CONFIRMAÇÃO ANTES DE MOSTRAR O CHAT

Quando a opção `Mostrar Chat de Lançamentos` estiver desativada e aparecer o botão compacto `💬 Mostrar chat`:

Ao tocar, NÃO abrir imediatamente.

Mostrar primeiro um diálogo de confirmação:

Título:
`Mostrar Chat de Lançamentos?`

Texto:
`O chat ocupa mais espaço na aba Lançar. Deseja realmente exibi-lo agora?`

Botões:
- `Cancelar`
- `Mostrar chat`

Comportamento:
- `Cancelar`: fecha o diálogo e mantém o chat oculto;
- `Mostrar chat`: mostra o chat;
- não registrar lançamento;
- não alterar estoque;
- não mexer em pendências;
- não mexer no WhatsApp.

A preferência continua persistente.

## 3) TESTES

Validar:
1. registros de ontem não aparecem em `Histórico de Hoje`;
2. registros de hoje aparecem;
3. à meia-noite o contador zera sem apagar dados antigos;
4. Todos = Gás + Água;
5. botão `Mostrar chat` pede confirmação;
6. Cancelar mantém oculto;
7. Confirmar mostra o chat;
8. após reiniciar, a preferência continua correta.

## 4) NÃO QUEBRAR
Preservar:
- integração WhatsApp v9.3;
- confirmação de entrega antes do lançamento;
- pendências;
- regras de separados;
- empréstimos;
- sincronização Início/Resumo;
- relatórios;
- dados existentes.

Atualizar `docs/RELATORIO-CODEX.md` com as alterações e testes.
