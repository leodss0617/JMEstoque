# Gerar APK pelo GitHub — JM Estoque v9.4.4

## Criar e enviar o repositório

1. No GitHub, entre na sua conta e escolha **New repository**. Defina o nome (por exemplo, JMEstoque), a visibilidade e crie um repositório vazio, sem README inicial.
2. No terminal, dentro de `~/JMEstoque`, execute os comandos abaixo, substituindo USUARIO pelo seu usuário. Este diretório ainda não possuía `.git` nesta entrega.

```sh
git init -b main
git add .
git status --short
git diff --cached --stat
# Revise os arquivos antes de confirmar: não envie dados pessoais nem credenciais.
git commit -m "JM Estoque v9.4.4"
git remote add origin https://github.com/USUARIO/JMEstoque.git
git push -u origin main
```

O `.gitignore` exclui `.env`, builds, caches, logs, backups, configurações locais e keystores. Não exclui o Gradle Wrapper (incluindo JAR). Se algum segredo já tiver sido versionado em outro repositório, o ignore não remove seu histórico.

## Executar e baixar

O arquivo `.github/workflows/android-apk.yml` executa automaticamente em push para `main`. Para iniciar manualmente, abra **Actions → Build Android APK → Run workflow → main → Run workflow**. O workflow precisa estar na branch padrão. Consulte [execução manual no GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Abra a execução concluída e, em **Artifacts**, baixe **JM-Estoque-debug**. Extraia o ZIP para obter `app-debug.apk`. É necessário estar conectado e ter acesso de leitura ao repositório. Veja [download de artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

O workflow usa Ubuntu, Java 17, instala/configura o SDK e executa `./gradlew :app:assembleDebug --no-daemon`. Remove somente na cópia do runner o override de AAPT2 específico do AndroidIDE. O projeto usa AGP 9.1.1 e Gradle 9.3.1; Java 17 atende ao [requisito do AGP](https://developer.android.com/build/releases/agp-9-1-0-release-notes). A versão de linguagem Java 11 no módulo não altera esse requisito de execução do Gradle.

## Assinatura e atualização sem perder dados

O build local usa a configuração `debugConfig` e a chave `debug.keystore` na raiz. Ela foi preservada, não copiada para a documentação nem adicionada ao workflow. As credenciais debug já existentes no Gradle não são reproduzidas aqui.

Sem essa chave, o workflow usa a chave debug gerada no runner. **Esse APK normalmente NÃO atualiza por cima do aplicativo local**: a assinatura difere, mesmo com o mesmo applicationId. A chave também pode mudar entre execuções. Não desinstale o app atual para contornar isso: a desinstalação pode apagar os dados. Para atualização, use a mesma chave e um versionCode compatível (esta versão usa 97).

A configuração local identifica a chave usada para gerar os APKs locais; sem acesso ao pacote instalado via ADB não é possível atestar a assinatura do app instalado. Antes da distribuição, compare os certificados com `apksigner verify --print-certs arquivo.apk`.

## Futuramente: mesma chave usando GitHub Secrets

Ainda não ativado. Guarde uma cópia segura da chave atual. Base64 apenas codifica: não protege o segredo. Gere a codificação localmente e cadastre seu conteúdo em **Settings → Secrets and variables → Actions → New repository secret**, sem colocá-lo em arquivo versionado:

- `ANDROID_KEYSTORE_BASE64`: conteúdo Base64 da chave existente.
- `ANDROID_KEYSTORE_PASSWORD`: senha do armazenamento.
- `ANDROID_KEY_ALIAS`: alias existente.
- `ANDROID_KEY_PASSWORD`: senha da chave.

No workflow, antes do build, restaure em `$RUNNER_TEMP/jm-signing.keystore` usando uma variável de ambiente vinculada ao Secret (não imprima seu valor):

```yaml
- name: Restore signing key
  env:
    KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
  run: |
    umask 077
    printf '%s' "$KEYSTORE_BASE64" | base64 --decode > "$RUNNER_TEMP/jm-signing.keystore"
```

No passo de build, exporte `ANDROID_KEYSTORE_PATH: ${{ runner.temp }}/jm-signing.keystore` e os outros três valores usando `secrets`. Adapte `signingConfigs` no Gradle para ler `System.getenv("ANDROID_KEYSTORE_PATH")`, `System.getenv("ANDROID_KEYSTORE_PASSWORD")`, `System.getenv("ANDROID_KEY_ALIAS")` e `System.getenv("ANDROID_KEY_PASSWORD")`. Associe essa configuração ao build `debug`; exija todos os valores quando a assinatura CI for solicitada, sem fallback silencioso. Preserve o ramo de assinatura local existente.

Adicione um passo com `if: always()` para remover a chave temporária. Nunca faça upload da chave, do Base64 ou de senhas como artifact. Publique somente o APK. Confirme que seu certificado coincide com o APK local antes de instalar por cima. A criação dos Secrets e a ativação dessa assinatura ficam para uma etapa futura.

## Verificação no aparelho

1. Gere geral, depois Todos os pendentes; envie pelo WhatsApp e confira todos os nomes e a imagem contra a prévia.
2. Gere Maria Júlia; confira apenas seu histórico, sem horário.
3. Gere outro cliente; confira se a imagem e o arquivo mudaram.
4. Volte ao geral e compartilhe.
5. Repita escolhendo outro aplicativo no compartilhador Android.
6. Confira filtros/opções, ausência de duplicações e saldos da versão anterior.

Os testes automatizados de JavaScript verificam a escolha do artefato e os bytes enviados à ponte, mas não substituem o recebimento real pelo WhatsApp e por outro aplicativo.
