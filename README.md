# VEN Desktop 0.5.7

Código-fonte do VEN Desktop, baseado no pacote portátil 0.5.6 fornecido. Aplicativo Windows Electron; o aplicativo Android não faz parte deste repositório.

## Compilar no Windows ou no GitHub

Requer Node.js 20 ou posterior. No Windows:

```powershell
npm install
npm run dist:win
```

O executável e os arquivos da versão portátil serão gravados em `dist/win-unpacked`. Para criar o ZIP distribuível, compacte o conteúdo dessa pasta (com `VEN.exe` na raiz do ZIP). A ação em `.github/workflows/build-windows.yml` faz isso e, ao publicar uma tag `v*`, anexa o ZIP e o SHA-256 à Release.

O VEN guarda o banco em `dados/ven-backup.json` junto ao aplicativo portátil. Não inclua a pasta `dados` em commits ou releases: ela contém informações da loja. O atualizador do aplicativo consulta a última GitHub Release em `Leoportilla/Ven-Desktop`, espera os nomes `VEN-Desktop-pasta-portatil.zip` e `VEN-Desktop-pasta-portatil.zip.sha256`, e preserva a pasta `dados` ao instalar.

As dependências opcionais `tesseract.js` e `@tesseract.js-data/por` dão suporte à leitura OCR de documentos. O build mantém Electron 33.4.11, a versão do runtime presente no pacote-base.
