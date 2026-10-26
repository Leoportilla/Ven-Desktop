'use strict';
/* Leitura de contas (PDF, foto, código de barras/Pix digitado) e de NF-e (XML). */
const carregarScript = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('Falha ao carregar o leitor de PDF.')); document.head.appendChild(s); });
let pdfPromessa = null;
function pdfjs() {
  if (pdfPromessa) return pdfPromessa;
  pdfPromessa = (async () => {
    if (!window.pdfjsLib) { await carregarScript('vendor/pdfjs/pdf.worker.classic.js'); await carregarScript('vendor/pdfjs/pdf.classic.js'); }
    try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.classic.js'; } catch (_) {}
    return window.pdfjsLib;
  })();
  pdfPromessa.catch(() => { pdfPromessa = null; });
  return pdfPromessa;
}
function itensParaTexto(items) {
  const linhas = [];
  items.forEach(it => { if (!it.str || !it.transform) return; const x = it.transform[4], y = it.transform[5]; let l = linhas.find(L => Math.abs(L.y - y) < 3); if (!l) { l = { y, p: [] }; linhas.push(l); } l.p.push({ x, s: it.str, w: it.width || 0 }); });
  linhas.sort((a, b) => b.y - a.y);
  return linhas.map(l => { l.p.sort((a, b) => a.x - b.x); let out = '', fim = null; l.p.forEach(p => { if (fim !== null && p.x - fim > 1.5 && !/^\s/.test(p.s) && !/\s$/.test(out)) out += ' '; out += p.s; fim = p.x + p.w; }); return out; }).join('\n');
}
async function ocrFoto(dataUrl) {
  const r = await window.venDesktop.ocrImagem(dataUrl);
  if (!r.ok) throw new Error(r.erro || 'Não consegui ler a foto.'); return r.texto || '';
}
async function textoDoPdf(file, aoProgresso) {
  const lib = await pdfjs(); let doc;
  try { doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; }
  catch (e) { if (e && e.name === 'PasswordException') throw new Error('Este PDF tem senha. Abra-o, salve sem senha e importe de novo.'); throw new Error('Não consegui abrir este PDF.'); }
  let texto = ''; const max = Math.min(doc.numPages, 8);
  for (let p = 1; p <= max; p++) { const pg = await doc.getPage(p); const tc = await pg.getTextContent(); texto += itensParaTexto(tc.items) + '\n\n'; }
  if (texto.replace(/\s/g, '').length >= 40) return texto;
  aoProgresso && aoProgresso('PDF sem texto: lendo as páginas como imagem…');
  let ocr = '';
  for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
    const pg = await doc.getPage(p); const vp0 = pg.getViewport({ scale: 1 }); const esc2 = Math.min(3, 1900 / Math.max(vp0.width, vp0.height)); const vp = pg.getViewport({ scale: esc2 });
    const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: cx, viewport: vp }).promise; ocr += await ocrFoto(cv.toDataURL('image/jpeg', .88)) + '\n\n';
  }
  return ocr;
}
async function prepararAnexo(file) {
  const tipo = file.type || '', nome = file.name || 'anexo';
  if (/^image\//.test(tipo)) { const src = await lerArquivoDataUrl(file); return { nome, tipo: 'image/jpeg', dados: await comprimirImagem(src, 1400, .72) }; }
  if (tipo === 'application/pdf' || /\.pdf$/i.test(nome)) { if (file.size > 1500 * 1024) return null; return { nome, tipo: 'application/pdf', dados: await lerArquivoDataUrl(file) }; }
  return null;
}
const rascunhoVazio = () => ({ descricao: '', fornecedor: '', cnpj: '', documento: '', categoria: '', valor: 0, vencimento: '', linha: '', pix: '', obs: '', origem: {}, avisos: [], codigoOk: null, via: 'manual', anexo: null });
function rascunhosDeTexto(texto, via, anexo) {
  const rs = VENBoleto.lerTexto(texto, { ignorarCnpj: empresa().cnpj || '' });
  return rs.map((d, i) => Object.assign(rascunhoVazio(), d, { via, anexo: i === 0 || rs.length <= 3 ? anexo : null }));
}
function rascunhoDePix(emv, via) {
  const p = VENBoleto.lerPix(emv); if (!p) return null;
  const d = rascunhoVazio(); d.pix = p.pix; d.valor = p.valor; d.fornecedor = p.fornecedor; d.descricao = p.fornecedor; d.via = via;
  if (p.valor) d.origem.valor = 'codigo'; if (p.fornecedor) d.origem.fornecedor = 'codigo';
  d.avisos.push('O Pix não informa a data de vencimento. Confira e preencha.'); return d;
}
/** Código digitado ou colado: Pix, linha digitável, código de barras ou texto solto. */
function rascunhosDeCodigo(raw) {
  raw = String(raw || '').trim(); if (!raw) return [];
  const pix = rascunhoDePix(raw, 'codigo'); if (pix) return [pix];
  return rascunhosDeTexto(raw, 'codigo', null);
}
/** Lê uma lista de arquivos (PDF ou imagem). Devolve { rascunhos, falhas[] }. */
async function rascunhosDeArquivos(files, aoProgresso) {
  const rascunhos = [], falhas = []; let n = 0;
  for (const file of files) {
    n++; const rot = files.length > 1 ? ` (${n}/${files.length})` : '';
    const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''), img = /^image\//.test(file.type || '');
    if (!pdf && !img) { falhas.push(file.name + ': escolha um PDF ou uma foto.'); continue; }
    try {
      aoProgresso && aoProgresso((pdf ? 'Lendo o PDF' : 'Lendo a foto') + rot + '…');
      const anexo = await prepararAnexo(file).catch(() => null); let texto = '';
      if (pdf) texto = await textoDoPdf(file, aoProgresso);
      else texto = await ocrFoto(await comprimirImagem(await lerArquivoDataUrl(file), 2000, .88));
      let rs = rascunhosDeCodigo(texto.trim().startsWith('000201') ? texto : '').length ? rascunhosDeCodigo(texto) : rascunhosDeTexto(texto, pdf ? 'pdf' : 'foto', anexo);
      if (!rs.length) { const d = rascunhoVazio(); d.via = pdf ? 'pdf' : 'foto'; d.anexo = anexo; d.avisos.push(texto.trim() ? 'Li o arquivo, mas não achei código de barras, valor ou vencimento. Preencha os dados; o arquivo já está anexado.' : 'Não consegui ler texto neste arquivo. Preencha manualmente; o arquivo já está anexado.'); rs = [d]; }
      rascunhos.push(...rs);
    } catch (e) { falhas.push((file.name || 'arquivo') + ': ' + (e.message || 'não foi possível ler.')); }
  }
  return { rascunhos, falhas };
}

