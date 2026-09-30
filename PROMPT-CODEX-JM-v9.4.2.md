# JM Estoque — v9.4.2
## Correção do balanço físico, relatório de entregas e auditoria das configurações

Projeto: `~/JMEstoque`

IMPORTANTE: primeiro faça backup dos arquivos que serão alterados. Não apague dados do usuário. Preserve toda a lógica já validada da v9.4/v9.4.1, integração WhatsApp, pendências, histórico, empréstimos e sincronização Início/Resumo.

# 1. CORRIGIR O ERRO DO TOTAL DE VAZIOS QUANDO CHEIOS ESTÁ NEGATIVO

Há um erro conceitual no relatório atual.

Caso real:
- total físico próprio da loja = 203
- cheios operacionais = -8
- separados cadastrados = 17
- usando separados = 8
- separados livres = 9
- vazios no pátio = 194

O relatório atual mostra:
`-8 cheios + 211 vazios = 203 no estoque físico`

Isso está ERRADO como balanço físico, porque `-8` é déficit operacional, não uma quantidade física de botijões cheios.

Nesse caso, a visão física correta é:

- Cheios físicos próprios = 0
- Separados livres = 9
- Vazios no pátio = 194
- Total físico próprio = 0 + 9 + 194 = 203

E a visão operacional é:
- Cheios operacionais = -8
- Separados cadastrados = 17
- Usando separados = 8
- Separados livres = 9

Nunca somar quantidade negativa de cheios com "vazios" para explicar o total físico.

Criar/usar uma função central de cálculo semelhante a:

```text
operationalFull = cheios
physicalFull = max(0, operationalFull)

deficit = max(0, -operationalFull)
usingSeparated = min(deficit, separatedRegistered)
separatedFree = max(0, separatedRegistered - usingSeparated)

remainingDeficit = max(0, deficit - separatedRegistered)
borrowedInUse = min(remainingDeficit, borrowedAvailableOrBalance)
uncoveredDeficit = max(0, remainingDeficit - borrowedAvailableOrBalance)

physicalOwnTotal =
    physicalFull + separatedFree + yardEmpty
```

Para o caso real:
```text
physicalFull = 0
separatedFree = 9
yardEmpty = 194
physicalOwnTotal = 203
```

No relatório, substituir a linha incorreta por algo claro como:

`Estoque físico próprio: 0 cheios + 9 separados livres + 194 vazios no pátio = 203`

E abaixo:
`⚠ Déficit operacional: 8 unidades. Usando 8 dos 17 separados cadastrados.`

Se houver empréstados:
- mostrar `Emprestados em uso: X`
- deixar claro que emprestados NÃO entram no total físico próprio da loja.

Não alterar o total fixo da loja apenas para fazer a conta fechar.

# 2. CARTÃO DE GÁS DO RELATÓRIO

Quando `cheios < 0`:
- o número grande pode continuar mostrando `-8` como "CHEIOS — déficit operacional";
- `SEPARADOS DISPONÍVEIS` deve mostrar apenas os livres, neste caso `9`;
- `VAZIOS NO PÁTIO` deve mostrar `194`;
- NÃO criar `211 vazios` somando separados cadastrados que já estão parcialmente em uso.

No bloco `CONTROLE OPERACIONAL — GÁS`, mostrar:
- Separados cadastrados: 17
- Usando separados: 8
- Separados livres: 9
- Emprestados recebidos/saldo atual: X, se houver
- Emprestados em uso: Y, se houver
- Emprestados a devolver: Z, se houver
- Falta de cobertura: W, se houver

# 3. RELATÓRIO DEVE MOSTRAR AS ENTREGAS DE HOJE

A opção de Config:
`LISTA DE LANÇAMENTOS DO DIA`

está marcada, mas o relatório atual não está mostrando a lista. Corrigir.

Quando essa opção estiver ATIVADA, adicionar ao relatório uma seção:
`ENTREGAS DE HOJE`

Separar em duas subseções:

## ÁGUA
Para cada entrega de água do dia atual, mostrar:
- nome real do cliente;
- quantidade;
- produto (`Água 20L`);
- forma de pagamento;
- opcionalmente endereço, se existir e houver espaço.

Exemplo visual:
```text
ÁGUA
Maria — 2 Água 20L — PIX
João — 1 Água 20L — Dinheiro
```

## GÁS
Para cada entrega de gás do dia atual, mostrar:
- nome real do cliente;
- quantidade;
- produto (`Gás GLP 13kg` ou `Gás do Povo`, quando for esse tipo);
- forma de pagamento;
- opcionalmente endereço.

Exemplo:
```text
GÁS
Luciana — 1 Gás GLP 13kg — PIX
Carlos — 1 Gás do Povo — PIX
```

Regras:
- usar somente lançamentos do DIA-CALENDÁRIO LOCAL atual;
- não usar últimas 24 horas;
- não repetir lançamento;
- ordenar por horário crescente ou pela ordem real do lançamento;
- não usar endereço como nome do cliente;
- se cliente realmente não estiver informado, mostrar `Cliente não informado`;
- não inventar forma de pagamento;
- se pagamento não estiver informado, mostrar `Não informado`;
- respeitar produto real;
- uma entrega de separado confirmada hoje também pode entrar como entrega do dia se ela gerou lançamento de entrega;
- não incluir "separar" que ainda não foi entregue como se fosse entrega concluída.

