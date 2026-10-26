# VEN Desktop (Windows)

Versão portátil do VEN para computador. Usa backup JSON compatível com o app móvel e pode sincronizar pelo Google Drive.

## Atualização automática

O VEN verifica atualizações publicadas em **GitHub Releases** ao iniciar e também pelo botão **Atualizações** no topo. Ao encontrar versão nova, oferece baixar e instalar. O pacote é validado por SHA-256 antes de substituir arquivos. A atualização sobrepõe os arquivos do programa e **não copia nem apaga a pasta `dados`**, que contém backup, configurações locais e autorização do Google.

Para publicar uma versão nova:

1. Atualize o campo `version` em `package.json` (por exemplo, `0.5.3`).
2. Faça commit e envie para a branch `main`.
3. Crie e envie uma tag correspondente à versão, começando com `v` (por exemplo, `v0.5.3`).
4. O GitHub Actions compila a pasta portátil e cria um GitHub Release com `VEN-Desktop-pasta-portatil.zip` e o respectivo arquivo `.sha256`. O aplicativo consulta o último Release publicado.

A execução da atualização requer que a pasta portátil permita gravação pelo usuário do Windows. Se o VEN estiver dentro de uma pasta protegida pelo Windows, mova a pasta portátil para um local gravável, como uma pasta dentro do perfil do usuário. Não extraia a nova versão por cima manualmente enquanto o programa estiver aberto.

## O que existe nesta versão

- **Visual**: menu lateral, ícones SVG, tema claro/escuro e busca rápida (Ctrl+K).
- **Venda (PDV)**: grade de produtos com foto, leitor de código de barras, desconto e atalhos.
- **Pagamento dividido**: PIX, dinheiro com troco, cartão parcelado, débito e outras formas.
- **Impressão**: cupom de 58/80 mm ou A4, PDF e compartilhamento.
- **Empresa**: dados e logotipo, preenchimento por CNPJ e CEP.
- **Clientes e produtos**: fotos, NCM, margem e importação de NF-e.
- **Financeiro**: contas a pagar e receber, calendário e relatórios.
- **Google Drive**: importação do backup gerado no celular.

## Dados locais

Os dados ficam na pasta `dados` ao lado do programa (`ven-backup.json`, `config.json` e credenciais locais). Mantenha essa pasta para preservar os dados e as configurações. Recomendamos ter um backup externo antes de grandes atualizações.

## Gerar localmente

```bash
npm install
npm run dist
```

O workflow do GitHub Actions gera o ZIP portátil para teste a cada push à `main` e publica um Release quando uma tag `v*` é enviada.

## Leitura de fotos de boletos (OCR)

Depende do pacote opcional `tesseract.js`. Se não estiver disponível, o VEN avisa e permite digitar o código.
