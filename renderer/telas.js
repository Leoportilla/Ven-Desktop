'use strict';
const TELAS = [
  ['inicio', 'Início', 'home', 'Visão geral'], ['pdv', 'Nova venda', 'cart', ''], ['pedidos', 'Pedidos', 'pedidos', 'Vendas e orçamentos'], ['clientes', 'Clientes', 'users', ''], ['produtos', 'Produtos', 'box', 'Produtos e serviços'],
  ['pagar', 'A pagar', 'pagar', 'Contas a pagar'], ['receber', 'A receber', 'receber', 'Contas a receber'], ['calendario', 'Calendário', 'calendar', 'Vencimentos do mês'], ['relatorios', 'Relatórios', 'chart', ''], ['config', 'Configurações', 'sliders', '']
];
const GRUPOS_NAV = [['', ['inicio']], ['Vendas', ['pdv', 'pedidos', 'clientes', 'produtos']], ['Financeiro', ['pagar', 'receber', 'calendario']], ['Gestão', ['relatorios', 'config']]];
let tela = 'inicio', sub = {}, termo = '';
const casa = (...c) => !termo || norm(c.join(' ')).includes(norm(termo));

/* ---------- blocos de interface ---------- */
const cab = (titulo, desc, acoes = '') => `<div class="pagina-cab"><div><h2>${esc(titulo)}</h2>${desc ? `<p>${desc}</p>` : ''}</div><div class="pagina-acoes">${acoes}</div></div>`;
const b = (rot, act, { pri, icone, cls = '' } = {}) => `<button class="btn ${pri ? 'pri' : ''} ${cls}" data-act="${act}">${icone ? ic(icone) : ''}${esc(rot)}</button>`;
const bi = (act, icone, tit, cls = '') => `<button class="ibtn ${cls}" data-act="${act}" title="${esc(tit)}" aria-label="${esc(tit)}">${ic(icone)}</button>`;
const vazioBloco = (icone, t, s, acao = '') => `<div class="vazio-bloco grande">${ic(icone)}<b>${esc(t)}</b><small>${s || ''}</small>${acao}</div>`;
const abas = (id, itens, atual) => `<div class="seg" role="tablist">${itens.map(([k, t, n]) => `<button role="tab" aria-selected="${k === atual}" class="${k === atual ? 'on' : ''}" data-sub="${id}:${k}">${esc(t)}${n != null ? `<i>${n}</i>` : ''}</button>`).join('')}</div>`;
function tabela(cols, linhas, vazioHtml) {
  if (!linhas.length) return `<div class="card">${vazioHtml || vazioBloco('search', 'Nada encontrado', termo ? 'Tente outro termo de busca.' : '')}</div>`;
  return `<div class="card tabela-card"><div class="tablewrap"><table><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''} ${c.cls || ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map((c, i) => `<td class="${cols[i].num ? 'num' : ''} ${cols[i].cls || ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
const kpi = (rot, v, s, { cls = '', icone = '', tom = '' } = {}) => `<div class="kpi ${tom}">${icone ? `<span class="kpi-ico">${ic(icone)}</span>` : ''}<span class="kpi-rot">${esc(rot)}</span><b class="kpi-v ${cls}">${esc(v)}</b><small>${esc(s || '')}</small></div>`;
const pillSit = (rec, venc) => rec ? pill('Recebida', 'ok') : (venc && venc < hojeISO() ? pill('Vencida', 'bad') : pill('Em aberto', 'mut'));
const pillVenda = v => { const e = estadoVenda(v); return e === 'paid' ? pill('Recebida', 'ok') : e === 'partial' ? pill('Parcial', 'warn') : pillSit(false, v.vencimento); };
const menuLinha = (tipo, id) => `<button class="ibtn" data-act="menu:${tipo}:${id}" data-menu title="Mais ações" aria-label="Mais ações">${ic('dots')}</button>`;
const diasTxt = iso => { const n = diasAte(iso); return n < 0 ? `${-n} dia${n === -1 ? '' : 's'} em atraso` : n === 0 ? 'vence hoje' : n === 1 ? 'vence amanhã' : `em ${n} dias`; };

/* ---------- cálculos ---------- */
function resumo(d, ym) {
  const vm = d.vendas.filter(v => ymDe(v.data) === ym), vendido = vm.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const entrou = d.vendas.reduce((a, v) => a + (arr(v.pagamentos).length ? arr(v.pagamentos).filter(p => ymDe(p.data) === ym).reduce((x, p) => x + (Number(p.valor) || 0), 0) : (ymDe(v.data) === ym ? Number(v.recebido) || 0 : 0)), 0)
    + d.avulso.filter(c => !c.vendaNumero && c.status === 'recebida' && ymDe(c.recebidoEm) === ym).reduce((a, c) => a + (Number(c.valorRecebido != null ? c.valorRecebido : c.valor) || 0), 0);
  const saiu = d.pagar.filter(c => c.status === 'paga' && ymDe(c.pagoEm) === ym).reduce((a, c) => a + (Number(c.valorPago != null ? c.valorPago : c.valor) || 0), 0);
  const aReceber = d.vendas.reduce((a, v) => { const parcelas = d.avulso.filter(c => Number(c.vendaNumero) === Number(v.numero) && c.status !== 'recebida').reduce((s, c) => s + (Number(c.valor) || 0), 0); return a + Math.max(0, r2(saldoVenda(v) - parcelas)); }, 0) + d.avulso.filter(c => c.status !== 'recebida').reduce((a, c) => a + (Number(c.valor) || 0), 0);
  const aPagar = d.pagar.filter(c => c.status !== 'paga').reduce((a, c) => a + (Number(c.valor) || 0), 0);
  return { vendido, entrou, saiu, resultado: r2(entrou - saiu), aReceber, aPagar, nVendas: vm.length };
}
function vencimentos(d) {
  const r = [...d.vendas.filter(v => saldoVenda(v) > 0.009 && v.vencimento).map(v => { const parcelas = d.avulso.filter(c => Number(c.vendaNumero) === Number(v.numero) && c.status !== 'recebida').reduce((a, c) => a + (Number(c.valor) || 0), 0), restante = Math.max(0, r2(saldoVenda(v) - parcelas)); return restante > 0.009 ? { q: v.vencimento, t: numPed(v.numero) + ' · ' + (v.clienteNome || 'Sem cliente'), v: restante, tipo: 'r' } : null; }).filter(Boolean),
    ...d.avulso.filter(c => c.status !== 'recebida' && c.vencimento).map(c => ({ q: c.vencimento, t: c.descricao + (c.cliente ? ' · ' + c.cliente : ''), v: Number(c.valor) || 0, tipo: 'r' })),
    ...d.pagar.filter(c => c.status !== 'paga' && c.vencimento).map(c => ({ q: c.vencimento, t: c.descricao || c.fornecedor, v: Number(c.valor) || 0, tipo: 'p' }))];
  return r.sort((a, b) => String(a.q).localeCompare(String(b.q)));
}
function graficoBarras(d) {
  const h = new Date(), meses = []; for (let i = 5; i >= 0; i--) { const x = new Date(h.getFullYear(), h.getMonth() - i, 1), k = x.getFullYear() + '-' + pad(x.getMonth() + 1), r = resumo(d, k); meses.push({ rot: MESES[x.getMonth()].slice(0, 3), e: r.entrou, s: r.saiu }); }
  const max = Math.max(1, ...meses.flatMap(m => [m.e, m.s])), W = 520, H = 190, base = 160, pw = W / meses.length;
  const barras = meses.map((m, i) => { const x = i * pw + pw / 2, he = Math.round(m.e / max * 140), hs = Math.round(m.s / max * 140);
    return `<g><rect class="b-e" x="${x - 17}" y="${base - he}" width="15" height="${Math.max(he, 2)}" rx="4"><title>${esc(m.rot)}: entrou ${esc(brl(m.e))}</title></rect><rect class="b-s" x="${x + 2}" y="${base - hs}" width="15" height="${Math.max(hs, 2)}" rx="4"><title>${esc(m.rot)}: saiu ${esc(brl(m.s))}</title></rect><text x="${x}" y="${base + 20}" text-anchor="middle">${esc(m.rot)}</text></g>`; }).join('');
  const guias = [0.5, 1].map(f => `<line x1="0" x2="${W}" y1="${base - 140 * f}" y2="${base - 140 * f}"/>`).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas dos últimos 6 meses"><g class="guias">${guias}<line x1="0" x2="${W}" y1="${base}" y2="${base}"/></g>${barras}</svg><div class="legenda"><span><i class="b-e"></i>Entrou</span><span><i class="b-s"></i>Saiu</span></div>`;
}

/* ---------- Início ---------- */
function vInicio(d) {
  const ym = ymHoje(), r = resumo(d, ym), mes = nomeMes(ym), emp = empresa(), hora = new Date().getHours(), saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const venc = vencimentos(d), atrasadas = venc.filter(x => x.q < hojeISO()), prox = venc.filter(x => x.q >= hojeISO()).slice(0, 7);
  const recentes = d.vendas.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5);
  const abertasPagar = d.pagar.filter(c => c.status !== 'paga'), vencidasPagar = abertasPagar.filter(c => c.vencimento < hojeISO());
  const linhaV = x => `<div class="linha"><span class="dot ${x.tipo === 'p' ? 'neg' : 'pos'}"></span><div><b>${esc(x.t)}</b><small>${esc(dataBR(x.q))} · ${esc(diasTxt(x.q))}</small></div><b class="${x.tipo === 'p' ? 'neg' : 'pos'}">${x.tipo === 'p' ? '−' : '+'}${esc(brl(x.v))}</b></div>`;
  return `<header class="inicio-cab"><div class="ic-esq"><span class="ic-sup">${saud}${emp.fantasia || emp.nome ? ', ' + esc(emp.fantasia || emp.nome) : ''} · ${esc(mes)}</span>
    <div class="ic-linha"><b class="ic-v ${r.resultado < 0 ? 'neg' : ''}">${esc(brl(r.resultado))}</b><span class="ic-rot">resultado do mês</span></div>
    <div class="ic-sub"><span><i class="dot pos"></i>Entrou ${esc(brl(r.entrou))}</span><span><i class="dot neg"></i>Saiu ${esc(brl(r.saiu))}</span></div></div>
    <div class="ic-acoes">${b('Importar conta', 'importarConta', { icone: 'download', cls: 'suave' })}${b('Nova receita', 'novaReceita', { icone: 'plus', cls: 'suave' })}${b('Novo cliente', 'novoCliente', { icone: 'user', cls: 'suave' })}${b('Nova venda', 'pdv', { pri: true, icone: 'cart' })}</div></header>
  <div class="grid g4">${kpi('Vendido no mês', brl(r.vendido), r.nVendas + ' venda' + (r.nVendas === 1 ? '' : 's'), { icone: 'cart', tom: 'azul' })}${kpi('A receber', brl(r.aReceber), 'Vendas e receitas em aberto', { icone: 'receber', cls: 'pos', tom: 'pos' })}${kpi('A pagar', brl(r.aPagar), abertasPagar.length + ' conta' + (abertasPagar.length === 1 ? '' : 's') + ' em aberto', { icone: 'pagar', cls: 'neg', tom: 'neg' })}${kpi('Atrasados', String(atrasadas.length), atrasadas.length ? 'Precisam de atenção' : 'Tudo em dia', { icone: 'alert', tom: atrasadas.length ? 'warn' : '' })}</div>
  <div class="grid g2-1">
    <div class="card"><div class="card-tit"><h3>Entradas e saídas</h3><small>Últimos 6 meses</small></div>${graficoBarras(d)}</div>
    <div class="card"><div class="card-tit"><h3>Próximos vencimentos</h3>${b('Calendário', 'ir:calendario', { cls: 'mini suave' })}</div><div class="linhas">${atrasadas.length ? `<div class="aviso warn">${ic('alert')}<span>${atrasadas.length} vencimento${atrasadas.length === 1 ? '' : 's'} em atraso, entre contas a pagar e a receber.</span></div>` : ''}${prox.length ? prox.map(linhaV).join('') : '<p class="mut pad">Nada a vencer. Bom trabalho!</p>'}</div></div></div>
  <div class="grid g2">
    <div class="card"><div class="card-tit"><h3>Vendas recentes</h3>${b('Ver todas', 'ir:pedidos', { cls: 'mini suave' })}</div><div class="linhas">${recentes.length ? recentes.map(v => `<button class="linha clicavel" data-act="ver:venda:${v.numero}">${avatar(v.clienteNome || 'S')}<div><b>${esc(v.clienteNome || 'Sem cliente')}</b><small>${esc(numPed(v.numero))} · ${esc(dataBR(String(v.data).slice(0, 10)))}</small></div><span>${pillVenda(v)}</span><b>${esc(brl(v.total))}</b></button>`).join('') : `<p class="mut pad">Nenhuma venda ainda. Clique em “Nova venda”.</p>`}</div></div>
    <div class="card"><div class="card-tit"><h3>Contas a pagar</h3>${b('Importar', 'importarConta', { cls: 'mini suave', icone: 'download' })}</div><div class="linhas">${abertasPagar.length ? abertasPagar.sort((a, c) => String(a.vencimento).localeCompare(String(c.vencimento))).slice(0, 5).map(c => `<button class="linha clicavel" data-act="pagar:${c.id}"><span class="dot ${c.vencimento < hojeISO() ? 'neg' : 'mut'}"></span><div><b>${esc(c.descricao || c.fornecedor)}</b><small>${esc(dataBR(c.vencimento))} · ${esc(diasTxt(c.vencimento))}</small></div><b>${esc(brl(c.valor))}</b></button>`).join('') : `<p class="mut pad">Nenhuma conta em aberto.</p>`}${vencidasPagar.length ? `<div class="aviso neg">${ic('alert')}<span>${vencidasPagar.length} conta(s) vencida(s)</span></div>` : ''}</div></div></div>`;
}

