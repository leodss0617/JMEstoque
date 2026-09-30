# JM Estoque — v9.4: chat recolhível, separados operacionais e empréstimos

Você está trabalhando no projeto Android local em `~/JMEstoque`.

## OBJETIVO
Corrigir a lógica operacional do estoque e melhorar a interface sem quebrar o que já funciona, especialmente:
- pendências por cliente;
- regras de gás/água;
- integração WhatsApp v9.3;
- confirmação de entrega antes de lançar;
- relatórios;
- backup/dados existentes.

Antes de alterar, INSPECIONE TODO O PROJETO e identifique onde estão:
- estado/modelo de estoque;
- cálculo de `cheios`, `vazios`, `separados`, `emprestados`;
- tela `Resumo`;
- tela `Início`;
- tela `Lançar`;
- relatório diário / relatório em imagem;
- parser do chat;
- persistência local;
- sincronização entre Início e Resumo.

NÃO faça remendos visuais desconectados dos dados. A regra deve existir em uma única fonte de verdade e todas as telas/relatórios devem usar o mesmo cálculo.

---

# 1. CHAT DE LANÇAMENTOS — MOSTRAR/OCULTAR

O bloco grande "CHAT DE LANÇAMENTOS" ocupa muito espaço na aba Lançar.

Implementar uma preferência persistente:
`mostrarChatLancamentos: Boolean`

Requisitos:
- adicionar em Config uma opção clara:
  `Mostrar Chat de Lançamentos na aba Lançar`
- deve poder ativar/desativar;
- persistir após fechar/reabrir app;
- se desativado, esconder somente o bloco do chat/frase rápida;
- NÃO remover a funcionalidade;
- NÃO esconder "Entregas do WhatsApp";
- quando escondido, deixar na aba Lançar um botão compacto:
  `💬 Mostrar chat`
- ao tocar, mostrar novamente;
- deve funcionar em modo claro e escuro.

---

# 2. REGRA CORRETA DOS SEPARADOS DE GÁS

Hoje existe um erro conceitual.

Exemplo REAL atual:
- `cheios = -8`
- `separados cadastrados/pendentes = 17`

Como há 8 cheios negativos, isso significa que 8 unidades dos separados estão sendo usadas fisicamente para cobrir o déficit.

Então:
- separados cadastrados = 17
- usando separados = 8
- separados livres/disponíveis = 9

Fórmula mínima:
```text
deficitCheios = max(0, -cheios)
usandoSeparados = min(deficitCheios, separadosCadastrados)
separadosLivres = max(0, separadosCadastrados - usandoSeparados)
```

IMPORTANTE:
- na área detalhada pode continuar mostrando `17 cadastrados/pendentes`;
- porém o cartão principal de "SEPARADOS" no Resumo e no relatório deve mostrar o que está realmente livre/disponível: `9`;
- nunca mostrar 17 como se as 17 unidades ainda estivessem fisicamente livres;
- deixar claro no detalhe:
  - `Separados cadastrados: 17`
  - `Usando separados: 8`
  - `Separados livres: 9`

No relatório principal, usar:
`SEPARADOS DISPONÍVEIS: 9`

Se estiver usando separados, mostrar aviso:
`⚠️ Estoque cheio negativo. Usando 8 separados. Restam 9 separados livres.`

Esse aviso também deve aparecer no relatório/imagem compartilhável.

---

# 3. ESTOQUE NEGATIVO É PERMITIDO

NÃO impedir `cheios` de ficar negativo.

A lógica operacional é:
1. usa cheios normais;
2. quando cheios passam abaixo de zero, o déficit consome separados;
3. quando os separados disponíveis acabam, pode usar unidades emprestadas de outra empresa.

Portanto NÃO faça clamp para zero em `cheios`.

---

# 4. EMPRÉSTIMOS DE OUTRA EMPRESA

Criar um controle real e persistente de gás emprestado.

Precisamos distinguir no mínimo:

```text
emprestadosSolicitados
emprestadosEmUso
emprestadosDisponiveis
emprestadosADevolver
```

A nomenclatura pode ser refinada, mas deve ficar muito clara para o usuário.

Adicionar uma área em `Início` ou `Config`:
`🔥 Empréstimos de gás`

Ações:
- `Registrar empréstimo recebido`
- informar quantidade;
- opcionalmente nome da empresa;
- data padrão = hoje;
- `Registrar devolução`
- informar quantidade devolvida;
- opcionalmente empresa;
- não permitir devolver mais do que o saldo devido sem confirmação/erro claro.

Persistir histórico:
- data;
- quantidade;
- tipo: recebeu/devolveu;
- empresa quando informada.

No Resumo mostrar:
- Emprestados solicitados / saldo atual;
- Emprestados em uso;
- Emprestados ainda disponíveis;
- A devolver para outra empresa.

No relatório diário/imagem mostrar os mesmos dados quando houver valor > 0.

---

# 5. QUANDO OS SEPARADOS ACABAREM

Cobertura de déficit:
```text
deficitCheios = max(0, -cheios)

usandoSeparados =
    min(deficitCheios, separadosCadastrados)

deficitDepoisSeparados =
    max(0, deficitCheios - separadosCadastrados)

emprestadosEmUso =
    min(deficitDepoisSeparados, emprestadosSaldoAtual)

faltaCobertura =
    max(0, deficitDepoisSeparados - emprestadosSaldoAtual)
```

