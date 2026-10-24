'use strict';
/* ===== Clientes ===== */
function formCliente(id) {
  const d = dados(), c = id ? d.clientes.find(x => String(x.id) === String(id)) : null;
  const nasc = c && c.nascimento ? dataBR(c.nascimento) : '';
  modal({
    titulo: c ? 'Editar cliente' : 'Novo cliente', largo: true,
    corpo: `<div class="fgrid">${campo('Nome *', 'cNome', c && c.nome, '', 'full')}${campo('CPF/CNPJ', 'cDoc', c && c.doc)}${campo('Telefone / WhatsApp', 'cTel', c && c.telefone)}${campo('E-mail', 'cMail', c && c.email)}${campo('Nascimento (dd/mm/aaaa)', 'cNasc', nasc)}${campo('Endereço', 'cEnd', c && (c.address || ''), '', 'full')}${campo('Observações', 'cObs', c && c.notes, '', 'full')}</div>`,
    botoes: [{ t: 'Cancelar' }, {
      t: 'Salvar', pri: true, fn: el => {
        const nome = V(el, 'cNome').trim(); if (!nome) { toast('Informe o nome do cliente.', true); return false; }
        const nt = V(el, 'cNasc').trim(); if (nt && !parseData(nt)) { toast('Data de nascimento inválida.', true); return false; }
        const obj = { ...(c || {}), id: c ? c.id : 'CLI-' + Date.now(), nome, doc: V(el, 'cDoc').trim(), telefone: V(el, 'cTel').trim(), email: V(el, 'cMail').trim(), nascimento: parseData(nt), address: V(el, 'cEnd').trim(), notes: V(el, 'cObs').trim(), atualizado: new Date().toISOString() };
        const l = dados().clientes; gravarChave('ven_clientes', c ? l.map(x => String(x.id) === String(c.id) ? obj : x) : [...l, obj]); toast('Cliente salvo.'); render();
      }
    }]
  });
}
function excluirCliente(id) { const c = dados().clientes.find(x => String(x.id) === String(id)); if (!c) return; confirmar('Excluir cliente?', `${c.nome} será removido. Vendas já feitas continuam no histórico.`, () => { gravarChave('ven_clientes', dados().clientes.filter(x => String(x.id) !== String(id))); toast('Cliente excluído.'); render(); }, 'Excluir', true); }

/* ===== Produtos ===== */
function formProduto(id) {
  const d = dados(), p = id ? d.produtos.find(x => String(x.id) === String(id)) : null;
  const usados = new Set(d.produtos.map(x => String(x.id).toUpperCase()));
  let n = 1, cod; do { cod = 'MAN-' + String(n++).padStart(4, '0'); } while (usados.has(cod));
  modal({
    titulo: p ? 'Editar item' : 'Novo produto ou serviço', largo: true,
    corpo: `<div class="fgrid">${selecao('Tipo', 'pTipo', [['product', 'Produto'], ['service', 'Serviço']], p ? (p.kind === 'service' ? 'service' : 'product') : 'product')}${campo('Código', 'pCod', p ? p.id : cod, p ? 'disabled' : '')}${campo('Descrição *', 'pDesc', p && p.d, '', 'full')}${campo('Preço de venda (R$)', 'pPreco', p ? moeda(p.p) : '')}${campo('Custo (R$)', 'pCusto', p && p.c ? moeda(p.c) : '')}${campo('Estoque', 'pEst', p ? p.q : '', 'inputmode="numeric"')}${campo('Unidade', 'pUn', p ? p.unit : 'un')}${campo('Código de barras', 'pBar', p && arr(p.b)[0])}${campo('NCM (8 números)', 'pNcm', p && p.ncm, 'maxlength="10" inputmode="numeric"')}</div>`,
    botoes: [{ t: 'Cancelar' }, {
      t: 'Salvar', pri: true, fn: async el => {
        const desc = V(el, 'pDesc').trim(); if (!desc) { toast('Informe a descrição.', true); return false; }
        const kind = V(el, 'pTipo'), ncm = V(el, 'pNcm').replace(/\D/g, '');
        if (kind !== 'service' && ncm.length !== 8 && !el._ncmOk) { toast(ncm ? 'O NCM tem 8 números e este tem ' + ncm.length + '. Clique em Salvar de novo para gravar assim mesmo.' : 'Produto sem NCM. Clique em Salvar de novo para gravar assim mesmo.', true); el._ncmOk = true; return false; }
        const obj = { ...(p || {}), id: p ? p.id : V(el, 'pCod').trim() || cod, d: desc, description: p ? p.description || '' : '', p: numeroBR(V(el, 'pPreco')), c: numeroBR(V(el, 'pCusto')), q: Number(V(el, 'pEst')) || 0, unit: V(el, 'pUn').trim() || 'un', b: V(el, 'pBar').trim() ? [V(el, 'pBar').trim()] : [], kind, serviceType: p ? p.serviceType || 'fixed' : 'fixed', ncm: kind === 'service' ? '' : ncm, manual: p ? !!p.manual : true, key: p ? p.key : (V(el, 'pCod').trim() || cod) };
        const dd = dados();
        if (p && !p.manual) gravarCatalogo(dd.catalogo.map(x => String(x.id) === String(p.id) ? obj : x));
        else gravarChave('ven_produtosManuais', p ? dd.manuais.map(x => String(x.id) === String(p.id) ? obj : x) : [...dd.manuais, obj]);
        toast('Item salvo.'); render();
      }
    }]
  });
}
function excluirProduto(id) { const p = dados().produtos.find(x => String(x.id) === String(id)); if (!p) return; confirmar('Excluir item?', `${p.d} será removido do catálogo.`, () => { const dd = dados(); if (p.manual) gravarChave('ven_produtosManuais', dd.manuais.filter(x => String(x.id) !== String(id))); else gravarCatalogo(dd.catalogo.filter(x => String(x.id) !== String(id))); toast('Item excluído.'); render(); }, 'Excluir', true); }