/* ---------- Pedidos ---------- */
function vPedidos(d) {
  const f = sub.pedidos || 'todos';
  const ven = d.vendas.map(v => ({ k: 'venda', n: v.numero, data: v.data, cli: v.clienteNome || 'Sem cliente', total: Number(v.total) || 0, st: pillVenda(v), itens: arr(v.itens).length, saldo: saldoVenda(v) }));
  const vend = new Set(d.vendas.map(v => Number(v.orcamentoNumero)));
  const orc = d.pedidos.filter(o => !vend.has(Number(o.numero))).map(o => ({ k: 'orc', n: o.numero, data: o.data, cli: o.cli || 'Sem cliente', total: totaisItens(o.itens, o.desc, o.tipo).total, st: pill('Pedido aberto', 'mut'), itens: arr(o.itens).length, saldo: 0 }));
  const todos = [...ven, ...orc], l = todos.filter(x => f === 'todos' || (f === 'vendas' ? x.k === 'venda' : x.k === 'orc')).filter(x => casa(x.n, numPed(x.n), x.cli)).sort((a, c) => String(c.data).localeCompare(String(a.data)));
  return cab('Pedidos', 'Vendas fechadas e pedidos em aberto.', b('Nova venda', 'pdv', { pri: true, icone: 'plus' })) + `<div class="barra">${abas('pedidos', [['todos', 'Todos', todos.length], ['vendas', 'Vendas', ven.length], ['orc', 'Em aberto', orc.length]], f)}</div>`
    + tabela([{ t: 'Pedido' }, { t: 'Cliente' }, { t: 'Data' }, { t: 'Itens', num: 1, cls: 'esconde' }, { t: 'Total', num: 1 }, { t: 'Situação' }, { t: '', cls: 'acoes-col' }],
      l.map(x => [`<b>${esc(numPed(x.n))}</b>`, `<div class="cel-pessoa">${avatar(x.cli)}<span>${esc(x.cli)}</span></div>`, esc(dataBR(String(x.data).slice(0, 10))), x.itens, `<b>${esc(brl(x.total))}</b>`, x.st,
        `<div class="acoes">${x.k === 'orc' ? b('Cobrar', 'fechar:' + x.n, { pri: true, cls: 'mini' }) : (x.saldo > 0.009 ? b('Receber', 'receberV:' + x.n, { pri: true, cls: 'mini' }) : '')}${bi('ver:' + x.k + ':' + x.n, 'eye', 'Abrir')}${menuLinha(x.k === 'orc' ? 'orc' : 'venda', x.n)}</div>`]),
      vazioBloco('pedidos', 'Nenhum pedido ainda', 'As vendas feitas em “Nova venda” aparecem aqui.', b('Nova venda', 'pdv', { pri: true, icone: 'cart' })));
}

