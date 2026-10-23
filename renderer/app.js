'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad = n => String(n).padStart(2, '0');
const ymHoje = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const dataBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso ? '' : '—'); };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

const IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  ped: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
  fin: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M7 15h4"/>',
  rep: '<path d="M5 20V10M12 20V4M19 20v-7"/>'
};
const TELAS = [
  ['inicio', 'Início', 'home'], ['pedidos', 'Pedidos', 'ped'], ['produtos', 'Produtos', 'box'],
  ['clientes', 'Clientes', 'users'], ['financeiro', 'Financeiro', 'fin'], ['relatorios', 'Relatórios', 'rep']
];

let backup = null, origem = '', tela = 'inicio', sub = {}, termo = '';

/* ---------- dados ---------- */
function lerChave(k, padrao) {
  const s = backup && backup.storage && backup.storage[k];
  if (s == null) return padrao;
  try { const v = JSON.parse(s); return v == null ? padrao : v; } catch (_) { return padrao; }
}
const arr = v => Array.isArray(v) ? v : [];
function dados() {
  const cat = lerChave('ven_catalogoImportado', null);
  return {
    vendas: arr(lerChave('ven_vendas', [])),
    pedidos: arr(lerChave('ven_orcamentosSalvos', [])),
    clientes: arr(lerChave('ven_clientes', [])),
    produtos: [...arr(cat && cat.products), ...arr(lerChave('ven_produtosManuais', []))],
    pagar: arr(lerChave('ven_contasPagar', [])),
    avulso: arr(lerChave('ven_receberAvulso', []))
  };
}
const saldoVenda = v => Math.max(0, (Number(v.total) || 0) - (Number(v.recebido) || 0));
const estadoVenda = v => (Number(v.recebido) || 0) >= (Number(v.total) || 0) - 0.009 ? 'paid' : ((Number(v.recebido) || 0) > 0 ? 'partial' : 'pending');
const ymDe = iso => String(iso || '').slice(0, 7);
function pillVenda(v) {
  const e = estadoVenda(v);
  if (e === 'paid') return '<span class="pill ok">Recebida</span>';
  const atras = v.vencimento && v.vencimento < hojeISO();
  return e === 'partial' ? '<span class="pill warn">Parcial</span>' : (atras ? '<span class="pill bad">Vencida</span>' : '<span class="pill mut">Em aberto</span>');
}
function resumo(d, ym) {
  const vendasMes = d.vendas.filter(v => ymDe(v.data) === ym);
  const vendido = vendasMes.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const entrou = vendasMes.reduce((a, v) => a + (Number(v.recebido) || 0), 0) + d.avulso.filter(c => c.status === 'recebida' && ymDe(c.recebidoEm) === ym).reduce((a, c) => a + (Number(c.valorRecebido != null ? c.valorRecebido : c.valor) || 0), 0);
  const saiu = d.pagar.filter(c => c.status === 'paga' && ymDe(c.pagoEm) === ym).reduce((a, c) => a + (Number(c.valorPago != null ? c.valorPago : c.valor) || 0), 0);
  const aReceber = d.vendas.reduce((a, v) => a + saldoVenda(v), 0) + d.avulso.filter(c => c.status !== 'recebida').reduce((a, c) => a + (Number(c.valor) || 0), 0);
  const aPagar = d.pagar.filter(c => c.status !== 'paga').reduce((a, c) => a + (Number(c.valor) || 0), 0);
  return { vendido, entrou, saiu, resultado: entrou - saiu, aReceber, aPagar, nVendas: vendasMes.length };
}

