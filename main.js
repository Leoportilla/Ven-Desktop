const { app, BrowserWindow, ipcMain, dialog, Menu, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const os = require('os');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const servicos = require('./servicos');

// Modo portable: guarda os dados em "dados" ao lado do .exe (PORTABLE_EXECUTABLE_DIR é definido pelo electron-builder).
const base = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(process.execPath) : __dirname);
const pastaDados = path.join(base, 'dados');
const arquivoBackup = path.join(pastaDados, 'ven-backup.json');
const arquivoToken = path.join(pastaDados, 'google-token.bin');
const GOOGLE_CLIENT_ID = '62502411129-11fe7v3gstvi2a8dcet7fej64r0r171d.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
try { fs.mkdirSync(pastaDados, { recursive: true }); } catch (_) {}
let oauthServer = null;
let janelaPrincipal = null;
function guardarToken(token) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('O Windows não disponibilizou armazenamento seguro para o token.');
  fs.writeFileSync(arquivoToken, safeStorage.encryptString(JSON.stringify(token)));
}
function lerToken() {
  if (!fs.existsSync(arquivoToken)) return null;
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Não foi possível desbloquear o token seguro neste computador.');
  return JSON.parse(safeStorage.decryptString(fs.readFileSync(arquivoToken)));
}
function limparToken() { try { fs.unlinkSync(arquivoToken); } catch (_) {} }
async function oauthConectar(clientSecret) {
  if (!clientSecret || !String(clientSecret).trim()) throw new Error('Cole o segredo do cliente OAuth para continuar.');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(24).toString('hex');
  return new Promise((resolve, reject) => {
    let done = false, timeout;
    const finish = (err, val) => { if (done) return; done = true; clearTimeout(timeout); try { oauthServer && oauthServer.close(); } catch (_) {} oauthServer = null; err ? reject(err) : resolve(val); };
    oauthServer = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/oauth2callback') { res.writeHead(404); res.end('Not found'); return; }
      if (u.searchParams.get('state') !== state) { res.writeHead(400); res.end('Estado inválido.'); return finish(new Error('Resposta OAuth inválida.')); }
      const code = u.searchParams.get('code'), oauthErr = u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>VEN</title><h2>Autorização recebida</h2><p>Você pode voltar ao VEN Desktop.</p>');
      if (oauthErr || !code) return finish(new Error('Autorização recusada: ' + (oauthErr || 'código ausente')));
      try {
        const redirect = `http://127.0.0.1:${oauthServer.address().port}/oauth2callback`;
        const body = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: String(clientSecret).trim(), code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' });
        const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        const data = await resp.json();
        if (!resp.ok || !data.access_token) throw new Error(data.error_description || data.error || 'O Google não retornou token.');
        data.client_secret = String(clientSecret).trim(); data.obtido_em = Date.now(); guardarToken(data); finish(null, { ok: true });
      } catch (e) { finish(e); }
    });
    oauthServer.on('error', e => finish(e));
    oauthServer.listen(0, '127.0.0.1', async () => {
      const redirect = `http://127.0.0.1:${oauthServer.address().port}/oauth2callback`;
      const q = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: DRIVE_SCOPE, access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state });
      try { await shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + q.toString()); } catch (e) { finish(e); }
    });
    timeout = setTimeout(() => finish(new Error('Tempo de autorização expirou. Tente novamente.')), 180000);
  });
}
async function tokenAcesso() {
  let t = lerToken(); if (!t) throw new Error('Clique em Conectar Google primeiro.');
  if (t.access_token && Date.now() < (t.obtido_em || 0) + (Number(t.expires_in || 3600) - 60) * 1000) return t.access_token;
  if (!t.refresh_token) throw new Error('Autorização expirada. Conecte ao Google novamente.');
  const body = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' });
  const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const d = await resp.json(); if (!resp.ok || !d.access_token) throw new Error(d.error_description || d.error || 'Não foi possível renovar a autorização.');
  t = { ...t, ...d, client_secret: t.client_secret, refresh_token: d.refresh_token || t.refresh_token, obtido_em: Date.now() }; guardarToken(t); return t.access_token;
}
async function driveFetch(url) {
  const tok = await tokenAcesso(); const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
  if (!resp.ok) { let m = ''; try { const j = await resp.json(); m = j.error && j.error.message || ''; } catch (_) {} throw new Error(`Google Drive respondeu ${resp.status}${m ? ': ' + m : ''}`); }
  return resp;
}