Se `faltaCobertura > 0`, mostrar aviso forte:
`🚨 Faltam X botijões para cobrir o estoque negativo. Separe/registre empréstimo.`

Os emprestados NÃO entram no total físico próprio da loja.

---

# 6. ENTRADA DE MERCADORIA NOVA

Quando chegar mercadoria própria da loja, a entrada não pode simplesmente ignorar os déficits operacionais.

Regra solicitada:
1. primeiro recompõe o que estava sendo consumido dos separados;
2. depois trata o que estiver sendo coberto por empréstimos;
3. somente o restante fica como cheios livres.

A implementação deve preservar a consistência histórica.

IMPORTANTE:
- se a arquitetura atual usa `cheios` negativo como representação do déficit, não faça uma segunda subtração/adição em paralelo que duplique o efeito;
- crie uma função central de cálculo/normalização;
- depois de qualquer entrada, venda, entrega, separação, devolução ou empréstimo, recalcular a visão operacional a partir da mesma fonte de verdade.

Criar testes para:
### Caso A
Antes:
- cheios = -8
- separados cadastrados = 17
- emprestados = 0

Resultado visual:
- usando separados = 8
- separados livres = 9

Entrada de 5:
- o déficit diminui corretamente;
- separados livres aumentam de forma coerente;
- não duplicar unidades.

### Caso B
Antes:
- cheios = -20
- separados cadastrados = 17
- empréstimos suficientes registrados

O sistema deve mostrar:
- 17 separados consumidos;
- 3 emprestados em uso;
- separados livres 0.

Ao entrar mercadoria, atualizar os saldos sem duplicar estoque.

---

# 7. ÁGUA

NÃO alterar a regra específica da água que já foi corrigida:
- água "para entregar" que já foi contabilizada como vazia NÃO deve continuar contando como separada cheia;
- exemplo conhecido: 23 pendentes visuais, mas 2 (Luciana e Denis) já são "para entregar" e contam como vazios; então o Resumo deve mostrar apenas 21 separados cheios.

Preservar essa lógica.

---

# 8. INÍCIO E RESUMO

Continuam sendo duas visões da MESMA fonte de dados.

- Início = edição/ajuste operacional;
- Resumo = visualização consolidada.

Qualquer alteração em Início deve refletir imediatamente no Resumo.
Não criar cópias independentes dos valores.

---

# 9. RELATÓRIO

Corrigir o relatório para usar exatamente a mesma função central do Resumo.

Para gás, quando:
- cheios = -8;
- separados cadastrados = 17;

o relatório NÃO pode mostrar simplesmente:
`Separados: 17`

Deve mostrar:
- `Cheios: -8`
- `Separados disponíveis: 9`
- `Usando separados: 8`

e um aviso:
`⚠️ Estoque cheio negativo — 8 unidades estão sendo atendidas pelos separados.`

Se houver empréstimos:
- `Emprestados solicitados/saldo: X`
- `Emprestados em uso: Y`
- `Emprestados a devolver: Z`

Não poluir visualmente o relatório: usar um bloco operacional compacto.

---

# 10. NÃO QUEBRAR WHATSAPP v9.3

Preservar:
- `WhatsAppNotificationService`;
- filtro pelo contato autorizado;
- fila "Entregas do WhatsApp";
- mensagens fragmentadas;
- deduplicação;
- regra de NÃO lançar estoque antes do entregador confirmar;
- pedido `awaiting_delivery`;
- confirmação `delivered`;
- somente depois `registered`.

Não altere permissões nem remova a integração v9.3.

---

# 11. MIGRAÇÃO DE DADOS

A atualização deve manter dados existentes.

Se forem necessárias novas chaves/estruturas:
- aplicar migração segura;
- valores ausentes devem iniciar em zero;
- não apagar histórico;
- não resetar estoque;
- não resetar pendências;
- não resetar configurações.

---

# 12. TESTES OBRIGATÓRIOS

Antes de concluir, crie/rode testes determinísticos ou uma rotina de validação para estes casos:

1. cheios 10, separados 17 -> livres 17, usando 0
2. cheios 0, separados 17 -> livres 17, usando 0
3. cheios -8, separados 17 -> livres 9, usando 8
4. cheios -17, separados 17 -> livres 0, usando 17
5. cheios -20, separados 17, emprestados 5 -> emprestadosEmUso 3
6. cheios -25, separados 17, emprestados 5 -> faltaCobertura 3
7. entrada de mercadoria com estoque negativo não duplica unidades
8. relatório e Resumo exibem os mesmos saldos
9. toggle do Chat persiste
10. integração WhatsApp continua compilando

---

# 13. BUILD

Depois das alterações:
- rodar compilação Android;
- preferir o wrapper existente;
- no AndroidIDE, se necessário, usar o AAPT2 local já configurado;
- gerar APK debug funcional.

Copiar o APK final para:
`/storage/emulated/0/Download/JM-Estoque-v9.4-Operacional.apk`

---

# 14. RELATÓRIO DO CODEX

OBRIGATÓRIO criar/atualizar:

`docs/RELATORIO-CODEX.md`

com:
- diagnóstico;
- causa dos erros encontrados;
- regras implementadas;
- arquivos alterados;
- migração de dados;
- testes realizados;
- resultado do build;
- caminho do APK;
- pendências reais, se existirem.

Não diga apenas que terminou. Verifique a implementação e o build antes de concluir.
