# VEN Desktop (Windows, portable)

Versão de computador do VEN. Lê o backup `.json` gerado pelo app Android (Configurações → Baixar backup, ou a cópia do Google Drive).

## Versão 0.1 (fase 1)
- Menu lateral: Início, Pedidos, Produtos, Clientes, Financeiro (a pagar / a receber), Relatórios (por mês).
- Busca (Ctrl+K), Abrir backup (Ctrl+O), atalhos Alt+1..6, tema claro/escuro automático (segue o Windows).
- Somente leitura: "Salvar cópia" exporta o backup carregado, sem alterações.
- Portable: o backup aberto fica em `dados/ven-backup.json` ao lado do .exe.

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