/* ===== Contas a pagar ===== */
function formConta(id) {
  const l = dados().pagar, c = id ? l.find(x => String(x.id) === String(id)) : null;
  const forn = [...new Set(l.map(x => x.fornecedor).filter(Boolean))];
  modal({
    titulo: c ? 'Editar conta' : 'Nova conta a pagar', largo: true,
    corpo: `<div class="fgrid">${campo('Descrição *', 'aDesc', c && c.descricao, '', 'full')}${campo('Valor (R$) *', 'aValor', c ? moeda(c.valor) : '')}${campo('Vencimento * (dd/mm/aaaa)', 'aVenc', c ? dataBR(c.vencimento) : '')}${campo('Fornecedor', 'aForn', c && c.fornecedor, 'list="fornList"')}<datalist id="fornList">${forn.map(f => `<option value="${esc(f)}">`).join('')}</datalist>${selecao('Categoria', 'aCat', CATEGORIAS, c ? c.categoria : 'Outros')}${campo('Observações', 'aObs', c && c.obs, '', 'full')}${c ? '' : `${selecao('Repetição', 'aRep', [['u', 'Conta única'], ['p', 'Parcelada'], ['m', 'Todo mês']], 'u')}${campo('Quantas vezes?', 'aQtd', '12', 'inputmode="numeric"')}<label class="f full chk"><input type="checkbox" id="aPaga"> <span>Esta conta já foi paga</span></label>`}</div>`,
    aoAbrir: el => { const r = el.querySelector('#aRep'); if (r) { const t = () => { el.querySelector('#aQtd').closest('label').style.display = r.value === 'u' ? 'none' : ''; }; r.onchange = t; t(); } },
    botoes: [{ t: 'Cancelar' }, {
      t: 'Salvar', pri: true, fn: el => {
        const desc = V(el, 'aDesc').trim(), valor = numeroBR(V(el, 'aValor')), venc = parseData(V(el, 'aVenc'));
        if (!desc) { toast('Informe a descrição.', true); return false; } if (!(valor > 0)) { toast('Informe um valor maior que zero.', true); return false; } if (!venc) { toast('Informe o vencimento (dd/mm/aaaa).', true); return false; }
        const base = { descricao: desc, fornecedor: V(el, 'aForn').trim(), categoria: V(el, 'aCat'), valor: r2(valor), obs: V(el, 'aObs').trim() };
        const dd = dados().pagar;
        if (c) { gravarChave('ven_contasPagar', dd.map(x => String(x.id) === String(c.id) ? { ...x, ...base, vencimento: venc } : x)); toast('Conta atualizada.'); return render(); }
        const rep = V(el, 'aRep'), qtd = rep === 'u' ? 1 : Math.max(2, Math.min(60, Number(V(el, 'aQtd')) || 2)), nova = [];
        for (let i = 0; i < qtd; i++) { const x = { id: novoId(), ...base, descricao: qtd > 1 && rep === 'p' ? `${desc} (${i + 1}/${qtd})` : desc, vencimento: i ? somaMes(venc, i) : venc, status: 'pendente', criado: new Date().toISOString() }; if (V(el, 'aPaga') && i === 0) { x.status = 'paga'; x.pagoEm = hojeISO(); x.valorPago = x.valor; } nova.push(x); }
        gravarChave('ven_contasPagar', [...dd, ...nova]); toast(qtd > 1 ? qtd + ' contas lançadas.' : 'Conta lançada.'); render();
      }
    }]
  });
}
function pagarConta(id) {
  const c = dados().pagar.find(x => String(x.id) === String(id)); if (!c) return;
  modal({
    titulo: 'Registrar pagamento', sub: `${c.descricao || c.fornecedor} · vence ${dataBR(c.vencimento)}`,
    corpo: `<div class="fgrid">${campo('Valor pago (R$)', 'gVal', moeda(c.valor))}${campo('Data do pagamento', 'gData', dataBR(hojeISO()))}${selecao('Forma', 'gForma', FORMAS, 'PIX', 'full')}</div><p class="mut small">Se pagou com juros ou desconto, altere o valor pago. O valor original da conta continua registrado.</p>`,
    botoes: [{ t: 'Cancelar' }, { t: 'Confirmar pagamento', pri: true, fn: el => { const v = numeroBR(V(el, 'gVal')), dt = parseData(V(el, 'gData')); if (!(v > 0)) { toast('Informe o valor pago.', true); return false; } if (!dt) { toast('Data inválida.', true); return false; } gravarChave('ven_contasPagar', dados().pagar.map(x => String(x.id) === String(id) ? { ...x, status: 'paga', pagoEm: dt, valorPago: r2(v), formaPgto: V(el, 'gForma') } : x)); toast('Pagamento registrado.'); render(); } }]
  });
}
function desfazerPagamento(id) { gravarChave('ven_contasPagar', dados().pagar.map(x => { if (String(x.id) !== String(id)) return x; const y = { ...x, status: 'pendente' }; delete y.pagoEm; delete y.valorPago; delete y.formaPgto; return y; })); toast('Pagamento desfeito.'); render(); }
function excluirConta(id) { const c = dados().pagar.find(x => String(x.id) === String(id)); if (!c) return; confirmar('Excluir conta?', `${c.descricao || c.fornecedor} será removida.`, () => { gravarChave('ven_contasPagar', dados().pagar.filter(x => String(x.id) !== String(id))); toast('Conta excluída.'); render(); }, 'Excluir', true); }

