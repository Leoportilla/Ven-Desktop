const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('venDesktop', {
  carregarSalvo: () => ipcRenderer.invoke('backup:carregarSalvo'),
  abrirBackup: () => ipcRenderer.invoke('backup:abrir'),
  salvarCopia: (texto) => ipcRenderer.invoke('backup:salvarCopia', texto)
});
