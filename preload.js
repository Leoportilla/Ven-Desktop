const { contextBridge, ipcRenderer } = require('electron');
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('venDesktop', {
  carregarSalvo: inv('backup:carregarSalvo'),
  abrirBackup: inv('backup:abrir'),
  gravar: inv('backup:gravar'),
  salvarCopia: inv('backup:salvarCopia'),
  imprimir: inv('imprimir'),
  imprimirHtml: inv('imprimir:html'),
  salvarPdf: inv('imprimir:pdf'),
  salvarTexto: inv('arquivo:salvarTexto'),
  impressoras: inv('impressoras:listar'),
  configLer: inv('config:ler'),
  configGravar: inv('config:gravar'),
  dadosInfo: inv('dados:info'),
  abrirPastaDados: inv('dados:abrirPasta'),
  consultarCnpj: inv('consulta:cnpj'),
  consultarCep: inv('consulta:cep'),
  buscarNcm: inv('consulta:ncm'),
  abrirExterno: inv('externo:abrir'),
  ocrImagem: inv('ocr:imagem'),
  driveConectar: inv('drive:conectar'),
  driveEstado: inv('drive:estado'),
  driveDesconectar: inv('drive:desconectar'),
  driveSincronizar: inv('drive:sincronizar'),
  verificarAtualizacao: inv('atualizador:verificar'),
  instalarAtualizacao: inv('atualizador:instalar')
});