/* ---------- Clientes ---------- */
function vClientes(d) {
  const l = d.clientes.filter(c => casa(c.nome, c.doc, c.telefone, c.email, c.city)).sort((a, c) => norm(a.nome).localeCompare(norm(c.nome)));
  return cab('Clientes', `${d.clientes.length} cadastrado${d.clientes.length === 1 ? '' : 's'}. Digite um CNPJ para o VEN preencher os dados.`, b('Novo cliente', 'novoCliente', { pri: true, icone: 'plus' }))
    + tabela([{ t: 'Cliente' }, { t: 'Contato' }, { t: 'Cidade', cls: 'esconde' }, { t: 'Compras', num: 1 }, { t: 'Total comprado', num: 1 }, { t: '', cls: 'acoes-col' }],
      l.map(c => { const vs = d.vendas.filter(v => norm(v.clienteNome) === norm(c.nome)), tot = vs.reduce((a, v) => a + (Number(v.total) || 0), 0), aberto = vs.reduce((a, v) => a + saldoVenda(v), 0);
        return [`<button class="cel-pessoa link" data-act="ficha:${esc(c.id)}">${avatar(c.nome)}<span><b>${esc(c.nome)}</b><small>${esc(c.doc || 'Sem CPF/CNPJ')}</small></span></button>`, `<div class="cel-dupla"><span>${esc(c.telefone || '—')}</span><small>${esc(c.email || '')}</small></div>`, esc([c.city, c.state].filter(Boolean).join(' - ') || '—'), vs.length, `<b>${esc(brl(tot))}</b>${aberto > 0.009 ? `<small class="neg">deve ${esc(brl(aberto))}</small>` : ''}`,
          `<div class="acoes">${bi('vendaCli:' + c.id, 'cart', 'Nova venda para este cliente')}${bi('editCli:' + c.id, 'edit', 'Editar')}${bi('delCli:' + c.id, 'trash', 'Excluir', 'perigo')}</div>`]; }),
      vazioBloco('users', 'Nenhum cliente ainda', 'Cadastre clientes para vincular às vendas e cobrar pelo WhatsApp.', b('Novo cliente', 'novoCliente', { pri: true, icone: 'plus' })));
}

