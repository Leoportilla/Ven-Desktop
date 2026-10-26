'use strict';
/* ===== Consultas automáticas (CNPJ e CEP) reutilizáveis em formulários ===== */
const MSG_CONSULTA = { 'nao-encontrado': 'Não encontrado na base pública. Preencha os dados manualmente.', indisponivel: 'Consulta indisponível agora (verifique a internet). Você pode preencher manualmente.', invalido: 'Documento inválido. Confira os números.' };
function preencherCampos(el, mapa) {
  let n = 0, mantidos = 0;
  for (const [id, val] of Object.entries(mapa)) {
    const i = el.querySelector('#' + id); if (!i || !val) continue;
    if (!i.value.trim() || i.dataset.auto === '1') { if (i.value !== val) n++; i.value = val; i.dataset.auto = '1'; } else if (i.value.trim() !== val) mantidos++;
  }
  return { n, mantidos };
}
function statusConsulta(el, id, tipo, html) { const s = el.querySelector('#' + id); if (!s) return; if (s.dataset.cls == null) { const m = /\bc[1-6]\b/.exec(s.className); s.dataset.cls = m ? m[0] : ''; } s.hidden = !html; s.className = 'consulta ' + (tipo || '') + ' ' + s.dataset.cls; s.innerHTML = html || ''; }
/* ids: { doc, btn, status, cep, cepStatus, mapaCnpj(d)->{id:valor}, mapaCep(d)->{id:valor}, focoCep } */
function ligarConsultas(el, ids) {
  let tokenC = 0, tokenP = 0; const doc = el.querySelector('#' + ids.doc), btn = el.querySelector('#' + ids.btn);
  el.addEventListener('input', e => { if (e.isTrusted && e.target.dataset) delete e.target.dataset.auto; });
  const atualizar = () => {
    if (!doc || !btn) return; const n = soDig(doc.value); const pronto = n.length === 14 && cnpjValido(n);
    btn.hidden = !pronto; btn.disabled = false; btn.lastElementChild.textContent = 'Buscar dados';
    if (n.length === 14 && !pronto) statusConsulta(el, ids.status, 'err', 'CNPJ inválido. Confira os números digitados.'); else statusConsulta(el, ids.status, '', '');
  };
  const buscarCnpj = async () => {
    const n = soDig(doc.value); if (!cnpjValido(n)) return; const t = ++tokenC; btn.disabled = true; btn.lastElementChild.textContent = 'Buscando…';
    statusConsulta(el, ids.status, 'load', '<span class="spin"></span>Consultando dados públicos do CNPJ…');
    const r = await window.venDesktop.consultarCnpj(n); if (t !== tokenC) return; btn.disabled = false; btn.lastElementChild.textContent = 'Buscar dados';
    if (!r.ok) return statusConsulta(el, ids.status, 'err', esc(MSG_CONSULTA[r.erro] || MSG_CONSULTA.indisponivel));
    const res = preencherCampos(el, ids.mapaCnpj(r.dados)); btn.hidden = true;
    statusConsulta(el, ids.status, 'ok', `Dados encontrados e preenchidos (${res.n} campo${res.n === 1 ? '' : 's'}). Confira antes de salvar.${res.mantidos ? ' O que você já tinha preenchido foi mantido.' : ''}`);
  };
  if (doc) { doc.addEventListener('input', () => { tokenC++; atualizar(); }); atualizar(); }
  if (btn) btn.addEventListener('click', buscarCnpj);
  const cep = ids.cep && el.querySelector('#' + ids.cep);
  if (cep) {
    const buscarCep = async () => {
      const n = soDig(cep.value); if (n.length !== 8) return statusConsulta(el, ids.cepStatus, '', ''); const t = ++tokenP;
      statusConsulta(el, ids.cepStatus, 'load', '<span class="spin"></span>Buscando endereço pelo CEP…');
      const r = await window.venDesktop.consultarCep(n); if (t !== tokenP) return;
      if (!r.ok) return statusConsulta(el, ids.cepStatus, 'err', esc(r.erro === 'nao-encontrado' ? 'CEP não encontrado.' : MSG_CONSULTA.indisponivel));
      const res = preencherCampos(el, ids.mapaCep(r.dados)); statusConsulta(el, ids.cepStatus, 'ok', res.n ? 'Endereço preenchido pelo CEP.' : 'Endereço já estava preenchido.');
      const f = ids.focoCep && el.querySelector('#' + ids.focoCep); f && f.focus();
    };
    cep.addEventListener('input', () => { tokenP++; if (soDig(cep.value).length === 8) buscarCep(); else statusConsulta(el, ids.cepStatus, '', ''); });
  }
}
const blocoCnpj = (rot, id, val) => `<label class="f"><span class="rot-linha">${esc(rot)}<button type="button" class="bolha" id="${id}Btn" hidden>${ic('search')}<span>Buscar dados</span></button></span><input id="${id}" value="${esc(docBR(val))}" data-mask="doc" maxlength="18" placeholder="CPF ou CNPJ"></label>`;

