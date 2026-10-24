'use strict';
const IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  ped: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
  fin: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M7 15h4"/>',
  rep: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  cart: '<path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>'
};
const TELAS = [['inicio', 'Início', 'home'], ['pedidos', 'Pedidos', 'ped'], ['produtos', 'Produtos', 'box'], ['clientes', 'Clientes', 'users'], ['financeiro', 'Financeiro', 'fin'], ['relatorios', 'Relatórios', 'rep']];
let tela = 'inicio', sub = {}, termo = '';

const kpi = (rot, v, s, cls) => `<div class="card kpi"><h3>${esc(rot)}</h3><div class="v ${cls || ''}">${esc(v)}</div><div class="s">${esc(s || '')}</div></div>`;
const vazio = (t, s) => `<div class="card vazio"><b>${esc(t)}</b>${esc(s || '')}</div>`;
const btn = (t, act, cls = '') => `<button class="btn mini ${cls}" data-act="${act}">${esc(t)}</button>`;
const acoesTd = (...b) => `<div class="acoes">${b.join('')}</div>`;
function tabela(cols, linhas, vazioMsg) {
  if (!linhas.length) return vazio(vazioMsg || 'Nada encontrado', termo ? 'Tente outro termo de busca.' : '');
  return `<div class="tablewrap"><table><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map((c, i) => `<td class="${cols[i].num ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const abas = (id, itens, atual) => `<div class="tabs">${itens.map(([k, t]) => `<button class="tab ${k === atual ? 'on' : ''}" data-sub="${id}:${k}">${esc(t)}</button>`).join('')}</div>`;
const barra = (...b) => `<div class="barra">${b.join('')}</div>`;
const casa = (...campos) => !termo || norm(campos.join(' ')).includes(norm(termo));
const pillRec = (rec, venc) => rec ? '<span class="pill ok">Recebida</span>' : (venc && venc < hojeISO() ? '<span class="pill bad">Vencida</span>' : '<span class="pill mut">Em aberto</span>');
function pillVenda(v) { const e = estadoVenda(v); return e === 'paid' ? '<span class="pill ok">Recebida</span>' : e === 'partial' ? '<span class="pill warn">Parcial</span>' : pillRec(false, v.vencimento); }

function resumo(d, ym) {
  const vm = d.vendas.filter(v => ymDe(v.data) === ym);
  const vendido = vm.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const entrou = d.vendas.reduce((a, v) => a + (arr(v.pagamentos).length ? arr(v.pagamentos).filter(p => ymDe(p.data) === ym).reduce((x, p) => x + (Number(p.valor) || 0), 0) : (ymDe(v.data) === ym ? Number(v.recebido) || 0 : 0)), 0)
    + d.avulso.filter(c => c.status === 'recebida' && ymDe(c.recebidoEm) === ym).reduce((a, c) => a + (Number(c.valorRecebido != null ? c.valorRecebido : c.valor) || 0), 0);
  const saiu = d.pagar.filter(c => c.status === 'paga' && ymDe(c.pagoEm) === ym).reduce((a, c) => a + (Number(c.valorPago != null ? c.valorPago : c.valor) || 0), 0);
  const aReceber = d.vendas.reduce((a, v) => a + saldoVenda(v), 0) + d.avulso.filter(c => c.status !== 'recebida').reduce((a, c) => a + (Number(c.valor) || 0), 0);
  const aPagar = d.pagar.filter(c => c.status !== 'paga').reduce((a, c) => a + (Number(c.valor) || 0), 0);
  return { vendido, entrou, saiu, resultado: entrou - saiu, aReceber, aPagar, nVendas: vm.length };
}

/* ---------- telas ---------- */
function vInicio(d) {
  const ym = ymHoje(), r = resumo(d, ym), nome = MESES[Number(ym.slice(5)) - 1], h = new Date(), meses = [];
  for (let i = 5; i >= 0; i--) { const x = new Date(h.getFullYear(), h.getMonth() - i, 1), k = x.getFullYear() + '-' + pad(x.getMonth() + 1); meses.push([MESES[x.getMonth()].slice(0, 3), d.vendas.filter(v => ymDe(v.data) === k).reduce((a, v) => a + (Number(v.total) || 0), 0)]); }
  const max = Math.max(1, ...meses.map(m => m[1]));
  const venc = [...d.vendas.filter(v => saldoVenda(v) > 0.009 && v.vencimento).map(v => ({ q: v.vencimento, t: '#' + pad(v.numero) + ' ' + (v.clienteNome || 'Sem cliente'), v: saldoVenda(v), tipo: 'r' })), ...d.avulso.filter(c => c.status !== 'recebida').map(c => ({ q: c.vencimento, t: c.descricao, v: Number(c.valor) || 0, tipo: 'r' })), ...d.pagar.filter(c => c.status !== 'paga' && c.vencimento).map(c => ({ q: c.vencimento, t: c.descricao || c.fornecedor || 'Conta', v: Number(c.valor) || 0, tipo: 'p' }))].filter(x => x.q).sort((a, b) => a.q.localeCompare(b.q)).slice(0, 8);
  return `<div class="atalhos"><button class="btn pri" data-act="pdv">+ Nova venda <kbd>Ctrl+N</kbd></button><button class="btn" data-act="novaConta">+ Nova conta</button><button class="btn" data-act="novaReceita">+ Nova receita</button><button class="btn" data-act="novoCliente">+ Novo cliente</button></div>
  <div class="grid g4">${kpi('Resultado de ' + nome, brl(r.resultado), 'Entrou − saiu', r.resultado < 0 ? 'neg' : 'pos')}${kpi('Entrou no mês', brl(r.entrou), r.nVendas + ' venda(s) no mês')}${kpi('A receber', brl(r.aReceber), 'Vendas e receitas em aberto', 'pos')}${kpi('A pagar', brl(r.aPagar), 'Contas em aberto', 'neg')}</div>
  <div class="grid g3 mt"><div class="card"><h3>Vendido nos últimos 6 meses</h3><div class="bars">${meses.map(m => `<div class="bar"><i data-h="${Math.round(m[1] / max * 100)}" title="${esc(brl(m[1]))}"></i><span>${esc(m[0])}</span></div>`).join('')}</div></div>
  <div class="card"><h3>Próximos vencimentos</h3><div class="list">${venc.length ? venc.map(x => `<div class="row"><span>${esc(dataBR(x.q))} · ${esc(x.t)}</span><b class="${x.tipo === 'p' ? 'neg' : 'pos'}">${x.tipo === 'p' ? '−' : '+'}${esc(brl(x.v))}</b></div>`).join('') : '<div class="mut">Nada em aberto.</div>'}</div></div></div>`;
}
function vPedidos(d) {
  const f = sub.pedidos || 'todos';
  const ven = d.vendas.map(v => ({ k: 'venda', n: v.numero, data: v.data, cli: v.clienteNome || 'Sem cliente', total: Number(v.total) || 0, st: pillVenda(v), itens: arr(v.itens).length }));
  const vend = new Set(d.vendas.map(v => Number(v.orcamentoNumero)));
  const orc = d.pedidos.filter(o => !vend.has(Number(o.numero))).map(o => ({ k: 'orc', n: o.numero, data: o.data, cli: o.cli || 'Sem cliente', total: totaisItens(o.itens, o.desc, o.tipo).total, st: '<span class="pill mut">Orçamento</span>', itens: arr(o.itens).length }));
  const l = [...ven, ...orc].filter(x => f === 'todos' || (f === 'vendas' ? x.k === 'venda' : x.k === 'orc')).filter(x => casa(x.n, x.cli)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return barra(`<button class="btn pri" data-act="pdv">+ Nova venda</button>`) + abas('pedidos', [['todos', 'Todos (' + (ven.length + orc.length) + ')'], ['vendas', 'Vendas (' + ven.length + ')'], ['orc', 'Orçamentos (' + orc.length + ')']], f)
    + tabela([{ t: 'Nº' }, { t: 'Data' }, { t: 'Cliente' }, { t: 'Itens', num: 1 }, { t: 'Total', num: 1 }, { t: 'Situação' }, { t: '' }], l.map(x => ['#' + pad(x.n || 0), esc(dataBR(String(x.data).slice(0, 10))), esc(x.cli), x.itens, esc(brl(x.total)), x.st, acoesTd(btn('Abrir', `ver:${x.k}:${x.n}`), x.k === 'orc' ? btn('Fechar venda', `fechar:${x.n}`, 'pri') : (estadoVenda(d.vendas.find(v => Number(v.numero) === Number(x.n))) !== 'paid' ? btn('Receber', `receberV:${x.n}`, 'pri') : ''), btn('Excluir', `delPed:${x.k}:${x.n}`, 'perigo'))]), 'Nenhum pedido');
}
function vProdutos(d) {
  const f = sub.produtos || 'todos';
  let l = d.produtos.filter(p => f === 'todos' || (f === 'servicos' ? p.kind === 'service' : p.kind !== 'service')).filter(p => casa(p.id, p.d, p.description, arr(p.b).join(' '), p.ncm));
  const total = l.length; l = l.slice(0, 400);
  return barra(`<button class="btn pri" data-act="novoProduto">+ Novo produto/serviço</button>`) + abas('produtos', [['todos', 'Todos (' + d.produtos.length + ')'], ['produtos', 'Produtos'], ['servicos', 'Serviços']], f)
    + tabela([{ t: 'Código' }, { t: 'Descrição' }, { t: 'NCM' }, { t: 'Estoque', num: 1 }, { t: 'Preço', num: 1 }, { t: '' }], l.map(p => [esc(p.id), esc(p.d || p.description), p.kind === 'service' ? '—' : (p.ncm ? esc(p.ncm) : '<span class="pill warn">falta</span>'), p.kind === 'service' ? '—' : esc(p.q), esc(brl(p.p)), acoesTd(btn('Editar', `editProd:${p.id}`), btn('Excluir', `delProd:${p.id}`, 'perigo'))]), 'Nenhum produto')
    + (total > 400 ? `<p class="mut small">Mostrando 400 de ${total}. Refine a busca.</p>` : '');
}
function vClientes(d) {
  const l = d.clientes.filter(c => casa(c.nome, c.doc, c.telefone, c.email));
  return barra(`<button class="btn pri" data-act="novoCliente">+ Novo cliente</button>`) + tabela([{ t: 'Nome' }, { t: 'CPF/CNPJ' }, { t: 'Telefone' }, { t: 'E-mail' }, { t: 'Compras', num: 1 }, { t: 'Total comprado', num: 1 }, { t: '' }],
    l.map(c => { const vs = d.vendas.filter(v => norm(v.clienteNome) === norm(c.nome)); return [esc(c.nome), esc(c.doc || '—'), esc(c.telefone || '—'), esc(c.email || '—'), vs.length, esc(brl(vs.reduce((a, v) => a + (Number(v.total) || 0), 0))), acoesTd(btn('Editar', `editCli:${c.id}`), btn('Excluir', `delCli:${c.id}`, 'perigo'))]; }), 'Nenhum cliente');
}
function vFinanceiro(d) {
  const f = sub.financeiro || 'pagar', hoje = hojeISO(), ab = abas('financeiro', [['pagar', 'Contas a pagar'], ['receber', 'Contas a receber']], f);
  if (f === 'pagar') {
    const st = sub.pg || 'abertas', todas = d.pagar.filter(c => casa(c.descricao, c.fornecedor, c.categoria));
    const l = todas.filter(c => st === 'todas' || (st === 'abertas' ? c.status !== 'paga' : c.status === 'paga')).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
    const tot = l.reduce((a, c) => a + (Number(c.valor) || 0), 0);
    return barra(`<button class="btn pri" data-act="novaConta">+ Nova conta</button>`, `<span class="mut">${l.length} conta(s) · ${esc(brl(tot))}</span>`) + ab + `<div class="tabs sub">${[['abertas', 'Em aberto'], ['pagas', 'Pagas'], ['todas', 'Todas']].map(([k, t]) => `<button class="tab ${k === st ? 'on' : ''}" data-sub="pg:${k}">${t}</button>`).join('')}</div>`
      + tabela([{ t: 'Vencimento' }, { t: 'Descrição' }, { t: 'Fornecedor' }, { t: 'Categoria' }, { t: 'Valor', num: 1 }, { t: 'Situação' }, { t: '' }], l.map(c => [esc(dataBR(c.vencimento)), esc(c.descricao || '—'), esc(c.fornecedor || '—'), esc(c.categoria || '—'), esc(brl(c.valor)), c.status === 'paga' ? `<span class="pill ok">Paga ${esc(dataBR(c.pagoEm))}</span>` : pillRec(false, c.vencimento), acoesTd(c.status === 'paga' ? btn('Desfazer', `undoPg:${c.id}`) : btn('Pagar', `pagar:${c.id}`, 'pri'), btn('Editar', `editConta:${c.id}`), btn('Excluir', `delConta:${c.id}`, 'perigo'))]), 'Nenhuma conta aqui');
  }
  const st = sub.rc || 'abertas';
  const itens = [...d.vendas.map(v => ({ k: 'v', id: v.numero, q: v.vencimento || '', t: 'Venda #' + pad(v.numero), c: v.clienteNome || '—', tot: Number(v.total) || 0, saldo: saldoVenda(v), rec: saldoVenda(v) <= 0.009, parcial: (Number(v.recebido) || 0) > 0 })),
    ...d.avulso.map(c => ({ k: 'a', id: c.id, q: c.vencimento || '', t: c.descricao || 'Receita avulsa', c: c.cliente || '—', tot: Number(c.valor) || 0, saldo: c.status === 'recebida' ? 0 : Number(c.valor) || 0, rec: c.status === 'recebida', parcial: false }))]
    .filter(x => casa(x.t, x.c)).filter(x => st === 'todas' || (st === 'abertas' ? !x.rec : x.rec)).sort((a, b) => String(a.q).localeCompare(String(b.q)));
  const tot = itens.reduce((a, x) => a + x.saldo, 0);
  return barra(`<button class="btn pri" data-act="novaReceita">+ Nova receita</button>`, `<span class="mut">${itens.length} item(ns) · saldo ${esc(brl(tot))}</span>`) + ab + `<div class="tabs sub">${[['abertas', 'Em aberto'], ['recebidas', 'Recebidas'], ['todas', 'Todas']].map(([k, t]) => `<button class="tab ${k === st ? 'on' : ''}" data-sub="rc:${k}">${t}</button>`).join('')}</div>`
    + tabela([{ t: 'Vencimento' }, { t: 'Origem' }, { t: 'Cliente' }, { t: 'Total', num: 1 }, { t: 'Saldo', num: 1 }, { t: 'Situação' }, { t: '' }], itens.map(x => [esc(dataBR(x.q)), esc(x.t), esc(x.c), esc(brl(x.tot)), esc(brl(x.saldo)), x.rec ? '<span class="pill ok">Recebida</span>' : (x.parcial ? '<span class="pill warn">Parcial</span>' : pillRec(false, x.q)),
      acoesTd(...(x.k === 'v' ? [!x.rec ? btn('Receber', `receberV:${x.id}`, 'pri') : '', x.parcial ? btn('Desfazer', `undoRec:${x.id}`) : '', btn('Abrir', `ver:venda:${x.id}`)] : [!x.rec ? btn('Receber', `receberA:${x.id}`, 'pri') : btn('Desfazer', `undoA:${x.id}`), btn('Editar', `editRec:${x.id}`), btn('Excluir', `delRec:${x.id}`, 'perigo')]))]), 'Nada a receber');
}
function vRelatorios(d) {
  const ref = sub.rel || ymHoje(), [y, m] = ref.split('-').map(Number), r = resumo(d, ref), vs = d.vendas.filter(v => ymDe(v.data) === ref), porCli = {};
  vs.forEach(v => { const k = v.clienteNome || 'Sem cliente'; porCli[k] = (porCli[k] || 0) + (Number(v.total) || 0); });
  const top = Object.entries(porCli).sort((a, b) => b[1] - a[1]).slice(0, 8), cats = {};
  d.pagar.filter(c => c.status === 'paga' && ymDe(c.pagoEm) === ref).forEach(c => { const k = c.categoria || 'Outros'; cats[k] = (cats[k] || 0) + (Number(c.valorPago != null ? c.valorPago : c.valor) || 0); });
  const nav = `<div class="tabs"><button class="tab" data-mes="-1">‹ Mês anterior</button><span class="tab on">${MESES[m - 1]} de ${y}</span><button class="tab" data-mes="1" ${ref >= ymHoje() ? 'disabled' : ''}>Próximo ›</button></div>`;
  return nav + `<div class="grid g4">${kpi('Resultado do mês', brl(r.resultado), 'Entrou − saiu', r.resultado < 0 ? 'neg' : 'pos')}${kpi('Vendido', brl(r.vendido), r.nVendas + ' venda(s)')}${kpi('Entrou', brl(r.entrou))}${kpi('Saiu (contas pagas)', brl(r.saiu), '', 'neg')}</div>
  <div class="grid g2 mt"><div class="card"><h3>Clientes que mais compraram</h3><div class="list">${top.length ? top.map(([n, v]) => `<div class="row"><span>${esc(n)}</span><b>${esc(brl(v))}</b></div>`).join('') : '<div class="mut">Sem vendas no mês.</div>'}</div></div>
  <div class="card"><h3>Despesas pagas por categoria</h3><div class="list">${Object.keys(cats).length ? Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="row"><span>${esc(n)}</span><b>${esc(brl(v))}</b></div>`).join('') : '<div class="mut">Sem despesas pagas no mês.</div>'}</div></div></div>`;
}

/* ---------- venda de balcão ---------- */
function vPdv(d) {
  return `<div class="pdv"><div class="card pdv-busca"><h3>Produtos <span class="mut">(Enter adiciona · leitor de código de barras funciona aqui)</span></h3><input id="pdvBusca" class="grande" placeholder="Buscar por nome, código ou código de barras" autocomplete="off"><div id="pdvRes" class="pdv-res"></div></div>
  <div class="card pdv-cart"><h3>${pdv.edit ? 'Editando pedido #' + pad(pdv.edit) : 'Pedido atual'}</h3><div id="pdvLado"></div></div></div>`;
}
function pdvResultados() {
  const d = dados(), q = norm($('#pdvBusca') ? $('#pdvBusca').value : ''), l = (q ? d.produtos.filter(p => norm([p.id, p.d, p.description, arr(p.b).join(' ')].join(' ')).includes(q)) : d.produtos).slice(0, 40);
  $('#pdvRes').innerHTML = l.length ? l.map(p => `<button class="pdv-item" data-add="${esc(p.id)}"><span><b>${esc(p.d)}</b><small>${esc(p.id)}${p.kind === 'service' ? ' · serviço' : ' · estoque ' + esc(p.q)}</small></span><b class="pri-tx">${esc(brl(p.p))}</b></button>`).join('') : '<div class="mut" style="padding:14px">Nenhum item encontrado.</div>';
}
function renderPdvLado() {
  const d = dados(), t = totaisItens(pdv.itens, pdv.desc, pdv.tipo);
  $('#pdvLado').innerHTML = `<div class="f"><span>Cliente</span><input id="pdvCli" list="pdvClis" value="${esc(pdv.cli)}" placeholder="Nome do cliente (opcional)" autocomplete="off"><datalist id="pdvClis">${d.clientes.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist></div>
  ${pdv.itens.length ? `<table class="mini"><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Preço</th><th class="num">Total</th><th></th></tr></thead><tbody>${pdv.itens.map((i, n) => `<tr><td>${esc(i.d)}</td><td class="num"><input class="q" data-i="${n}" data-c="q" value="${esc(i.q)}" inputmode="decimal"></td><td class="num"><input class="p" data-i="${n}" data-c="p" value="${esc(moeda(i.p))}" inputmode="decimal"></td><td class="num" id="pdvT${n}">${esc(brl((Number(i.q) || 0) * (Number(i.p) || 0)))}</td><td><button class="x" data-rm="${n}" aria-label="Remover">×</button></td></tr>`).join('')}</tbody></table>` : '<div class="vazio" style="padding:30px 10px"><b>Pedido vazio</b>Busque um produto ao lado e clique, ou use o leitor.</div>'}
  <div class="pdv-desc"><span>Desconto</span><input id="pdvDesc" value="${esc(pdv.desc || '')}" inputmode="decimal" placeholder="0"><select id="pdvTipo"><option value="%" ${pdv.tipo === '%' ? 'selected' : ''}>%</option><option value="R$" ${pdv.tipo !== '%' ? 'selected' : ''}>R$</option></select></div>
  <div class="pdv-tot"><div id="pdvSub" class="mut">Subtotal ${esc(brl(t.sub))}</div><div class="total" id="pdvTotal">${esc(brl(t.total))}</div></div>
  <div class="pdv-acoes"><button class="btn" data-act="pdvCancel">Cancelar</button><button class="btn" data-act="pdvSalvar">Salvar orçamento <kbd>F8</kbd></button><button class="btn pri" data-act="pdvFechar">Fechar venda <kbd>F9</kbd></button></div>`;
}
function atualizaTotaisPdv() { const t = totaisItens(pdv.itens, pdv.desc, pdv.tipo); $('#pdvSub').textContent = 'Subtotal ' + brl(t.sub); $('#pdvTotal').textContent = brl(t.total); pdv.itens.forEach((i, n) => { const e = $('#pdvT' + n); if (e) e.textContent = brl((Number(i.q) || 0) * (Number(i.p) || 0)); }); }

/* ---------- render ---------- */
const VIEWS = { inicio: vInicio, pedidos: vPedidos, produtos: vProdutos, clientes: vClientes, financeiro: vFinanceiro, relatorios: vRelatorios, pdv: vPdv };
function renderNav() {
  $('#nav').innerHTML = `<button class="novavenda" data-act="pdv"><svg viewBox="0 0 24 24">${IC.cart}</svg>Nova venda<kbd>Ctrl+N</kbd></button>` + TELAS.map(([k, t, ic], i) => `<button data-tela="${k}" class="${k === tela ? 'on' : ''}"><svg viewBox="0 0 24 24">${IC[ic]}</svg>${esc(t)}<kbd>Alt+${i + 1}</kbd></button>`).join('');
  $('#titulo').textContent = tela === 'pdv' ? 'Nova venda' : (TELAS.find(t => t[0] === tela) || [])[1] || '';
  $('#arquivoInfo').textContent = infoArquivo();
}
function render() {
  renderNav(); const c = $('#conteudo');
  if (!backup) { c.innerHTML = `<div class="card vazio"><b>Abra um backup do VEN</b>Use "Abrir backup" e escolha o arquivo .json gerado pelo app do celular (Configurações → Baixar backup, ou a cópia do Google Drive). Ou comece do zero.<br><br><button class="btn pri" id="btnAbrir2">Abrir backup</button> <button class="btn" id="btnZero">Começar do zero</button></div>`; $('#btnAbrir2').onclick = abrir; $('#btnZero').onclick = () => { backup = { app: 'VEN Vendas', format: 1, createdAt: new Date().toISOString(), origin: 'desktop', storage: {} }; origem = 'novo'; agendarGravacao(); render(); }; return; }
  c.innerHTML = VIEWS[tela](dados());
  c.querySelectorAll('[data-mt]').forEach(x => { x.style.marginTop = '16px'; });
  c.querySelectorAll('.bar i[data-h]').forEach(i => { i.style.height = i.dataset.h + '%'; });
  $('#busca').style.visibility = ['inicio', 'relatorios', 'pdv'].includes(tela) ? 'hidden' : 'visible';
  if (tela === 'pdv' && pdv) { renderPdvLado(); pdvResultados(); }
}
async function abrir() { const r = await window.venDesktop.abrirBackup(); if (!r.ok) return toast(r.erro || 'Não foi possível abrir o backup.', true); if (!r.dados) return; backup = r.dados; origem = r.origem || ''; salvoEm = ''; toast('Backup carregado.'); render(); }
async function salvar() { if (!backup) return toast('Abra um backup primeiro.', true); const r = await window.venDesktop.salvarCopia(JSON.stringify(backup)); if (!r.ok) return toast(r.erro || 'Não foi possível salvar.', true); if (r.salvo) toast('Cópia salva (leve este arquivo ao celular em Restaurar backup).'); }
function irPara(k) { if (k === tela && k !== 'pdv') return; if (tela === 'pdv' && pdv && pdv.itens.length && !confirm('Descartar o pedido em andamento?')) return; pdv = null; tela = k; termo = ''; $('#busca').value = ''; render(); }

const ACOES = {
  pdv: () => abrirPdv(), novaConta: () => formConta(), novaReceita: () => formReceita(), novoCliente: () => formCliente(), novoProduto: () => formProduto(),
  ver: (k, n) => verPedido(k, n), fechar: n => fecharVendaModal(n), receberV: n => receberVenda(n), delPed: (k, n) => excluirPedido(k, n),
  editProd: id => formProduto(id), delProd: id => excluirProduto(id), editCli: id => formCliente(id), delCli: id => excluirCliente(id),
  pagar: id => pagarConta(id), undoPg: id => desfazerPagamento(id), editConta: id => formConta(id), delConta: id => excluirConta(id),
  undoRec: n => desfazerRecebimento(n), receberA: id => receberReceita(id), undoA: id => desfazerReceita(id), editRec: id => formReceita(id), delRec: id => excluirReceita(id),
  pdvCancel: () => { pdv = null; tela = 'pedidos'; render(); }, pdvSalvar: () => salvarOrcamento(false), pdvFechar: () => salvarOrcamento(true)
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (a) { const [fn, ...args] = a.dataset.act.split(':'); if (ACOES[fn]) ACOES[fn](...args); return; }
  const n = e.target.closest('[data-tela]'); if (n) return irPara(n.dataset.tela);
  const s = e.target.closest('[data-sub]'); if (s) { const [k, v] = s.dataset.sub.split(':'); sub[k] = v; return render(); }
  const m = e.target.closest('[data-mes]'); if (m && !m.disabled) { const [y, mm] = (sub.rel || ymHoje()).split('-').map(Number), x = new Date(y, mm - 1 + Number(m.dataset.mes), 1); sub.rel = x.getFullYear() + '-' + pad(x.getMonth() + 1); return render(); }
  const ad = e.target.closest('[data-add]'); if (ad && pdv) { const p = dados().produtos.find(x => String(x.id) === ad.dataset.add); if (p) { pdvAdd(p); const b = $('#pdvBusca'); b.value = ''; pdvResultados(); b.focus(); } return; }
  const rm = e.target.closest('[data-rm]'); if (rm && pdv) { pdv.itens.splice(Number(rm.dataset.rm), 1); renderPdvLado(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pdvBusca') return pdvResultados();
  if (!pdv) return;
  if (t.id === 'pdvCli') pdv.cli = t.value; else if (t.id === 'pdvDesc') { pdv.desc = numeroBR(t.value); atualizaTotaisPdv(); }
  else if (t.dataset && t.dataset.i != null) { const i = pdv.itens[Number(t.dataset.i)]; if (!i) return; if (t.dataset.c === 'q') i.q = numeroBR(t.value); else i.p = numeroBR(t.value); atualizaTotaisPdv(); }
});
document.addEventListener('change', e => { if (pdv && e.target.id === 'pdvTipo') { pdv.tipo = e.target.value; atualizaTotaisPdv(); } if (pdv && e.target.dataset && e.target.dataset.c === 'p') e.target.value = moeda(numeroBR(e.target.value)); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modais.length) { modais[modais.length - 1]._fechar(); return; }
  if (e.target.id === 'pdvBusca' && e.key === 'Enter') { e.preventDefault(); const q = e.target.value.trim(), d = dados(), ex = d.produtos.find(p => String(p.id).toLowerCase() === q.toLowerCase() || arr(p.b).includes(q)); const p = ex || (q ? d.produtos.find(p => norm([p.id, p.d, arr(p.b).join(' ')].join(' ')).includes(norm(q))) : null); if (p) { pdvAdd(p); e.target.value = ''; pdvResultados(); } return; }
  if (modais.length) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#busca').focus(); $('#busca').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); abrir(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); if (backup) abrirPdv(); }
  if (e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); irPara(TELAS[Number(e.key) - 1][0]); }
  if (pdv && e.key === 'F8') { e.preventDefault(); salvarOrcamento(false); }
  if (pdv && e.key === 'F9') { e.preventDefault(); salvarOrcamento(true); }
});
$('#btnAbrir').onclick = abrir; $('#btnSalvar').onclick = salvar;
const googleCredModal = $('#googleCredModal');
$('#btnDriveConectar').onclick = async () => {
  // Não reabre o fluxo OAuth quando já existe uma autorização salva.
  // Se a autorização falhou/foi revogada, permita tentar novamente.
  $('#btnDriveConectar').disabled = true;
  try {
    const estado = await window.venDesktop.driveEstado();
    if (estado && estado.conectado) {
      $('#btnDriveConectar').textContent = 'Google conectado';
      toast('O Google já está conectado. Para sincronizar, use “Sincronizar com Android”.');
      return;
    }
  } catch (_) { /* segue para a tela de conexão */ }
  finally { $('#btnDriveConectar').disabled = false; }
  $('#googleClientSecret').value = '';
  googleCredModal.hidden = false;
  $('#googleClientSecret').focus();
};
$('#googleCredCancel').onclick = () => { googleCredModal.hidden = true; };
$('#googleCredContinue').onclick = async () => {
  const segredo = $('#googleClientSecret').value.trim();
  if (!segredo) { toast('Cole a chave secreta do cliente OAuth para continuar.', true); $('#googleClientSecret').focus(); return; }
  $('#googleCredContinue').disabled = true; $('#btnDriveConectar').disabled = true; toast('Abrindo autorização do Google…');
  try {
    const r = await window.venDesktop.driveConectar(segredo);
    if (!r.ok) toast(r.erro || 'Falha ao conectar ao Google.', true);
    else { googleCredModal.hidden = true; toast('Google Drive conectado.'); $('#btnDriveConectar').textContent = 'Google conectado'; }
  } catch (e) { toast(e.message || 'Falha ao conectar ao Google.', true); }
  finally { $('#googleCredContinue').disabled = false; $('#btnDriveConectar').disabled = false; }
};
$('#googleClientSecret').addEventListener('keydown', e => { if (e.key === 'Enter') $('#googleCredContinue').click(); if (e.key === 'Escape') googleCredModal.hidden = true; });
$('#btnDriveSync').onclick = async () => {
  try { const estado = await window.venDesktop.driveEstado(); if (!estado.conectado) { toast('Primeiro clique em Conectar Google e conclua a autorização.', true); return; } }
  catch (_) { toast('Primeiro conecte o Google Drive.', true); return; }
  if (!confirm('A sincronização substituirá os dados abertos pelo backup mais recente do Drive. Uma cópia dos dados atuais será salva antes. Continuar?')) return;
  $('#btnDriveSync').disabled = true; toast('Procurando backup no Google Drive…');
  try { const r = await window.venDesktop.driveSincronizar(); if (!r.ok) return toast(r.erro || 'Não foi possível sincronizar.', true); backup = r.dados; origem = r.nome; salvoEm = ''; render(); toast('Sincronização concluída: ' + r.nome); }
  catch (e) { toast(e.message || 'Falha na sincronização.', true); } finally { $('#btnDriveSync').disabled = false; }
};
(async () => { try { const r = await window.venDesktop.driveEstado(); if (r.conectado) $('#btnDriveConectar').textContent = 'Google conectado'; } catch (_) {} })();
$('#busca').addEventListener('input', e => { termo = e.target.value; const pos = e.target.selectionStart; render(); const b = $('#busca'); b.focus(); try { b.setSelectionRange(pos, pos); } catch (_) { } });
(async () => { try { const r = await window.venDesktop.carregarSalvo(); if (r.ok && r.dados) { backup = r.dados; origem = 'último aberto'; } else if (!r.ok) toast(r.erro, true); } catch (_) { } render(); })();