# 4. CONFIGURAÇÕES DO RELATÓRIO ESTÃO SENDO IGNORADAS

Auditar TODAS as opções da seção:
`O que aparece no relatório (imagem)`

No mínimo existem:
- `CLIENTES COM SEPARADOS / FALTAM ENTREGAR`
- `CLIENTES COM FALTA DE DEVOLVER VASILHAME`
- `LISTA DE LANÇAMENTOS DO DIA`

Verificar:
1. qual chave de persistência cada checkbox usa;
2. se a chave salva é exatamente a mesma lida pelo gerador do relatório;
3. se o valor é carregado corretamente ao abrir o app;
4. se `Salvar opções do relatório` realmente persiste;
5. se o relatório usa o valor salvo mais recente;
6. se não existe valor hardcoded sobrescrevendo a preferência;
7. se a geração da imagem usa as mesmas opções da tela;
8. se compartilhar/baixar relatório não usa uma versão antiga do estado.

Comportamento obrigatório:
- checkbox DESMARCADO = seção não aparece;
- checkbox MARCADO = seção aparece quando houver dados;
- se marcado mas não houver dados, usar comportamento consistente e compacto (pode omitir ou mostrar "nenhum", mas documentar);
- depois de salvar, fechar/reabrir app deve manter a configuração.

Também auditar:
- cores personalizadas do relatório;
- opção mostrar/ocultar chat;
- qualquer outra preferência visível em Config que afete relatório/lançamento.

# 5. PENDÊNCIAS NO RELATÓRIO

As duas opções de pendências são diferentes e devem ser respeitadas separadamente:

A) `CLIENTES COM SEPARADOS / FALTAM ENTREGAR`
- mostrar somente clientes com produto separado/aguardando entrega.

B) `CLIENTES COM FALTA DE DEVOLVER VASILHAME`
- mostrar somente quem realmente deve vasilhame.

Não misturar uma categoria na outra.
Se ambas estiverem ligadas, podem aparecer em blocos separados.

# 6. CONSISTÊNCIA ENTRE RESUMO E RELATÓRIO

O relatório não deve recalcular estoque por uma fórmula diferente.

Criar/reutilizar UMA fonte de verdade para:
- operationalFull
- physicalFull
- separatedRegistered
- usingSeparated
- separatedFree
- yardEmpty
- borrowed balance
- borrowed in use
- uncovered deficit
- physical own total

Resumo, Início e relatório devem consumir o mesmo resultado.

Caso real obrigatório para teste:
```text
total próprio = 203
cheios operacionais = -8
separados cadastrados = 17
usando separados = 8
separados livres = 9
vazios no pátio = 194
```

Resultado obrigatório:
```text
estoque físico próprio = 203
0 cheios físicos + 9 separados livres + 194 vazios no pátio = 203
```

NUNCA:
```text
-8 cheios + 211 vazios = 203
```

# 7. TESTES OBRIGATÓRIOS

Adicionar/rodar validações para:

1. cheios = -8, separados cadastrados = 17, pátio = 194
   - usando separados = 8
   - separados livres = 9
   - cheios físicos = 0
   - total físico = 203

2. cheios = 10, separados cadastrados = 17
   - usando separados = 0
   - separados livres = 17

3. cheios = -17, separados = 17
   - separados livres = 0
   - usando = 17

4. déficit maior que separados
   - usa emprestados somente depois dos separados

5. `LISTA DE LANÇAMENTOS DO DIA` desligada
   - seção não aparece

6. `LISTA DE LANÇAMENTOS DO DIA` ligada
   - seção aparece e lista entregas reais do dia

7. testar separação Água/Gás

8. testar cliente, quantidade, produto e pagamento

9. testar que endereço não vira nome do cliente

10. testar as duas opções de pendências independentemente

11. fechar/reabrir app e confirmar persistência das configurações

12. gerar imagem, compartilhar e baixar relatório e confirmar que todos usam o mesmo estado/configuração.

# 8. NÃO QUEBRAR

Preservar:
- integração WhatsApp;
- fila de entregas;
- confirmação do entregador;
- lançamentos;
- histórico;
- regras específicas de água;
- regra de separados de gás;
- empréstimos;
- backup;
- nuvem;
- dados existentes;
- sincronização Início/Resumo;
- chat recolhível;
- zeragem visual do Histórico de Hoje à meia-noite.

# 9. RELATÓRIO DO CODEX

Atualizar:
`docs/RELATORIO-CODEX.md`

Registrar:
- causa da soma incorreta de 211;
- fórmula antiga encontrada;
- fórmula nova;
- arquivos alterados;
- chaves de configuração auditadas;
- erros de persistência encontrados;
- como foi corrigida a lista de entregas do dia;
- testes executados;
- resultado do build.

Depois das alterações, compile o APK.
Não apenas descreva a solução: altere o projeto, valide e compile.