/* ===== Clientes ===== */
function formCliente(id, aoSalvar) {
  const d = dados(), c = id ? d.clientes.find(x => String(x.id) === String(id)) : null;
  const rua = c ? (c.street || c.address || '') : '';
  modal({
    titulo: c ? 'Editar cliente' : 'Novo cliente', sub: 'Os dados ficam salvos no backup e podem ser usados em orçamentos e vendas.', icone: 'users', tamanho: 'lg',
    corpo: `<div class="fgrid g6">
      ${campo('Nome ou razão social *', 'cNome', c && c.nome, 'maxlength="140" placeholder="Nome do cliente"', 'c6')}
      ${blocoCnpj('CPF / CNPJ', 'cDoc', c && c.doc).replace('class="f"', 'class="f c3"')}
      ${campo('Telefone / WhatsApp', 'cTel', c && c.telefone, 'data-mask="tel" maxlength="16" placeholder="(00) 00000-0000"', 'c3')}
      <div id="cStatus" class="consulta c6" hidden></div>
      ${campo('E-mail', 'cMail', c && c.email, 'type="email" maxlength="120" placeholder="cliente@email.com"', 'c4')}
      ${campo('Nascimento', 'cNasc', c && c.nascimento, 'type="date" max="' + hojeISO() + '"', 'c2')}
      <div class="sec-tit c6">Endereço</div>
      ${campo('CEP', 'cCep', c && c.cep, 'data-mask="cep" maxlength="9" inputmode="numeric" placeholder="00000-000" autocomplete="off"', 'c2', 'Preenche o endereço sozinho')}
      ${campo('Rua / avenida', 'cRua', rua, 'maxlength="160"', 'c3')}
      ${campo('Número', 'cNum', c && c.addressNumber, 'maxlength="20"', 'c1')}
      <div id="cCepStatus" class="consulta c6" hidden></div>
      ${campo('Complemento', 'cCompl', c && c.addressExtra, 'maxlength="80" placeholder="Apto, sala, casa"', 'c2')}
      ${campo('Bairro', 'cBairro', c && c.neighborhood, 'maxlength="100"', 'c2')}
      ${campo('Cidade', 'cCidade', c && c.city, 'maxlength="100"', 'c1')}
      ${campo('UF', 'cUf', c && c.state, 'maxlength="2" style="text-transform:uppercase" placeholder="RS"', 'c1')}
      <label class="f c6"><span>Observações</span><textarea id="cObs" rows="2" maxlength="500" placeholder="Opcional">${esc(c && c.notes || '')}</textarea></label>
    </div>`,
    aoAbrir: el => ligarConsultas(el, {
      doc: 'cDoc', btn: 'cDocBtn', status: 'cStatus', cep: 'cCep', cepStatus: 'cCepStatus', focoCep: 'cNum',
      mapaCnpj: x => ({ cNome: String(x.razao || x.fantasia || '').trim(), cTel: x.tel ? telBR(x.tel) : '', cMail: x.email ? String(x.email).trim().toLowerCase() : '', cRua: tituloBR([x.tipo, x.rua].filter(Boolean).join(' ')), cNum: String(x.numero || '').trim(), cCompl: tituloBR(x.compl || ''), cBairro: tituloBR(x.bairro || ''), cCidade: tituloBR(x.cidade || ''), cUf: String(x.uf || '').toUpperCase().slice(0, 2), cCep: cepBR(x.cep || ''), cObs: x.fantasia && norm(x.fantasia) !== norm(x.razao || '') ? 'Nome fantasia: ' + tituloBR(x.fantasia) : '' }),
      mapaCep: x => ({ cRua: tituloBR(x.rua), cBairro: tituloBR(x.bairro), cCidade: tituloBR(x.cidade), cUf: String(x.uf || '').toUpperCase(), cCompl: '' })
    }),
    botoes: [{ t: 'Cancelar' }, {
      t: c ? 'Salvar alterações' : 'Salvar cliente', pri: true, fn: el => {
        const nome = V(el, 'cNome').trim(); if (!nome) { toast('Informe o nome do cliente.', 'erro'); el.querySelector('#cNome').focus(); return false; }
        const doc = soDig(V(el, 'cDoc')); if (doc.length === 14 && !cnpjValido(doc)) { toast('O CNPJ informado não é válido.', 'erro'); return false; }
        const obj = { ...(c || {}), id: c ? c.id : 'CLI-' + Date.now(), nome, doc: docBR(V(el, 'cDoc')), telefone: V(el, 'cTel').trim(), email: V(el, 'cMail').trim(), nascimento: V(el, 'cNasc'), street: V(el, 'cRua').trim(), addressNumber: V(el, 'cNum').trim(), addressExtra: V(el, 'cCompl').trim(), neighborhood: V(el, 'cBairro').trim(), city: V(el, 'cCidade').trim(), state: V(el, 'cUf').trim().toUpperCase(), cep: V(el, 'cCep').trim(), notes: V(el, 'cObs').trim(), atualizado: new Date().toISOString() };
        if (obj.street) delete obj.address;
        const l = dados().clientes; gravarChave('ven_clientes', c ? l.map(x => String(x.id) === String(c.id) ? obj : x) : [...l, obj]);
        toast('Cliente salvo.'); aoSalvar ? aoSalvar(obj) : render();
      }
    }]
  });
}
function excluirCliente(id) { const c = dados().clientes.find(x => String(x.id) === String(id)); if (!c) return; confirmar('Excluir cliente?', `${c.nome} será removido. As vendas já feitas continuam no histórico.`, () => { gravarChave('ven_clientes', dados().clientes.filter(x => String(x.id) !== String(id))); toast('Cliente excluído.'); render(); }, 'Excluir', true); }
function fichaCliente(id) {
  const d = dados(), c = d.clientes.find(x => String(x.id) === String(id)); if (!c) return;
  const vs = d.vendas.filter(v => norm(v.clienteNome) === norm(c.nome)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const total = vs.reduce((a, v) => a + (Number(v.total) || 0), 0), aberto = vs.reduce((a, v) => a + saldoVenda(v), 0), end = enderecoCliente(c), waze = wazeUrl(c), wa = whatsUrl(c.telefone);
  const linha = (i, t) => t ? `<div class="kv">${ic(i)}<span>${esc(t)}</span></div>` : '';
  modal({
    titulo: c.nome, sub: c.doc ? 'CPF/CNPJ ' + c.doc : 'Ficha do cliente', icone: 'user', tamanho: 'lg',
    corpo: `<div class="ficha"><div class="ficha-col">${linha('phone', c.telefone)}${linha('mail', c.email)}${linha('pin', end)}${linha('gift', c.nascimento ? 'Aniversário em ' + dataBR(c.nascimento).slice(0, 5) : '')}${linha('info', c.notes)}
      <div class="acoes-linha">${wa ? `<button class="btn" data-x="wa">${ic('whatsapp')}WhatsApp</button>` : ''}${c.email ? `<button class="btn" data-x="mail">${ic('mail')}E-mail</button>` : ''}${waze ? `<button class="btn" data-x="waze">${ic('pin')}Rota no Waze</button>` : ''}</div></div>
      <div class="ficha-col"><div class="mini-kpis"><div><small>Compras</small><b>${vs.length}</b></div><div><small>Total comprado</small><b>${brl(total)}</b></div><div><small>Em aberto</small><b class="${aberto > 0 ? 'neg' : ''}">${brl(aberto)}</b></div></div>
      <div class="sec-tit">Últimas compras</div>${vs.length ? `<div class="lista">${vs.slice(0, 8).map(v => `<div class="li"><span><b>${numPed(v.numero)}</b> <small>${dataBR(String(v.data).slice(0, 10))}</small></span><span>${brl(v.total)} ${estadoVenda(v) === 'paid' ? pill('Recebida', 'pos') : pill('Em aberto', 'warn')}</span></div>`).join('')}</div>` : '<p class="vazio-txt">Ainda não há compras para este cliente.</p>'}</div></div>`,
    aoAbrir: el => el.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'wa') abrirExterno(wa); if (b.dataset.x === 'mail') abrirExterno('mailto:' + c.email); if (b.dataset.x === 'waze') abrirExterno(waze); }),
    botoes: [{ t: 'Excluir', perigo: true, suave: true, icone: 'trash', fn: () => { setTimeout(() => excluirCliente(id), 0); } }, { t: 'Nova venda', icone: 'cart', fn: () => { setTimeout(() => abrirPdv(null, c.nome), 0); } }, { t: 'Editar', pri: true, icone: 'edit', fn: () => { setTimeout(() => formCliente(id), 0); } }]
  });
}

