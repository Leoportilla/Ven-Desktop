# VEN Desktop (Windows, portable)

Versão de computador do VEN. Lê o backup `.json` gerado pelo app Android (Configurações → Baixar backup, ou a cópia do Google Drive).

## Versão 0.2 (funcional)
- **Nova venda** (Ctrl+N): busca por nome/código/código de barras (leitor funciona), quantidade e preço editáveis, cliente, desconto (% ou R$), Salvar orçamento (F8) ou Fechar venda (F9) com pagamento total, parcial ou a receber.
- **Pedidos**: abrir, editar orçamento, fechar venda, receber, imprimir recibo, excluir.
- **Clientes e Produtos**: criar, editar, excluir (aviso quando falta o NCM, igual ao celular).
- **Financeiro**: contas a pagar (única, parcelada ou mensal; pagar, desfazer, editar, excluir) e a receber (receber total ou parcial, desfazer, receitas avulsas únicas ou mensais).
- **Relatórios** por mês e **Início** com resultado, a receber, a pagar, gráfico e vencimentos.
- Tudo é gravado automaticamente em `dados/ven-backup.json` (ao lado do .exe), no **mesmo formato do app do celular**. Para levar ao celular: "Salvar cópia" e, no app, Restaurar backup.
- Atenção: não use celular e PC ao mesmo tempo sobre cópias diferentes; a sincronização em tempo real é uma fase futura.

## Gerar o .exe sem instalar nada
1. Envie estes arquivos para o repositório (branch `main`).
2. No GitHub: aba **Actions** → "Gerar VEN Desktop" → ao terminar, baixe o artefato **VEN-Desktop-portable**.

## Testar no PC com Node instalado
```
npm install
npm start
```
Um backup de exemplo está em `exemplo/backup-exemplo.json`.

## Próximas fases
Edição/lançamento, venda rápida de balcão, login do Drive, sincronização em tempo real, NF-e.