/* ---------- NF-e (XML) ---------- */
const nfeNum = v => { const n = Number(String(v || '0').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
function lerNfeXml(xml, produtos, jaImportadas) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML inválido ou malformado.');
  const inf = doc.getElementsByTagNameNS('*', 'infNFe')[0]; if (!inf) throw new Error('Este arquivo não parece ser um XML de NF-e.');
  const chave = (inf.getAttribute('Id') || '').replace(/^NFe/i, '');
  if (chave && arr(jaImportadas).includes(chave)) throw new Error('Esta nota fiscal já foi importada antes.');
  const get = (r, t) => (r && r.getElementsByTagNameNS('*', t)[0] && r.getElementsByTagNameNS('*', t)[0].textContent || '').trim();
  const emit = inf.getElementsByTagNameNS('*', 'emit')[0], fornecedor = get(emit, 'xNome'), numeroNf = get(inf.getElementsByTagNameNS('*', 'ide')[0], 'nNF');
  const dets = [...doc.getElementsByTagNameNS('*', 'det')]; if (!dets.length) throw new Error('Não encontrei itens neste XML.');
  const itens = dets.map((d, i) => {
    const prod = d.getElementsByTagNameNS('*', 'prod')[0], imposto = d.getElementsByTagNameNS('*', 'imposto')[0], num = (r, t) => nfeNum(get(r, t));
    const q = num(prod, 'qCom') || 1, unit = num(prod, 'vUnCom'), total = num(prod, 'vProd'), ipi = num(imposto, 'vIPI'), st = num(imposto, 'vICMSST'), frete = num(prod, 'vFrete'), outras = num(prod, 'vOutro'), desc = num(prod, 'vDesc');
    const custoTotal = Math.max(0, total + ipi + st + frete + outras - desc), ean1 = get(prod, 'cEAN'), ean2 = get(prod, 'cEANTrib');
    const ean = (ean1 && ean1 !== 'SEM GTIN' ? ean1 : '') || (ean2 && ean2 !== 'SEM GTIN' ? ean2 : '');
    const codigo = get(prod, 'cProd') || ('NFE-' + (i + 1)), nome = get(prod, 'xProd') || 'Produto sem descrição';
    const existente = produtos.find(p => (ean && arr(p.b).includes(ean)) || String(p.id).toLowerCase() === codigo.toLowerCase() || norm(p.d) === norm(nome));
    return { codigo, nome, q, custo: unit || total / q, custoEstimado: custoTotal / q, total, ean, ncm: soDig(get(prod, 'NCM')), un: get(prod, 'uCom') || 'un', existente: existente ? String(existente.id) : '' };
  });
  const dups = [...doc.getElementsByTagNameNS('*', 'dup')].map(x => ({ n: get(x, 'nDup'), venc: get(x, 'dVenc'), valor: nfeNum(get(x, 'vDup')) })).filter(x => x.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.venc));
  return { chave, fornecedor, numeroNf, itens, dups };
}