/* ---------- componentes ---------- */
const kpi = (rot, v, s, cls) => `<div class="card kpi"><h3>${esc(rot)}</h3><div class="v ${cls || ''}">${esc(v)}</div><div class="s">${esc(s || '')}</div></div>`;
const vazio = (t, s) => `<div class="card vazio"><b>${esc(t)}</b>${esc(s || '')}</div>`;
function tabela(cols, linhas, vazioMsg) {
  if (!linhas.length) return vazio(vazioMsg || 'Nada encontrado', termo ? 'Tente outro termo de busca.' : '');
  return `<div class="tablewrap"><table><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map((c, i) => `<td class="${cols[i].num ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const abas = (id, itens, atual) => `<div class="tabs">${itens.map(([k, t]) => `<button class="tab ${k === atual ? 'on' : ''}" data-sub="${id}:${k}">${esc(t)}</button>`).join('')}</div>`;
const casa = (...campos) => !termo || norm(campos.join(' ')).includes(norm(termo));

/* ---------- telas ---------- */
function vInicio(d) {
  const ym = ymHoje(), r = resumo(d, ym), nome = MESES[Number(ym.slice(5)) - 1];
  const meses = []; const h = new Date();
  for (let i = 5; i >= 0; i--) { const x = new Date(h.getFullYear(), h.getMonth() - i, 1); const k = x.getFullYear() + '-' + pad(x.getMonth() + 1); meses.push([MESES[x.getMonth()].slice(0, 3), d.vendas.filter(v => ymDe(v.data) === k).reduce((a, v) => a + (Number(v.total) || 0), 0)]); }
  const max = Math.max(1, ...meses.map(m => m[1]));
  const venc = [...d.vendas.filter(v => saldoVenda(v) > 0.009).map(v => ({ q: v.vencimento || '', t: '#' + pad(v.numero || 0) + ' ' + (v.clienteNome || 'Sem cliente'), v: saldoVenda(v), tipo: 'receber' })),
    ...d.pagar.filter(c => c.status !== 'paga').map(c => ({ q: c.vencimento || '', t: c.descricao || c.fornecedor || 'Conta', v: Number(c.valor) || 0, tipo: 'pagar' }))]
    .filter(x => x.q).sort((a, b) => a.q.localeCompare(b.q)).slice(0, 8);
  return `<div class="grid g4">${kpi('Resultado de ' + nome, brl(r.resultado), 'Entrou − saiu', r.resultado < 0 ? 'neg' : 'pos')}${kpi('Entrou', brl(r.entrou), 'Recebido nas vendas do mês')}${kpi('A receber', brl(r.aReceber), 'Vendas e receitas em aberto', 'pos')}${kpi('A pagar', brl(r.aPagar), 'Contas em aberto', 'neg')}</div>
  <div class="grid g3" data-mt="1"><div class="card"><h3>Vendido nos últimos 6 meses</h3><div class="bars">${meses.map(m => `<div class="bar"><i data-h="${Math.round(m[1] / max * 100)}" title="${esc(brl(m[1]))}"></i><span>${esc(m[0])}</span></div>`).join('')}</div></div>
  <div class="card"><h3>Próximos vencimentos</h3><div class="list">${venc.length ? venc.map(x => `<div class="row"><span>${esc(dataBR(x.q))} · ${esc(x.t)}</span><b class="${x.tipo === 'pagar' ? 'neg' : 'pos'}">${x.tipo === 'pagar' ? '−' : '+'}${esc(brl(x.v))}</b></div>`).join('') : '<div class="mut">Nada em aberto.</div>'}</div></div></div>`;
}
function vPedidos(d) {
  const f = sub.pedidos || 'todos';
  const ven = d.vendas.map(v => ({ k: 'venda', n: v.numero, data: v.data, cli: v.clienteNome || 'Sem cliente', total: Number(v.total) || 0, st: pillVenda(v), itens: arr(v.itens).length }));
  const vendidosOrc = new Set(d.vendas.map(v => Number(v.orcamentoNumero)));
  const orc = d.pedidos.filter(o => !vendidosOrc.has(Number(o.numero))).map(o => {
    const sub_ = arr(o.itens).reduce((a, i) => a + (Number(i.q) || 0) * (Number(i.p) || 0), 0), desc = Number(o.desc) || 0, dd = o.tipo === '%' ? sub_ * desc / 100 : desc;
    return { k: 'orc', n: o.numero, data: o.data || o.criadoEm, cli: o.clienteNome || (o.cliente && o.cliente.nome) || 'Sem cliente', total: sub_ - Math.min(Math.max(dd, 0), sub_), st: '<span class="pill mut">Orçamento</span>', itens: arr(o.itens).length };
  });
  let l = [...ven, ...orc].filter(x => f === 'todos' || (f === 'vendas' ? x.k === 'venda' : x.k === 'orc')).filter(x => casa(x.n, x.cli)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return abas('pedidos', [['todos', 'Todos (' + (ven.length + orc.length) + ')'], ['vendas', 'Vendas (' + ven.length + ')'], ['orc', 'Orçamentos (' + orc.length + ')']], f)
    + tabela([{ t: 'Nº' }, { t: 'Data' }, { t: 'Cliente' }, { t: 'Itens', num: 1 }, { t: 'Total', num: 1 }, { t: 'Situação' }], l.map(x => ['#' + pad(x.n || 0), esc(dataBR(x.data)), esc(x.cli), x.itens, esc(brl(x.total)), x.st]), 'Nenhum pedido');
}
function vProdutos(d) {
  const f = sub.produtos || 'todos';
  let l = d.produtos.filter(p => f === 'todos' || (f === 'servicos' ? p.kind === 'service' : p.kind !== 'service')).filter(p => casa(p.id, p.d, p.description, arr(p.b).join(' ')));
  const total = l.length; l = l.slice(0, 500);
  return abas('produtos', [['todos', 'Todos (' + d.produtos.length + ')'], ['produtos', 'Produtos'], ['servicos', 'Serviços']], f)
    + tabela([{ t: 'Código' }, { t: 'Descrição' }, { t: 'Tipo' }, { t: 'Estoque', num: 1 }, { t: 'Preço', num: 1 }], l.map(p => [esc(p.id), esc(p.d || p.description), p.kind === 'service' ? 'Serviço' : 'Produto', p.kind === 'service' ? '—' : esc(p.q), esc(brl(p.p))]), 'Nenhum produto')
    + (total > 500 ? `<p class="mut small">Mostrando 500 de ${total}. Refine a busca.</p>` : '');
}
function vClientes(d) {
  const l = d.clientes.filter(c => casa(c.nome, c.doc, c.cpfCnpj, c.documento, c.telefone, c.tel, c.whatsapp, c.email));
  return tabela([{ t: 'Nome' }, { t: 'CPF/CNPJ' }, { t: 'Telefone' }, { t: 'E-mail' }, { t: 'Compras', num: 1 }, { t: 'Total comprado', num: 1 }],
    l.map(c => { const vs = d.vendas.filter(v => norm(v.clienteNome) === norm(c.nome)); return [esc(c.nome), esc(c.doc || c.cpfCnpj || c.documento || '—'), esc(c.telefone || c.tel || c.whatsapp || '—'), esc(c.email || '—'), vs.length, esc(brl(vs.reduce((a, v) => a + (Number(v.total) || 0), 0)))]; }), 'Nenhum cliente');
}
function vFinanceiro(d) {
  const f = sub.financeiro || 'pagar', hoje = hojeISO();
  if (f === 'pagar') {
    const l = d.pagar.filter(c => casa(c.descricao, c.fornecedor, c.categoria)).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
    return abas('financeiro', [['pagar', 'Contas a pagar'], ['receber', 'Contas a receber']], f)
      + tabela([{ t: 'Vencimento' }, { t: 'Descrição' }, { t: 'Fornecedor' }, { t: 'Categoria' }, { t: 'Valor', num: 1 }, { t: 'Situação' }],
        l.map(c => [esc(dataBR(c.vencimento)), esc(c.descricao || '—'), esc(c.fornecedor || '—'), esc(c.categoria || '—'), esc(brl(c.valor)), c.status === 'paga' ? '<span class="pill ok">Paga</span>' : (c.vencimento && c.vencimento < hoje ? '<span class="pill bad">Vencida</span>' : '<span class="pill mut">Em aberto</span>')]), 'Nenhuma conta a pagar');
  }
  const l = [...d.vendas.filter(v => saldoVenda(v) > 0.009 || true).map(v => ({ q: v.vencimento || '', t: 'Venda #' + pad(v.numero || 0), c: v.clienteNome || '—', v: saldoVenda(v), tot: Number(v.total) || 0, st: pillVenda(v) })),
    ...d.avulso.map(c => ({ q: c.vencimento || '', t: c.descricao || 'Receita avulsa', c: c.cliente || '—', v: c.status === 'recebida' ? 0 : Number(c.valor) || 0, tot: Number(c.valor) || 0, st: c.status === 'recebida' ? '<span class="pill ok">Recebida</span>' : (c.vencimento && c.vencimento < hoje ? '<span class="pill bad">Vencida</span>' : '<span class="pill mut">Em aberto</span>') }))]
    .filter(x => casa(x.t, x.c)).sort((a, b) => String(a.q).localeCompare(String(b.q)));
  return abas('financeiro', [['pagar', 'Contas a pagar'], ['receber', 'Contas a receber']], f)
    + tabela([{ t: 'Vencimento' }, { t: 'Origem' }, { t: 'Cliente' }, { t: 'Total', num: 1 }, { t: 'Saldo', num: 1 }, { t: 'Situação' }], l.map(x => [esc(dataBR(x.q)), esc(x.t), esc(x.c), esc(brl(x.tot)), esc(brl(x.v)), x.st]), 'Nada a receber');
}
function vRelatorios(d) {
  const ref = sub.rel || ymHoje(), [y, m] = ref.split('-').map(Number), r = resumo(d, ref);
  const vs = d.vendas.filter(v => ymDe(v.data) === ref), porCli = {};
  vs.forEach(v => { const k = v.clienteNome || 'Sem cliente'; porCli[k] = (porCli[k] || 0) + (Number(v.total) || 0); });
  const top = Object.entries(porCli).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const cats = {}; d.pagar.filter(c => c.status === 'paga' && ymDe(c.pagoEm) === ref).forEach(c => { const k = c.categoria || 'Outros'; cats[k] = (cats[k] || 0) + (Number(c.valorPago != null ? c.valorPago : c.valor) || 0); });
  const nav = `<div class="tabs"><button class="tab" data-mes="-1">‹ Mês anterior</button><span class="tab on">${MESES[m - 1]} de ${y}</span><button class="tab" data-mes="1" ${ref >= ymHoje() ? 'disabled' : ''}>Próximo ›</button></div>`;
  return nav + `<div class="grid g4">${kpi('Resultado do mês', brl(r.resultado), 'Entrou − saiu', r.resultado < 0 ? 'neg' : 'pos')}${kpi('Vendido', brl(r.vendido), r.nVendas + ' venda(s)')}${kpi('Entrou', brl(r.entrou))}${kpi('Saiu (contas pagas)', brl(r.saiu), '', 'neg')}</div>
  <div class="grid g2" data-mt="1"><div class="card"><h3>Clientes que mais compraram</h3><div class="list">${top.length ? top.map(([n, v]) => `<div class="row"><span>${esc(n)}</span><b>${esc(brl(v))}</b></div>`).join('') : '<div class="mut">Sem vendas no mês.</div>'}</div></div>
  <div class="card"><h3>Despesas pagas por categoria</h3><div class="list">${Object.keys(cats).length ? Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="row"><span>${esc(n)}</span><b>${esc(brl(v))}</b></div>`).join('') : '<div class="mut">Sem despesas pagas no mês.</div>'}</div></div></div>`;
}
const VIEWS = { inicio: vInicio, pedidos: vPedidos, produtos: vProdutos, clientes: vClientes, financeiro: vFinanceiro, relatorios: vRelatorios };

/* ---------- render ---------- */
function toast(msg, erro) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (erro ? ' erro' : ''); t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, erro ? 5000 : 2600); }
function renderNav() {
  $('#nav').innerHTML = TELAS.map(([k, t, ic], i) => `<button data-tela="${k}" class="${k === tela ? 'on' : ''}"><svg viewBox="0 0 24 24">${IC[ic]}</svg>${esc(t)}<kbd>Alt+${i + 1}</kbd></button>`).join('');
  $('#titulo').textContent = (TELAS.find(t => t[0] === tela) || [])[1] || '';
  $('#arquivoInfo').textContent = backup ? 'Backup: ' + (origem || 'carregado') + (backup.createdAt ? ' · ' + dataBR(backup.createdAt) : '') : 'Nenhum backup aberto';
}
function render() {
  renderNav();
  const c = $('#conteudo');
  if (!backup) { c.innerHTML = `<div class="card vazio"><b>Abra um backup do VEN</b>Use "Abrir backup" e escolha o arquivo .json gerado pelo app do celular (Configurações → Baixar backup, ou a cópia do Google Drive).<br><br><button class="btn pri" id="btnAbrir2">Abrir backup</button></div>`; $('#btnAbrir2').onclick = abrir; return; }
  c.innerHTML = VIEWS[tela](dados());
  c.querySelectorAll('[data-mt]').forEach(x=>{x.style.marginTop='16px'});c.querySelectorAll('.bar i[data-h]').forEach(i => { i.style.height = i.dataset.h + '%'; });
  $('#busca').style.visibility = ['inicio', 'relatorios'].includes(tela) ? 'hidden' : 'visible';
}
async function abrir() {
  const r = await window.venDesktop.abrirBackup();
  if (!r.ok) return toast(r.erro || 'Não foi possível abrir o backup.', true);
  if (!r.dados) return;
  backup = r.dados; origem = r.origem || ''; toast('Backup carregado.'); render();
}
async function salvar() {
  if (!backup) return toast('Abra um backup primeiro.', true);
  const r = await window.venDesktop.salvarCopia(JSON.stringify(backup));
  if (!r.ok) return toast(r.erro || 'Não foi possível salvar.', true);
  if (r.salvo) toast('Cópia salva.');
}
function irPara(k) { tela = k; termo = ''; $('#busca').value = ''; render(); }

document.addEventListener('click', e => {
  const n = e.target.closest('[data-tela]'); if (n) return irPara(n.dataset.tela);
  const s = e.target.closest('[data-sub]'); if (s) { const [a, b] = s.dataset.sub.split(':'); sub[a] = b; return render(); }
  const m = e.target.closest('[data-mes]'); if (m && !m.disabled) { const [y, mm] = (sub.rel || ymHoje()).split('-').map(Number); const x = new Date(y, mm - 1 + Number(m.dataset.mes), 1); sub.rel = x.getFullYear() + '-' + pad(x.getMonth() + 1); render(); }
});
$('#btnAbrir').onclick = abrir; $('#btnSalvar').onclick = salvar;
$('#busca').addEventListener('input', e => { termo = e.target.value; const pos = e.target.selectionStart; render(); const b = $('#busca'); b.focus(); try { b.setSelectionRange(pos, pos); } catch (_) {} });
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#busca').focus(); $('#busca').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); abrir(); }
  if (e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); irPara(TELAS[Number(e.key) - 1][0]); }
});
(async () => {
  try { const r = await window.venDesktop.carregarSalvo(); if (r.ok && r.dados) { backup = r.dados; origem = 'último aberto'; } else if (!r.ok) toast(r.erro, true); } catch (_) {}
  render();
})();
