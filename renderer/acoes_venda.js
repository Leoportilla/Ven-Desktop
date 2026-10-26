'use strict';
/* ===== Venda de balcão (PDV) ===== */
let pdv = null;
function abrirPdv(numOrc, nomeCliente) {
  const d = dados(), o = numOrc ? d.pedidos.find(x => Number(x.numero) === Number(numOrc)) : null;
  pdv = { view: 'grade', edit: o ? o.numero : null, cli: o ? o.cli || '' : (nomeCliente || ''), desc: o ? o.desc || 0 : 0, tipo: o ? o.tipo || '%' : '%', obs: o ? o.obs || '' : '', itens: o ? arr(o.itens).map(i => ({ ...i })) : [], cat: 'todos' };
  irPara('pdv');
}
function vPdv(d) {
  const cats = ['todos', 'produto', 'serviço'];
  return `<div class="pdv"><section class="pdv-esq"><div class="pdv-topo"><label class="busca grande">${ic('search')}<input id="pdvBusca" placeholder="Buscar produto ou serviço, ou leia o código de barras" autocomplete="off"></label>
    <div class="seg" id="pdvCat">${cats.map(c => `<button data-cat="${c}" class="${pdv.cat === c ? 'on' : ''}">${c === 'todos' ? 'Tudo' : c === 'produto' ? 'Produtos' : 'Serviços'}</button>`).join('')}</div><div class="pdv-view" id="pdvView"><button type="button" data-view="grade" class="${pdv.view !== 'lista' ? 'on' : ''}" title="Cartões com fotos">Fotos</button><button type="button" data-view="lista" class="${pdv.view === 'lista' ? 'on' : ''}" title="Lista compacta">Lista</button></div></div>
    <div id="pdvRes" class="pdv-grade"></div></section>
    <aside class="pdv-dir"><header><h3>${pdv.edit ? 'Pedido ' + numPed(pdv.edit) : 'Venda atual'}</h3>${pdv.itens.length ? `<button class="btn mini" data-act="pdvLimpar">${ic('trash')}Limpar</button>` : ''}</header><div id="pdvLado"></div></aside></div>`;
}
function pdvResultados() {
  const d = dados(), q = norm($('#pdvBusca') ? $('#pdvBusca').value : '');
  let l = d.produtos; if (pdv.cat === 'produto') l = l.filter(p => p.kind !== 'service'); if (pdv.cat === 'serviço') l = l.filter(p => p.kind === 'service');
  if (q) l = l.filter(p => norm([p.id, p.d, p.description, arr(p.b).join(' ')].join(' ')).includes(q));
  const tot = l.length; l = l.slice(0, 60);
  $('#pdvRes').classList.toggle('lista', pdv.view === 'lista');
  $('#pdvRes').innerHTML = l.length ? l.map(p => `<button class="pcard" data-add="${esc(p.id)}">${miniatura(p, 'pcard-foto')}<span class="pcard-nome">${esc(p.d || p.description || 'Item sem descrição')}</span><span class="pcard-rod"><b>${brl(p.p)}</b><small>${p.kind === 'service' ? 'serviço' : 'estoque ' + esc(p.q)}</small></span></button>`).join('') + (tot > l.length ? `<p class="mais">Mostrando ${l.length} de ${tot}. Refine a busca.</p>` : '') : `<div class="vazio-bloco">${ic('box')}<b>${d.produtos.length ? 'Nada encontrado' : 'Nenhum produto cadastrado'}</b><small>${d.produtos.length ? 'Tente outro termo.' : 'Cadastre produtos ou importe uma nota (XML) em Produtos.'}</small></div>`;
}
function pdvAdd(p) {
  const i = pdv.itens.find(x => String(x.id) === String(p.id));
  if (i) i.q = (Number(i.q) || 0) + 1; else pdv.itens.push({ id: p.id, d: p.d || p.description || '', q: 1, p: Number(p.p) || 0, kind: p.kind || 'product', serviceType: p.serviceType || 'fixed', unit: p.unit || 'un', img: p.img || '' });
  renderPdvLado();
}
function renderPdvLado() {
  const d = dados(), t = totaisItens(pdv.itens, pdv.desc, pdv.tipo), el = $('#pdvLado'); if (!el) return;
  el.innerHTML = `<label class="f"><span>Cliente</span><input id="pdvCli" list="pdvClis" value="${esc(pdv.cli)}" placeholder="Opcional (obrigatório se ficar a receber)" autocomplete="off"><datalist id="pdvClis">${d.clientes.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist></label>
  <div class="carrinho">${pdv.itens.length ? pdv.itens.map((i, n) => `<div class="citem">${miniatura(i, 'cthumb')}<div class="cinfo"><b>${esc(i.d)}</b><small>${esc(i.id || '')}</small></div>
    <div class="qtd"><button data-q="${n}" data-dq="-1" aria-label="Menos">${ic('minus')}</button><input data-i="${n}" data-c="q" value="${esc(i.q)}" inputmode="decimal" aria-label="Quantidade"><button data-q="${n}" data-dq="1" aria-label="Mais">${ic('plus')}</button></div>
    <input class="cpreco" data-i="${n}" data-c="p" value="${esc(moeda(i.p))}" inputmode="decimal" aria-label="Preço unitário"><b class="ctot" id="pdvT${n}">${brl((Number(i.q) || 0) * (Number(i.p) || 0))}</b><button class="x" data-rm="${n}" aria-label="Remover">${ic('x')}</button></div>`).join('') : `<div class="vazio-bloco">${ic('cart')}<b>Carrinho vazio</b><small>Clique em um produto ou leia o código de barras.</small></div>`}</div>
  <div class="pdv-rodape"><div class="pdv-desc"><span>Desconto</span><input id="pdvDesc" value="${esc(pdv.desc || '')}" inputmode="decimal" placeholder="0"><select id="pdvTipo"><option value="%" ${pdv.tipo === '%' ? 'selected' : ''}>%</option><option value="R$" ${pdv.tipo !== '%' ? 'selected' : ''}>R$</option></select></div>
  <div class="linha-tot"><span>Subtotal</span><b id="pdvSub">${brl(t.sub)}</b></div><div class="linha-tot grande"><span>Total</span><b id="pdvTotal">${brl(t.total)}</b></div>
  <div class="pdv-acoes"><button class="btn" data-act="pdvSalvar">${ic('save')}Salvar pedido<kbd>F8</kbd></button><button class="btn pri" data-act="pdvFechar" ${pdv.itens.length ? '' : 'disabled'}>${ic('check')}Cobrar<kbd>F9</kbd></button></div></div>`;
}
function atualizaTotaisPdv() { const t = totaisItens(pdv.itens, pdv.desc, pdv.tipo); $('#pdvSub').textContent = brl(t.sub); $('#pdvTotal').textContent = brl(t.total); pdv.itens.forEach((i, n) => { const e = $('#pdvT' + n); if (e) e.textContent = brl((Number(i.q) || 0) * (Number(i.p) || 0)); }); }
function ligarPdv() {
  const busca = $('#pdvBusca'), conteudo = $('#conteudo'); pdvResultados(); renderPdvLado(); busca.focus();
  busca.oninput = pdvResultados;
  busca.onkeydown = e => {
    if (e.key !== 'Enter') return; e.preventDefault(); const q = norm(busca.value.trim()); if (!q) return;
    const d = dados(), exato = d.produtos.find(p => norm(p.id) === q || arr(p.b).some(b => norm(b) === q)), un = !exato && $$('#pdvRes .pcard').length === 1 ? d.produtos.find(p => String(p.id) === $('#pdvRes .pcard').dataset.add) : null, p = exato || un;
    if (p) { pdvAdd(p); busca.value = ''; pdvResultados(); } else toast('Nenhum item com esse código. Confira ou refine a busca.', 'erro');
  };
  $('#pdvView').onclick = e => { const b = e.target.closest('[data-view]'); if (!b) return; pdv.view = b.dataset.view; $$('#pdvView button').forEach(x => x.classList.toggle('on', x === b)); pdvResultados(); };
  $('#pdvCat').onclick = e => { const b = e.target.closest('[data-cat]'); if (!b) return; pdv.cat = b.dataset.cat; $$('#pdvCat button').forEach(x => x.classList.toggle('on', x === b)); pdvResultados(); };
  conteudo.onclick = e => {
    const a = e.target.closest('[data-add]'); if (a) { const p = dados().produtos.find(x => String(x.id) === a.dataset.add); if (p) pdvAdd(p); return; }
    const q = e.target.closest('[data-q]'); if (q) { const i = pdv.itens[+q.dataset.q]; i.q = Math.max(0, (Number(i.q) || 0) + (+q.dataset.dq)); if (i.q <= 0) pdv.itens.splice(+q.dataset.q, 1); renderPdvLado(); return; }
    const r = e.target.closest('[data-rm]'); if (r) { pdv.itens.splice(+r.dataset.rm, 1); renderPdvLado(); return; }
    const ac = e.target.closest('[data-act]'); if (!ac) return; const k = ac.dataset.act;
    if (k === 'pdvLimpar') { pdv.itens = []; pdv.desc = 0; renderPdvLado(); } else if (k === 'pdvSalvar') salvarOrcamento(false); else if (k === 'pdvFechar') salvarOrcamento(true);
  };
  conteudo.oninput = e => {
    const t = e.target; if (t.id === 'pdvCli') { pdv.cli = t.value; return; } if (t.id === 'pdvDesc') { pdv.desc = numeroBR(t.value); atualizaTotaisPdv(); return; }
    if (t.dataset && t.dataset.i != null) { const i = pdv.itens[+t.dataset.i]; i[t.dataset.c] = numeroBR(t.value); atualizaTotaisPdv(); }
  };
  conteudo.onchange = e => { if (e.target.id === 'pdvTipo') { pdv.tipo = e.target.value; atualizaTotaisPdv(); } if (e.target.classList.contains('cpreco')) e.target.value = moeda(numeroBR(e.target.value)); };
}
function snapshotPdv() { const t = totaisItens(pdv.itens, pdv.desc, pdv.tipo); return { cli: pdv.cli.trim(), desc: pdv.desc, tipo: pdv.tipo, obs: pdv.obs, itens: pdv.itens.map(i => ({ ...i, q: Number(i.q) || 0, p: Number(i.p) || 0 })), subtotal: t.sub, desconto: t.d, total: t.total, tipoRegistro: 'orcamento' }; }
function salvarOrcamento(cobrar) {
  if (!pdv.itens.length) return toast('Adicione produtos antes de salvar.', 'erro');
  if (pdv.itens.some(i => !(Number(i.q) > 0))) return toast('Há item com quantidade zero.', 'erro');
  const snap = snapshotPdv(), d = dados(); let num;
  if (pdv.edit != null && d.pedidos.some(o => Number(o.numero) === Number(pdv.edit))) {
    num = Number(pdv.edit); const ex = vendaDoPedido(d, num);
    if (ex && vendaTemRecebimento(ex)) { return toast('Este pedido já tem recebimento. Desfaça-o em A receber para alterar os itens.', 'erro'); }
    gravarChave('ven_orcamentosSalvos', d.pedidos.map(o => Number(o.numero) === num ? { ...o, ...snap, numero: num, tipoRegistro: ex ? 'venda_pendente' : 'orcamento', atualizado: new Date().toISOString() } : o));
  } else { num = proxNum('ven_ultimoNumeroOrcamento'); gravarChave('ven_ultimoNumeroOrcamento', num); gravarChave('ven_orcamentosSalvos', [{ numero: num, data: new Date().toISOString(), ...snap }, ...d.pedidos]); }
  pdv = null;
  if (cobrar) { irPara('pedidos'); fecharVendaModal(num); } else { toast('Pedido ' + numPed(num) + ' salvo.'); irPara('pedidos'); }
}