/* ---------- Produtos ---------- */
function vProdutos(d) {
  const f = sub.produtos || 'todos', baixo = p => p.kind !== 'service' && Number(p.q) <= 0;
  let l = d.produtos.filter(p => f === 'todos' || (f === 'servicos' ? p.kind === 'service' : f === 'zerados' ? baixo(p) : p.kind !== 'service')).filter(p => casa(p.id, p.d, p.description, arr(p.b).join(' '), p.ncm));
  const total = l.length; l = l.slice(0, 300); const nServ = d.produtos.filter(p => p.kind === 'service').length;
  return cab('Produtos e serviços', `${d.produtos.length} ${d.produtos.length === 1 ? 'item' : 'itens'} · ${d.produtos.filter(p => imgSegura(p.img)).length} com foto.`, b('Importar nota (XML)', 'importarNfe', { icone: 'xml' }) + b('Novo item', 'novoProduto', { pri: true, icone: 'plus' }))
    + `<div class="barra">${abas('produtos', [['todos', 'Todos', d.produtos.length], ['produtos', 'Produtos', d.produtos.length - nServ], ['servicos', 'Serviços', nServ], ['zerados', 'Sem estoque']], f)}</div>`
    + tabela([{ t: 'Item' }, { t: 'Código', cls: 'esconde' }, { t: 'NCM', cls: 'esconde' }, { t: 'Estoque', num: 1 }, { t: 'Custo', num: 1, cls: 'esconde' }, { t: 'Preço', num: 1 }, { t: '', cls: 'acoes-col' }],
      l.map(p => [`<div class="cel-prod">${miniatura(p, 'thumb')}<span><b>${esc(p.d || p.description || 'Sem descrição')}</b><small>${p.kind === 'service' ? 'Serviço' : (p.unit ? 'Unidade: ' + esc(p.unit) : 'Produto')}</small></span></div>`, `<span class="cod">${esc(p.id)}</span>`, esc(p.ncm ? ncmBR(p.ncm) : '—'), p.kind === 'service' ? '—' : (baixo(p) ? `<span class="neg">${esc(p.q)}</span>` : esc(p.q)), Number(p.c) > 0 ? esc(brl(p.c)) : '—', `<b>${esc(brl(p.p))}</b>`, `<div class="acoes">${bi('editProd:' + p.id, 'edit', 'Editar')}${bi('delProd:' + p.id, 'trash', 'Excluir', 'perigo')}</div>`]),
      vazioBloco('box', 'Nenhum item cadastrado', 'Cadastre manualmente ou importe o XML de uma nota de compra: o VEN cria os produtos e calcula o preço de venda.', b('Importar nota (XML)', 'importarNfe', { icone: 'xml' }) + b('Novo item', 'novoProduto', { pri: true, icone: 'plus' })))
    + (total > 300 ? `<p class="mut small pad">Mostrando 300 de ${total}. Refine a busca.</p>` : '');
}

/* ---------- A pagar ---------- */
function vPagar(d) {
  const st = sub.pg || 'abertas', hoje = hojeISO(), em7 = isoDe(new Date(Date.now() + 7 * 864e5)), todas = d.pagar;
  const ab = todas.filter(c => c.status !== 'paga'), venc = ab.filter(c => c.vencimento < hoje), sem = ab.filter(c => c.vencimento >= hoje && c.vencimento <= em7), pagasMes = todas.filter(c => c.status === 'paga' && ymDe(c.pagoEm) === ymHoje());
  const soma = a => a.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const l = todas.filter(c => casa(c.descricao, c.fornecedor, c.categoria, c.documento)).filter(c => st === 'todas' || (st === 'abertas' ? c.status !== 'paga' : st === 'vencidas' ? c.status !== 'paga' && c.vencimento < hoje : c.status === 'paga')).sort((a, c) => st === 'pagas' ? String(c.pagoEm).localeCompare(String(a.pagoEm)) : String(a.vencimento).localeCompare(String(c.vencimento)));
  const anexo = c => anexoConta(c.id) ? `<button class="ibtn" data-act="anexo:${c.id}" title="Ver anexo" aria-label="Ver anexo">${ic('clip')}</button>` : '';
  return cab('Contas a pagar', 'Importe boletos e faturas: o VEN lê o código e preenche tudo.', b('Importar conta', 'importarConta', { icone: 'download' }) + b('Nova conta', 'novaConta', { pri: true, icone: 'plus' }))
    + `<div class="grid g4">${kpi('Vencidas', brl(soma(venc)), venc.length + ' conta' + (venc.length === 1 ? '' : 's'), { icone: 'alert', cls: venc.length ? 'neg' : '', tom: venc.length ? 'neg' : '' })}${kpi('Próximos 7 dias', brl(soma(sem)), sem.length + ' conta' + (sem.length === 1 ? '' : 's'), { icone: 'clock', tom: 'warn' })}${kpi('Total em aberto', brl(soma(ab)), ab.length + ' conta' + (ab.length === 1 ? '' : 's'), { icone: 'pagar' })}${kpi('Pago no mês', brl(pagasMes.reduce((s, c) => s + (Number(c.valorPago != null ? c.valorPago : c.valor) || 0), 0)), pagasMes.length + ' pagamento' + (pagasMes.length === 1 ? '' : 's'), { icone: 'check', tom: 'pos' })}</div>`
    + `<div class="barra">${abas('pg', [['abertas', 'Em aberto', ab.length], ['vencidas', 'Vencidas', venc.length], ['pagas', 'Pagas'], ['todas', 'Todas']], st)}<span class="mut">${l.length} conta(s) · ${esc(brl(soma(l)))}</span></div>`
    + tabela([{ t: 'Vencimento' }, { t: 'Conta' }, { t: 'Categoria', cls: 'esconde' }, { t: 'Valor', num: 1 }, { t: 'Situação' }, { t: '', cls: 'acoes-col' }],
      l.map(c => [`<b>${esc(dataBR(c.vencimento))}</b>`, `<div class="cel-dupla"><b>${esc(c.descricao || c.fornecedor || '—')}${c.parcela ? ` <em class="parc">${c.parcela.n}/${c.parcela.de}</em>` : ''}</b><small>${esc(c.fornecedor && c.fornecedor !== c.descricao ? c.fornecedor : (c.documento ? 'Doc. ' + c.documento : ''))}</small></div>`, esc(c.categoria || '—'), `<b>${esc(brl(c.valor))}</b>`,
        c.status === 'paga' ? `${pill('Paga ' + dataCurta(c.pagoEm), 'ok')}` : (c.vencimento < hoje ? pill('Vencida', 'bad') : c.vencimento === hoje ? pill('Vence hoje', 'warn') : pill('Em aberto', 'mut')),
        `<div class="acoes">${c.status === 'paga' ? b('Desfazer', 'undoPg:' + c.id, { cls: 'mini suave' }) : b('Pagar', 'pagar:' + c.id, { pri: true, cls: 'mini' })}${anexo(c)}${menuLinha('conta', c.id)}</div>`]),
      vazioBloco('pagar', st === 'abertas' ? 'Nenhuma conta em aberto' : 'Nada por aqui', 'Importe um boleto (PDF ou foto) ou digite o código de barras.', b('Importar conta', 'importarConta', { pri: true, icone: 'download' })));
}