/* ===== Produtos ===== */
function codigoLivre(produtos) { const usados = new Set(produtos.map(x => String(x.id).toUpperCase())); let n = 1, cod; do { cod = 'MAN-' + String(n++).padStart(4, '0'); } while (usados.has(cod)); return cod; }
function miniatura(p, cls = '') { const s = imgSegura(p && p.img); return s ? `<img class="thumb ${cls}" src="${esc(s)}" alt="" loading="lazy">` : `<span class="thumb vazio ${cls}">${ic(p && p.kind === 'service' ? 'sliders' : 'box')}</span>`; }
function formProduto(id) {
  const d = dados(), p = id ? d.produtos.find(x => String(x.id) === String(id)) : null, cod = codigoLivre(d.produtos); let foto = p ? imgSegura(p.img) : '';
  const serv = p && p.kind === 'service';
  modal({
    titulo: p ? 'Editar item' : 'Novo produto ou serviço', icone: 'box', tamanho: 'lg',
    corpo: `<div class="fgrid g6">
      <div class="c6 foto-bloco"><div class="foto-prev" id="pFotoPrev"></div><div class="foto-acoes"><b>Foto do item</b><small>Aparece na venda e nos relatórios. Aceita JPG, PNG ou WebP.</small><div><button type="button" class="btn" id="pFotoBtn">${ic('image')}Escolher foto</button><button type="button" class="btn suave" id="pFotoRm" hidden>${ic('trash')}Remover</button><input type="file" id="pFotoInp" accept="image/*" hidden></div></div></div>
      ${selecao('Tipo', 'pTipo', [['product', 'Produto'], ['service', 'Serviço']], serv ? 'service' : 'product', 'c2')}
      ${campo('Código', 'pCod', p ? p.id : cod, p ? 'disabled' : 'maxlength="60"', 'c2')}
      ${campo('Código de barras', 'pBar', p && arr(p.b)[0], 'inputmode="numeric"', 'c2')}
      ${campo('Descrição *', 'pDesc', p && p.d, 'maxlength="160"', 'c6')}
      ${campo('Preço de venda (R$)', 'pPreco', p ? moeda(p.p) : '', 'data-moeda inputmode="decimal" placeholder="0,00"', 'c2')}
      ${campo('Custo (R$)', 'pCusto', p && p.c ? moeda(p.c) : '', 'data-moeda inputmode="decimal" placeholder="0,00"', 'c2')}
      <label class="f c2" id="pMargem"><span>Margem</span><input id="pMargemV" disabled value="—"></label>
      <div id="pBlocoProd" class="fgrid g6 c6 sem-gap">
        ${campo('Estoque', 'pEst', p ? p.q : '', 'inputmode="decimal"', 'c2')}
        ${campo('Unidade', 'pUn', p ? p.unit : 'un', 'maxlength="8"', 'c2')}
        ${campo('Localização', 'pLoc', p && p.l, 'maxlength="60" placeholder="Prateleira, corredor"', 'c2')}
        <label class="f c6"><span class="rot-linha">NCM (8 números)<span class="bolhas"><button type="button" class="bolha" id="pNcmUsados">${ic('list')}<span>Já usados</span></button><button type="button" class="bolha" id="pNcmBuscar">${ic('search')}<span>Buscar NCM</span></button></span></span><input id="pNcm" value="${esc(ncmBR(p && p.ncm))}" data-mask="ncm" maxlength="10" inputmode="numeric" placeholder="0000.00.00"></label>
      </div>
      <label class="f c2 oculto" id="pBlocoServ"><span>Cobrança do serviço</span><select id="pServTipo"><option value="fixed">Valor fixo</option><option value="hourly">Por hora</option></select></label>
    </div>`,
    aoAbrir: el => {
      const prev = el.querySelector('#pFotoPrev'), rm = el.querySelector('#pFotoRm'), mostrar = () => { prev.innerHTML = foto ? `<img src="${esc(foto)}" alt="">` : ic('image'); rm.hidden = !foto; };
      mostrar(); el.querySelector('#pFotoBtn').onclick = () => el.querySelector('#pFotoInp').click(); rm.onclick = () => { foto = ''; mostrar(); };
      el.querySelector('#pFotoInp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { foto = await comprimirImagem(await lerArquivoDataUrl(f), 640, .82); mostrar(); } catch (_) { toast('Não foi possível ler a imagem.', 'erro'); } e.target.value = ''; };
      const tipo = el.querySelector('#pTipo'), sync = () => { const s = tipo.value === 'service'; el.querySelector('#pBlocoProd').classList.toggle('oculto', s); el.querySelector('#pBlocoServ').classList.toggle('oculto', !s); }; tipo.onchange = sync;
      el.querySelector('#pServTipo').value = p && p.serviceType === 'hourly' ? 'hourly' : 'fixed'; sync();
      const marg = () => { const pv = numeroBR(V(el, 'pPreco')), c = numeroBR(V(el, 'pCusto')); el.querySelector('#pMargemV').value = pv > 0 && c > 0 ? ((pv - c) / pv * 100).toFixed(1).replace('.', ',') + '%  (' + brl(pv - c) + ')' : '—'; };
      ['pPreco', 'pCusto'].forEach(i => el.querySelector('#' + i).addEventListener('input', marg)); marg();
      el.querySelector('#pNcmUsados').onclick = () => ncmUsados(n => { el.querySelector('#pNcm').value = ncmBR(n); });
      el.querySelector('#pNcmBuscar').onclick = () => buscarNcmModal(V(el, 'pDesc'), n => { el.querySelector('#pNcm').value = ncmBR(n); });
    },
    botoes: [{ t: 'Cancelar' }, {
      t: 'Salvar', pri: true, fn: el => {
        const desc = V(el, 'pDesc').trim(); if (!desc) { toast('Informe a descrição.', 'erro'); el.querySelector('#pDesc').focus(); return false; }
        const kind = V(el, 'pTipo'), ncm = soDig(V(el, 'pNcm'));
        if (kind !== 'service' && ncm.length !== 8 && !el._ncmOk) { toast(ncm ? `O NCM tem 8 números e este tem ${ncm.length}. Clique em Salvar de novo para gravar assim mesmo.` : 'Produto sem NCM. Clique em Salvar de novo para gravar assim mesmo.', 'erro'); el._ncmOk = true; return false; }
        const bar = V(el, 'pBar').trim(), hourly = V(el, 'pServTipo') === 'hourly';
        const obj = { ...(p || {}), id: p ? p.id : (V(el, 'pCod').trim() || cod), d: desc, description: p ? p.description || '' : '', p: numeroBR(V(el, 'pPreco')), c: numeroBR(V(el, 'pCusto')), q: kind === 'service' ? 0 : numeroBR(V(el, 'pEst')), l: V(el, 'pLoc').trim(), unit: kind === 'service' ? (hourly ? 'h' : 'un') : (V(el, 'pUn').trim() || 'un'), b: bar ? [bar, ...arr(p && p.b).slice(1)] : [], img: foto || '', kind, serviceType: kind === 'service' ? (hourly ? 'hourly' : 'fixed') : 'fixed', ncm: kind === 'service' ? '' : ncm, manual: p ? !!p.manual : true };
        obj.key = p ? p.key : obj.id; delete obj.s;
        const dd = dados();
        if (p && !p.manual) gravarCatalogo(dd.catalogo.map(x => String(x.id) === String(p.id) ? obj : x));
        else gravarChave('ven_produtosManuais', p ? dd.manuais.map(x => String(x.id) === String(p.id) ? obj : x) : [...dd.manuais, obj]);
        toast('Item salvo.'); render();
      }
    }]
  });
}
function excluirProduto(id) { const p = dados().produtos.find(x => String(x.id) === String(id)); if (!p) return; confirmar('Excluir item?', `${p.d} será removido do catálogo.`, () => { const dd = dados(); if (p.manual) gravarChave('ven_produtosManuais', dd.manuais.filter(x => String(x.id) !== String(id))); else gravarCatalogo(dd.catalogo.filter(x => String(x.id) !== String(id))); toast('Item excluído.'); render(); }, 'Excluir', true); }
function ncmUsados(aoEscolher) {
  const m = {}; dados().produtos.forEach(p => { const n = soDig(p.ncm); if (n.length === 8) { (m[n] = m[n] || { n: 0, ex: p.d }).n++; } });
  const l = Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, 30);
  const el = modal({ titulo: 'NCMs já usados', tamanho: 'sm', icone: 'list', corpo: l.length ? `<div class="lista sel">${l.map(([n, x]) => `<button type="button" class="li" data-n="${n}"><span><b>${ncmBR(n)}</b><small>${x.n} ${x.n === 1 ? 'produto' : 'produtos'} · ex.: ${esc(x.ex)}</small></span>${ic('chevR')}</button>`).join('')}</div>` : '<p class="vazio-txt">Nenhum produto com NCM ainda.</p>' });
  el.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { aoEscolher(b.dataset.n); el._fechar(); } });
}
function buscarNcmModal(sugestao, aoEscolher) {
  const el = modal({ titulo: 'Buscar NCM', sub: 'Pesquise pela descrição do produto. Confirme a classificação com seu contador.', tamanho: 'md', icone: 'search', corpo: `<div class="busca-linha"><input id="ncmQ" value="${esc(sugestao || '')}" placeholder="Ex.: cabo elétrico" data-sem-enter="1"><button class="btn pri" id="ncmGo">${ic('search')}Buscar</button></div><div id="ncmRes" class="lista sel mt"></div><p class="rodape-nota"><a href="#" id="ncmSite">Abrir consulta oficial (Siscomex)</a></p>` });
  const res = el.querySelector('#ncmRes'), buscar = async () => {
    const t = el.querySelector('#ncmQ').value.trim(); if (t.length < 2) { res.innerHTML = '<p class="vazio-txt">Digite pelo menos 2 letras ou parte do código.</p>'; return; }
    res.innerHTML = '<p class="vazio-txt"><span class="spin"></span>Consultando a tabela NCM…</p>'; const r = await window.venDesktop.buscarNcm(t);
    if (!r.ok) { res.innerHTML = `<p class="vazio-txt">${r.erro === 'nao-encontrado' ? 'Nada encontrado para essa busca.' : 'Não foi possível consultar agora. Verifique a internet ou use a consulta oficial.'}</p>`; return; }
    res.innerHTML = r.dados.length ? r.dados.map(x => `<button type="button" class="li" data-n="${x.codigo}"><span><b>${ncmBR(x.codigo)}</b><small>${esc(x.descricao)}</small></span>${ic('chevR')}</button>`).join('') : '<p class="vazio-txt">Nada encontrado para essa busca.</p>';
  };
  el.querySelector('#ncmGo').onclick = buscar; el.querySelector('#ncmQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
  el.querySelector('#ncmSite').onclick = e => { e.preventDefault(); abrirExterno('https://portalunico.siscomex.gov.br/classif/#/sumario?perfil=publico'); };
  el.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { aoEscolher(b.dataset.n); el._fechar(); } });
  if ((sugestao || '').trim().length >= 3) buscar();
}

