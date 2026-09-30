# JM Estoque — v9.4.3
## Relatório mais compacto + controle operacional condicional + Config organizada

Projeto: `~/JMEstoque`

Antes de alterar:
- faça backup dos arquivos que serão modificados;
- preserve todos os dados existentes;
- preserve as regras já corrigidas da v9.4.2;
- NÃO mexa nas regras de pendências, água, separados, empréstimos, WhatsApp, histórico diário e sincronização Início/Resumo, exceto onde este prompt pedir.

# 1) DIMINUIR AS LINHAS / FAIXAS BRANCAS GIGANTES DO RELATÓRIO

Na imagem do relatório atual há muito espaço/faixa branca em volta e entre os cartões escuros.

Objetivo:
- deixar o relatório mais compacto;
- reduzir bastante a largura/espessura dessas áreas brancas;
- manter boa leitura no WhatsApp;
- não cortar textos;
- não deixar os cartões grudados.

Ajustar o gerador da imagem do relatório:
- margem externa branca: aproximadamente 6–10 px;
- espaço vertical entre cartões: aproximadamente 6–10 px;
- bordas/separadores brancos: finos;
- remover qualquer `padding`, `margin`, `gap`, `strokeWidth`, moldura ou canvas extra que esteja criando faixas brancas muito largas;
- manter cantos arredondados;
- não aumentar artificialmente a altura da imagem.

IMPORTANTE:
- inspecionar a implementação real antes de alterar;
- não aplicar números cegamente se a escala do canvas for diferente; o resultado visual deve ficar claramente mais estreito e compacto;
- manter o relatório legível no celular e quando enviado pelo WhatsApp.

# 2) CONTROLE OPERACIONAL — GÁS SÓ QUANDO REALMENTE NECESSÁRIO

Hoje o bloco `CONTROLE OPERACIONAL — GÁS` aparece sempre.

Nova regra:
MOSTRAR esse bloco somente quando existir situação operacional especial, por exemplo:

```text
usingSeparated > 0
OU
borrowedInUse > 0
OU
borrowedToReturn > 0
OU
uncoveredDeficit > 0
```

Se todos esses valores forem zero:
- NÃO renderizar o bloco no relatório;
- não deixar espaço vazio reservado.

Exemplos:

### Caso normal
- cheios = 20
- usando separados = 0
- empréstimos = 0

=> NÃO mostrar `CONTROLE OPERACIONAL — GÁS`.

### Caso usando separados
- cheios = -8
- usando separados = 8
- separados livres = 9

=> MOSTRAR o bloco.

### Caso usando/possuindo empréstimos pendentes
- borrowedInUse > 0 ou borrowedToReturn > 0

=> MOSTRAR o bloco.

O bloco deve continuar usando a MESMA fonte de verdade do Resumo.

# 3) VENDAS E PAGAMENTOS PASSA A SER OPCIONAL

Adicionar uma nova preferência persistente:

`reportShowSalesPayments`

Texto na Config:
`Mostrar vendas e pagamentos no relatório`

Comportamento:
- DESLIGADO: não mostrar o bloco `VENDAS E PAGAMENTOS` no relatório;
- LIGADO: mostrar normalmente;
- persistir após fechar/reabrir o app;
- o gerador da imagem e a prévia devem respeitar exatamente o mesmo valor;
- compartilhar/baixar imagem também deve respeitar.

Como o usuário pediu para não mostrar por padrão:
- para instalações/usuários em que essa nova chave ainda não existe, iniciar como `false`;
- NÃO alterar outras preferências existentes.

# 4) ORGANIZAR MELHOR A TELA CONFIG

A tela Config está ficando extensa e misturada.

Reorganizar em grupos claros, sem perder nenhuma configuração existente.

## Grupo A — RELATÓRIO
Título:
`📋 Relatório`

Subseção `Conteúdo do relatório`:
- Clientes com separados / faltam entregar
- Clientes com falta de devolver vasilhame
- Entregas / lançamentos do dia
- Mostrar vendas e pagamentos no relatório  ← NOVO

Subseção `Aparência do relatório`:
- cores do relatório;
- tema/cores específicas já existentes;
- botão `Salvar cores` somente dentro dessa área, se ainda for necessário.

Colocar o botão:
`Salvar opções do relatório`
logo abaixo das opções de conteúdo.