/* ---------- A receber ---------- */
function vReceber(d) {
  const st = sub.rc || 'abertas', hoje = hojeISO();
  const itens = [...d.vendas.map(v => { const filhos = d.avulso.filter(c => Number(c.vendaNumero) === Number(v.numero)), parcelas = filhos.filter(c => c.status !== 'recebida').reduce((a, c) => a + (Number(c.valor) || 0), 0), saldo = Math.max(0, r2(saldoVenda(v) - parcelas)); return filhos.length && saldo <= 0.009 ? null : { k: 'v', id: v.numero, q: v.vencimento || '', t: 'Venda ' + numPed(v.numero), c: v.clienteNome || '—', tot: Number(v.total) || 0, saldo, rec: saldo <= 0.009, parcial: (Number(v.recebido) || 0) > 0.009 }; }).filter(Boolean),
    ...d.avulso.map(c => ({ k: 'a', id: c.id, q: c.vencimento || '', t: c.descricao || 'Receita', c: c.cliente || '—', tot: Number(c.valor) || 0, saldo: c.status === 'recebida' ? 0 : Number(c.valor) || 0, rec: c.status === 'recebida', parcial: false }))];
  const ab = itens.filter(x => !x.rec), venc = ab.filter(x => x.q && x.q < hoje), soma = a => a.reduce((s, x) => s + x.saldo, 0);
  const l = itens.filter(x => casa(x.t, x.c)).filter(x => st === 'todas' || (st === 'abertas' ? !x.rec : st === 'vencidas' ? !x.rec && x.q && x.q < hoje : x.rec)).sort((a, c) => String(a.q || '9').localeCompare(String(c.q || '9')));
  return cab('Contas a receber', 'Saldo de vendas a prazo e receitas avulsas.', b('Nova receita', 'novaReceita', { pri: true, icone: 'plus' }))
    + `<div class="grid g3">${kpi('Total a receber', brl(soma(ab)), ab.length + ' em aberto', { icone: 'receber', cls: 'pos', tom: 'pos' })}${kpi('Vencidos', brl(soma(venc)), venc.length + (venc.length === 1 ? ' item' : ' itens'), { icone: 'alert', cls: venc.length ? 'neg' : '', tom: venc.length ? 'neg' : '' })}${kpi('Recebido no mês', brl(resumo(d, ymHoje()).entrou), 'Vendas e receitas', { icone: 'check' })}</div>`
    + `<div class="barra">${abas('rc', [['abertas', 'Em aberto', ab.length], ['vencidas', 'Vencidos', venc.length], ['recebidas', 'Recebidos'], ['todas', 'Todos']], st)}</div>`
    + tabela([{ t: 'Vencimento' }, { t: 'Origem' }, { t: 'Cliente' }, { t: 'Total', num: 1, cls: 'esconde' }, { t: 'Saldo', num: 1 }, { t: 'Situação' }, { t: '', cls: 'acoes-col' }],
      l.map(x => [x.q ? `<b>${esc(dataBR(x.q))}</b>` : '—', esc(x.t), esc(x.c), esc(brl(x.tot)), `<b>${esc(brl(x.saldo))}</b>`, x.rec ? pill('Recebida', 'ok') : (x.parcial ? pill('Parcial', 'warn') : pillSit(false, x.q)),
        `<div class="acoes">${x.k === 'v' ? (!x.rec ? b('Receber', 'receberV:' + x.id, { pri: true, cls: 'mini' }) : '') : (!x.rec ? b('Receber', 'receberA:' + x.id, { pri: true, cls: 'mini' }) : b('Desfazer', 'undoA:' + x.id, { cls: 'mini suave' }))}${!x.rec ? bi('cobrar:' + x.k + ':' + x.id, 'whatsapp', 'Cobrar pelo WhatsApp') : ''}${menuLinha(x.k === 'v' ? 'rcv' : 'rca', x.id)}</div>`]),
      vazioBloco('receber', 'Nada a receber', 'Vendas com saldo e receitas avulsas aparecem aqui.'));
}