/* ===== Contas a receber ===== */
function receberVenda(num) {
  const v = dados().vendas.find(x => Number(x.numero) === Number(num)); if (!v) return; const s = saldoVenda(v); if (s <= 0) return toast('Esta venda já está quitada.', true);
  modal({
    titulo: 'Receber · Venda #' + pad(v.numero), sub: `${v.clienteNome || 'Sem cliente'} · saldo ${brl(s)}`,
    corpo: `<div class="fgrid">${campo('Valor recebido (R$)', 'rVal', moeda(s))}${campo('Data', 'rData', dataBR(hojeISO()))}${selecao('Forma', 'rForma', FORMAS, v.pagamento || 'PIX')}${campo('Novo vencimento do restante (opcional)', 'rVenc', '', 'placeholder="dd/mm/aaaa"')}</div>`,
    botoes: [{ t: 'Cancelar' }, {
      t: 'Registrar', pri: true, fn: el => {
        const val = r2(numeroBR(V(el, 'rVal'))), iso = parseData(V(el, 'rData'));
        if (val <= 0) { toast('Informe um valor maior que zero.', true); return false; } if (val > s + 0.001) { toast('O valor é maior que o saldo da venda.', true); return false; } if (!iso) { toast('Data inválida.', true); return false; } if (iso > hojeISO()) { toast('A data do recebimento não pode ser futura.', true); return false; }
        const nv = parseData(V(el, 'rVenc'));
        gravarChave('ven_vendas', dados().vendas.map(x => { if (Number(x.numero) !== Number(num)) return x; const y = { ...x }; y.recebido = r2((Number(y.recebido) || 0) + val); y.pagamentos = arr(y.pagamentos).concat([{ data: iso + 'T12:00:00', valor: val, forma: V(el, 'rForma') }]); if (saldoVenda(y) <= 0) { y.status = 'paid'; y.recebido = y.total; y.pagoEm = iso + 'T12:00:00'; } else { y.status = 'partial'; if (val < s - 0.001 && nv) y.vencimento = nv; } return y; }));
        toast('Recebimento registrado.'); render();
      }
    }]
  });
}
function desfazerRecebimento(num) {
  gravarChave('ven_vendas', dados().vendas.map(x => {
    if (Number(x.numero) !== Number(num)) return x; const y = { ...x }, p = arr(y.pagamentos).slice(); let val; if (p.length) { val = Number(p.pop().valor) || 0; y.pagamentos = p; } else val = Number(y.recebido) || 0;
    y.recebido = Math.max(0, r2((Number(y.recebido) || 0) - val)); y.status = y.recebido > 0 ? 'partial' : 'pending'; delete y.pagoEm; return y;
  })); toast('Recebimento desfeito.'); render();
}
function formReceita(id) {
  const l = dados().avulso, c = id ? l.find(x => String(x.id) === String(id)) : null;
  modal({
    titulo: c ? 'Editar receita' : 'Nova receita', sub: 'Aluguel, serviços e outras entradas que não vêm de vendas.', largo: true,
    corpo: `<div class="fgrid">${campo('Descrição *', 'eDesc', c && c.descricao, '', 'full')}${campo('Valor (R$) *', 'eVal', c ? moeda(c.valor) : '')}${campo('Vencimento * (dd/mm/aaaa)', 'eVenc', dataBR(c ? c.vencimento : hojeISO()))}${campo('Cliente (opcional)', 'eCli', c && c.cliente, '', 'full')}${c ? '' : `${selecao('Repetição', 'eRep', [['u', 'Única'], ['m', 'Todo mês']], 'u')}${campo('Por quantos meses?', 'eQtd', '12', 'inputmode="numeric"')}`}</div>`,
    aoAbrir: el => { const r = el.querySelector('#eRep'); if (r) { const t = () => { el.querySelector('#eQtd').closest('label').style.display = r.value === 'u' ? 'none' : ''; }; r.onchange = t; t(); } },
    botoes: [{ t: 'Cancelar' }, {
      t: c ? 'Salvar' : 'Adicionar', pri: true, fn: el => {
        const desc = V(el, 'eDesc').trim(), val = r2(numeroBR(V(el, 'eVal'))), venc = parseData(V(el, 'eVenc'));
        if (!desc) { toast('Informe a descrição.', true); return false; } if (!(val > 0)) { toast('Informe um valor maior que zero.', true); return false; } if (!venc) { toast('Informe o vencimento.', true); return false; }
        const dd = dados().avulso;
        if (c) { gravarChave('ven_receberAvulso', dd.map(x => String(x.id) === String(c.id) ? { ...x, descricao: desc, valor: val, vencimento: venc, cliente: V(el, 'eCli').trim() } : x)); toast('Receita atualizada.'); return render(); }
        const rep = V(el, 'eRep'), n = rep === 'u' ? 1 : Math.max(2, Math.min(60, Number(V(el, 'eQtd')) || 12)), sid = novoId(), dia = Number(venc.slice(8)), nova = [];
        for (let i = 0; i < n; i++) { const x = { id: novoId(), descricao: desc, cliente: V(el, 'eCli').trim(), valor: val, vencimento: i ? somaMes(venc, i, dia) : venc, status: 'pendente' }; if (n > 1) x.serie = { id: sid, rec: 'mensal', n, i, dia }; nova.push(x); }
        gravarChave('ven_receberAvulso', [...dd, ...nova]); toast(n > 1 ? n + ' receitas lançadas.' : 'Receita lançada.'); render();
      }
    }]
  });
}
function receberReceita(id) {
  const c = dados().avulso.find(x => String(x.id) === String(id)); if (!c) return;
  modal({
    titulo: 'Receber · ' + c.descricao, corpo: `<div class="fgrid">${campo('Valor recebido (R$)', 'vVal', moeda(c.valor))}${campo('Data', 'vData', dataBR(hojeISO()))}${selecao('Forma', 'vForma', FORMAS, 'PIX', 'full')}</div>`,
    botoes: [{ t: 'Cancelar' }, { t: 'Registrar', pri: true, fn: el => { const v = r2(numeroBR(V(el, 'vVal'))), iso = parseData(V(el, 'vData')); if (!(v > 0)) { toast('Informe um valor maior que zero.', true); return false; } if (!iso) { toast('Data inválida.', true); return false; } gravarChave('ven_receberAvulso', dados().avulso.map(x => String(x.id) === String(id) ? { ...x, status: 'recebida', recebidoEm: iso, valorRecebido: v, forma: V(el, 'vForma') } : x)); toast('Recebimento registrado.'); render(); } }]
  });
}
function desfazerReceita(id) { gravarChave('ven_receberAvulso', dados().avulso.map(x => { if (String(x.id) !== String(id)) return x; const y = { ...x, status: 'pendente' }; delete y.recebidoEm; delete y.valorRecebido; delete y.forma; return y; })); toast('Recebimento desfeito.'); render(); }
function excluirReceita(id) { const c = dados().avulso.find(x => String(x.id) === String(id)); if (!c) return; confirmar('Excluir receita?', `${c.descricao} será removida.`, () => { gravarChave('ven_receberAvulso', dados().avulso.filter(x => String(x.id) !== String(id))); toast('Receita excluída.'); render(); }, 'Excluir', true); }

