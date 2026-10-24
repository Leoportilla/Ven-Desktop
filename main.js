const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Modo portable: guarda os dados em "dados" ao lado do .exe (PORTABLE_EXECUTABLE_DIR é definido pelo electron-builder).
const base = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(process.execPath) : __dirname);
const pastaDados = path.join(base, 'dados');
const arquivoBackup = path.join(pastaDados, 'ven-backup.json');
try { fs.mkdirSync(pastaDados, { recursive: true }); } catch (_) {}

function validar(texto) {
  const d = JSON.parse(texto);
  if (!d || !['VEN Vendas', 'IAGER Vendas'].includes(d.app) || d.format !== 1 || !d.storage || typeof d.storage !== 'object') throw new Error('Arquivo inválido ou incompatível com o VEN.');
  return d;
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 980, minHeight: 600, title: 'VEN', backgroundColor: '#0f1216',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

ipcMain.handle('backup:carregarSalvo', async () => {
  try { if (!fs.existsSync(arquivoBackup)) return { ok: true, dados: null }; return { ok: true, dados: validar(fs.readFileSync(arquivoBackup, 'utf8')) }; }
  catch (e) { return { ok: false, erro: e.message }; }
});
ipcMain.handle('backup:abrir', async () => {
  const r = await dialog.showOpenDialog({ title: 'Abrir backup do VEN', filters: [{ name: 'Backup VEN', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: true, dados: null };
  try {
    const texto = fs.readFileSync(r.filePaths[0], 'utf8'); const dados = validar(texto);
    fs.writeFileSync(arquivoBackup, texto, 'utf8');
    return { ok: true, dados, origem: path.basename(r.filePaths[0]) };
  } catch (e) { return { ok: false, erro: e.message }; }
});
ipcMain.handle('backup:salvarCopia', async (_e, texto) => {
  const r = await dialog.showSaveDialog({ title: 'Salvar cópia do backup', defaultPath: 'VEN_backup_' + new Date().toISOString().slice(0, 10) + '.json', filters: [{ name: 'Backup VEN', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: true, salvo: false };
  try { fs.writeFileSync(r.filePath, texto, 'utf8'); return { ok: true, salvo: true }; } catch (e) { return { ok: false, erro: e.message }; }
});

ipcMain.handle('backup:gravar', async (_e, texto) => {
  try { validar(texto); const tmp = arquivoBackup + '.tmp'; fs.writeFileSync(tmp, texto, 'utf8'); fs.renameSync(tmp, arquivoBackup); return { ok: true }; }
  catch (e) { return { ok: false, erro: e.message }; }
});
ipcMain.handle('imprimir', async (e) => new Promise(res => { e.sender.print({ printBackground: true }, ok => res({ ok })); }));

app.whenReady().then(criarJanela);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
