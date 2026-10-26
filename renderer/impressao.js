'use strict';
/* Cupom (58/80 mm) e A4: recibo comercial e orçamento. Não é documento fiscal. */
function docDeVenda(v) {
  const d = dados(), o = pedidoDaVenda(d, v), emp = v.empresaSnapshot && (v.empresaSnapshot.nome || v.empresaSnapshot.fantasia) ? v.empresaSnapshot : empresa();
  const itens = arr(v.itens); const t = totaisItens(itens, o && o.desc, o && o.tipo);
  const cli = v.clienteSnapshot || d.clientes.find(c => norm(c.nome) === norm(v.clienteNome)) || { nome: v.clienteNome || '' };
  const pgs = arr(v.pagamentos).length ? arr(v.pagamentos).map(p => ({ forma: p.forma, valor: Number(p.valor) || 0, data: p.data })) : (Number(v.recebido) > 0 ? [{ forma: v.pagamento || 'Recebido', valor: Number(v.recebido), data: v.data }] : []);
  return { tipo: 'venda', numero: v.numero, data: v.data, empresa: emp, cliente: cli, itens, subtotal: t.sub || r2(itens.reduce((a, i) => a + (Number(i.q) || 0) * (Number(i.p) || 0), 0)), desconto: r2(Math.max(0, (t.sub || 0) - (Number(v.total) || 0))), total: Number(v.total) || 0, pagamentos: pgs, recebido: Number(v.recebido) || 0, saldo: saldoVenda(v), vencimento: v.vencimento || '', obs: v.observacoes || (o && o.obs) || '', rodape: true };
}
function docDePedido(o) {
  const d = dados(), t = totaisItens(o.itens, o.desc, o.tipo), cli = d.clientes.find(c => norm(c.nome) === norm(o.cli)) || { nome: o.cli || '' };
  return { tipo: 'orcamento', numero: o.numero, data: o.data, empresa: empresa(), cliente: cli, itens: arr(o.itens), subtotal: t.sub, desconto: t.d, total: t.total, pagamentos: [], recebido: 0, saldo: 0, vencimento: '', obs: o.obs || '', rodape: true };
}
function docTeste() {
  return { tipo: 'venda', numero: 0, data: new Date().toISOString(), empresa: empresa(), cliente: { nome: 'Cliente de teste' }, itens: [{ d: 'Produto de exemplo', q: 2, p: 12.5 }, { d: 'Serviço de exemplo', q: 1, p: 30 }], subtotal: 55, desconto: 5, total: 50, pagamentos: [{ forma: 'PIX', valor: 30 }, { forma: 'Dinheiro', valor: 20 }], recebido: 50, saldo: 0, vencimento: '', obs: 'Impressão de teste.', rodape: true };
}
function htmlDocumento(doc, formato) {
  formato = formato || cfg.impressao.formato || '80'; const c = cfg.impressao, e = doc.empresa || {}, termico = formato !== 'a4', largo = formato === '80';
  const nomeEmp = esc(e.fantasia || e.nome || 'Minha empresa'), razao = e.fantasia && e.nome && e.fantasia !== e.nome ? esc(e.nome) : '';
  const logo = c.mostrarLogo && imgSegura(e.logo) ? `<img class="logo" src="${esc(e.logo)}" alt="">` : '';
  const dadosEmp = c.mostrarEmpresa ? [razao, e.cnpj ? 'CPF/CNPJ ' + esc(docBR(e.cnpj)) : '', esc(e.end || ''), esc([e.telefone, e.email].filter(Boolean).join(' · '))].filter(Boolean).map(x => `<div>${x}</div>`).join('') : '';
  const titulo = doc.tipo === 'orcamento' ? 'ORÇAMENTO' : 'COMPROVANTE DE VENDA';
  const qtd = q => { const n = Number(q) || 0; return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }); };
  const cli = doc.cliente && doc.cliente.nome ? `<div class="bloco"><b>Cliente:</b> ${esc(doc.cliente.nome)}${doc.cliente.doc ? '<br>' + esc(docBR(doc.cliente.doc)) : ''}${doc.cliente.telefone ? '<br>' + esc(doc.cliente.telefone) : ''}${enderecoCliente(doc.cliente) && !termico ? '<br>' + esc(enderecoCliente(doc.cliente)) : ''}</div>` : '';
  const linhasItens = termico
    ? arr(doc.itens).map(i => `<div class="it"><div class="it-n">${esc(i.d)}</div><div class="it-v"><span>${qtd(i.q)} x ${moeda(i.p)}</span><span>${moeda((Number(i.q) || 0) * (Number(i.p) || 0))}</span></div></div>`).join('')
    : `<table class="tb"><thead><tr><th>Item</th><th class="r">Qtd.</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead><tbody>${arr(doc.itens).map(i => `<tr><td>${esc(i.d)}</td><td class="r">${qtd(i.q)}</td><td class="r">${brl(i.p)}</td><td class="r">${brl((Number(i.q) || 0) * (Number(i.p) || 0))}</td></tr>`).join('')}</tbody></table>`;
  const lin = (a, b, cls = '') => `<div class="ln ${cls}"><span>${a}</span><span>${b}</span></div>`;
  const tot = lin('Subtotal', brl(doc.subtotal)) + (doc.desconto > 0.004 ? lin('Desconto', '- ' + brl(doc.desconto)) : '') + lin('TOTAL', brl(doc.total), 'grande');
  const pg = doc.tipo === 'venda' ? (arr(doc.pagamentos).length ? '<div class="sec">Pagamento</div>' + doc.pagamentos.map(p => lin(esc(p.forma || ''), brl(p.valor))).join('') : '') + (doc.saldo > 0.004 ? lin('A receber', brl(doc.saldo), 'forte') + (doc.vencimento ? lin('Vencimento', dataBR(doc.vencimento)) : '') : '') : '';
  const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  @page{margin:0}
  html,body{background:#fff;color:#000}
  body{font-family:${termico ? "Consolas,'Courier New',monospace" : "'Segoe UI',Arial,sans-serif"};font-size:${formato === '58' ? 10 : largo ? 12.5 : termico ? 10.5 : 13}px;line-height:1.38;width:${termico ? (largo ? '80mm' : '58mm') : '100%'};min-width:${termico ? (largo ? '80mm' : '58mm') : '0'};padding:${termico ? (largo ? '3mm 3.5mm 5mm' : '3mm 3mm 5mm') : '16mm 15mm'}}
  .topo{text-align:center;margin-bottom:${termico ? 6 : 14}px}
  .logo{display:block;margin:0 auto 6px;max-width:${termico ? (largo ? '40mm' : '30mm') : '46mm'};max-height:${termico ? '16mm' : '24mm'};object-fit:contain;${termico ? 'filter:grayscale(1) contrast(1.5);' : ''}}
  .nome{font-weight:700;font-size:${termico ? '1.15em' : '1.5em'};letter-spacing:.2px}
  .topo div{font-size:${termico ? '.92em' : '.95em'}}
  .tit{margin:${termico ? '8px 0 4px' : '10px 0 6px'};text-align:${termico ? 'center' : 'left'};font-weight:700;${termico ? '' : 'font-size:1.25em;border-bottom:2px solid #000;padding-bottom:6px'}}
  .meta{text-align:${termico ? 'center' : 'left'};margin-bottom:6px}
  .bloco{margin:6px 0}
  .sep{border-top:1px ${termico ? 'dashed' : 'solid'} #000;margin:7px 0}
  .it{margin:4px 0}.it-n{font-weight:700;word-break:break-word}.it-v{display:flex;justify-content:space-between;gap:8px}
  .tb{width:100%;border-collapse:collapse;margin:8px 0}.tb th{text-align:left;border-bottom:1.5px solid #000;padding:6px 4px}.tb td{padding:6px 4px;border-bottom:1px solid #ccc}.r{text-align:right!important}
  .ln{display:flex;justify-content:space-between;gap:8px;margin:2px 0}.ln.grande{font-weight:700;font-size:${termico ? '1.25em' : '1.35em'};margin-top:4px}.ln.forte{font-weight:700}
  .tots{${termico ? '' : 'margin-left:auto;width:62%'}}
  .sec{font-weight:700;margin:${termico ? '8px 0 2px' : '14px 0 4px'};${termico ? '' : 'font-size:1.05em'}}
  .obs{margin-top:8px;font-style:italic;word-break:break-word}
  .rod{margin-top:${termico ? 10 : 22}px;text-align:center;font-size:.9em}
  .nf{margin-top:6px;text-align:center;font-size:.82em}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} ${pad4(doc.numero)}</title><style>${css}</style></head><body>
  <div class="topo">${logo}<div class="nome">${nomeEmp}</div>${dadosEmp}</div>
  <div class="sep"></div>
  <div class="tit">${titulo} Nº ${pad4(doc.numero)}</div>
  <div class="meta">${dataBR(String(doc.data).slice(0, 10))} ${horaBR(doc.data)}</div>
  ${cli}
  <div class="sep"></div>
  ${linhasItens}
  <div class="sep"></div>
  <div class="tots">${tot}${pg}</div>
  ${doc.obs ? `<div class="obs">Obs.: ${esc(doc.obs)}</div>` : ''}
  <div class="sep"></div>
  ${doc.rodape && c.rodape ? `<div class="rod">${esc(c.rodape)}</div>` : ''}
  <div class="nf">${doc.tipo === 'orcamento' ? 'Orçamento sujeito a alteração de preços e estoque. ' : ''}Documento sem valor fiscal.</div>
  </body></html>`;
}
async function imprimirDoc(doc) {
  const c = cfg.impressao; toast('Enviando para a impressora…');
  const r = await window.venDesktop.imprimirHtml({ html: htmlDocumento(doc, c.formato), formato: c.formato, silencioso: !!c.direto, impressora: c.impressora, copias: c.copias });
  if (r.ok) toast('Impressão enviada.'); else if (r.erro !== 'cancelado') toast('Não foi possível imprimir: ' + (r.erro || 'verifique a impressora.'), 'erro');
}
async function salvarPdfDoc(doc) {
  const f = cfg.impressao.formato; const r = await window.venDesktop.salvarPdf({ html: htmlDocumento(doc, f), formato: f, nome: (doc.tipo === 'orcamento' ? 'Orcamento_' : 'Venda_') + pad4(doc.numero) + '.pdf' });
  if (!r.ok) return toast('Não foi possível gerar o PDF: ' + r.erro, 'erro'); if (r.salvo) toast('PDF salvo.');
}
function textoWhatsDoc(doc) {
  const e = doc.empresa || {}, linhas = [`*${e.fantasia || e.nome || 'Minha empresa'}*`, `${doc.tipo === 'orcamento' ? 'Orçamento' : 'Pedido'} ${numPed(doc.numero)} - ${dataBR(String(doc.data).slice(0, 10))}`, ''];
  arr(doc.itens).forEach(i => linhas.push(`${Number(i.q) || 0}x ${i.d} - ${brl((Number(i.q) || 0) * (Number(i.p) || 0))}`));
  linhas.push(''); if (doc.desconto > 0.004) linhas.push('Desconto: ' + brl(doc.desconto)); linhas.push('*Total: ' + brl(doc.total) + '*');
  if (doc.tipo === 'venda' && doc.saldo > 0.004) linhas.push('Saldo a receber: ' + brl(doc.saldo) + (doc.vencimento ? ' (vence em ' + dataBR(doc.vencimento) + ')' : ''));
  linhas.push('', doc.tipo === 'orcamento' ? 'Fico à disposição para fechar o pedido.' : 'Obrigado pela preferência!');
  return linhas.join('\n');
}
function menuImprimir(ancora, doc) {
  abrirMenu(ancora, [
    { t: 'Imprimir', d: 'Formato atual: ' + ({ '58': 'cupom 58 mm', '80': 'cupom 80 mm', a4: 'A4' }[cfg.impressao.formato] || ''), icone: 'print', fn: () => imprimirDoc(doc) },
    { t: 'Salvar em PDF', icone: 'file', fn: () => salvarPdfDoc(doc) },
    { t: 'Enviar por WhatsApp', icone: 'whatsapp', fn: () => { const tel = doc.cliente && doc.cliente.telefone; const u = whatsUrl(tel, textoWhatsDoc(doc)); if (u) abrirExterno(u); else { navigator.clipboard && navigator.clipboard.writeText(textoWhatsDoc(doc)); toast('Cliente sem WhatsApp válido. Texto copiado para colar na conversa.'); } } },
    { t: 'Copiar texto', icone: 'copy', fn: () => { navigator.clipboard.writeText(textoWhatsDoc(doc)).then(() => toast('Texto copiado.')); } }
  ]);
}