/* ---------- Calendário ---------- */
function vCalendario(d) {
  const ref = sub.cal || ymHoje(), [y, m] = ref.split('-').map(Number), primeiro = new Date(y, m - 1, 1), dias = new Date(y, m, 0).getDate(), ini = primeiro.getDay(), hoje = hojeISO();
  const ev = {}; vencimentos(d).forEach(x => { if (ymDe(x.q) === ref) (ev[x.q] = ev[x.q] || []).push(x); });
  d.avulso.concat([]).forEach(() => { });
  let cel = ''; for (let i = 0; i < ini; i++) cel += '<div class="dia vazio"></div>';
  for (let n = 1; n <= dias; n++) {
    const iso = ref + '-' + pad(n), e = ev[iso] || [], r = e.filter(x => x.tipo === 'r'), p = e.filter(x => x.tipo === 'p');
    cel += `<button class="dia ${iso === hoje ? 'hoje' : ''} ${e.length ? 'tem' : ''}" data-act="dia:${iso}" ${e.length ? '' : 'tabindex="-1"'}><span class="n">${n}</span>${r.length ? `<span class="ev pos">+${esc(brl(r.reduce((a, x) => a + x.v, 0)).replace('R$ ', ''))}</span>` : ''}${p.length ? `<span class="ev neg">−${esc(brl(p.reduce((a, x) => a + x.v, 0)).replace('R$ ', ''))}</span>` : ''}</button>`;
  }
  for (let i = ini + dias; i < 42; i++) cel += '<div class="dia vazio"></div>';
  const todos = Object.values(ev).flat(), tr = todos.filter(x => x.tipo === 'r').reduce((a, x) => a + x.v, 0), tp = todos.filter(x => x.tipo === 'p').reduce((a, x) => a + x.v, 0);
  return cab('Calendário', 'Vencimentos de contas a pagar e a receber (em aberto).', `<div class="nav-mes"><button class="ibtn" data-mes="cal:-1" aria-label="Mês anterior">${ic('chevL')}</button><b>${esc(nomeMes(ref))}</b><button class="ibtn" data-mes="cal:1" aria-label="Próximo mês">${ic('chevR')}</button></div>`)
    + `<div class="grid g3">${kpi('A receber no mês', brl(tr), '', { cls: 'pos', icone: 'receber', tom: 'pos' })}${kpi('A pagar no mês', brl(tp), '', { cls: 'neg', icone: 'pagar', tom: 'neg' })}${kpi('Saldo previsto', brl(tr - tp), 'Em aberto', { icone: 'wallet', cls: tr - tp < 0 ? 'neg' : 'pos' })}</div>
  <div class="card cal"><div class="cal-sem">${DIAS_SEM.map(x => `<span>${esc(x.slice(0, 3))}</span>`).join('')}</div><div class="cal-grade">${cel}</div></div>`;
}
function diaCalendario(iso) {
  const l = vencimentos(dados()).filter(x => x.q === iso);
  modal({ titulo: dataBR(iso), sub: l.length + ' vencimento(s)', icone: 'calendar', tamanho: 'sm', corpo: `<div class="linhas">${l.map(x => `<div class="linha"><span class="dot ${x.tipo === 'p' ? 'neg' : 'pos'}"></span><div><b>${esc(x.t)}</b><small>${x.tipo === 'p' ? 'A pagar' : 'A receber'}</small></div><b class="${x.tipo === 'p' ? 'neg' : 'pos'}">${esc(brl(x.v))}</b></div>`).join('')}</div>` });
}

/* ---------- Relatórios ---------- */
function vRelatorios(d) {
  const ref = sub.rel || ymHoje(), r = resumo(d, ref), vs = d.vendas.filter(v => ymDe(v.data) === ref), porCli = {}, cats = {}, formas = {}, prods = {};
  vs.forEach(v => { const k = v.clienteNome || 'Sem cliente'; porCli[k] = (porCli[k] || 0) + (Number(v.total) || 0); arr(v.itens).forEach(i => { const n = i.d || 'Item'; prods[n] = (prods[n] || 0) + (Number(i.q) || 0) * (Number(i.p) || 0); }); });
  d.vendas.forEach(v => arr(v.pagamentos).filter(p => ymDe(p.data) === ref).forEach(p => { const k = String(p.forma || 'Outro').replace(/ \d+x$/, ''); formas[k] = (formas[k] || 0) + (Number(p.valor) || 0); }));
  d.pagar.filter(c => c.status === 'paga' && ymDe(c.pagoEm) === ref).forEach(c => { const k = c.categoria || 'Outros'; cats[k] = (cats[k] || 0) + (Number(c.valorPago != null ? c.valorPago : c.valor) || 0); });
  const rank = (o, n = 8) => { const e = Object.entries(o).sort((a, c) => c[1] - a[1]).slice(0, n), mx = Math.max(1, ...e.map(x => x[1])); return e.length ? e.map(([k, v]) => `<div class="rank"><div><span>${esc(k)}</span><b>${esc(brl(v))}</b></div><i style="width:${Math.max(3, Math.round(v / mx * 100))}%"></i></div>`).join('') : '<p class="mut pad">Sem dados no mês.</p>'; };
  return cab('Relatórios', 'Resumo do mês escolhido.', `<div class="nav-mes"><button class="ibtn" data-mes="rel:-1" aria-label="Mês anterior">${ic('chevL')}</button><b>${esc(nomeMes(ref))}</b><button class="ibtn" data-mes="rel:1" ${ref >= ymHoje() ? 'disabled' : ''} aria-label="Próximo mês">${ic('chevR')}</button></div><button class="btn" data-act="exportarCsv">${ic('download')}Exportar vendas (CSV)</button>`)
    + `<div class="grid g4">${kpi('Resultado', brl(r.resultado), 'Entrou − saiu', { icone: 'trend', cls: r.resultado < 0 ? 'neg' : 'pos', tom: 'azul' })}${kpi('Vendido', brl(r.vendido), r.nVendas + ' venda(s)' + (r.nVendas ? ' · ticket ' + brl(r.vendido / r.nVendas) : ''), { icone: 'cart' })}${kpi('Entrou', brl(r.entrou), 'Recebimentos do mês', { icone: 'receber', tom: 'pos' })}${kpi('Saiu', brl(r.saiu), 'Contas pagas no mês', { icone: 'pagar', cls: 'neg', tom: 'neg' })}</div>
  <div class="grid g2"><div class="card"><div class="card-tit"><h3>Clientes que mais compraram</h3></div>${rank(porCli)}</div><div class="card"><div class="card-tit"><h3>Itens mais vendidos (valor)</h3></div>${rank(prods)}</div>
  <div class="card"><div class="card-tit"><h3>Recebido por forma de pagamento</h3></div>${rank(formas)}</div><div class="card"><div class="card-tit"><h3>Despesas por categoria</h3></div>${rank(cats)}</div></div>`;
}
function exportarCsv() {
  const ref = sub.rel || ymHoje(), d = dados(), q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"', l = d.vendas.filter(v => ymDe(v.data) === ref).sort((a, c) => a.numero - c.numero);
  const csv = ['Pedido;Data;Cliente;Total;Recebido;Saldo;Forma'].concat(l.map(v => [v.numero, dataBR(String(v.data).slice(0, 10)), q(v.clienteNome), moeda(v.total), moeda(v.recebido), moeda(saldoVenda(v)), q(v.pagamento)].join(';'))).join('\r\n');
  window.venDesktop.salvarTexto('vendas-' + ref + '.csv', csv).then(r => { if (r && r.salvo) toast('Arquivo salvo.'); });
}