/* ===== Pedidos / vendas ===== */
function verPedido(tipo, num) {
  const d = dados(), v = tipo === 'venda' ? d.vendas.find(x => Number(x.numero) === Number(num)) : null, o = tipo === 'orc' ? d.pedidos.find(x => Number(x.numero) === Number(num)) : (v ? d.pedidos.find(x => Number(x.numero) === Number(v.orcamentoNumero)) : null);
  const itens = arr((v || o).itens), t = v ? { sub: totaisItens(itens, 0).sub, total: Number(v.total) || 0 } : totaisItens(itens, o.desc, o.tipo);
  const mov = v ? arr(v.pagamentos).map(p => `<div class="row"><span>${dataBR(String(p.data).slice(0, 10))} · ${esc(p.forma || '')}</span><b>${brl(p.valor)}</b></div>`).join('') || (Number(v.recebido) > 0 ? `<div class="row"><span>Recebido na venda</span><b>${brl(v.recebido)}</b></div>` : '') : '';
  const bt = [{ t: 'Fechar' }]; 
  if (v) { bt.push({ t: 'Imprimir recibo', fn: () => { imprimirRecibo(v); return false; } }); if (saldoVenda(v) > 0.009) bt.push({ t: 'Receber', pri: true, fn: () => { setTimeout(() => receberVenda(v.numero), 0); } }); }
  else { bt.push({ t: 'Editar', fn: () => { setTimeout(() => abrirPdv(o.numero), 0); } }); bt.push({ t: 'Fechar venda', pri: true, fn: () => { setTimeout(() => fecharVendaModal(o.numero), 0); } }); }
  modal({
    titulo: (v ? 'Venda #' : 'Orçamento #') + pad((v || o).numero), sub: (v ? v.clienteNome : o.cli) || 'Sem cliente', largo: true,
    corpo: `<table class="mini"><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead><tbody>${itens.map(i => `<tr><td>${esc(i.d)}</td><td class="num">${esc(i.q)}</td><td class="num">${brl(i.p)}</td><td class="num">${brl((Number(i.q) || 0) * (Number(i.p) || 0))}</td></tr>`).join('')}</tbody></table><div class="list" style="margin-top:12px"><div class="row"><span>Total</span><b>${brl(t.total)}</b></div>${v ? `<div class="row"><span>Recebido</span><b class="pos">${brl(v.recebido)}</b></div><div class="row"><span>Saldo</span><b class="${saldoVenda(v) > 0 ? 'neg' : ''}">${brl(saldoVenda(v))}</b></div>${v.vencimento ? `<div class="row"><span>Vencimento</span><b>${dataBR(v.vencimento)}</b></div>` : ''}${mov ? `<h4>Recebimentos</h4>${mov}` : ''}` : ''}</div>`,
    botoes: bt
  });
}
function excluirPedido(tipo, num) {
  const d = dados(), v = tipo === 'venda' ? d.vendas.find(x => Number(x.numero) === Number(num)) : vendaDoPedido(d, num);
  if (v && ((Number(v.recebido) || 0) > 0.009)) return toast('Esta venda tem recebimentos. Desfaça os recebimentos antes de excluir.', true);
  const on = tipo === 'venda' ? v.orcamentoNumero : num;
  confirmar('Excluir ' + (tipo === 'venda' ? 'venda' : 'orçamento') + '?', 'O registro será removido, inclusive a cobrança em Contas a receber.', () => { gravarChave('ven_vendas', d.vendas.filter(x => !v || Number(x.numero) !== Number(v.numero))); gravarChave('ven_orcamentosSalvos', d.pedidos.filter(o => Number(o.numero) !== Number(on))); toast('Excluído.'); render(); }, 'Excluir', true);
}
function imprimirRecibo(v) {
  const e = v.empresaSnapshot || lerChave('ven_empresa', {}) || {};
  $('#imp').innerHTML = `<h2>${esc(e.fantasia || e.nome || 'Empresa')}</h2><div>${e.cnpj ? 'CPF/CNPJ ' + esc(e.cnpj) + ' · ' : ''}${esc(e.end || '')}${e.telefone ? ' · ' + esc(e.telefone) : ''}</div><h2 style="margin-top:20px">RECIBO / COMPROVANTE COMERCIAL Nº ${pad(v.numero)}</h2><p>Data: ${dataBR(String(v.data).slice(0, 10))}</p><p>Recebemos de: <b>${esc(v.clienteNome || 'Cliente não informado')}</b></p><table><thead><tr><th>Produto</th><th class="r">Qtd.</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead><tbody>${arr(v.itens).map(i => `<tr><td>${esc(i.d)}</td><td class="r">${esc(i.q)}</td><td class="r">${brl(i.p)}</td><td class="r">${brl((Number(i.q) || 0) * (Number(i.p) || 0))}</td></tr>`).join('')}</tbody></table><p><b>Total da venda: ${brl(v.total)}</b><br>Forma de pagamento: ${esc(v.pagamento || '')}<br>Recebido: ${brl(v.recebido)}<br>Saldo pendente: ${brl(saldoVenda(v))}</p><p style="margin-top:28px">Documento comercial de controle. Não substitui nota fiscal.</p>`;
  window.venDesktop.imprimir();
}

