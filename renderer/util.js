'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad = n => String(n).padStart(2, '0');
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const isoDe = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hojeISO = () => isoDe(new Date());
const ymHoje = () => hojeISO().slice(0, 7);
const ymDe = iso => String(iso || '').slice(0, 7);
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; };
const parseData = t => { t = String(t || '').trim(); let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); if (m) return m[3] + '-' + m[2] + '-' + m[1]; m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); return m ? t : ''; };
const numeroBR = t => { t = String(t == null ? '' : t).trim().replace(/[^\d.,-]/g, ''); if (!t) return 0; if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return isFinite(n) ? n : 0; };
const moeda = n => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const somaMes = (iso, n, dia) => { const [y, m, d] = iso.split('-').map(Number); const alvo = new Date(y, m - 1 + n, 1); const ult = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate(); return isoDe(new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(dia || d, ult))); };
const arr = v => Array.isArray(v) ? v : [];
const FORMAS = ['PIX', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência'];
const CATEGORIAS = ['Energia elétrica', 'Água', 'Internet e telefone', 'Aluguel', 'Funcionários e salários', 'Comissões', 'Fornecedores', 'Impostos e taxas', 'Frete e transporte', 'Sistemas e assinaturas', 'Materiais', 'Outros'];

/* ---------- armazenamento (mesmo formato do app do celular) ---------- */
let backup = null, origem = '', salvoEm = '', _t = 0;
function lerChave(k, padrao) {
  const s = backup && backup.storage && backup.storage[k];
  if (s == null) return padrao;
  try { const v = JSON.parse(s); return v == null ? padrao : v; } catch (_) { return padrao; }
}
function gravarChave(k, v) { if (!backup) return; backup.storage[k] = JSON.stringify(v); agendarGravacao(); }
function agendarGravacao() {
  clearTimeout(_t);
  _t = setTimeout(async () => {
    backup.createdAt = new Date().toISOString();
    try { const r = await window.venDesktop.gravar(JSON.stringify(backup)); salvoEm = r.ok ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; if (!r.ok) toast(r.erro || 'Não foi possível gravar.', true); } catch (e) { toast('Não foi possível gravar.', true); }
    const i = $('#arquivoInfo'); if (i) i.textContent = infoArquivo();
  }, 250);
}
const infoArquivo = () => backup ? 'Backup: ' + (origem || 'carregado') + (salvoEm ? ' · gravado ' + salvoEm : '') : 'Nenhum backup aberto';
function dados() {
  const cat = lerChave('ven_catalogoImportado', null);
  return {
    vendas: arr(lerChave('ven_vendas', [])), pedidos: arr(lerChave('ven_orcamentosSalvos', [])), clientes: arr(lerChave('ven_clientes', [])),
    catalogo: arr(cat && cat.products), manuais: arr(lerChave('ven_produtosManuais', [])),
    get produtos() { return [...this.catalogo, ...this.manuais]; },
    pagar: arr(lerChave('ven_contasPagar', [])), avulso: arr(lerChave('ven_receberAvulso', []))
  };
}
function gravarCatalogo(lista) { const cat = lerChave('ven_catalogoImportado', null) || { products: [], date: new Date().toISOString() }; cat.products = lista; gravarChave('ven_catalogoImportado', cat); }

/* ---------- regras de negócio ---------- */
const saldoVenda = v => Math.max(0, r2((Number(v.total) || 0) - (Number(v.recebido) || 0)));
const estadoVenda = v => (Number(v.recebido) || 0) >= (Number(v.total) || 0) - 0.009 ? 'paid' : ((Number(v.recebido) || 0) > 0 ? 'partial' : 'pending');
function totaisItens(itens, desc, tipo) {
  const sub = arr(itens).reduce((a, i) => a + (Number(i.q) || 0) * (Number(i.p) || 0), 0);
  const d = Math.min(Math.max(tipo === '%' ? sub * (Number(desc) || 0) / 100 : Number(desc) || 0, 0), sub);
  return { sub: r2(sub), d: r2(d), total: r2(sub - d) };
}
const vendaDoPedido = (d, num) => d.vendas.find(v => Number(v.orcamentoNumero) === Number(num)) || null;
const proxNum = k => {
  const d = dados(); let m = Number(lerChave(k, 0)) || 0;
  if (k === 'ven_ultimoNumeroVenda') d.vendas.forEach(v => { m = Math.max(m, Number(v.numero) || 0); });
  else { d.pedidos.forEach(o => { m = Math.max(m, Number(o.numero) || 0); }); d.vendas.forEach(v => { m = Math.max(m, Number(v.orcamentoNumero) || 0); }); }
  return m + 1;
};

/* ---------- toast / modal ---------- */
function toast(msg, erro) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (erro ? ' erro' : ''); t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, erro ? 5000 : 2600); }
let modais = [];
function modal({ titulo, sub, corpo, botoes, largo, aoAbrir }) {
  const el = document.createElement('div'); el.className = 'modal-bg';
  el.innerHTML = `<div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true"><div class="m-head"><div><h2>${esc(titulo)}</h2>${sub ? `<p class="mut">${esc(sub)}</p>` : ''}</div><button class="x" data-fechar aria-label="Fechar">×</button></div><div class="m-body">${corpo}</div><div class="m-foot"></div></div>`;
  const foot = el.querySelector('.m-foot');
  (botoes || [{ t: 'Fechar' }]).forEach(b => { const x = document.createElement('button'); x.className = 'btn ' + (b.pri ? 'pri' : '') + (b.perigo ? ' perigo' : ''); x.textContent = b.t; x.onclick = async () => { if (b.fn) { const r = await b.fn(el); if (r === false) return; } fechar(); }; foot.appendChild(x); });
  const fechar = () => { el.remove(); modais = modais.filter(m => m !== el); const f = modais[modais.length - 1]; if (f) { const i = f.querySelector('input,select,textarea'); i && i.focus(); } };
  el._fechar = fechar;
  el.addEventListener('mousedown', e => { if (e.target === el || e.target.closest('[data-fechar]')) fechar(); });
  document.body.appendChild(el); modais.push(el);
  const pri = [...foot.children].find(b => b.classList.contains('pri'));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && pri && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); pri.click(); } });
  if (aoAbrir) aoAbrir(el);
  const i = el.querySelector('input:not([type=checkbox]),select,textarea'); i && setTimeout(() => { if (!el.contains(document.activeElement)) i.focus(); }, 30);
  return el;
}
function confirmar(titulo, msg, fn, rot = 'Confirmar', perigo) { modal({ titulo, corpo: `<p>${esc(msg)}</p>`, botoes: [{ t: 'Cancelar' }, { t: rot, pri: !perigo, perigo, fn }] }); }
const campo = (rot, id, val = '', extra = '', cls = '') => `<label class="f ${cls}"><span>${esc(rot)}</span><input id="${id}" value="${esc(val)}" ${extra}></label>`;
const selecao = (rot, id, opcoes, atual, cls = '') => `<label class="f ${cls}"><span>${esc(rot)}</span><select id="${id}">${opcoes.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(atual) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
const V = (el, id) => { const x = el.querySelector('#' + id); return x ? (x.type === 'checkbox' ? x.checked : x.value) : ''; };