/* ===== Cobrança com várias formas de pagamento ===== */
function fecharVendaModal(num) {
  const d = dados(), o = d.pedidos.find(x => Number(x.numero) === Number(num)); if (!o) return; const ex = vendaDoPedido(d, num);
  const total = totaisItens(o.itens, o.desc, o.tipo).total; let linhas = [{ forma: 'PIX', valor: total, parc: 1, entregue: 0 }];
  const el = modal({
    titulo: 'Cobrar · ' + numPed(num), sub: `${o.cli || 'Sem cliente'} · ${arr(o.itens).length} item(ns)`, icone: 'wallet', tamanho: 'lg',
    corpo: `<div class="pg"><div class="pg-total"><span>Total da venda</span><b>${brl(total)}</b></div>
      <div class="pg-add"><span>Adicionar forma de pagamento</span><div class="chips" id="pgChips">${FORMAS.map(f => `<button type="button" data-f="${esc(f.id)}">${ic(f.icone)}${esc(f.rot)}</button>`).join('')}</div></div>
      <div id="pgLinhas" class="pg-linhas"></div><div id="pgResumo" class="pg-resumo"></div>
      <div class="fgrid g6" style="margin-top:14px">${campo('Data da venda', 'fData', hojeISO(), 'type="date"', 'c2')}<label class="f c2 oculto" id="pgVencBox"><span>Vencimento do restante</span><input id="fVenc" type="date"></label>${campo('Observações (opcional)', 'fObs', ex ? ex.observacoes : '', 'maxlength="300"', 'c6')}</div></div>`,
    aoAbrir: el => {
      const L = el.querySelector('#pgLinhas'), R = el.querySelector('#pgResumo');
      const soma = () => r2(linhas.reduce((a, l) => a + (Number(l.valor) || 0), 0));
      const resumo = () => {
        const s = soma(), falta = r2(total - s), troco = linhas.filter(l => l.forma === 'Dinheiro' && l.entregue > l.valor).reduce((a, l) => a + (l.entregue - l.valor), 0);
        el.querySelector('#pgVencBox').classList.toggle('oculto', falta <= 0.009);
        R.innerHTML = `<div class="r"><span>Recebido agora</span><b class="pos">${brl(Math.min(s, total))}</b></div>` + (falta > 0.009 ? `<div class="r aviso-r"><span>Fica a receber</span><b class="neg">${brl(falta)}</b></div>` : '') + (falta < -0.009 ? `<div class="r"><span>Passou do total em</span><b class="neg">${brl(-falta)}</b></div>` : '') + (troco > 0 ? `<div class="r"><span>Troco</span><b>${brl(troco)}</b></div>` : '');
      };
      const desenhar = () => {
        L.innerHTML = linhas.map((l, n) => { const f = FORMAS.find(x => x.id === l.forma) || FORMAS[0]; return `<div class="pg-linha"><span class="pg-ico">${ic(f.icone)}</span><div class="pg-nome"><b>${esc(f.id)}</b>${l.forma === 'Cartão de crédito' ? `<select data-n="${n}" data-c="parc">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${Number(l.parc) === i + 1 ? 'selected' : ''}>${i + 1}x${l.valor > 0 ? ' de ' + brl(l.valor / (i + 1)) : ''}</option>`).join('')}</select>` : ''}</div>
          <label class="pg-val"><span>Valor</span><input data-n="${n}" data-c="valor" data-moeda inputmode="decimal" value="${moeda(l.valor)}"></label>${l.forma === 'Dinheiro' ? `<label class="pg-val"><span>Cliente deu</span><input data-n="${n}" data-c="entregue" data-moeda inputmode="decimal" placeholder="${moeda(l.valor)}" value="${l.entregue ? moeda(l.entregue) : ''}"></label>` : ''}
          <button type="button" class="x" data-del="${n}" aria-label="Remover" ${linhas.length > 1 ? '' : 'disabled'}>${ic('x')}</button></div>`; }).join('') + (linhas.length ? '' : '<p class="mut">Nenhuma forma escolhida: a venda inteira fica a receber.</p>');
        resumo();
      };
      const falta = () => Math.max(0, r2(total - soma()));
      el.querySelector('#pgChips').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; linhas.push({ forma: b.dataset.f, valor: falta(), parc: 1, entregue: 0 }); desenhar(); const ins = L.querySelectorAll('input[data-c=valor]'); if (ins.length) ins[ins.length - 1].select(); };
      L.addEventListener('input', e => { const t = e.target, l = linhas[+t.dataset.n]; if (!l || t.tagName !== 'INPUT') return; l[t.dataset.c] = numeroBR(t.value); if (t.dataset.c === 'valor') { l.manual = true; if (+t.dataset.n > 0 && linhas[0] && !linhas[0].manual) { linhas[0].valor = Math.max(0, r2(total - linhas.slice(1).reduce((a, x) => a + (Number(x.valor) || 0), 0))); const i0 = L.querySelector('input[data-n="0"][data-c="valor"]'); if (i0) i0.value = moeda(linhas[0].valor); } } resumo(); });
      L.addEventListener('change', e => { const t = e.target, l = linhas[+t.dataset.n]; if (!l) return; if (t.dataset.c !== 'parc') return; l.parc = Number(t.value) || 1; desenhar(); });
      L.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b || b.disabled) return; linhas.splice(+b.dataset.del, 1); desenhar(); });
      el._linhas = () => linhas; desenhar();
    },
    botoes: [{ t: 'Cancelar' }, { t: 'Deixar tudo a receber', suave: true, fn: el => registrarVenda(el, o, ex, total, []) }, { t: 'Concluir venda', pri: true, icone: 'check', fn: el => registrarVenda(el, o, ex, total, el._linhas()) }]
  });
}
function registrarVenda(el, o, ex, total, linhas) {
  const validas = linhas.filter(l => Number(l.valor) > 0), soma = r2(validas.reduce((a, l) => a + Number(l.valor), 0));
  if (soma > total + 0.009) { toast('Os valores somam mais que o total da venda.', 'erro'); return false; }
  const dt = V(el, 'fData') || hojeISO(), falta = r2(total - soma);
  if (dt > hojeISO() && soma > 0) { toast('A data da venda com recebimento não pode ser futura.', 'erro'); return false; }
  const d = dados(), c = d.clientes.find(x => norm(x.nome) === norm(o.cli));
  if (falta > 0.009 && !o.cli) { toast('Para deixar valor a receber, informe o cliente no pedido.', 'erro'); return false; }
  const venc = falta > 0.009 ? V(el, 'fVenc') : '', n = ex ? Number(ex.numero) : proxNum('ven_ultimoNumeroVenda'); if (!ex) gravarChave('ven_ultimoNumeroVenda', n);
  const pagamentos = validas.map(l => ({ data: dt + 'T12:00:00', valor: r2(Number(l.valor)), forma: rotuloForma(l.forma, l.parc), ...(l.forma === 'Dinheiro' && l.entregue > l.valor ? { entregue: r2(l.entregue), troco: r2(l.entregue - l.valor) } : {}) }));
  const formas = [...new Set(validas.map(l => l.forma))], st = falta <= 0.009 ? 'paid' : (soma > 0 ? 'partial' : 'pending');
  const v = { ...(ex || {}), numero: n, orcamentoNumero: o.numero, data: dt + 'T12:00:00', vencimento: venc || '', clienteId: c ? c.id : '', clienteNome: c ? c.nome : (o.cli || ''), clienteSnapshot: c ? { ...c } : null, pagamento: formas.length ? (formas.length > 1 ? formas.join(' + ') : pagamentos[0].forma) : 'A receber', status: st, recebido: Math.min(soma, total), total, pagamentos, termos: '', observacoes: V(el, 'fObs').trim(), itens: arr(o.itens).map(i => ({ ...i })), empresaSnapshot: lerChave('ven_empresa', {}) };
  if (st === 'paid') v.pagoEm = dt + 'T12:00:00'; else delete v.pagoEm;
  gravarChave('ven_vendas', ex ? d.vendas.map(x => Number(x.numero) === n ? v : x) : [v, ...d.vendas]);
  gravarChave('ven_orcamentosSalvos', d.pedidos.map(x => Number(x.numero) === Number(o.numero) ? { ...x, tipoRegistro: 'venda_fechada', vendaNumero: n, atualizado: new Date().toISOString() } : x));
  el._fechar(); render(); posVenda(v); return false;
}
function posVenda(v) {
  const doc = docDeVenda(v), saldo = saldoVenda(v), troco = arr(v.pagamentos).reduce((a, p) => a + (Number(p.troco) || 0), 0);
  const el = modal({
    titulo: 'Venda ' + numPed(v.numero) + ' registrada', icone: 'check', tamanho: 'sm',
    corpo: `<div class="sucesso"><div class="ok-ico">${ic('check')}</div><b>${brl(v.total)}</b><span>${saldo > 0 ? 'Recebido ' + brl(v.recebido) + ' · a receber ' + brl(saldo) : 'Pagamento completo'}</span>${troco > 0 ? `<span class="troco">Troco: <b>${brl(troco)}</b></span>` : ''}</div>
      <div class="pos-acoes"><button class="btn pri grande" id="pvImp">${ic('print')}Imprimir ${cfg.impressao.formato === 'a4' ? 'recibo A4' : 'cupom'}</button><button class="btn" id="pvPdf">${ic('file')}Salvar PDF</button><button class="btn" id="pvZap">${ic('whatsapp')}WhatsApp</button></div>`,
    aoAbrir: el => {
      el.querySelector('#pvImp').onclick = () => imprimirDoc(doc); el.querySelector('#pvPdf').onclick = () => salvarPdfDoc(doc);
      el.querySelector('#pvZap').onclick = () => { const u = whatsUrl(doc.cliente && doc.cliente.telefone, textoWhatsDoc(doc)); if (u) abrirExterno(u); else { navigator.clipboard && navigator.clipboard.writeText(textoWhatsDoc(doc)); toast('Cliente sem WhatsApp válido. Texto copiado.'); } };
      el.querySelector('#pvImp').focus();
    },
    botoes: [{ t: 'Concluir' }, { t: 'Nova venda', pri: true, icone: 'plus', fn: () => { setTimeout(() => abrirPdv(), 0); } }]
  });
}

/* ===== Pedidos e vendas ===== */
function verPedido(tipo, num) {
  const d = dados(), v = tipo === 'venda' ? d.vendas.find(x => Number(x.numero) === Number(num)) : null, o = tipo === 'orc' ? d.pedidos.find(x => Number(x.numero) === Number(num)) : (v ? pedidoDaVenda(d, v) : null);
  const base = v || o; if (!base) return; const itens = arr(base.itens), t = v ? { sub: totaisItens(itens, 0).sub, total: Number(v.total) || 0 } : totaisItens(itens, o.desc, o.tipo), doc = v ? docDeVenda(v) : docDePedido(o);
  const mov = v ? (arr(v.pagamentos).map(p => `<div class="row"><span>${dataBR(String(p.data).slice(0, 10))} · ${esc(p.forma || '')}</span><b>${brl(p.valor)}</b></div>`).join('') || (Number(v.recebido) > 0 ? `<div class="row"><span>Recebido na venda</span><b>${brl(v.recebido)}</b></div>` : '')) : '';
  const bt = [{ t: 'Fechar' }, { t: 'Imprimir', icone: 'print', suave: true, fn: () => { menuImprimir(document.activeElement, doc); return false; } }];
  if (v) { if (saldoVenda(v) > 0.009) bt.push({ t: 'Receber', pri: true, icone: 'receber', fn: () => { setTimeout(() => receberVenda(v.numero), 0); } }); }
  else { bt.push({ t: 'Editar', fn: () => { setTimeout(() => abrirPdv(o.numero), 0); } }); bt.push({ t: 'Cobrar', pri: true, icone: 'wallet', fn: () => { setTimeout(() => fecharVendaModal(o.numero), 0); } }); }
  modal({
    titulo: (v ? 'Venda ' : 'Pedido ') + numPed(base.numero), sub: (v ? v.clienteNome : o.cli) || 'Sem cliente', icone: 'receipt', tamanho: 'lg',
    corpo: `<table class="tab-mini"><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead><tbody>${itens.map(i => `<tr><td>${esc(i.d)}</td><td class="num">${esc(i.q)}</td><td class="num">${brl(i.p)}</td><td class="num">${brl((Number(i.q) || 0) * (Number(i.p) || 0))}</td></tr>`).join('')}</tbody></table>
    <div class="lista-linhas"><div class="row"><span>Total</span><b>${brl(t.total)}</b></div>${v ? `<div class="row"><span>Recebido</span><b class="pos">${brl(v.recebido)}</b></div><div class="row"><span>Saldo</span><b class="${saldoVenda(v) > 0 ? 'neg' : ''}">${brl(saldoVenda(v))}</b></div>${v.vencimento && saldoVenda(v) > 0 ? `<div class="row"><span>Vencimento</span><b>${dataBR(v.vencimento)}</b></div>` : ''}` : ''}</div>${mov ? `<h4 class="sub-tit">Recebimentos</h4><div class="lista-linhas">${mov}</div>` : ''}`,
    botoes: bt
  });
}
function reabrirVenda(num) {
  const d = dados(), v = d.vendas.find(x => Number(x.numero) === Number(num)); if (!v) return;
  if (vendaTemRecebimento(v)) return toast('Esta venda tem recebimentos. Desfaça-os antes de reabrir.', 'erro');
  confirmar('Reabrir como pedido?', 'A venda sai de A receber e o pedido volta para edição.', () => {
    gravarChave('ven_vendas', d.vendas.filter(x => Number(x.numero) !== Number(num)));
    gravarChave('ven_orcamentosSalvos', d.pedidos.map(o => Number(o.numero) === Number(v.orcamentoNumero) ? { ...o, tipoRegistro: 'orcamento', vendaNumero: undefined } : o)); toast('Pedido reaberto.'); render();
  }, 'Reabrir');
}
function excluirPedido(tipo, num) {
  const d = dados(), v = tipo === 'venda' ? d.vendas.find(x => Number(x.numero) === Number(num)) : vendaDoPedido(d, num);
  if (v && vendaTemRecebimento(v)) return toast('Esta venda tem recebimentos. Desfaça-os antes de excluir.', 'erro');
  const on = tipo === 'venda' ? (v && v.orcamentoNumero) : num;
  confirmar('Excluir ' + (tipo === 'venda' ? 'venda' : 'pedido') + '?', 'O registro será removido, inclusive a cobrança em A receber.', () => {
    gravarChave('ven_vendas', d.vendas.filter(x => !v || Number(x.numero) !== Number(v.numero)));
    gravarChave('ven_orcamentosSalvos', d.pedidos.filter(o => Number(o.numero) !== Number(on))); toast('Excluído.'); render();
  }, 'Excluir', true);
}