function validar(texto) {
  const d = JSON.parse(texto);
  if (!d || !['VEN Vendas', 'IAGER Vendas'].includes(d.app) || d.format !== 1 || !d.storage || typeof d.storage !== 'object') throw new Error('Arquivo inválido ou incompatível com o VEN.');
  return d;
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 980, minHeight: 600, title: 'VEN', backgroundColor: '#0d1217', icon: path.join(__dirname, 'renderer', 'ven-logo.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  Menu.setApplicationMenu(null);
  janelaPrincipal = win;
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
ipcMain.handle('drive:conectar', async (_e, segredo) => { try { await oauthConectar(segredo); return { ok: true }; } catch (e) { return { ok: false, erro: e.message }; } });
ipcMain.handle('drive:estado', async () => { try { return { ok: true, conectado: !!lerToken() }; } catch (e) { return { ok: false, conectado: false, erro: e.message }; } });
ipcMain.handle('drive:desconectar', async () => { limparToken(); return { ok: true }; });
ipcMain.handle('drive:sincronizar', async () => {
  try {
    const q = encodeURIComponent("'appDataFolder' in parents and trashed = false and name contains 'VEN_BACKUP_'");
    const resp = await driveFetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=modifiedTime%20desc&pageSize=100&fields=files(id,name,mimeType,modifiedTime,size)&q=' + q);
    const j = await resp.json(); const files = (j.files || []).filter(f => /^VEN_BACKUP_.*\.json$/i.test(f.name || '')).sort((a,b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')));
    if (!files.length) throw new Error('Nenhum VEN_BACKUP_*.json encontrado na área privada do Drive. Confirme a conta Google e faça um backup no celular.');
    const f = files[0], dl = await driveFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(f.id) + '?alt=media');
    const texto = await dl.text(), dados = validar(texto);
    if (fs.existsSync(arquivoBackup)) {
      const atual = fs.readFileSync(arquivoBackup, 'utf8'); validar(atual);
      const nome = 'ven-backup-antes-drive-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      fs.writeFileSync(path.join(pastaDados, nome), atual, 'utf8');
    }
    const tmp = arquivoBackup + '.tmp'; fs.writeFileSync(tmp, texto, 'utf8'); fs.renameSync(tmp, arquivoBackup);
    return { ok: true, dados, nome: f.name, modificado: f.modifiedTime || null, total: files.length };
  } catch (e) { return { ok: false, erro: e.message }; }
});
/* ---- Sincronização com o celular (mescla): cada aparelho grava o próprio arquivo na pasta privada do Drive ---- */
async function driveReq(url, init) {
  const tok = await tokenAcesso(); const resp = await fetch(url, { ...(init || {}), headers: { Authorization: 'Bearer ' + tok, ...((init && init.headers) || {}) } });
  if (!resp.ok) { let m = ''; try { const j = await resp.json(); m = j.error && j.error.message || ''; } catch (_) {} throw new Error(`Google Drive respondeu ${resp.status}${m ? ': ' + m : ''}`); }
  return resp;
}
async function listarBackupsDrive() {
  const q = encodeURIComponent("'appDataFolder' in parents and trashed = false and name contains 'VEN_BACKUP_'");
  const j = await (await driveReq('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=modifiedTime%20desc&pageSize=100&fields=files(id,name,modifiedTime,size)&q=' + q)).json();
  return (j.files || []).filter(f => /^VEN_BACKUP_.*\.json$/i.test(f.name || ''));
}
ipcMain.handle('sync:baixar', async () => {
  try {
    const f = (await listarBackupsDrive()).find(x => !/^VEN_BACKUP_PC_/i.test(x.name));
    if (!f) return { ok: true, vazio: true };
    const texto = await (await driveReq('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(f.id) + '?alt=media')).text(); validar(texto);
    return { ok: true, texto, nome: f.name, modificado: f.modifiedTime || null };
  } catch (e) { return { ok: false, erro: e.message }; }
});
ipcMain.handle('sync:enviar', async (_e, texto) => {
  try {
    validar(texto); const corpo = Buffer.from(texto, 'utf8'); if (corpo.length > 25 * 1024 * 1024) throw new Error('Os dados ficaram grandes demais para enviar (acima de 25 MB).');
    const d = new Date(), p = n => String(n).padStart(2, '0'), nome = `VEN_BACKUP_PC_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
    const lim = 'ven' + Date.now().toString(16), meta = JSON.stringify({ name: nome, parents: ['appDataFolder'] });
    const body = Buffer.concat([Buffer.from(`--${lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${lim}\r\nContent-Type: application/json\r\n\r\n`), corpo, Buffer.from(`\r\n--${lim}--`)]);
    await driveReq('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + lim }, body });
    try { const meus = (await listarBackupsDrive()).filter(x => /^VEN_BACKUP_PC_/i.test(x.name)).slice(3); for (const x of meus) await driveReq('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(x.id), { method: 'DELETE' }); } catch (_) {}
    return { ok: true, nome };
  } catch (e) { return { ok: false, erro: e.message }; }
});
ipcMain.handle('sync:copia', async (_e, texto) => {
  try {
    const nome = 'ven-antes-sincronizar-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'; fs.writeFileSync(path.join(pastaDados, nome), String(texto || ''), 'utf8');
    const velhos = fs.readdirSync(pastaDados).filter(n => /^ven-antes-sincronizar-.*\.json$/.test(n)).sort().reverse().slice(5); velhos.forEach(n => { try { fs.unlinkSync(path.join(pastaDados, n)); } catch (_) {} });
    return { ok: true };
  } catch (e) { return { ok: false, erro: e.message }; }
});
ipcMain.handle('imprimir', async (e) => new Promise(res => { e.sender.print({ printBackground: true }, ok => res({ ok })); }));


/* ============ Configurações locais (por computador, fora do backup) ============ */
const arquivoConfig = path.join(pastaDados, 'config.json');
const CONFIG_PADRAO = { syncBase: null, syncEm: '', tema: 'auto', impressao: { formato: '80', impressora: '', direto: false, rodape: 'Obrigado pela preferência!', mostrarLogo: true, mostrarEmpresa: true, copias: 1 } };
function lerConfig() {
  try { const c = JSON.parse(fs.readFileSync(arquivoConfig, 'utf8')); return { ...CONFIG_PADRAO, ...c, impressao: { ...CONFIG_PADRAO.impressao, ...(c.impressao || {}) } }; }
  catch (_) { return JSON.parse(JSON.stringify(CONFIG_PADRAO)); }
}
ipcMain.handle('config:ler', async () => lerConfig());
ipcMain.handle('config:gravar', async (_e, c) => {
  try { const atual = lerConfig(); const nova = { ...atual, ...c, impressao: { ...atual.impressao, ...((c && c.impressao) || {}) } }; fs.writeFileSync(arquivoConfig, JSON.stringify(nova, null, 1), 'utf8'); return { ok: true, config: nova }; }
  catch (e) { return { ok: false, erro: e.message }; }
});
ipcMain.handle('dados:info', async () => ({ pasta: pastaDados, arquivo: arquivoBackup, versao: app.getVersion() }));
ipcMain.handle('dados:abrirPasta', async () => { const r = await shell.openPath(pastaDados); return { ok: !r, erro: r || '' }; });

/* ============ Consultas públicas (CNPJ, CEP, NCM) ============ */
const erroConsulta = e => { const m = e && e.message; return ['nao-encontrado', 'invalido', 'curto'].includes(m) ? m : 'indisponivel'; };
ipcMain.handle('consulta:cnpj', async (_e, v) => { try { return { ok: true, dados: await servicos.consultarCnpj(v) }; } catch (e) { return { ok: false, erro: erroConsulta(e) }; } });
ipcMain.handle('consulta:cep', async (_e, v) => { try { return { ok: true, dados: await servicos.consultarCep(v) }; } catch (e) { return { ok: false, erro: erroConsulta(e) }; } });
ipcMain.handle('consulta:ncm', async (_e, v) => { try { return { ok: true, dados: await servicos.buscarNcm(v) }; } catch (e) { return { ok: false, erro: erroConsulta(e) }; } });

/* ============ Abrir links externos permitidos (WhatsApp, Waze, e-mail) ============ */
const EXTERNOS = /^(https:\/\/(wa\.me|api\.whatsapp\.com|waze\.com|www\.waze\.com|portalunico\.siscomex\.gov\.br)\/|mailto:)/i;
ipcMain.handle('externo:abrir', async (_e, url) => { if (!EXTERNOS.test(String(url || ''))) return { ok: false }; try { await shell.openExternal(String(url)); return { ok: true }; } catch (_) { return { ok: false }; } });

/* ============ Impressão (cupom 58/80 mm ou A4) e PDF ============ */
const PX_MM = 96 / 25.4;
const larguraMm = f => (f === '58' ? 58 : f === '80' ? 80 : 210);
async function janelaDeImpressao(html, formato) {
  const tmp = path.join(os.tmpdir(), 'ven-imp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false, width: Math.round(larguraMm(formato) * PX_MM), height: 1100, useContentSize: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); w.webContents.on('will-navigate', ev => ev.preventDefault());
  await w.loadFile(tmp);
  const altura = await w.webContents.executeJavaScript('Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))');
  const limpar = () => { try { w.destroy(); } catch (_) {} try { fs.unlinkSync(tmp); } catch (_) {} };
  return { w, altura, limpar };
}
ipcMain.handle('impressoras:listar', async () => {
  try { const l = await (janelaPrincipal || BrowserWindow.getAllWindows()[0]).webContents.getPrintersAsync(); return { ok: true, impressoras: l.map(x => ({ nome: x.name, descricao: x.displayName || x.name, padrao: !!x.isDefault })) }; }
  catch (e) { return { ok: false, erro: e.message, impressoras: [] }; }
});
ipcMain.handle('imprimir:html', async (_e, o) => {
  let j; try {
    o = o || {}; const f = ['58', '80', 'a4'].includes(o.formato) ? o.formato : '80';
    j = await janelaDeImpressao(String(o.html || ''), f);
    const opc = { silent: !!o.silencioso, printBackground: true, margins: { marginType: 'none' }, copies: Math.max(1, Math.min(5, Number(o.copias) || 1)) };
    if (o.impressora) opc.deviceName = String(o.impressora);
    opc.pageSize = f === 'a4' ? 'A4' : { width: larguraMm(f) * 1000, height: Math.max(40000, Math.ceil((j.altura + 24) / PX_MM * 1000)) };
    const r = await new Promise(res => j.w.webContents.print(opc, (ok, motivo) => res({ ok, motivo })));
    return r.ok ? { ok: true } : { ok: false, erro: r.motivo === 'cancelled' ? 'cancelado' : (r.motivo || 'Falha ao imprimir.') };
  } catch (e) { return { ok: false, erro: e.message }; } finally { j && j.limpar(); }
});
ipcMain.handle('imprimir:pdf', async (_e, o) => {
  let j; try {
    o = o || {}; const f = ['58', '80', 'a4'].includes(o.formato) ? o.formato : 'a4';
    const r = await dialog.showSaveDialog({ title: 'Salvar PDF', defaultPath: String(o.nome || 'VEN.pdf').replace(/[\\/:*?"<>|]/g, '-'), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return { ok: true, salvo: false };
    j = await janelaDeImpressao(String(o.html || ''), f);
    const pageSize = f === 'a4' ? 'A4' : { width: larguraMm(f) / 25.4, height: Math.max(2, (j.altura + 24) / 96) };
    const buf = await j.w.webContents.printToPDF({ printBackground: true, pageSize, margins: { marginType: 'none' } });
    fs.writeFileSync(r.filePath, buf); return { ok: true, salvo: true, caminho: r.filePath };
  } catch (e) { return { ok: false, erro: e.message }; } finally { j && j.limpar(); }
});
ipcMain.handle('arquivo:salvarTexto', async (_e, o) => {
  try {
    o = o || {}; const ext = String(o.extensao || 'csv').replace(/[^a-z0-9]/gi, '');
    const r = await dialog.showSaveDialog({ title: 'Salvar arquivo', defaultPath: String(o.nome || 'VEN.' + ext).replace(/[\\/:*?"<>|]/g, '-'), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (r.canceled || !r.filePath) return { ok: true, salvo: false };
    fs.writeFileSync(r.filePath, (ext === 'csv' ? '﻿' : '') + String(o.texto || ''), 'utf8'); return { ok: true, salvo: true };
  } catch (e) { return { ok: false, erro: e.message }; }
});

/* ============ Leitura de fotos de contas (OCR no computador) ============ */
let ocrWorker = null, ocrPronto = null;
function pastaIdiomaOcr() {
  try {
    const raiz = path.dirname(require.resolve('@tesseract.js-data/por/package.json'));
    const cand = ['4.0.0_best_int', '4.0.0_fast_int', '4.0.0'].map(n => path.join(raiz, n));
    for (const c of cand) if (fs.existsSync(path.join(c, 'por.traineddata.gz'))) return c;
    for (const d of fs.readdirSync(raiz)) { const c = path.join(raiz, d); if (fs.existsSync(path.join(c, 'por.traineddata.gz'))) return c; }
  } catch (_) {}
  return null;
}
async function obterOcr() {
  if (ocrWorker) return ocrWorker;
  if (!ocrPronto) ocrPronto = (async () => {
    let T; try { T = require('tesseract.js'); } catch (_) { throw new Error('O leitor de fotos não está instalado nesta versão. Use o PDF da conta ou digite o código.'); }
    const opcoes = { cachePath: path.join(pastaDados, 'ocr-cache'), logger: () => {} };
    const lp = pastaIdiomaOcr(); if (lp) { opcoes.langPath = lp; opcoes.gzip = true; }
    ocrWorker = await T.createWorker('por', 1, opcoes); return ocrWorker;
  })();
  try { return await ocrPronto; } catch (e) { ocrPronto = null; throw e; }
}
ipcMain.handle('ocr:imagem', async (_e, dataUrl) => {
  try {
    const m = /^data:image\/(png|jpe?g|webp|bmp);base64,(.+)$/i.exec(String(dataUrl || '')); if (!m) throw new Error('Imagem inválida.');
    const w = await obterOcr(); const r = await w.recognize(Buffer.from(m[2], 'base64'));
    return { ok: true, texto: (r && r.data && r.data.text) || '' };
  } catch (e) { return { ok: false, erro: e.message || 'Falha na leitura da foto.' }; }
});
app.on('before-quit', () => { try { ocrWorker && ocrWorker.terminate(); } catch (_) {} });



/* ============ Atualização automática via GitHub Releases ============ */
const UPDATE_REPO = 'Leoportilla/Ven-Desktop';
const UPDATE_ZIP = 'VEN-Desktop-pasta-portatil.zip';
const UPDATE_HASH = UPDATE_ZIP + '.sha256';
let updateInProgress = false;
function compararVersoes(a, b) {
  const parse = v => String(v || '').replace(/^v/i, '').split(/[+-]/)[0].split('.').map(n => Number.parseInt(n, 10) || 0);
  const aa = parse(a), bb = parse(b);
  for (let i = 0; i < Math.max(aa.length, bb.length, 3); i++) {
    const x = aa[i] || 0, y = bb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}
async function obterReleaseMaisRecente() {
  const resp = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'VEN-Desktop-Updater', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15000)
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub respondeu ${resp.status} ao consultar atualizações.`);
  const release = await resp.json();
  if (release.draft || release.prerelease) return null;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const zip = assets.find(a => a.name === UPDATE_ZIP);
  const hash = assets.find(a => a.name === UPDATE_HASH);
  if (!release.tag_name || !zip || !hash || !zip.browser_download_url || !hash.browser_download_url) {
    throw new Error('A última versão publicada não contém o pacote portátil e o arquivo de verificação.');
  }
  return { tag: release.tag_name, versao: String(release.tag_name).replace(/^v/i, ''), zipUrl: zip.browser_download_url, hashUrl: hash.browser_download_url, notas: String(release.body || '').slice(0, 4000), publicada: release.published_at || null };
}
async function verificarAtualizacao() {
  const atual = app.getVersion();
  const release = await obterReleaseMaisRecente();
  if (!release) return { ok: true, atual, disponivel: false };
  return { ok: true, atual, disponivel: compararVersoes(release.versao, atual) > 0, versao: release.versao, tag: release.tag, notas: release.notas, publicada: release.publicada };
}
async function baixarArquivo(url, destino) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.hostname !== 'github.com') throw new Error('Endereço de atualização inválido.');
  const resp = await fetch(url, { headers: { 'User-Agent': 'VEN-Desktop-Updater' }, signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!resp.ok || !resp.body) throw new Error(`Falha ao baixar atualização (HTTP ${resp.status}).`);
  await pipeline(Readable.fromWeb(resp.body), fs.createWriteStream(destino, { flags: 'wx' }));
}
function scriptAtualizador() {
  return String.raw`param([Parameter(Mandatory=$true)][string]$InstallDir,[Parameter(Mandatory=$true)][string]$ZipPath,[Parameter(Mandatory=$true)][int]$ProcessId,[Parameter(Mandatory=$true)][string]$ExePath)
$ErrorActionPreference = 'Stop'
$stage = Join-Path $env:TEMP ('VEN-stage-' + [guid]::NewGuid().ToString('N'))
$backup = Join-Path $env:TEMP ('VEN-rollback-' + [guid]::NewGuid().ToString('N'))
$copied = New-Object System.Collections.Generic.List[string]
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
try {
  while (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 500 }
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $stage -Force
  $files = Get-ChildItem -LiteralPath $stage -File -Recurse
  if (-not ($files | Where-Object { $_.Name -eq 'VEN.exe' })) { throw 'O pacote não contém VEN.exe.' }
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($stage.Length).TrimStart([char]92, [char]47)
    if ($relative -match '(^|[\\/])\.\.([\\/]|$)') { throw 'O pacote contém um caminho inválido.' }
    if ($relative -match '^dados([\\/]|$)') { continue }
    $target = Join-Path $InstallDir $relative
    $targetFull = [IO.Path]::GetFullPath($target)
    if (-not $targetFull.StartsWith($InstallDir.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho de arquivo fora da pasta do VEN.' }
    $parent = Split-Path -Parent $targetFull
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    if (Test-Path -LiteralPath $targetFull -PathType Leaf) {
      $saved = Join-Path $backup $relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $saved) -Force | Out-Null
      Copy-Item -LiteralPath $targetFull -Destination $saved -Force
    }
    $copied.Add($targetFull)
    Copy-Item -LiteralPath $file.FullName -Destination $targetFull -Force
  }
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $ExePath -WorkingDirectory $InstallDir
  Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ZipPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
} catch {
  $problem = $_.Exception.Message
  $copyList = @($copied.ToArray()); [array]::Reverse($copyList)
  foreach ($targetFull in $copyList) {
    try {
      $relative = $targetFull.Substring($InstallDir.Length).TrimStart([char]92, [char]47)
      $saved = Join-Path $backup $relative
      if (Test-Path -LiteralPath $saved -PathType Leaf) { Copy-Item -LiteralPath $saved -Destination $targetFull -Force }
      elseif (Test-Path -LiteralPath $targetFull -PathType Leaf) { Remove-Item -LiteralPath $targetFull -Force }
    } catch { }
  }
  try { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Não foi possível atualizar o VEN. Os arquivos anteriores foram restaurados quando possível.' + [Environment]::NewLine + [Environment]::NewLine + $problem, 'Atualização do VEN', 'OK', 'Error') | Out-Null } catch { }
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ZipPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}
`;
}
async function instalarAtualizacao() {
  if (updateInProgress) return { ok: false, erro: 'Uma atualização já está em andamento.' };
  updateInProgress = true;
  let zipPath = null, hashPath = null, scriptPath = null;
  try {
    const release = await obterReleaseMaisRecente();
    if (!release || compararVersoes(release.versao, app.getVersion()) <= 0) return { ok: true, disponivel: false };
    const tempDir = app.getPath('temp');
    const suffix = crypto.randomBytes(6).toString('hex');
    zipPath = path.join(tempDir, `VEN-Desktop-update-${suffix}.zip`);
    hashPath = path.join(tempDir, `VEN-Desktop-update-${suffix}.sha256`);
    await baixarArquivo(release.zipUrl, zipPath);
    await baixarArquivo(release.hashUrl, hashPath);
    const expected = (fs.readFileSync(hashPath, 'utf8').match(/\b[a-f0-9]{64}\b/i) || [])[0];
    if (!expected) throw new Error('O arquivo de verificação da atualização é inválido.');
    const hash = crypto.createHash('sha256');
    await pipeline(fs.createReadStream(zipPath), hash);
    if (hash.digest('hex').toLowerCase() !== expected.toLowerCase()) throw new Error('A verificação do download falhou. Nenhum arquivo foi alterado.');
    try { fs.unlinkSync(hashPath); } catch (_) {} hashPath = null;
    scriptPath = path.join(tempDir, `VEN-Desktop-updater-${suffix}.ps1`);
    fs.writeFileSync(scriptPath, scriptAtualizador(), 'utf8');
    const installDir = base;
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-InstallDir', installDir, '-ZipPath', zipPath, '-ProcessId', String(process.pid), '-ExePath', process.execPath], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', e => { try { fs.unlinkSync(scriptPath); } catch (_) {} });
    child.unref();
    return { ok: true, iniciada: true, versao: release.versao };
  } catch (e) {
    for (const f of [zipPath, hashPath, scriptPath]) { try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {} }
    return { ok: false, erro: e.message || 'Não foi possível atualizar o VEN.' };
  } finally { updateInProgress = false; }
}
ipcMain.handle('atualizador:verificar', async () => { try { return await verificarAtualizacao(); } catch (e) { return { ok: false, erro: e.message }; } });
ipcMain.handle('atualizador:instalar', async () => {
  try {
    const r = await instalarAtualizacao();
    if (r.ok && r.iniciada) {
      await dialog.showMessageBox(janelaPrincipal, { type: 'info', title: 'Atualização do VEN', message: `A versão ${r.versao} foi baixada e verificada. O VEN será fechado e reaberto para concluir a atualização.`, buttons: ['OK'] });
      app.quit();
    }
    return r;
  } catch (e) { return { ok: false, erro: e.message }; }
});


app.whenReady().then(() => {
  criarJanela();
  setTimeout(async () => {
    try {
      const u = await verificarAtualizacao();
      if (!u.ok || !u.disponivel || !janelaPrincipal || janelaPrincipal.isDestroyed()) return;
      const choice = await dialog.showMessageBox(janelaPrincipal, { type: 'info', title: 'Atualização do VEN disponível', message: `Há uma nova versão do VEN (${u.versao}).`, detail: 'Deseja baixar e instalar agora? Seus dados e configurações locais serão preservados.', buttons: ['Atualizar agora', 'Depois'], defaultId: 0, cancelId: 1, noLink: true });
      if (choice.response === 0) {
        const r = await instalarAtualizacao();
        if (r.ok && r.iniciada) { await dialog.showMessageBox(janelaPrincipal, { type: 'info', title: 'Atualização do VEN', message: `A versão ${r.versao} foi baixada e verificada. O VEN será fechado e reaberto para concluir a atualização.`, buttons: ['OK'] }); app.quit(); }
        else if (!r.ok) await dialog.showMessageBox(janelaPrincipal, { type: 'error', title: 'Atualização do VEN', message: r.erro || 'Não foi possível atualizar.' });
      }
    } catch (_) { /* A falha de rede não impede o uso normal do VEN. */ }
  }, 6000);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
