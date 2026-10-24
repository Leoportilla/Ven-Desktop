const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('venDesktop', {
  carregarSalvo: () => ipcRenderer.invoke('backup:carregarSalvo'),
  abrirBackup: () => ipcRenderer.invoke('backup:abrir'),
  gravar: (texto) => ipcRenderer.invoke('backup:gravar', texto),
  imprimir: () => ipcRenderer.invoke('imprimir'),
  salvarCopia: (texto) => ipcRenderer.invoke('backup:salvarCopia', texto)
});
