'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad = n => String(n).padStart(2, '0');
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const isoDe = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hojeISO = () => isoDe(new Date());
const ymHoje = () => hojeISO().slice(0, 7);
const ymDe = iso => String(iso || '').slice(0, 7);
const ymSoma = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const nomeMes = ym => { const [y, m] = ym.split('-').map(Number); return MESES[m - 1] + ' de ' + y; };
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; };
const dataCurta = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] : '—'; };
const horaBR = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const parseData = t => { t = String(t || '').trim(); let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); if (m) return m[3] + '-' + m[2] + '-' + m[1]; m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); return m ? t : ''; };
const diasAte = iso => { if (!iso) return null; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const a = new Date(y, m - 1, d), h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((a - h) / 864e5); };
const numeroBR = t => { t = String(t == null ? '' : t).trim().replace(/[^\d.,-]/g, ''); if (!t) return 0; if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return isFinite(n) ? n : 0; };
const moeda = n => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const somaMes = (iso, n, dia) => { const [y, m, d] = iso.split('-').map(Number); const alvo = new Date(y, m - 1 + n, 1); const ult = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate(); return isoDe(new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(dia || d, ult))); };
const arr = v => Array.isArray(v) ? v : [];
const soDig = s => String(s == null ? '' : s).replace(/\D/g, '');
const tituloBR = t => { const peq = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']); return String(t || '').toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => (i > 0 && peq.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' '); };
const telBR = t => { const d = soDig(t).replace(/^55(?=\d{10,11}$)/, ''); if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7); if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6); return String(t || '').trim(); };
const cepBR = c => { const d = soDig(c); return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : String(c || '').trim(); };
const cnpjBR = v => { const d = soDig(v); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d; };
const cpfBR = v => { const d = soDig(v); return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : d; };
const docBR = v => { const d = soDig(v); return d.length === 14 ? cnpjBR(d) : d.length === 11 ? cpfBR(d) : String(v || '').trim(); };
const ncmBR = v => { const d = soDig(v).slice(0, 8); return d.length > 6 ? d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6) : d.length > 4 ? d.slice(0, 4) + '.' + d.slice(4) : d; };
function cnpjValido(n) { n = soDig(n); if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false; const dv = (b, p) => { let t = 0; for (let i = 0; i < p.length; i++) t += Number(b[i]) * p[i]; const r = t % 11; return r < 2 ? 0 : 11 - r; }; return dv(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(n[12]) && dv(n, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(n[13]); }
const inicial = nome => (String(nome || '?').trim().match(/[A-Za-zÀ-ú0-9]/) || ['?'])[0].toUpperCase();
const corDe = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 6; };
const avatar = (nome, tam = '') => `<span class="avatar a${corDe(nome)} ${tam}" aria-hidden="true">${esc(inicial(nome))}</span>`;
const pill = (t, tipo = 'mut') => `<span class="pill ${tipo}">${esc(t)}</span>`;

/* Formas de pagamento (as mesmas do app do celular + parcelamento no crédito) */
const FORMAS = [
  { id: 'PIX', rot: 'PIX', icone: 'pix' }, { id: 'Dinheiro', rot: 'Dinheiro', icone: 'banknote' },
  { id: 'Cartão de débito', rot: 'Débito', icone: 'card' }, { id: 'Cartão de crédito', rot: 'Crédito', icone: 'card', parcelas: true },
  { id: 'Boleto', rot: 'Boleto', icone: 'barcode' }, { id: 'Transferência', rot: 'Transferência', icone: 'sync' },
  { id: 'Cheque', rot: 'Cheque', icone: 'file' }, { id: 'Outro', rot: 'Outro', icone: 'tag' }
];
const FORMAS_NOMES = FORMAS.map(f => f.id);
const CATEGORIAS = ['Energia elétrica', 'Água', 'Internet e telefone', 'Aluguel', 'Funcionários e salários', 'Comissões', 'Fornecedores', 'Impostos e taxas', 'Frete e transporte', 'Sistemas e assinaturas', 'Materiais', 'Outros'];

/* ---------- configuração local (por computador) ---------- */
let cfg = { tema: 'auto', impressao: { formato: '80', impressora: '', direto: false, rodape: 'Obrigado pela preferência!', mostrarLogo: true, mostrarEmpresa: true, copias: 1 } };
async function carregarConfig() { try { cfg = await window.venDesktop.configLer(); } catch (_) {} aplicarTema(); }
async function salvarConfig(patch) { try { const r = await window.venDesktop.configGravar(patch); if (r.ok) cfg = r.config; } catch (_) {} aplicarTema(); }
function aplicarTema() { const t = cfg.tema; if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema; }

/* ---------- armazenamento (mesmo formato do app do celular) ---------- */
let backup = null, origem = '', salvoEm = '', _t = 0;
function lerChave(k, padrao) {
  const s = backup && backup.storage && backup.storage[k];
  if (s == null) return padrao;
  try { const v = JSON.parse(s); return v == null ? padrao : v; } catch (_) { return padrao; }
}
function gravarChave(k, v) { if (!backup) return; backup.storage[k] = JSON.stringify(v); agendarGravacao(); }
function removerChave(k) { if (backup && backup.storage) { delete backup.storage[k]; agendarGravacao(); } }
function agendarGravacao() {
  clearTimeout(_t);
  _t = setTimeout(async () => {
    if (!backup) return; backup.createdAt = new Date().toISOString();
    try { const r = await window.venDesktop.gravar(JSON.stringify(backup)); salvoEm = r.ok ? horaBR(new Date()) : ''; if (!r.ok) toast(r.erro || 'Não foi possível gravar.', 'erro'); } catch (e) { toast('Não foi possível gravar.', 'erro'); }
    if (typeof atualizarRodapeLateral === 'function') atualizarRodapeLateral();
  }, 250);
}
const infoArquivo = () => backup ? (origem || 'Backup carregado') + (salvoEm ? ' · salvo às ' + salvoEm : '') : 'Nenhum backup aberto';
function dados() {
  const cat = lerChave('ven_catalogoImportado', null);
  return {
    vendas: arr(lerChave('ven_vendas', [])), pedidos: arr(lerChave('ven_orcamentosSalvos', [])), clientes: arr(lerChave('ven_clientes', [])),
    catalogo: arr(cat && cat.products), manuais: arr(lerChave('ven_produtosManuais', [])),
    get produtos() { return [...this.catalogo, ...this.manuais]; },
    pagar: arr(lerChave('ven_contasPagar', [])), avulso: arr(lerChave('ven_receberAvulso', []))
  };
}
const empresa = () => ({ nome: '', fantasia: '', cnpj: '', end: '', telefone: '', email: '', logo: '', ...(lerChave('ven_empresa', {}) || {}) });
function gravarCatalogo(lista) { const cat = lerChave('ven_catalogoImportado', null) || { products: [], date: new Date().toISOString() }; cat.products = lista; gravarChave('ven_catalogoImportado', cat); }
const anexoConta = id => lerChave('ven_cpa_' + id, null);
const gravarAnexoConta = (id, o) => { if (!o || (!o.boleto && !o.comprovante)) removerChave('ven_cpa_' + id); else gravarChave('ven_cpa_' + id, o); };

/* ---------- regras de negócio ---------- */
const saldoVenda = v => Math.max(0, r2((Number(v.total) || 0) - (Number(v.recebido) || 0)));
const estadoVenda = v => (Number(v.recebido) || 0) >= (Number(v.total) || 0) - 0.009 ? 'paid' : ((Number(v.recebido) || 0) > 0 ? 'partial' : 'pending');
const vendaTemRecebimento = v => !!v && ((Number(v.recebido) || 0) > 0.009 || arr(v.pagamentos).some(p => (Number(p.valor) || 0) > 0.009));
function totaisItens(itens, desc, tipo) {
  const sub = arr(itens).reduce((a, i) => a + (Number(i.q) || 0) * (Number(i.p) || 0), 0);
  const d = Math.min(Math.max(tipo === '%' ? sub * (Number(desc) || 0) / 100 : Number(desc) || 0, 0), sub);
  return { sub: r2(sub), d: r2(d), total: r2(sub - d) };
}
const vendaDoPedido = (d, num) => d.vendas.find(v => Number(v.orcamentoNumero) === Number(num)) || null;
const pedidoDaVenda = (d, v) => v ? d.pedidos.find(o => Number(o.numero) === Number(v.orcamentoNumero)) || null : null;
const proxNum = k => {
  const d = dados(); let m = Number(lerChave(k, 0)) || 0;
  if (k === 'ven_ultimoNumeroVenda') d.vendas.forEach(v => { m = Math.max(m, Number(v.numero) || 0); });
  else { d.pedidos.forEach(o => { m = Math.max(m, Number(o.numero) || 0); }); d.vendas.forEach(v => { m = Math.max(m, Number(v.orcamentoNumero) || 0); }); }
  return m + 1;
};
const numPed = n => '#' + pad4(n);
const pad4 = n => String(n || 0).padStart(4, '0');
function enderecoCliente(c) {
  const rua = String(c && c.street || '').trim();
  if (rua) return [rua + (c.addressNumber ? ', ' + c.addressNumber : ''), c.addressExtra, c.neighborhood, [c.city, c.state].filter(Boolean).join(' - '), c.cep ? 'CEP ' + c.cep : ''].filter(Boolean).join(', ');
  return String(c && c.address || '').trim();
}
function wazeUrl(c) { const rua = String(c && c.street || '').trim(), cid = String(c && c.city || '').trim(), uf = String(c && c.state || '').trim(); if (!rua || !cid || !uf) return ''; return 'https://waze.com/ul?q=' + encodeURIComponent([rua, c.addressNumber, c.neighborhood, cid, uf].filter(Boolean).join(', ')) + '&navigate=yes'; }
function whatsUrl(tel, texto) { let n = soDig(tel).replace(/^0+/, ''); if (n.startsWith('55')) n = n.slice(2); if (n.length < 10 || n.length > 11) return ''; return 'https://wa.me/55' + n + (texto ? '?text=' + encodeURIComponent(texto) : ''); }
const abrirExterno = url => { if (!url) return toast('Não há dado válido para abrir.', 'erro'); window.venDesktop.abrirExterno(url); };

/* ---------- avisos ---------- */
function toast(msg, tipo) {
  const t = $('#toast'); const e = tipo === 'erro';
  t.innerHTML = ic(e ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>'; t.className = 'toast ' + (e ? 'erro' : 'ok'); t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, e ? 5200 : 2600);
}

/* ---------- janelas (modal) ---------- */
let modais = [];
function modal({ titulo, sub, corpo, botoes, tamanho = 'md', aoAbrir, icone, esquerda }) {
  const el = document.createElement('div'); el.className = 'modal-bg';
  el.innerHTML = `<div class="modal ${tamanho}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><header class="m-head">${icone ? `<span class="m-ico">${ic(icone)}</span>` : ''}<div class="m-tit"><h2>${esc(titulo)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="ibtn" data-fechar aria-label="Fechar" title="Fechar (Esc)">${ic('x')}</button></header><div class="m-body">${corpo}</div><footer class="m-foot">${esquerda ? `<div class="m-esq">${esquerda}</div>` : ''}<div class="m-acoes"></div></footer></div>`;
  const foot = el.querySelector('.m-acoes');
  const fechar = () => { el.remove(); modais = modais.filter(m => m !== el); };
  el._fechar = fechar;
  (botoes || [{ t: 'Fechar' }]).forEach(b => {
    const x = document.createElement('button'); x.type = 'button'; x.className = 'btn ' + (b.pri ? 'pri' : '') + (b.perigo ? ' perigo' : '') + (b.suave ? ' suave' : '');
    x.innerHTML = (b.icone ? ic(b.icone) : '') + esc(b.t); if (b.id) x.id = b.id;
    x.onclick = async () => { if (x.disabled) return; x.disabled = true; try { if (b.fn) { const r = await b.fn(el); if (r === false) { x.disabled = false; return; } } fechar(); } catch (e) { x.disabled = false; console.error(e); toast(e.message || 'Algo deu errado.', 'erro'); } };
    foot.appendChild(x);
  });
  el.addEventListener('mousedown', e => { if (e.target === el && !el._fixo) { /* clique fora não fecha formulários */ } if (e.target.closest('[data-fechar]')) fechar(); });
  document.body.appendChild(el); modais.push(el);
  const pri = [...foot.children].find(b => b.classList.contains('pri'));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && pri && !e.shiftKey && !['TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName) && !e.target.dataset.semEnter) { e.preventDefault(); pri.click(); } });
  if (aoAbrir) aoAbrir(el);
  const i = el.querySelector('[autofocus],input:not([type=checkbox]):not([type=file]):not([type=hidden]),select,textarea'); i && setTimeout(() => { if (!el.contains(document.activeElement) || document.activeElement === document.body) i.focus(); }, 30);
  return el;
}
function confirmar(titulo, msg, fn, rot = 'Confirmar', perigo) { return modal({ titulo, tamanho: 'sm', icone: perigo ? 'alert' : 'info', corpo: `<p class="texto">${esc(msg)}</p>`, botoes: [{ t: 'Cancelar' }, { t: rot, pri: !perigo, perigo, fn }] }); }

/* ---------- menus suspensos ---------- */
let menuAberto = null;
function fecharMenu() { if (menuAberto) { menuAberto.remove(); menuAberto = null; } }
function abrirMenu(ancora, itens, { alinhar = 'direita' } = {}) {
  fecharMenu(); const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = itens.map((it, i) => it === '-' ? '<hr>' : `<button type="button" role="menuitem" data-i="${i}" class="${it.perigo ? 'perigo' : ''}" ${it.off ? 'disabled' : ''}>${it.icone ? ic(it.icone) : ''}<span><b>${esc(it.t)}</b>${it.d ? `<small>${esc(it.d)}</small>` : ''}</span></button>`).join('');
  document.body.appendChild(m); const r = ancora.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let left = alinhar === 'direita' ? r.right - mw : r.left; left = Math.max(8, Math.min(left, innerWidth - mw - 8));
  let top = r.bottom + 6; if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; const it = itens[Number(b.dataset.i)]; fecharMenu(); it && it.fn && it.fn(); });
  menuAberto = m; return m;
}
document.addEventListener('mousedown', e => { if (menuAberto && !menuAberto.contains(e.target) && !e.target.closest('[data-menu]')) fecharMenu(); }, true);

/* ---------- campos de formulário ---------- */
const campo = (rot, id, val = '', extra = '', cls = '', dica = '') => `<label class="f ${cls}"><span>${esc(rot)}</span><input id="${id}" value="${esc(val)}" ${extra}>${dica ? `<small>${dica}</small>` : ''}</label>`;
const selecao = (rot, id, opcoes, atual, cls = '') => `<label class="f ${cls}"><span>${esc(rot)}</span><select id="${id}">${opcoes.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(atual) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
const V = (el, id) => { const x = el.querySelector('#' + id); return x ? (x.type === 'checkbox' ? x.checked : x.value) : ''; };
const lerArquivoDataUrl = file => new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => err(new Error('Não foi possível ler o arquivo.')); r.readAsDataURL(file); });
const carregarImagem = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => err(new Error('Imagem inválida.')); i.src = src; });
async function comprimirImagem(src, lado, q, tipo = 'image/jpeg') {
  const i = await carregarImagem(src); let w = i.naturalWidth || i.width, h = i.naturalHeight || i.height; const m = Math.max(w, h);
  if (m > lado) { w = Math.round(w * lado / m); h = Math.round(h * lado / m); }
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (tipo === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); } x.drawImage(i, 0, 0, w, h);
  return c.toDataURL(tipo, q);
}
const imgSegura = s => typeof s === 'string' && /^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/)/i.test(s) ? s : '';
