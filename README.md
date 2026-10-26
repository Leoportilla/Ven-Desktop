# VEN Desktop (Windows)

Versão para computador do VEN. Usa os mesmos dados do app do celular (backup JSON e Google Drive).

## O que tem na versão 0.5.0
- **Visual novo**: menu lateral, ícones SVG, tema claro/escuro, busca rápida (Ctrl+K).
- **Venda (PDV)**: grade de produtos com foto, leitor de código de barras, desconto, atalhos F8/F9.
- **Pagamento dividido**: PIX + dinheiro (com troco), cartão em até 12x, débito, boleto, etc.
- **Impressão**: cupom 58/80 mm ou A4, salvar PDF, enviar por WhatsApp. Documento sem valor fiscal.
- **Empresa**: dados e logotipo, com preenchimento automático por CNPJ e CEP.
- **Clientes**: CNPJ/CEP preenchem o cadastro; ficha com WhatsApp, e-mail e Waze.
- **Produtos**: foto, NCM (busca e "já usados"), margem, importação de NF-e (XML) com markup e parcelas em contas a pagar.
- **Contas a pagar**: importa boleto/fatura (PDF, foto ou código digitado), valida a linha digitável, lê Pix copia e cola, evita duplicidade, parcelamento/recorrência, comprovante e anexos.
- **Contas a receber**: recebimento parcial por forma de pagamento, receitas avulsas, cobrança por WhatsApp.
- **Calendário** de vencimentos e **relatórios** do mês (CSV de vendas).
- Google Drive: mesma conexão da versão anterior (não foi alterada).

## Como gerar (GitHub Actions)
Envie o conteúdo desta pasta para o repositório. O workflow gera `VEN-Desktop-pasta-portatil.zip` (pasta portátil, sem instalador). Extraia e abra `VEN.exe`.

## Dados
Ficam na pasta `dados` ao lado do programa (`backup.json`, `config.json`). Para levar ao celular use "Salvar cópia" ou sincronize pelo Google Drive.

## Observação sobre leitura de fotos de boletos (OCR)
Depende do pacote opcional `tesseract.js`. Se não estiver disponível, o VEN avisa e você pode digitar o código.