/* ---------- Configurações ---------- */
function vConfig(d) {
  const f = sub.cfg || 'empresa', abasCfg = [['empresa', 'Empresa'], ['impressao', 'Impressão'], ['aparencia', 'Aparência'], ['nuvem', 'Google Drive'], ['dados', 'Dados']];
  const corpo = { empresa: cfgEmpresa, impressao: cfgImpressao, aparencia: cfgAparencia, nuvem: cfgNuvem, dados: cfgDados }[f](d);
  return cab('Configurações', 'Dados da empresa, impressão e sincronização.') + `<div class="barra">${abas('cfg', abasCfg, f)}</div>` + corpo;
}
const sw = (id, rot, ligado, dica) => `<label class="sw"><input type="checkbox" id="${id}" ${ligado ? 'checked' : ''}><i></i><span><b>${esc(rot)}</b>${dica ? `<small>${esc(dica)}</small>` : ''}</span></label>`;
function cfgEmpresa() {
  const e = empresa(), logo = imgSegura(e.logo);
  return `<form class="card cfg" id="formEmpresa" onsubmit="return false"><p class="cfg-intro">Estes dados saem no cabeçalho dos recibos, orçamentos e cupons.</p><div class="fgrid g6">
    <div class="c6 logo-linha"><div class="logo-prev">${logo ? `<img src="${esc(logo)}" alt="Logo">` : ic('image')}</div><div><b>Logotipo</b><small>Aparece nos recibos. PNG ou JPG, fundo claro funciona melhor.</small><div class="linha-btn"><label class="btn">${ic('upload')}Escolher imagem<input type="file" id="eLogoArq" accept="image/*" hidden></label>${logo ? `<button type="button" class="btn suave" id="eLogoRem">${ic('trash')}Remover</button>` : ''}</div></div></div>
    ${blocoCnpj('CNPJ ou CPF', 'eDoc', e.cnpj).replace('class="f"', 'class="f c3"')}${campo('Telefone / WhatsApp', 'eTel', e.telefone, 'data-mask="tel" maxlength="16"', 'c3')}<div id="eStatus" class="consulta c6" hidden></div>
    ${campo('Razão social / nome', 'eNome', e.nome, 'maxlength="140"', 'c3')}${campo('Nome fantasia (aparece nos recibos)', 'eFant', e.fantasia, 'maxlength="100"', 'c3')}
    ${campo('Endereço completo', 'eEnd', e.end, 'maxlength="220" placeholder="Rua, número, bairro, cidade - UF"', 'c6')}${campo('E-mail', 'eMail', e.email, 'type="email" maxlength="120"', 'c3')}${campo('CEP (ajuda a completar o endereço)', 'eCep', '', 'data-mask="cep" maxlength="9" inputmode="numeric" placeholder="00000-000"', 'c3')}<div id="eCepStatus" class="consulta c6" hidden></div></div>
    <div class="cfg-rod"><span class="mut" id="eSalvo"></span><button class="btn pri" type="button" id="eSalvar">${ic('save')}Salvar dados da empresa</button></div></form>`;
}
function ligarEmpresa() {
  const el = $('#formEmpresa'); if (!el) return; let logoNovo, removido = false;
  const montaEnd = x => [tituloBR([x.tipo, x.rua].filter(Boolean).join(' ')) + (x.numero ? ', ' + x.numero : ''), tituloBR(x.compl || ''), tituloBR(x.bairro || ''), [tituloBR(x.cidade || ''), String(x.uf || '').toUpperCase()].filter(Boolean).join(' - '), x.cep ? 'CEP ' + cepBR(x.cep) : ''].map(s => String(s).replace(/^, /, '')).filter(Boolean).join(', ');
  ligarConsultas(el, { doc: 'eDoc', btn: 'eDocBtn', status: 'eStatus', cep: 'eCep', cepStatus: 'eCepStatus', mapaCnpj: x => ({ eNome: String(x.razao || x.fantasia || '').trim(), eFant: tituloBR(x.fantasia || x.razao || ''), eTel: x.tel ? telBR(x.tel) : '', eMail: x.email ? String(x.email).trim().toLowerCase() : '', eEnd: montaEnd(x), eCep: cepBR(x.cep || '') }), mapaCep: x => ({ eEnd: [tituloBR(x.rua), tituloBR(x.bairro), [tituloBR(x.cidade), String(x.uf || '').toUpperCase()].filter(Boolean).join(' - ')].filter(Boolean).join(', ') }) });
  $('#eLogoArq').onchange = async ev => { const f = ev.target.files[0]; if (!f) return; try { logoNovo = await comprimirImagem(await lerArquivoDataUrl(f), 400, 0.9, 'image/png'); removido = false; $('.logo-prev').innerHTML = `<img src="${logoNovo}" alt="Logo">`; } catch (_) { toast('Imagem inválida.', 'erro'); } };
  const rem = $('#eLogoRem'); if (rem) rem.onclick = () => { removido = true; logoNovo = ''; $('.logo-prev').innerHTML = ic('image'); };
  $('#eSalvar').onclick = () => {
    const doc = soDig(V(el, 'eDoc')); if (doc.length === 14 && !cnpjValido(doc)) return toast('O CNPJ informado não é válido.', 'erro');
    const at = empresa(), novo = { ...at, nome: V(el, 'eNome').trim(), fantasia: V(el, 'eFant').trim(), cnpj: docBR(V(el, 'eDoc')), end: V(el, 'eEnd').trim(), telefone: V(el, 'eTel').trim(), email: V(el, 'eMail').trim() };
    if (logoNovo) novo.logo = logoNovo; else if (removido) novo.logo = '';
    gravarChave('ven_empresa', novo); toast('Dados da empresa salvos.'); $('#eSalvo').textContent = 'Salvo às ' + horaBR(new Date()); atualizarRodapeLateral();
  };
}
function cfgImpressao() {
  const c = cfg.impressao;
  return `<div class="card cfg" id="formImp"><p class="cfg-intro">Os recibos são <b>comprovantes comerciais sem valor fiscal</b>. Funcionam com impressora térmica (58 ou 80 mm) ou com qualquer impressora comum em A4.</p><div class="fgrid g6">
    ${selecao('Tamanho do papel', 'iFormato', [['58', 'Cupom térmico 58 mm'], ['80', 'Cupom térmico 80 mm'], ['a4', 'Folha A4']], c.formato, 'c3')}
    <label class="f c3"><span>Impressora</span><select id="iImp"><option value="">Padrão do Windows</option></select><small id="iImpMsg"></small></label>
    ${campo('Cópias', 'iCop', c.copias || 1, 'type="number" min="1" max="5"', 'c2')}${campo('Mensagem no rodapé', 'iRod', c.rodape, 'maxlength="90" placeholder="Obrigado pela preferência!"', 'c4')}
    <div class="c6 sws">${sw('iDireto', 'Imprimir direto, sem janela de confirmação', c.direto, 'Ideal para o balcão: o cupom sai assim que a venda é concluída.')}${sw('iLogo', 'Mostrar o logotipo no recibo', c.mostrarLogo)}${sw('iEmp', 'Mostrar dados da empresa no recibo', c.mostrarEmpresa)}</div></div>
    <div class="cfg-rod"><button class="btn" type="button" id="iTeste">${ic('print')}Imprimir teste</button><button class="btn pri" type="button" id="iSalvar">${ic('save')}Salvar</button></div></div>`;
}
async function ligarImpressao() {
  const sel = $('#iImp'); if (!sel) return; const atual = cfg.impressao.impressora;
  try { const r = await window.venDesktop.impressoras(); (r.impressoras || []).forEach(p => { const o = document.createElement('option'); o.value = p.nome; o.textContent = (p.descricao || p.nome) + (p.padrao ? ' (padrão)' : ''); sel.appendChild(o); }); if (atual && ![...sel.options].some(o => o.value === atual)) { const o = document.createElement('option'); o.value = atual; o.textContent = atual + ' (não encontrada)'; sel.appendChild(o); } sel.value = atual || ''; if (!(r.impressoras || []).length) $('#iImpMsg').textContent = 'Nenhuma impressora instalada foi encontrada.'; } catch (_) { $('#iImpMsg').textContent = 'Não foi possível listar as impressoras.'; }
  const ler = () => ({ formato: $('#iFormato').value, impressora: $('#iImp').value, copias: Math.max(1, Math.min(5, Number($('#iCop').value) || 1)), rodape: $('#iRod').value.trim(), direto: $('#iDireto').checked, mostrarLogo: $('#iLogo').checked, mostrarEmpresa: $('#iEmp').checked });
  $('#iSalvar').onclick = async () => { await salvarConfig({ impressao: ler() }); toast('Configurações de impressão salvas.'); };
  $('#iTeste').onclick = async () => { await salvarConfig({ impressao: ler() }); imprimirDoc(docTeste()); };
}
function cfgAparencia() {
  const t = cfg.tema;
  return `<div class="card cfg"><p class="cfg-intro">Escolha como o VEN aparece neste computador.</p><div class="temas">${[['auto', 'Automático', 'monitor', 'Segue o Windows'], ['claro', 'Claro', 'sun', 'Fundo branco'], ['escuro', 'Escuro', 'moon', 'Menos brilho']].map(([k, n, i, s]) => `<button class="tema ${t === k ? 'on' : ''}" data-tema="${k}">${ic(i)}<b>${n}</b><small>${s}</small></button>`).join('')}</div></div>`;
}
function cfgNuvem() {
  return `<div class="card cfg"><p class="cfg-intro">Conecte a mesma conta Google usada no app do celular para trazer o backup mais recente do Drive.</p>
    <div class="nuvem"><span class="nuvem-ico">${ic('cloud')}</span><div><b id="nuvemTit">Google Drive</b><small id="nuvemSub">Verificando…</small></div></div>
    <div class="cfg-rod esq"><button class="btn" id="btnDriveConectar">${ic('link')}<span>Conectar Google</span></button><button class="btn pri" id="btnDriveSync">${ic('sync')}Sincronizar com o celular</button><button class="btn suave" id="btnDriveSair" hidden>Desconectar</button></div></div>`;
}
function cfgDados(d) {
  return `<div class="card cfg"><p class="cfg-intro">Tudo é gravado automaticamente neste computador, na pasta <b>dados</b> ao lado do programa. Faça cópias de segurança de vez em quando.</p>
    <div class="dados-info" id="dadosInfo"></div><div class="cfg-rod esq"><button class="btn" id="btnAbrir">${ic('folder')}Abrir backup…</button><button class="btn" id="btnSalvar">${ic('save')}Salvar cópia…</button><button class="btn suave" id="btnPasta">${ic('folder')}Mostrar pasta de dados</button></div></div>`;
}