/* ===== Importar NF-e (XML) ===== */
function importarNfe() {
  const el = modal({
    titulo: 'Importar NF-e (XML)', sub: 'Entrada de mercadoria: atualiza custo e estoque e cadastra o que for novo.', icone: 'xml', tamanho: 'xl',
    corpo: `<div id="nfeArea"><label class="drop" id="nfeDrop">${ic('upload')}<b>Escolha o XML da nota fiscal</b><small>Ou arraste o arquivo para cá. É o XML original recebido do fornecedor.</small><input type="file" id="nfeInp" accept=".xml,text/xml,application/xml" hidden></label></div>`,
    botoes: [{ t: 'Cancelar' }, { t: 'Importar itens', pri: true, id: 'nfeOk', fn: () => aplicarNfe(el) }]
  });
  el.querySelector('#nfeOk').disabled = true; el._nfe = null;
  const ler = async f => {
    try {
      const nfe = lerNfeXml(await f.text(), dados().produtos, lerChave('ven_nfe_importadas', [])); el._nfe = nfe; const dup = nfe.dups || [];
      const novos = nfe.itens.filter(i => !i.existente).length;
      el.querySelector('#nfeArea').innerHTML = `<div class="nfe-cab"><div><b>${esc(nfe.fornecedor || 'Fornecedor')}</b><small>NF-e ${esc(nfe.numeroNf || '')} · ${nfe.itens.length} item(ns): ${novos} novo(s), ${nfe.itens.length - novos} já cadastrado(s)</small></div>
        <label class="f inline"><span>Markup sobre o custo (só itens novos)</span><span class="input-sufixo"><input id="nfeMk" type="number" min="0" max="1000" step="1" value="0"><i>%</i></span></label></div>
        <div class="tabela peq"><table><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Custo un.</th><th class="num">Venda sugerida</th><th>NCM</th><th>Situação</th></tr></thead><tbody>${nfe.itens.map((i, n) => `<tr><td><b>${esc(i.nome)}</b><small class="sub">${esc(i.codigo)}${i.ean ? ' · ' + esc(i.ean) : ''}</small></td><td class="num">${i.q}</td><td class="num">${brl(i.custoEstimado)}</td><td class="num" data-venda="${n}">${i.existente ? 'mantém' : '—'}</td><td>${esc(ncmBR(i.ncm) || '—')}</td><td>${i.existente ? pill('Atualiza', 'brand') : pill('Novo', 'pos')}</td></tr>`).join('')}</tbody></table></div>
        ${nfe.dups.length ? `<label class="chk-linha"><input type="checkbox" id="nfeDup" checked><span>Lançar ${nfe.dups.length} parcela(s) em Contas a pagar<small>${nfe.dups.map(x => dataBR(x.venc) + ' ' + brl(x.valor)).join(' · ')}</small></span></label>` : ''}`;
      const mk = el.querySelector('#nfeMk'), sync = () => { const m = Math.max(0, Number(mk.value) || 0); nfe.itens.forEach((i, n) => { const c = el.querySelector(`[data-venda="${n}"]`); if (c && !i.existente) c.textContent = m > 0 ? brl(i.custoEstimado * (1 + m / 100)) : '—'; }); }; mk.oninput = sync; sync();
      el.querySelector('#nfeOk').disabled = false;
    } catch (e) { toast(e.message || 'Não foi possível ler o XML.', 'erro'); }
  };
  const inp = el.querySelector('#nfeInp'), drop = el.querySelector('#nfeDrop');
  inp.onchange = () => inp.files[0] && ler(inp.files[0]);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('sobre'); }; drop.ondragleave = () => drop.classList.remove('sobre'); drop.ondrop = e => { e.preventDefault(); drop.classList.remove('sobre'); e.dataTransfer.files[0] && ler(e.dataTransfer.files[0]); };
  drop.onclick = e => { if (e.target !== inp) inp.click(); };
}
function aplicarNfe(el) {
  const nfe = el._nfe; if (!nfe) return false; const mk = Math.max(0, Number(el.querySelector('#nfeMk').value) || 0); let novos = 0, atualizados = 0;
  const dd = dados(); let manuais = dd.manuais.slice(); let catalogo = dd.catalogo.slice();
  nfe.itens.forEach(n => {
    const custo = n.custoEstimado || n.custo || 0;
    if (n.existente) {
      const ix = manuais.findIndex(x => String(x.id) === n.existente);
      if (ix >= 0) { const m = manuais[ix]; manuais[ix] = { ...m, c: custo, q: (Number(m.q) || 0) + n.q, b: n.ean && !arr(m.b).includes(n.ean) ? [...arr(m.b), n.ean] : m.b, ncm: m.ncm || n.ncm }; }
      else { const jx = catalogo.findIndex(x => String(x.id) === n.existente); if (jx >= 0) { const m = catalogo[jx], b = arr(m.b); catalogo[jx] = { ...m, c: custo, q: (Number(m.q) || 0) + n.q, b: n.ean && !b.includes(n.ean) ? [...b, n.ean] : b, ncm: m.ncm || n.ncm }; } }
      atualizados++;
    } else {
      let id = String(n.codigo).slice(0, 60); const todos = [...manuais, ...catalogo]; if (!id || todos.some(p => String(p.id) === id)) id = codigoLivre(todos);
      manuais.push({ id, d: n.nome, description: 'Importado de NF-e', c: custo, p: mk > 0 ? r2(custo * (1 + mk / 100)) : 0, q: n.q, l: 'Entrada NF-e', b: n.ean ? [n.ean] : [], img: '', manual: true, key: id, kind: 'product', serviceType: 'fixed', unit: (n.un || 'un').toLowerCase().slice(0, 8), ncm: n.ncm, attrs: {} }); novos++;
    }
  });
  gravarChave('ven_produtosManuais', manuais); if (catalogo.length) gravarCatalogo(catalogo);
  const dupBox = el.querySelector('#nfeDup'); let contas = 0;
  if (dupBox && dupBox.checked) { const l = dados().pagar.slice(); nfe.dups.forEach(x => { l.push({ id: novoId(), descricao: `NF-e ${nfe.numeroNf} - ${nfe.fornecedor}`.slice(0, 100), fornecedor: nfe.fornecedor, cnpj: '', documento: nfe.numeroNf, categoria: 'Fornecedores', valor: x.valor, vencimento: x.venc, linha: '', pix: '', obs: '', status: 'pendente', origem: 'nfe', criadoEm: new Date().toISOString() }); contas++; }); gravarChave('ven_contasPagar', l); }
  if (nfe.chave) { const k = lerChave('ven_nfe_importadas', []); if (!k.includes(nfe.chave)) { k.push(nfe.chave); gravarChave('ven_nfe_importadas', k); } }
  toast(`Importação concluída: ${novos} novo(s), ${atualizados} atualizado(s)${contas ? ', ' + contas + ' conta(s) a pagar' : ''}.`); render();
}
