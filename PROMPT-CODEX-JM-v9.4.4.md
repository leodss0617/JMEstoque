# JM Estoque — v9.4.4
## Corrigir compartilhamento do relatório de pendências + preparar GitHub Actions para gerar APK

Projeto: `~/JMEstoque`

Antes de qualquer alteração:
- faça backup dos arquivos alterados;
- preserve todos os dados existentes;
- preserve as regras já validadas da v9.4.3;
- não mude regras de estoque, separados, empréstimos, WhatsApp, histórico diário, pendências ou sincronização, exceto onde este prompt pedir.

# 1) BUG: AO COMPARTILHAR RELATÓRIO DE PENDÊNCIAS, ESTÁ SENDO ENVIADO OUTRO RELATÓRIO

Há pelo menos três tipos de relatório/imagem no app:
1. relatório geral;
2. relatório de todos os pendentes;
3. relatório de pendentes de um único cliente.

Problema atual:
- a prévia de pendências pode estar correta;
- mas ao tocar em "Enviar no WhatsApp"/compartilhar, o app envia outra imagem/relatório, provavelmente o relatório geral ou um arquivo antigo em cache.

Corrigir de forma estrutural.

## Regras obrigatórias

### A. Não usar uma variável/URI global única para todos os relatórios
Cada ação de compartilhar deve receber EXPLICITAMENTE o arquivo/URI que acabou de ser gerado para aquele relatório.

Criar uma API clara, por exemplo:

`shareReport(uri)`

e nunca usar uma função global de "último relatório" se isso puder apontar para outro tipo de relatório.

### B. Arquivos separados por tipo
Usar nomes diferentes, por exemplo:

- `relatorio-geral-<timestamp>.png`
- `pendencias-todos-<timestamp>.png`
- `pendencias-cliente-<clientId>-<timestamp>.png`

Não sobrescrever o relatório de pendências com o arquivo do relatório geral.

### C. Relatório "Todos os pendentes"
Ao gerar e compartilhar:
- a imagem compartilhada deve ser EXATAMENTE a mesma mostrada na prévia;
- conter todos os clientes visíveis/selecionados;
- sem horário se essa já é a regra atual;
- sem duplicações;
- respeitar filtros/opções atuais.

### D. Relatório "Um cliente"
Ao escolher um cliente:
- preservar o cliente selecionado;
- gerar somente o histórico/pendências desse cliente;
- compartilhar exatamente essa imagem;
- não cair no relatório geral;
- não trocar para o último cliente aberto;
- usar identificador estável do cliente quando houver ID disponível.

### E. Share Intent / FileProvider
Auditar:
- URI criada pelo FileProvider;
- MIME type `image/png`;
- `FLAG_GRANT_READ_URI_PERMISSION`;
- arquivo real apontado pela URI;
- se cache está retornando arquivo antigo;
- se existe reutilização indevida de `currentReportUri`, `lastReportUri`, `reportImage`, `sharedImagePath` ou equivalente.

Ao compartilhar:
- gerar/salvar primeiro o arquivo correto;
- obter a URI desse arquivo;
- passar essa URI diretamente ao Intent.

### F. Não regenerar outro relatório ao compartilhar
Se a tela já mostrou a prévia do relatório de pendências:
- preferir compartilhar o MESMO arquivo mostrado;
- se precisar regenerar, usar exatamente os mesmos dados e o mesmo tipo;
- nunca chamar a função de geração do relatório geral por engano.

# 2) TESTES OBRIGATÓRIOS DO COMPARTILHAMENTO

Executar casos equivalentes:

1. gerar relatório geral -> depois "Todos os pendentes" -> compartilhar
   Resultado: compartilha "Todos os pendentes", não o geral.

2. gerar relatório de Maria Júlia -> compartilhar
   Resultado: imagem compartilhada é somente Maria Júlia.

3. gerar relatório de outro cliente depois de Maria Júlia
   Resultado: não reaproveita URI/arquivo anterior.

4. voltar ao relatório geral -> compartilhar
   Resultado: compartilha o geral.

5. comparar arquivo da prévia com arquivo usado no compartilhamento quando aplicável.

6. testar compartilhamento para WhatsApp e compartilhamento genérico Android.

# 3) PREPARAR GITHUB ACTIONS PARA GERAR O APK

Adicionar:
`.github/workflows/android-apk.yml`

Objetivo:
- build manual com `workflow_dispatch`;
- build automático em push para `main`;
- usar Ubuntu;
- usar Java 17, salvo se os arquivos atuais exigirem outra versão;
- executar `./gradlew :app:assembleDebug --no-daemon`;
- publicar `app/build/outputs/apk/debug/app-debug.apk` como artifact.

Workflow base:

```yaml
name: Build Android APK

on:
  workflow_dispatch:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
          cache: gradle

      - name: Permission for Gradle wrapper
        run: chmod +x gradlew

      - name: Build Debug APK
        run: ./gradlew :app:assembleDebug --no-daemon

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: JM-Estoque-debug
          path: app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
```

Adaptar ao projeto real se necessário.

# 4) ASSINATURA DO APK — NÃO QUEBRAR ATUALIZAÇÃO

IMPORTANTE:
Um APK gerado no GitHub só poderá ser instalado POR CIMA do app atual se for assinado com a MESMA chave.

Nesta etapa:
- NÃO commitar keystore;
- identificar como o APK local atual é assinado;
- documentar a situação sem revelar senha/chave;
- adicionar ao `.gitignore`:
  - `*.jks`
  - `*.keystore`
  - `keystore.properties`
- preparar instruções em `docs/GITHUB-BUILD.md` para futuramente usar GitHub Secrets com keystore em Base64 e senhas em Secrets.

Não colocar segredos reais no repositório.

# 5) .gitignore

Auditar/criar `.gitignore` Android:
- `.gradle/`
- `build/`
- `**/build/`
- `.idea/`
- `local.properties`
- `*.jks`
- `*.keystore`
- `keystore.properties`
- logs
- backups

NÃO ignorar:
- `gradlew`
- `gradlew.bat`
- `gradle/wrapper/gradle-wrapper.jar`
- `gradle/wrapper/gradle-wrapper.properties`

# 6) DOCUMENTAÇÃO PARA GITHUB

Criar:
`docs/GITHUB-BUILD.md`

Explicar em português Brasil:
- como criar um repositório no GitHub;
- como enviar este projeto;
- como abrir Actions;
- como executar `Build Android APK`;
- onde baixar o artifact;
- alerta sobre assinatura;
- como configurar assinatura com GitHub Secrets futuramente.

# 7) NÃO QUEBRAR

Preservar:
- relatório geral;
- relatórios de pendências;
- estoque;
- separados;
- empréstimos;
- configurações;
- WhatsApp;
- histórico do dia;
- backup/nuvem;
- dados existentes;
- tema e layout.

# 8) VERSÃO E BUILD LOCAL

Atualizar versão visível para `v9.4.4` se o projeto segue essa sequência.

No final:
- rodar testes existentes;
- rodar `assembleDebug`;
- copiar APK para `/storage/emulated/0/Download/JM-Estoque-v9.4.4.apk` quando esse caminho existir.

# 9) RELATÓRIO DO CODEX

Atualizar:
`docs/RELATORIO-CODEX.md`

Incluir:
- causa exata do relatório errado ao compartilhar;
- URI/variável/função problemática;
- correção aplicada;
- testes;
- arquivos GitHub Actions adicionados;
- `.gitignore`;
- situação da assinatura;
- resultado do build;
- pendências reais.

Não apenas descreva. Edite, teste e compile.