Evitar dois botões diferentes salvando a mesma preferência.

## Grupo B — LANÇAMENTOS
Título:
`✍️ Lançamentos`

Incluir:
- Mostrar Chat de Lançamentos;
- qualquer preferência relacionada ao chat;
- opções de lançamento que já existirem.

## Grupo C — ESTOQUE E ALERTAS
Título:
`📦 Estoque e alertas`

Incluir:
- estoque mínimo;
- alertas;
- configurações de separados/emprestados que forem realmente configurações;
- não colocar dados operacionais atuais aqui se eles pertencem a Início/Resumo.

## Grupo D — WHATSAPP / ENTREGAS
Título:
`💬 WhatsApp e entregas`

Incluir:
- ativação/configuração da integração;
- número/contato autorizado;
- lembretes de entrega;
- demais controles relacionados ao WhatsApp já existentes.

## Grupo E — DADOS E SINCRONIZAÇÃO
Título:
`☁️ Dados e sincronização`

Incluir:
- backup;
- restaurar;
- compartilhar backup;
- nuvem;
- sincronização.

## Grupo F — SOBRE
Título:
`ℹ️ Sobre`

Incluir:
- versão;
- informações do app;
- diagnóstico, se já existir.

Requisitos de UX:
- cards/seções bem separados;
- títulos claros;
- não duplicar opções;
- manter modo escuro legível;
- reduzir textos explicativos longos;
- explicações maiores podem ir em botão `?` quando fizer sentido;
- manter tudo em português Brasil.

# 5) GARANTIR QUE TODAS AS CONFIGURAÇÕES SEJAM RESPEITADAS

Auditar as preferências da tela Config.

Para cada configuração:
1. identificar a chave persistida;
2. confirmar que a UI carrega o valor salvo;
3. confirmar que o botão de salvar grava a chave correta;
4. confirmar que o módulo consumidor lê a MESMA chave;
5. remover valores hardcoded que sobrescrevam preferências;
6. confirmar persistência após reiniciar o app.

Especialmente:
- clientes com separados / faltam entregar;
- falta devolver vasilhame;
- lançamentos/entregas do dia;
- vendas e pagamentos;
- cores do relatório;
- mostrar/ocultar chat.

# 6) RELATÓRIO DE ENTREGAS DE HOJE

Preservar a correção da v9.4.2:
- quando a opção de lançamentos/entregas do dia estiver ligada, mostrar as entregas de hoje;
- separar Água e Gás;
- nome do cliente;
- quantidade;
- produto;
- forma de pagamento;
- somente entregas realmente concluídas;
- não usar últimas 24h; usar o dia-calendário local.

Não remover essa funcionalidade ao compactar o relatório.

# 7) TESTES OBRIGATÓRIOS

Validar:

1. relatório com todos os blocos fica visualmente mais compacto;
2. não há faixas brancas gigantes;
3. textos não são cortados;
4. `CONTROLE OPERACIONAL — GÁS` não aparece em situação normal;
5. aparece quando `usingSeparated > 0`;
6. aparece quando há empréstado em uso/a devolver;
7. `VENDAS E PAGAMENTOS` desligado => bloco não aparece;
8. ligado => bloco aparece;
9. reiniciar app mantém essa preferência;
10. todas as opções antigas do relatório continuam funcionando;
11. preview, baixar e compartilhar geram a mesma composição;
12. Config ficou organizada nos grupos pedidos;
13. integração WhatsApp e histórico diário continuam funcionando;
14. build Android concluído com sucesso.

# 8) VERSÃO E BUILD

Atualizar a versão visível para `v9.4.3` apenas se o projeto atual usar essa sequência de versão.

Compilar o APK no final.

Copiar APK para:
`/storage/emulated/0/Download/JM-Estoque-v9.4.3.apk`

# 9) RELATÓRIO DO CODEX

Atualizar:
`docs/RELATORIO-CODEX.md`

Informar:
- quais estilos/margens do relatório causavam as faixas brancas largas;
- quais valores foram ajustados;
- condição final para exibir `CONTROLE OPERACIONAL — GÁS`;
- nova chave `reportShowSalesPayments`;
- como a tela Config foi reorganizada;
- chaves de preferências auditadas;
- arquivos alterados;
- testes;
- resultado do build;
- caminho do APK.

Não apenas descreva. Edite de fato o projeto, teste e compile.
