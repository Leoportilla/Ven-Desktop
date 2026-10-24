const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('venDesktop', {
  carregarSalvo: () => ipcRenderer.invoke('backup:carregarSalvo'),
  abrirBackup: () => ipcRenderer.invoke('backup:abrir'),
  gravar: (texto) => ipcRenderer.invoke('backup:gravar', texto),
  imprimir: () => ipcRenderer.invoke('imprimir'),
  salvarCopia: (texto) => ipcRenderer.invoke('backup:salvarCopia', texto),
  driveConectar: (segredo) => ipcRenderer.invoke('drive:conectar', segredo),
  driveEstado: () => ipcRenderer.invoke('drive:estado'),
  driveSincronizar: () => ipcRenderer.invoke('drive:sincronizar')
});
