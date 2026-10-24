# VEN Desktop (Windows, pasta portátil)

Versão de computador do VEN. Lê o backup `.json` gerado pelo app Android (Configurações → Baixar backup, ou a cópia do Google Drive). Esta compilação distribui a pasta do aplicativo, em vez de um único `.exe` autoextraível, para evitar a etapa de extração do formato portable.

## Versão 0.2 (funcional)
- **Nova venda** (Ctrl+N): busca por nome/código/código de barras (leitor funciona), quantidade e preço editáveis, cliente, desconto (% ou R$), Salvar orçamento (F8) ou Fechar venda (F9) com pagamento total, parcial ou a receber.
- **Pedidos**: abrir, editar orçamento, fechar venda, receber, imprimir recibo, excluir.
- **Clientes e Produtos**: criar, editar, excluir (aviso quando falta o NCM, igual ao celular).
- **Financeiro**: contas a pagar (única, parcelada ou mensal; pagar, desfazer, editar, excluir) e a receber (receber total ou parcial, desfazer, receitas avulsas únicas ou mensais).
- **Relatórios** por mês e **Início** com resultado, a receber, a pagar, gráfico e vencimentos.
- Tudo é gravado automaticamente em `dados/ven-backup.json` (ao lado do .exe), no **mesmo formato do app do celular**. Para levar ao celular: "Salvar cópia" e, no app, Restaurar backup.
- Atenção: não use celular e PC ao mesmo tempo sobre cópias diferentes; a sincronização em tempo real é uma fase futura.

## Gerar a pasta portátil sem instalar o VEN
1. Envie estes arquivos para o repositório (branch `main`).
2. No GitHub: aba **Actions** → "Gerar VEN Desktop" → ao terminar, baixe o artefato **VEN-Desktop-pasta-portatil**. Extraia o ZIP e execute `VEN.exe` dentro da pasta extraída. Não mova apenas o EXE: mantenha os arquivos e pastas juntos.

## Testar no PC com Node instalado
```
npm install
npm start
```
Um backup de exemplo está em `exemplo/backup-exemplo.json`.

## Observação sobre inicialização
A pasta portátil elimina a extração própria do alvo `portable`, mas não garante sozinha que toda lentidão de 30 segundos será resolvida; o resultado precisa ser medido no computador Windows. Os dados continuam ao lado do executável, na pasta `dados`.

## Próximas fases
Edição/lançamento, venda rápida de balcão, login do Drive, sincronização em tempo real, NF-e.


## Google Drive (integração inicial)

- O botão **Conectar Google** inicia OAuth para desktop com PKCE e callback local.
- O segredo do cliente é solicitado localmente e guardado junto do token usando o armazenamento seguro do Electron/Windows; não o coloque no código-fonte nem envie por mensagem.
- O botão **Sincronizar com Android** procura `VEN_BACKUP_*.json` na pasta privada `appDataFolder`, baixa o mais recente e valida o formato antes de substituir os dados locais. Se já existir um backup local válido, cria uma cópia `ven-backup-antes-drive-*.json` na pasta `dados`.
- O projeto OAuth precisa estar no mesmo projeto Google Cloud usado pelo app Android e a conta Google precisa ter acesso. Se a lista vier vazia, essa correspondência ainda precisa ser verificada.
- Esta integração ainda precisa de teste real no Windows com a conta Google do usuário. O ambiente de desenvolvimento não tem como confirmar o login OAuth nem a visibilidade dos backups do Drive.
- Não é emissão fiscal; impressão continua sendo recibo comercial.
