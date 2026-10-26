'use strict';
/* ===== Contas a pagar ===== */
let filaContas = [], filaTotal = 0;
const nomeSituacaoVia = { pdf: 'do PDF', foto: 'da foto', codigo: 'do código digitado', camera: 'pela câmera' };
const tagOrigem = (d, k) => { const o = d.origem && d.origem[k]; return o ? `<em class="tag-lido">${o === 'codigo' ? 'lido do código' : 'lido do texto'}</em>` : ''; };
function contaDuplicada(lista, f, ignorarId) {
  const dg = f.linha && f.linha.length >= 44 ? f.linha : '', nome = norm(f.fornecedor || f.descricao || '');
  return lista.find(c => String(c.id) !== String(ignorarId || '') && ((dg && soDig(c.linha) === dg) || (Math.abs((Number(c.valor) || 0) - f.valor) < 0.005 && c.vencimento === f.vencimento && norm(c.fornecedor || c.descricao || '') === nome)));
}
function abrirImportarConta() {
  const el = modal({
    titulo: 'Importar conta a pagar', sub: 'O VEN lê boleto, fatura ou Pix e preenche os dados. Você confere antes de salvar.', icone: 'download', tamanho: 'lg',
    corpo: `<label class="drop" id="impDrop">${ic('upload')}<b>Arraste PDFs ou fotos das contas</b><small>Ou clique para escolher. Pode selecionar vários arquivos de uma vez.</small><input type="file" id="impInp" accept="application/pdf,image/*" multiple hidden></label>
      <div class="ou"><span>ou digite o código</span></div>
      <label class="f"><span>Linha digitável, código de barras ou Pix copia e cola</span><textarea id="impCod" rows="2" placeholder="Cole aqui. Também funciona com leitor de código de barras USB." data-sem-enter="1"></textarea></label>
      <div id="impEstado" class="consulta" hidden></div>`,
    botoes: [{ t: 'Preencher manualmente', suave: true, fn: () => { setTimeout(() => iniciarFila([]), 0); } }, { t: 'Ler código', pri: true, icone: 'barcode', fn: () => { const rs = rascunhosDeCodigo(V(el, 'impCod')); if (!rs.length) { statusConsulta(el, 'impEstado', 'err', 'Esse código não parece ser de um boleto ou Pix. Confira os números.'); return false; } setTimeout(() => iniciarFila(rs), 0); } }]
  });
  const estado = t => statusConsulta(el, 'impEstado', t ? 'load' : '', t ? '<span class="spin"></span>' + esc(t) : '');
  const processar = async files => {
    if (!files.length) return; el.querySelector('.m-foot').style.opacity = .5;
    const { rascunhos, falhas } = await rascunhosDeArquivos([...files], estado); el.querySelector('.m-foot').style.opacity = 1; estado('');
    if (!rascunhos.length) { statusConsulta(el, 'impEstado', 'err', esc(falhas.join(' ') || 'Não consegui ler os arquivos.')); return; }
    el._fechar(); if (falhas.length) toast(falhas[0], 'erro'); iniciarFila(rascunhos);
  };
  const inp = el.querySelector('#impInp'), drop = el.querySelector('#impDrop');
  inp.onchange = () => processar(inp.files); drop.onclick = e => { if (e.target !== inp) inp.click(); };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('sobre'); }; drop.ondragleave = () => drop.classList.remove('sobre'); drop.ondrop = e => { e.preventDefault(); drop.classList.remove('sobre'); processar(e.dataTransfer.files); };
  el.querySelector('#impCod').addEventListener('paste', () => setTimeout(() => { const rs = rascunhosDeCodigo(V(el, 'impCod')); if (rs.length) { el._fechar(); iniciarFila(rs); } }, 40));
}
function iniciarFila(rs) {
  if (!rs.length) { const d = rascunhoVazio(); filaContas = []; filaTotal = 0; return formConta(d); }
  filaTotal = rs.length; filaContas = rs.slice(); proximaDaFila(); if (filaTotal > 1) toast(`Encontrei ${filaTotal} contas. Revise uma por vez.`);
}
function proximaDaFila() { const d = filaContas.shift(); if (!d) { filaTotal = 0; return render(); } formConta(d, { posicao: filaTotal - filaContas.length, total: filaTotal }); }
function editarConta(id) {
  const c = dados().pagar.find(x => String(x.id) === String(id)); if (!c) return;
  const a = anexoConta(id) || {}; formConta({ ...rascunhoVazio(), ...c, via: 'manual', anexo: a.boleto || null, _edit: id });
}
function formConta(d, fila) {
  const edit = !!d._edit, lista = dados().pagar, forn = [...new Set(lista.map(x => x.fornecedor).filter(Boolean))];
  const avisos = arr(d.avisos).map(a => `<div class="aviso ${/não conferem|diferente/.test(a) ? 'neg' : 'warn'}">${ic('alert')}<span>${esc(a)}</span></div>`).join('');
  const info = d.via && d.via !== 'manual' && !edit ? `<div class="aviso brand">${ic('info')}<span>Dados lidos ${nomeSituacaoVia[d.via] || 'automaticamente'}. <b>Confira antes de salvar.</b></span></div>` : '';
  const el = modal({
    titulo: edit ? 'Editar conta' : 'Nova conta a pagar', sub: fila && fila.total > 1 ? `Conta ${fila.posicao} de ${fila.total}` : (edit ? 'Altere os dados e salve.' : 'Confira os dados e salve.'), icone: 'pagar', tamanho: 'lg',
    corpo: `${info}${avisos}<div class="fgrid g6">
      ${campo('Descrição *', 'fDesc', d.descricao, 'maxlength="100" placeholder="Ex.: Conta de luz, Fornecedor X"', 'c6')}
      <label class="f c3"><span>Valor (R$) * ${tagOrigem(d, 'valor')}</span><input id="fValor" data-moeda inputmode="decimal" placeholder="0,00" value="${d.valor ? moeda(d.valor) : ''}"></label>
      <label class="f c3"><span>Vencimento * ${tagOrigem(d, 'vencimento')}</span><input id="fVenc" type="date" value="${esc(d.vencimento || '')}"></label>
      <label class="f c6"><span>Fornecedor / beneficiário ${tagOrigem(d, 'fornecedor')}</span><input id="fForn" maxlength="100" list="fornList" placeholder="Quem vai receber" value="${esc(d.fornecedor || '')}"><datalist id="fornList">${forn.map(f => `<option value="${esc(f)}">`).join('')}</datalist></label>
      ${selecao('Categoria', 'fCat', CATEGORIAS, d.categoria || 'Outros', 'c3')}
      ${campo('CNPJ do beneficiário (opcional)', 'fCnpj', d.cnpj ? cnpjBR(d.cnpj) : '', 'data-mask="doc" maxlength="18" inputmode="numeric" placeholder="00.000.000/0000-00"', 'c3')}
      <label class="f c6"><span>Linha digitável / código de barras</span><input id="fLinha" inputmode="numeric" placeholder="Digite ou cole o código" value="${esc(d.linha ? VENBoleto.fmtLinha(d.linha) : '')}"><small id="fLinhaMsg"></small></label>
      ${d.pix || (edit && d.pix) ? campo('Pix copia e cola', 'fPix', d.pix, '', 'c6') : ''}
      ${campo('Nº do documento (opcional)', 'fDoc', d.documento, 'maxlength="40"', 'c2')}
      <label class="f c4"><span>Observações (opcional)</span><input id="fObs" maxlength="300" placeholder="Ex.: pagar pelo banco X" value="${esc(d.obs || '')}"></label>
      <div class="c6 anexo-bloco"><span class="anexo-ico">${ic('clip')}</span><div><b>${d.anexo ? esc(d.anexo.nome || 'Arquivo anexado') : 'Anexar boleto ou foto'}</b><small>${d.anexo ? 'Fica guardado junto da conta.' : 'PDF de até 1,5 MB ou imagem. Opcional.'}</small></div>${d.anexo ? `<button type="button" class="btn" id="fAnexoVer">${ic('eye')}Ver</button>` : ''}<label class="btn">${ic('upload')}${d.anexo ? 'Trocar' : 'Escolher'}<input type="file" id="fAnexo" accept="application/pdf,image/*" hidden></label></div>
      ${edit ? '' : `<div class="c6 sec-tit">Repetição</div>
      ${selecao('Esta conta se repete?', 'fRep', [['u', 'Não, é uma conta só'], ['p', 'Parcelada (valor de cada parcela)'], ['m', 'Todo mês (aluguel, internet…)']], 'u', 'c4')}
      ${campo('Quantas vezes?', 'fQtd', '12', 'type="number" min="2" max="60"', 'c2')}
      <div id="fRepInfo" class="consulta c6" hidden></div>
      <label class="chk-linha c6"><input type="checkbox" id="fJaPaga"><span>Esta conta já foi paga</span></label>
      <label class="f c3 oculto" id="fPagaBox"><span>Data do pagamento</span><input id="fPagaEm" type="date" value="${hojeISO()}"></label>`}
    </div>`,
    aoAbrir: el => {
      const g = id => el.querySelector('#' + id); let novoAnexo = null;
      const linha = g('fLinha'), msg = g('fLinhaMsg');
      const validarLinha = () => {
        const dg = soDig(linha.value);
        if ([44, 47, 48].includes(dg.length)) {
          const r = VENBoleto.interpretar(dg);
          if (r) { linha.value = VENBoleto.fmtLinha(r.linha); if (r.valor > 0) g('fValor').value = moeda(r.valor); if (r.vencimento && !g('fVenc').value) g('fVenc').value = r.vencimento; if (r.categoria && g('fCat').value === 'Outros') g('fCat').value = r.categoria; msg.className = r.ok ? 'ok' : 'err'; msg.textContent = r.ok ? 'Código válido' + (r.valor > 0 ? ' · ' + brl(r.valor) : '') + (r.vencimento ? ' · vence ' + dataBR(r.vencimento) : ' · informe o vencimento') : 'Os dígitos não conferem. Confira o código.'; }
        } else { msg.className = ''; msg.textContent = dg.length ? (dg.length <= 48 ? dg.length + ' dígitos. O código tem 44, 47 ou 48 dígitos.' : dg.length + ' dígitos: passou de 48. Confira.') : ''; }
      };
      linha.addEventListener('input', validarLinha); if (soDig(linha.value)) validarLinha();
      g('fForn').addEventListener('change', () => { const hit = lista.find(c => c.fornecedor && norm(c.fornecedor) === norm(g('fForn').value) && c.categoria); if (hit && g('fCat').value === 'Outros') g('fCat').value = hit.categoria; if (hit && !g('fDesc').value.trim()) g('fDesc').value = hit.descricao || g('fForn').value; });
      const ver = g('fAnexoVer'); if (ver) ver.onclick = () => verAnexo(novoAnexo || d.anexo);
      g('fAnexo').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const a = await prepararAnexo(f); if (a) { novoAnexo = a; el._novoAnexo = a; toast('Anexo selecionado: ' + (a.nome || 'arquivo')); } else toast('Arquivo não guardado: use PDF de até 1,5 MB ou uma imagem.', 'erro'); } catch (_) { toast('Não foi possível ler o anexo.', 'erro'); } };
      const rep = g('fRep'); if (rep) {
        const atual = () => { g('fQtd').closest('label').classList.toggle('oculto', rep.value === 'u'); const q = Math.max(2, Math.min(60, Number(g('fQtd').value) || 2)), v = numeroBR(g('fValor').value), dt = g('fVenc').value, i = g('fRepInfo'); if (rep.value === 'u') { i.hidden = true; return; } i.hidden = false; i.className = 'consulta c6'; i.textContent = v > 0 && dt ? `${q} contas de ${brl(v)}${rep.value === 'p' ? ' (total ' + brl(v * q) + ')' : ''} · até ${nomeMes(somaMes(dt, q - 1).slice(0, 7))}` : 'Informe valor e vencimento para ver o resumo.'; };
        rep.onchange = atual; ['fQtd', 'fValor', 'fVenc'].forEach(i => g(i).addEventListener('input', atual)); atual();
        g('fJaPaga').onchange = () => g('fPagaBox').classList.toggle('oculto', !g('fJaPaga').checked);
      }
    },
    botoes: [{ t: 'Cancelar', fn: () => { filaContas = []; filaTotal = 0; } }, ...(edit || (fila && fila.total > 1) ? [] : [{ t: 'Salvar e adicionar outra', fn: el => salvarConta(el, d, true) }]), { t: edit ? 'Salvar alterações' : 'Salvar conta', pri: true, fn: el => salvarConta(el, d, false) }]
  });
  return el;
}
async function salvarConta(el, d, outra) {
  const edit = !!d._edit, lerCampos = () => ({ descricao: V(el, 'fDesc').trim(), valor: r2(numeroBR(V(el, 'fValor'))), vencimento: V(el, 'fVenc'), fornecedor: V(el, 'fForn').trim(), categoria: V(el, 'fCat'), cnpj: soDig(V(el, 'fCnpj')), linha: soDig(V(el, 'fLinha')), documento: V(el, 'fDoc').trim(), obs: V(el, 'fObs').trim(), pix: V(el, 'fPix') ? V(el, 'fPix').trim() : (d.pix || '') });
  const f = lerCampos(); if (!f.descricao) f.descricao = f.fornecedor;
  if (!f.descricao) { toast('Informe a descrição da conta.', 'erro'); el.querySelector('#fDesc').focus(); return false; }
  if (!(f.valor > 0)) { toast('Informe um valor maior que zero.', 'erro'); el.querySelector('#fValor').focus(); return false; }
  if (!f.vencimento) { toast('Informe a data de vencimento.', 'erro'); el.querySelector('#fVenc').focus(); return false; }
  if (f.cnpj.length === 14 && !cnpjValido(f.cnpj)) { toast('O CNPJ informado não é válido.', 'erro'); return false; }
  const lista = dados().pagar, dup = contaDuplicada(lista, f, d._edit);
  const seguir = async () => {
    const anexo = el._novoAnexo || d.anexo || null;
    if (edit) {
      gravarChave('ven_contasPagar', lista.map(x => String(x.id) === String(d._edit) ? { ...x, ...f, pix: f.pix || x.pix || '' } : x));
      if (anexo) { const a = anexoConta(d._edit) || {}; a.boleto = anexo; gravarAnexoConta(d._edit, a); } toast('Conta atualizada.'); return render();
    }
    const tipo = V(el, 'fRep') || 'u', qtd = tipo === 'u' ? 1 : Math.max(2, Math.min(60, Number(V(el, 'fQtd')) || 2)), jaPaga = V(el, 'fJaPaga'), pagaEm = V(el, 'fPagaEm') || hojeISO(), grupo = qtd > 1 ? novoId() : '', novas = [];
    for (let i = 0; i < qtd; i++) {
      const c = { id: novoId(), descricao: f.descricao, fornecedor: f.fornecedor, cnpj: f.cnpj, documento: f.documento, categoria: f.categoria || 'Outros', valor: f.valor, vencimento: i ? somaMes(f.vencimento, i) : f.vencimento, linha: i ? '' : f.linha, pix: i ? '' : f.pix, obs: f.obs, status: 'pendente', origem: d.via || 'manual', criadoEm: new Date().toISOString() };
      if (grupo) { c.grupo = grupo; c.parcela = { n: i + 1, de: qtd, tipo }; } if (jaPaga && i === 0) { c.status = 'paga'; c.pagoEm = pagaEm; c.valorPago = f.valor; } novas.push(c);
    }
    gravarChave('ven_contasPagar', lista.concat(novas)); if (anexo) gravarAnexoConta(novas[0].id, { boleto: anexo });
    toast(qtd > 1 ? qtd + ' contas criadas.' : 'Conta salva.');
    if (filaContas.length) { el._fechar(); proximaDaFila(); return; }
    if (outra) { el._fechar(); formConta(rascunhoVazio()); return; } render();
  };
  if (dup) { return new Promise(res => { confirmar('Conta parecida já cadastrada', `Já existe “${dup.descricao || dup.fornecedor}” de ${brl(dup.valor)} com vencimento em ${dataBR(dup.vencimento)}. Salvar mesmo assim?`, async () => { await seguir(); el._fechar(); res(false); }, 'Salvar mesmo assim'); }).then(() => false); }
  await seguir(); return true;
}
async function verAnexo(x) {
  if (!x || !x.dados) return toast('Anexo não encontrado.', 'erro');
  const el = modal({ titulo: x.nome || 'Anexo', icone: 'clip', tamanho: 'xl', corpo: '<div class="visor" id="visor"><span class="spin"></span></div>', botoes: [{ t: 'Fechar' }] }); const v = el.querySelector('#visor');
  if (/^image\//.test(x.tipo)) { v.innerHTML = `<img src="${esc(x.dados)}" alt="">`; return; }
  try {
    const lib = await pdfjs(), bin = atob(x.dados.split(',')[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const doc = await lib.getDocument({ data: u8, isEvalSupported: false }).promise; v.innerHTML = '';
    for (let p = 1; p <= Math.min(doc.numPages, 4); p++) { const pg = await doc.getPage(p), vp0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(2, 880 / vp0.width) }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; v.appendChild(cv); await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; }
  } catch (_) { v.innerHTML = '<p class="vazio-txt">Não foi possível exibir este PDF.</p>'; }
}
function pagarConta(id) {
  const c = dados().pagar.find(x => String(x.id) === String(id)); if (!c) return;
  modal({
    titulo: 'Registrar pagamento', sub: `${c.descricao || c.fornecedor} · vence em ${dataBR(c.vencimento)}`, icone: 'check', tamanho: 'sm',
    corpo: `<div class="fgrid g2">${campo('Data do pagamento', 'gData', hojeISO(), 'type="date"', 'c2')}${campo('Valor pago (R$)', 'gVal', moeda(c.valor), 'data-moeda inputmode="decimal"', 'c2', 'Se pagou com juros ou desconto, altere o valor.')}${selecao('Forma de pagamento', 'gForma', [...FORMAS_NOMES, 'Débito automático'], 'PIX', 'c2')}<label class="f c2"><span>Comprovante (opcional)</span><input type="file" id="gComp" accept="application/pdf,image/*"></label></div>`,
    botoes: [{ t: 'Cancelar' }, {
      t: 'Confirmar pagamento', pri: true, fn: async el => {
        const v = numeroBR(V(el, 'gVal')), dt = V(el, 'gData'); if (!(v > 0)) { toast('Informe o valor pago.', 'erro'); return false; } if (!dt) { toast('Data inválida.', 'erro'); return false; }
        gravarChave('ven_contasPagar', dados().pagar.map(x => String(x.id) === String(id) ? { ...x, status: 'paga', pagoEm: dt, valorPago: r2(v), formaPgto: V(el, 'gForma') } : x));
        const f = el.querySelector('#gComp').files[0]; if (f) { try { const a = await prepararAnexo(f); if (a) { const o = anexoConta(id) || {}; o.comprovante = a; gravarAnexoConta(id, o); } else toast('Comprovante não guardado: use PDF até 1,5 MB ou imagem.', 'erro'); } catch (_) { toast('Não foi possível ler o comprovante.', 'erro'); } }
        toast('Pagamento registrado.'); render();
      }
    }]
  });
}
function desfazerPagamento(id) { gravarChave('ven_contasPagar', dados().pagar.map(x => { if (String(x.id) !== String(id)) return x; const y = { ...x, status: 'pendente' }; delete y.pagoEm; delete y.valorPago; delete y.formaPgto; return y; })); toast('Pagamento desfeito.'); render(); }
function excluirConta(id) {
  const c = dados().pagar.find(x => String(x.id) === String(id)); if (!c) return;
  const grupo = c.grupo ? dados().pagar.filter(x => x.grupo === c.grupo && String(x.id) !== String(id) && x.status !== 'paga').length : 0;
  const apagar = ids => { gravarChave('ven_contasPagar', dados().pagar.filter(x => !ids.includes(String(x.id)))); ids.forEach(i => removerChave('ven_cpa_' + i)); toast(ids.length > 1 ? ids.length + ' contas excluídas.' : 'Conta excluída.'); render(); };
  if (grupo) { modal({ titulo: 'Excluir conta repetida?', tamanho: 'sm', icone: 'alert', corpo: `<p class="texto">“${esc(c.descricao || c.fornecedor)}” faz parte de uma série com mais ${grupo} conta(s) em aberto.</p>`, botoes: [{ t: 'Cancelar' }, { t: 'Só esta', perigo: true, suave: true, fn: () => apagar([String(id)]) }, { t: 'Esta e as próximas em aberto', perigo: true, pri: true, fn: () => apagar(dados().pagar.filter(x => x.grupo === c.grupo && x.status !== 'paga' && String(x.vencimento) >= String(c.vencimento)).map(x => String(x.id))) }] }); return; }
  confirmar('Excluir conta?', `${c.descricao || c.fornecedor} será removida.`, () => apagar([String(id)]), 'Excluir', true);
}
function abrirAnexoConta(id) { const a = anexoConta(id) || {}; if (a.boleto && a.comprovante) { abrirMenu(document.activeElement, [{ t: 'Boleto / fatura', icone: 'file', fn: () => verAnexo(a.boleto) }, { t: 'Comprovante', icone: 'check', fn: () => verAnexo(a.comprovante) }]); } else verAnexo(a.boleto || a.comprovante); }

/* ===== Contas a receber ===== */
function campoFormaPagamento(prefixo, atual) {
  return `${selecao('Forma', prefixo + 'Forma', FORMAS_NOMES, atual || 'PIX', 'c3')}<label class="f c3 oculto" id="${prefixo}ParcBox"><span>Parcelas</span><select id="${prefixo}Parc">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}x</option>`).join('')}</select></label>`;
}
const rotuloForma = (forma, parc) => forma === 'Cartão de crédito' && Number(parc) > 1 ? `Cartão de crédito ${parc}x` : forma;
function ligarParcelas(el, prefixo) { const f = el.querySelector('#' + prefixo + 'Forma'), b = el.querySelector('#' + prefixo + 'ParcBox'); const s = () => b.classList.toggle('oculto', f.value !== 'Cartão de crédito'); f.onchange = s; s(); }
function receberVenda(num) {
  const v = dados().vendas.find(x => Number(x.numero) === Number(num)); if (!v) return; const s = saldoVenda(v); if (s <= 0) return toast('Esta venda já está quitada.', 'erro');
  modal({
    titulo: 'Receber · ' + numPed(v.numero), sub: `${v.clienteNome || 'Sem cliente'} · saldo ${brl(s)}`, icone: 'receber', tamanho: 'md',
    corpo: `<div class="fgrid g6">${campo('Valor recebido (R$)', 'rVal', moeda(s), 'data-moeda inputmode="decimal"', 'c3')}${campo('Data', 'rData', hojeISO(), 'type="date" max="' + hojeISO() + '"', 'c3')}${campoFormaPagamento('r', v.pagamento)}${campo('Novo vencimento do restante (opcional)', 'rVenc', '', 'type="date"', 'c6', 'Só se receber menos que o saldo.')}</div>`,
    aoAbrir: el => ligarParcelas(el, 'r'),
    botoes: [{ t: 'Cancelar' }, {
      t: 'Registrar recebimento', pri: true, fn: el => {
        const val = r2(numeroBR(V(el, 'rVal'))), iso = V(el, 'rData');
        if (val <= 0) { toast('Informe um valor maior que zero.', 'erro'); return false; } if (val > s + 0.001) { toast('O valor é maior que o saldo da venda.', 'erro'); return false; } if (!iso) { toast('Data inválida.', 'erro'); return false; } if (iso > hojeISO()) { toast('A data do recebimento não pode ser futura.', 'erro'); return false; }
        const nv = V(el, 'rVenc'), forma = rotuloForma(V(el, 'rForma'), V(el, 'rParc'));
        gravarChave('ven_vendas', dados().vendas.map(x => { if (Number(x.numero) !== Number(num)) return x; const y = { ...x }; y.recebido = r2((Number(y.recebido) || 0) + val); y.pagamentos = arr(y.pagamentos).concat([{ data: iso + 'T12:00:00', valor: val, forma }]); if (saldoVenda(y) <= 0) { y.status = 'paid'; y.recebido = y.total; y.pagoEm = iso + 'T12:00:00'; } else { y.status = 'partial'; if (nv) y.vencimento = nv; } return y; }));
        toast('Recebimento registrado.'); render();
      }
    }]
  });
}
function desfazerRecebimento(num) {
  gravarChave('ven_vendas', dados().vendas.map(x => {
    if (Number(x.numero) !== Number(num)) return x; const y = { ...x }, p = arr(y.pagamentos).slice(); let val; if (p.length) { val = Number(p.pop().valor) || 0; y.pagamentos = p; } else val = Number(y.recebido) || 0;
    y.recebido = Math.max(0, r2((Number(y.recebido) || 0) - val)); y.status = y.recebido > 0 ? 'partial' : 'pending'; delete y.pagoEm; return y;
  })); toast('Último recebimento desfeito.'); render();
}
function formReceita(id) {
  const l = dados().avulso, c = id ? l.find(x => String(x.id) === String(id)) : null;
  modal({
    titulo: c ? 'Editar receita' : 'Nova receita', sub: 'Aluguel, serviços e outras entradas que não vêm de vendas.', icone: 'receber', tamanho: 'md',
    corpo: `<div class="fgrid g6">${campo('Descrição *', 'eDesc', c && c.descricao, 'maxlength="100"', 'c6')}${campo('Valor (R$) *', 'eVal', c ? moeda(c.valor) : '', 'data-moeda inputmode="decimal" placeholder="0,00"', 'c3')}${campo('Vencimento *', 'eVenc', c ? c.vencimento : hojeISO(), 'type="date"', 'c3')}${campo('Cliente (opcional)', 'eCli', c && c.cliente, 'maxlength="100" list="eCliList"', 'c6')}<datalist id="eCliList">${dados().clientes.map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>${c ? '' : `${selecao('Repetição', 'eRep', [['u', 'Única'], ['m', 'Todo mês']], 'u', 'c4')}${campo('Por quantos meses?', 'eQtd', '12', 'type="number" min="2" max="60"', 'c2')}`}</div>`,
    aoAbrir: el => { const r = el.querySelector('#eRep'); if (r) { const t = () => el.querySelector('#eQtd').closest('label').classList.toggle('oculto', r.value === 'u'); r.onchange = t; t(); } },
    botoes: [{ t: 'Cancelar' }, {
      t: c ? 'Salvar alterações' : 'Adicionar', pri: true, fn: el => {
        const desc = V(el, 'eDesc').trim(), val = r2(numeroBR(V(el, 'eVal'))), venc = V(el, 'eVenc');
        if (!desc) { toast('Informe a descrição.', 'erro'); return false; } if (!(val > 0)) { toast('Informe um valor maior que zero.', 'erro'); return false; } if (!venc) { toast('Informe o vencimento.', 'erro'); return false; }
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
    titulo: 'Receber · ' + c.descricao, icone: 'receber', tamanho: 'sm', corpo: `<div class="fgrid g6">${campo('Valor recebido (R$)', 'vVal', moeda(c.valor), 'data-moeda inputmode="decimal"', 'c3')}${campo('Data', 'vData', hojeISO(), 'type="date" max="' + hojeISO() + '"', 'c3')}${selecao('Forma', 'vForma', FORMAS_NOMES, 'PIX', 'c6')}</div>`,
    botoes: [{ t: 'Cancelar' }, { t: 'Registrar', pri: true, fn: el => { const v = r2(numeroBR(V(el, 'vVal'))), iso = V(el, 'vData'); if (!(v > 0)) { toast('Informe um valor maior que zero.', 'erro'); return false; } if (!iso) { toast('Data inválida.', 'erro'); return false; } gravarChave('ven_receberAvulso', dados().avulso.map(x => String(x.id) === String(id) ? { ...x, status: 'recebida', recebidoEm: iso, valorRecebido: v, forma: V(el, 'vForma') } : x)); toast('Recebimento registrado.'); render(); } }]
  });
}
function desfazerReceita(id) { gravarChave('ven_receberAvulso', dados().avulso.map(x => { if (String(x.id) !== String(id)) return x; const y = { ...x, status: 'pendente' }; delete y.recebidoEm; delete y.valorRecebido; delete y.forma; return y; })); toast('Recebimento desfeito.'); render(); }
function excluirReceita(id) {
  const c = dados().avulso.find(x => String(x.id) === String(id)); if (!c) return;
  const serie = c.serie ? dados().avulso.filter(x => x.serie && x.serie.id === c.serie.id && String(x.id) !== String(id) && x.status !== 'recebida' && x.vencimento >= c.vencimento).length : 0;
  const apagar = ids => { gravarChave('ven_receberAvulso', dados().avulso.filter(x => !ids.includes(String(x.id)))); toast(ids.length > 1 ? ids.length + ' receitas excluídas.' : 'Receita excluída.'); render(); };
  if (serie) { modal({ titulo: 'Excluir receita repetida?', tamanho: 'sm', icone: 'alert', corpo: `<p class="texto">“${esc(c.descricao)}” se repete todo mês. Há mais ${serie} em aberto daqui para frente.</p>`, botoes: [{ t: 'Cancelar' }, { t: 'Só esta', perigo: true, suave: true, fn: () => apagar([String(id)]) }, { t: 'Esta e as próximas', perigo: true, pri: true, fn: () => apagar(dados().avulso.filter(x => x.serie && x.serie.id === c.serie.id && x.status !== 'recebida' && x.vencimento >= c.vencimento).map(x => String(x.id))) }] }); return; }
  confirmar('Excluir receita?', `${c.descricao} será removida.`, () => apagar([String(id)]), 'Excluir', true);
}
function cobrarWhats(tipo, id) {
  const d = dados(), emp = empresa(); let nome = '', tel = '', valor = 0, venc = '', ref = '';
  if (tipo === 'v') { const v = d.vendas.find(x => Number(x.numero) === Number(id)); if (!v) return; const c = d.clientes.find(x => norm(x.nome) === norm(v.clienteNome)); nome = v.clienteNome; tel = c && c.telefone; valor = saldoVenda(v); venc = v.vencimento; ref = 'referente ao pedido ' + numPed(v.numero); }
  else { const a = d.avulso.find(x => String(x.id) === String(id)); if (!a) return; const c = d.clientes.find(x => norm(x.nome) === norm(a.cliente)); nome = a.cliente; tel = c && c.telefone; valor = Number(a.valor) || 0; venc = a.vencimento; ref = 'referente a ' + a.descricao; }
  const atraso = venc && venc < hojeISO(), primeiro = String(nome || '').split(' ')[0];
  const texto = `Olá${primeiro ? ', ' + primeiro : ''}! Tudo bem?\n\n${atraso ? 'Identificamos que o pagamento' : 'Passando para lembrar do pagamento'} de ${brl(valor)} ${ref}${venc ? ', com vencimento em ' + dataBR(venc) : ''}${atraso ? ' está em aberto' : ''}.\n\nSe já pagou, por favor desconsidere. Qualquer dúvida estou à disposição.\n${emp.fantasia || emp.nome || ''}`.trim();
  const u = whatsUrl(tel, texto); if (u) abrirExterno(u); else { navigator.clipboard && navigator.clipboard.writeText(texto); toast('Cliente sem WhatsApp cadastrado. Mensagem copiada para colar.', 'erro'); }
}