/* ===== Venda de balcão (PDV) ===== */
let pdv = null;
function abrirPdv(numOrc) {
  const d = dados(), o = numOrc ? d.pedidos.find(x => Number(x.numero) === Number(numOrc)) : null;
  pdv = { edit: o ? o.numero : null, cli: o ? o.cli || '' : '', desc: o ? o.desc || 0 : 0, tipo: o ? o.tipo || '%' : '%', obs: o ? o.obs || '' : '', itens: o ? arr(o.itens).map(i => ({ ...i })) : [], busca: '' };
  tela = 'pdv'; termo = ''; render(); setTimeout(() => { const b = $('#pdvBusca'); b && b.focus(); }, 30);
}
function pdvAdd(p) { const i = pdv.itens.find(x => String(x.id) === String(p.id)); if (i) i.q = (Number(i.q) || 0) + 1; else pdv.itens.push({ id: p.id, d: p.d, q: 1, p: Number(p.p) || 0, kind: p.kind || 'product', serviceType: p.serviceType || 'fixed', unit: p.unit || 'un' }); renderPdvLado(); }
function snapshotPdv() { const t = totaisItens(pdv.itens, pdv.desc, pdv.tipo); return { cli: pdv.cli, desc: pdv.desc, tipo: pdv.tipo, obs: pdv.obs, itens: pdv.itens.map(i => ({ ...i, q: Number(i.q) || 0, p: Number(i.p) || 0 })), subtotal: t.sub, desconto: t.d, total: t.total, tipoRegistro: 'orcamento' }; }
function salvarOrcamento(depois) {
  if (!pdv.itens.length) return toast('Adicione produtos antes de gravar.', true);
  const snap = snapshotPdv(), d = dados(); let num;
  if (pdv.edit != null && d.pedidos.some(o => Number(o.numero) === Number(pdv.edit))) { num = Number(pdv.edit); gravarChave('ven_orcamentosSalvos', d.pedidos.map(o => Number(o.numero) === num ? { ...o, ...snap, numero: num, tipoRegistro: vendaDoPedido(d, num) ? 'venda_pendente' : 'orcamento', atualizado: new Date().toISOString() } : o)); }
  else { num = proxNum('ven_ultimoNumeroOrcamento'); gravarChave('ven_ultimoNumeroOrcamento', num); gravarChave('ven_orcamentosSalvos', [{ numero: num, data: new Date().toISOString(), ...snap }, ...d.pedidos]); }
  pdv = null; toast('Pedido #' + pad(num) + ' salvo.');
  if (depois) { tela = 'pedidos'; render(); fecharVendaModal(num); } else { tela = 'pedidos'; render(); }
}
function fecharVendaModal(num) {
  const d = dados(), o = d.pedidos.find(x => Number(x.numero) === Number(num)); if (!o) return; const ex = vendaDoPedido(d, num);
  const total = totaisItens(o.itens, o.desc, o.tipo).total, c = d.clientes.find(x => norm(x.nome) === norm(o.cli));
  modal({
    titulo: 'Fechar venda · Pedido #' + pad(num), sub: `${o.cli || 'Sem cliente'} · ${brl(total)}`, largo: true,
    corpo: `<div class="fgrid">${selecao('Pagamento', 'fPag', [['paid', 'Recebido total'], ['partial', 'Recebido parcial'], ['pending', 'A receber (fiado/boleto)']], 'paid')}${selecao('Forma', 'fForma', FORMAS, 'PIX')}${campo('Valor recebido (R$)', 'fRec', moeda(total))}${campo('Data da venda', 'fData', dataBR(hojeISO()))}${campo('Vencimento do saldo (opcional)', 'fVenc', '', 'placeholder="dd/mm/aaaa"')}${campo('Observações', 'fObs', '', '', 'full')}</div>`,
    aoAbrir: el => { const s = el.querySelector('#fPag'), r = el.querySelector('#fRec'); s.onchange = () => { r.value = s.value === 'paid' ? moeda(total) : s.value === 'pending' ? '0,00' : ''; if (s.value === 'partial') r.focus(); }; },
    botoes: [{ t: 'Cancelar' }, {
      t: 'Registrar venda', pri: true, fn: el => {
        let st = V(el, 'fPag'), rec = r2(numeroBR(V(el, 'fRec'))); if (rec > total + 0.009) { toast('O valor recebido não pode ser maior que o total.', true); return false; }
        if (st === 'paid') rec = total; if (st === 'partial' && (rec <= 0 || rec >= total)) { toast('Para pagamento parcial, informe um valor maior que zero e menor que o total.', true); return false; }
        if (st === 'pending' && rec > 0) st = rec >= total ? 'paid' : 'partial'; if (st === 'pending') rec = 0;
        const dt = parseData(V(el, 'fData')) || hojeISO(), venc = parseData(V(el, 'fVenc'));
        const n = ex ? Number(ex.numero) : proxNum('ven_ultimoNumeroVenda'); if (!ex) gravarChave('ven_ultimoNumeroVenda', n);
        const v = { ...(ex || {}), numero: n, orcamentoNumero: o.numero, data: dt + 'T12:00:00', vencimento: venc || '', clienteId: c ? c.id : '', clienteNome: c ? c.nome : (o.cli || ''), clienteSnapshot: c ? { ...c } : null, pagamento: V(el, 'fForma'), status: st, recebido: rec, total, termos: '', observacoes: V(el, 'fObs').trim(), itens: arr(o.itens).map(i => ({ ...i })), empresaSnapshot: lerChave('ven_empresa', {}) };
        if (st === 'paid') v.pagoEm = dt + 'T12:00:00';
        const dd = dados(); gravarChave('ven_vendas', ex ? dd.vendas.map(x => Number(x.numero) === n ? v : x) : [v, ...dd.vendas]);
        gravarChave('ven_orcamentosSalvos', dd.pedidos.map(x => Number(x.numero) === Number(o.numero) ? { ...x, tipoRegistro: 'venda_fechada', vendaNumero: n, atualizado: new Date().toISOString() } : x));
        toast('Venda #' + pad(n) + ' registrada.'); tela = 'pedidos'; render();
      }
    }]
  });
}
