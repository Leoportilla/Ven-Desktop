'use strict';
/* ===== Navegação e estrutura ===== */
function atualizarRodapeLateral() { const e = $('#arquivoInfo'); if (e) e.innerHTML = backup ? `<span class="pt ${salvoEm ? 'ok' : ''}"></span>${esc(salvoEm ? 'Salvo às ' + salvoEm : (origem || 'Backup carregado'))}` : '<span class="pt"></span>Nenhum backup aberto'; }
function renderNav() {
  $('#nav').innerHTML = GRUPOS_NAV.map(([g, ks]) => `<div class="nav-grupo">${g ? `<span>${g}</span>` : ''}${ks.map(k => { const t = TELAS.find(x => x[0] === k); return `<button data-tela="${k}" class="${k === tela ? 'on' : ''} ${k === 'pdv' ? 'destaque' : ''}">${ic(t[2])}<b>${esc(t[1])}</b></button>`; }).join('')}</div>`).join('');
  const t = TELAS.find(x => x[0] === tela) || TELAS[0]; $('#titulo').textContent = t[1]; $('#subtitulo').textContent = t[3] || '';
  const li = !['inicio', 'pdv', 'relatorios', 'calendario', 'config'].includes(tela); $('#busca').parentElement.style.visibility = li ? 'visible' : 'hidden';
  atualizarRodapeLateral();
}
const VIEWS = { inicio: vInicio, pdv: vPdv, pedidos: vPedidos, clientes: vClientes, produtos: vProdutos, pagar: vPagar, receber: vReceber, calendario: vCalendario, relatorios: vRelatorios, config: vConfig };
function telaBoasVindas() {
  return `<div class="boas"><img src="ven-logo.png" alt="VEN"><h2>Bem-vindo ao VEN para computador</h2><p>Abra o backup gerado no celular ou sincronize com o Google Drive. Se preferir, comece do zero.</p>
  <div class="boas-acoes"><button class="btn pri grande" id="bvAbrir">${ic('folder')}Abrir backup</button><button class="btn grande" id="bvDrive">${ic('cloud')}Usar Google Drive</button><button class="btn grande suave" id="bvZero">Começar do zero</button></div></div>`;
}
function render() {
  renderNav(); const c = $('#conteudo'); c.onclick = c.oninput = c.onchange = c.onkeydown = null; c.classList.toggle('pdv-tela', tela === 'pdv' && !!backup);
  if (!backup) { c.innerHTML = telaBoasVindas(); $('#bvAbrir').onclick = abrir; $('#bvDrive').onclick = () => { tela = 'config'; sub.cfg = 'nuvem'; novoBackupVazio(); }; $('#bvZero').onclick = novoBackupVazio; return; }
  if (tela === 'pdv' && !pdv) pdv = { view: 'lista', edit: null, cli: '', desc: 0, tipo: '%', obs: '', itens: [], cat: 'todos' };
  const y = c.scrollTop; c.innerHTML = VIEWS[tela](dados()); c.scrollTop = tela === ultimaTelaRender ? y : 0; ultimaTelaRender = tela;
  if (tela === 'pdv') ligarPdv(); if (tela === 'config') { ({ empresa: ligarEmpresa, impressao: ligarImpressao, nuvem: ligarNuvem, dados: ligarDados }[sub.cfg || 'empresa'] || (() => { }))(); }
  aplicarMascaras(c);
}
let ultimaTelaRender = '';
function novoBackupVazio() { backup = { app: 'VEN Vendas', format: 1, createdAt: new Date().toISOString(), storage: {} }; origem = 'Novo (neste computador)'; salvoEm = ''; agendarGravacao(); render(); }
function irPara(k) {
  if (k === tela && k !== 'pdv') return;
  if (tela === 'pdv' && pdv && pdv.itens.length && k !== 'pdv') { confirmar('Sair da venda?', 'Os itens do carrinho ainda não foram salvos.', () => { pdv = null; tela = k; termo = ''; $('#busca').value = ''; render(); }, 'Descartar e sair', true); return; }
  if (k !== 'pdv') pdv = null; tela = k; termo = ''; $('#busca').value = ''; render();
}
async function abrir() { const r = await window.venDesktop.abrirBackup(); if (!r.ok) return toast(r.erro || 'Não foi possível abrir o backup.', 'erro'); if (!r.dados) return; backup = r.dados; origem = r.origem || ''; salvoEm = ''; toast('Backup carregado.'); render(); }
async function salvarCopia() { if (!backup) return toast('Abra um backup primeiro.', 'erro'); const r = await window.venDesktop.salvarCopia(JSON.stringify(backup)); if (!r.ok) return toast(r.erro || 'Não foi possível salvar.', 'erro'); if (r.salvo) toast('Cópia salva. Leve o arquivo ao celular em Restaurar backup.'); }

/* ===== Máscaras ===== */
const MASCARAS = { doc: docBR, tel: telBR, cep: cepBR, ncm: ncmBR };
function aplicarMascaras(raiz) { (raiz || document).querySelectorAll('[data-mask]').forEach(i => { i.dataset.mascarado = '1'; }); }
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset) return;
  if (t.dataset.mask && MASCARAS[t.dataset.mask] && e.inputType !== 'deleteContentBackward') { const v = MASCARAS[t.dataset.mask](t.value); if (v !== t.value) t.value = v; }
});
document.addEventListener('focusout', e => { const t = e.target; if (t.dataset && t.dataset.moeda != null && t.value.trim()) t.value = moeda(numeroBR(t.value)); });
document.addEventListener('focusin', e => { const t = e.target; if (t.matches && t.matches('input[data-moeda]')) setTimeout(() => t.select(), 0); });

/* ===== Ações ===== */
const MENUS = {
  venda: (n, el) => [{ t: 'Imprimir / PDF / WhatsApp', icone: 'print', fn: () => { const v = dados().vendas.find(x => Number(x.numero) === Number(n)); v && menuImprimir(el, docDeVenda(v)); } }, { t: 'Reabrir como pedido', icone: 'undo', fn: () => reabrirVenda(n) }, '-', { t: 'Excluir venda', icone: 'trash', perigo: true, fn: () => excluirPedido('venda', n) }],
  orc: (n, el) => [{ t: 'Editar pedido', icone: 'edit', fn: () => abrirPdv(n) }, { t: 'Imprimir orçamento', icone: 'print', fn: () => { const o = dados().pedidos.find(x => Number(x.numero) === Number(n)); o && menuImprimir(el, docDePedido(o)); } }, '-', { t: 'Excluir pedido', icone: 'trash', perigo: true, fn: () => excluirPedido('orc', n) }],
  conta: id => { const c = dados().pagar.find(x => String(x.id) === String(id)) || {}; return [{ t: 'Editar', icone: 'edit', fn: () => editarConta(id) }, ...(c.status === 'paga' ? [{ t: 'Desfazer pagamento', icone: 'undo', fn: () => desfazerPagamento(id) }] : []), ...(c.linha ? [{ t: 'Copiar linha digitável', icone: 'copy', fn: () => navigator.clipboard.writeText(soDig(c.linha)).then(() => toast('Código copiado.')) }] : []), ...(c.pix ? [{ t: 'Copiar Pix copia e cola', icone: 'pix', fn: () => navigator.clipboard.writeText(c.pix).then(() => toast('Pix copiado.')) }] : []), '-', { t: 'Excluir', icone: 'trash', perigo: true, fn: () => excluirConta(id) }]; },
  rcv: n => [{ t: 'Abrir venda', icone: 'eye', fn: () => verPedido('venda', n) }, { t: 'Desfazer último recebimento', icone: 'undo', fn: () => { const v = dados().vendas.find(x => Number(x.numero) === Number(n)); if (v && vendaTemRecebimento(v)) desfazerRecebimento(n); else toast('Esta venda não tem recebimentos.', 'erro'); } }],
  rca: id => { const c = dados().avulso.find(x => String(x.id) === String(id)); return c && c.vendaNumero ? (c.status === 'recebida' ? [{ t: 'Desfazer recebimento', icone: 'undo', fn: () => desfazerReceita(id) }] : [{ t: 'Abrir venda', icone: 'eye', fn: () => verPedido('venda', c.vendaNumero) }]) : [{ t: 'Editar', icone: 'edit', fn: () => formReceita(id) }, { t: 'Excluir', icone: 'trash', perigo: true, fn: () => excluirReceita(id) }]; }
};
const ACOES = {
  pdv: () => irPara('pdv'), ir: k => irPara(k), novaConta: () => { filaContas = []; formConta(rascunhoVazio()); }, importarConta: abrirImportarConta, novaReceita: () => formReceita(), novoCliente: () => formCliente(), novoProduto: () => formProduto(), importarNfe: importarNfe,
  ver: (k, n) => verPedido(k, n), fechar: n => fecharVendaModal(n), receberV: n => receberVenda(n), vendaCli: id => { const c = dados().clientes.find(x => String(x.id) === id); abrirPdv(null, c && c.nome); },
  editProd: id => formProduto(id), delProd: id => excluirProduto(id), editCli: id => formCliente(id), delCli: id => excluirCliente(id), ficha: id => fichaCliente(id),
  pagar: id => pagarConta(id), undoPg: id => desfazerPagamento(id), anexo: id => abrirAnexoConta(id), receberA: id => receberReceita(id), undoA: id => desfazerReceita(id), cobrar: (t, id) => cobrarWhats(t, id),
  dia: iso => diaCalendario(iso), exportarCsv: exportarCsv,
  menu: (tipo, id, el) => abrirMenu(el, MENUS[tipo](id, el))
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (a && !a.closest('.modal-bg') && (!a.closest('.pdv') || /^(menu|ir)/.test(a.dataset.act) || false)) { /* tratada abaixo */ }
  if (a && !(a.closest('#conteudo.pdv-tela') && /^pdv(Limpar|Salvar|Fechar)$/.test(a.dataset.act))) { const [fn, ...args] = a.dataset.act.split(':'); if (ACOES[fn]) { ACOES[fn](...args, a); return; } }
  const n = e.target.closest('[data-tela]'); if (n) return irPara(n.dataset.tela);
  const s = e.target.closest('[data-sub]'); if (s) { const [k, v] = s.dataset.sub.split(':'); sub[k] = v; return render(); }
  const m = e.target.closest('[data-mes]'); if (m && !m.disabled) { const [k, dlt] = m.dataset.mes.split(':'), ref = sub[k] || ymHoje(); sub[k] = ymSoma(ref, Number(dlt)); return render(); }
  const th = e.target.closest('[data-tema]'); if (th) { salvarConfig({ tema: th.dataset.tema }).then(render); }
});
let tBusca; $('#busca').addEventListener('input', e => { termo = e.target.value; clearTimeout(tBusca); tBusca = setTimeout(() => { const pos = e.target.selectionStart; render(); const b = $('#busca'); b.focus(); try { b.setSelectionRange(pos, pos); } catch (_) { } }, 120); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (menuAberto) return fecharMenu(); if (modais.length) return modais[modais.length - 1]._fechar(); }
  if (modais.length) return; const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 'k') { e.preventDefault(); paleta(); }
  else if (ctrl && k === 'o') { e.preventDefault(); abrir(); }
  else if (ctrl && k === 'n' && backup) { e.preventDefault(); irPara('pdv'); }
  else if (e.altKey && /^[0-9]$/.test(e.key)) { e.preventDefault(); const ks = GRUPOS_NAV.flatMap(g => g[1]), i = e.key === '0' ? 9 : Number(e.key) - 1; if (ks[i] && backup) irPara(ks[i]); }
  else if (tela === 'pdv' && pdv && e.key === 'F8') { e.preventDefault(); salvarOrcamento(false); }
  else if (tela === 'pdv' && pdv && e.key === 'F9') { e.preventDefault(); salvarOrcamento(true); }
  else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && $('#busca').offsetParent) { e.preventDefault(); $('#busca').focus(); }
});

/* ===== Paleta de comandos (Ctrl+K) ===== */
function paleta() {
  if (!backup) return; const d = dados();
  const cmds = [...TELAS.map(t => ({ t: 'Ir para ' + t[1], icone: t[2], fn: () => irPara(t[0]) })), { t: 'Nova venda', icone: 'cart', fn: () => irPara('pdv') }, { t: 'Importar conta a pagar', icone: 'download', fn: abrirImportarConta }, { t: 'Novo cliente', icone: 'user', fn: () => formCliente() }, { t: 'Novo produto', icone: 'box', fn: () => formProduto() }, { t: 'Nova receita', icone: 'receber', fn: () => formReceita() },
    ...d.clientes.map(c => ({ t: c.nome, d: 'Cliente', icone: 'user', fn: () => fichaCliente(c.id) })), ...d.vendas.slice(0, 200).map(v => ({ t: numPed(v.numero) + ' · ' + (v.clienteNome || 'Sem cliente'), d: brl(v.total), icone: 'receipt', fn: () => verPedido('venda', v.numero) })), ...d.produtos.slice(0, 500).map(p => ({ t: p.d || p.description || p.id, d: 'Produto · ' + brl(p.p), icone: 'box', fn: () => formProduto(p.id) }))];
  const el = modal({ titulo: 'Busca rápida', icone: 'search', tamanho: 'md', corpo: `<input id="pq" class="paleta-in" placeholder="Digite um cliente, produto, pedido ou comando…" autocomplete="off"><div id="pr" class="paleta-res"></div>`, botoes: [{ t: 'Fechar' }] });
  let sel = 0, lista = []; const pr = el.querySelector('#pr'), pq = el.querySelector('#pq');
  const desenhar = () => { const q = norm(pq.value); lista = (q ? cmds.filter(c => norm(c.t + ' ' + (c.d || '')).includes(q)) : cmds.slice(0, 14)).slice(0, 12); sel = Math.min(sel, Math.max(0, lista.length - 1)); pr.innerHTML = lista.length ? lista.map((c, i) => `<button data-i="${i}" class="${i === sel ? 'on' : ''}">${ic(c.icone)}<span>${esc(c.t)}</span><small>${esc(c.d || '')}</small></button>`).join('') : '<p class="mut pad">Nada encontrado.</p>'; };
  const abrirSel = () => { const c = lista[sel]; if (c) { el._fechar(); setTimeout(c.fn, 0); } };
  pq.oninput = () => { sel = 0; desenhar(); }; pr.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { sel = +b.dataset.i; abrirSel(); } };
  pq.onkeydown = e => { if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, lista.length - 1); desenhar(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); desenhar(); e.preventDefault(); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); abrirSel(); } };
  desenhar(); pq.focus();
}

/* ===== Google Drive e dados ===== */
const googleCredModal = $('#googleCredModal');
async function ligarNuvem() {
  const conectar = $('#btnDriveConectar'), sync = $('#btnDriveSync'), sair = $('#btnDriveSair'); if (!conectar) return;
  const estado = async () => { let ok = false; try { ok = !!(await window.venDesktop.driveEstado()).conectado; } catch (_) { } $('#nuvemSub').textContent = ok ? 'Conectado. Pronto para sincronizar.' : 'Não conectado. Conecte para trazer o backup do celular.'; conectar.hidden = ok; sair.hidden = !ok; return ok; };
  estado();
  conectar.onclick = () => { $('#googleClientSecret').value = ''; googleCredModal.hidden = false; $('#googleClientSecret').focus(); };
  sair.onclick = async () => { try { await window.venDesktop.driveDesconectar(); } catch (_) { } toast('Google desconectado.'); estado(); };
  sync.onclick = () => sincronizarAgora();
  $('#btnDriveSubst').onclick = async () => {
    if (!(await estado())) return toast('Primeiro conecte sua conta Google.', 'erro');
    confirmar('Substituir pelos dados do celular?', 'Tudo o que está neste PC será trocado pelo backup mais recente do Drive. Uma cópia dos dados atuais é salva antes. Para juntar os dois lados sem perder nada, use "Sincronizar agora".', async () => {
      toast('Procurando backup no Google Drive…');
      try { const r = await window.venDesktop.driveSincronizar(); if (!r.ok) return toast(r.erro || 'Não foi possível sincronizar.', 'erro'); backup = r.dados; origem = r.nome; salvoEm = ''; await salvarConfig({ syncBase: null }); toast('Dados substituídos: ' + r.nome); render(); } catch (e) { toast(e.message || 'Falha na sincronização.', 'erro'); }
    }, 'Substituir', true);
  };
  if (cfg.syncEm) { const s = $('#nuvemSub'); const t = () => { s.dataset.extra = ' Última sincronização: ' + new Date(cfg.syncEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '.'; }; t(); setTimeout(() => { s.textContent += s.dataset.extra; }, 400); }
}
/* ===== Sincronização com o celular (junta os dois lados) ===== */
let sincronizando = false;
async function sincronizarAgora() {
  if (sincronizando) return; if (!backup) return toast('Abra ou crie os dados primeiro.', 'erro');
  let ok = false; try { ok = !!(await window.venDesktop.driveEstado()).conectado; } catch (_) { }
  if (!ok) { toast('Conecte sua conta Google para sincronizar.', 'erro'); tela = 'config'; sub.cfg = 'nuvem'; render(); return; }
  sincronizando = true; const bt = $('#btnSync'), tx = $('#btnSyncTxt'); bt.disabled = true; tx.textContent = 'Sincronizando…';
  try {
    const r = await window.venDesktop.syncBaixar(); if (!r.ok) throw new Error(r.erro || 'Não foi possível ler o Drive.');
    const remoto = r.vazio ? {} : JSON.parse(r.texto).storage;
    const m = VENSync.mesclar(backup.storage, remoto, cfg.syncBase || {});
    const naoVen = {}; Object.keys(backup.storage).forEach(k => { if (!k.startsWith('ven_')) naoVen[k] = backup.storage[k]; });
    const novo = { app: 'VEN Vendas', format: 1, createdAt: new Date().toISOString(), origin: 'sync-pc', storage: { ...naoVen, ...m.storage } };
    await window.venDesktop.syncCopia(JSON.stringify(backup));
    const up = await window.venDesktop.syncEnviar(JSON.stringify(novo)); if (!up.ok) throw new Error(up.erro || 'Não foi possível enviar ao Drive.');
    backup = novo; origem = 'Sincronizado com o celular'; salvoEm = ''; agendarGravacao(); await salvarConfig({ syncBase: m.base, syncEm: new Date().toISOString() });
    toast(r.vazio ? 'Dados deste PC enviados ao Drive. Agora sincronize no celular.' : 'Sincronizado: ' + VENSync.resumoTexto(m.resumo) + '.'); render();
  } catch (e) { toast('Sincronização não concluída: ' + (e.message || e), 'erro'); }
  finally { sincronizando = false; bt.disabled = false; tx.textContent = 'Sincronizar'; }
}
$('#btnSync').onclick = sincronizarAgora;
$('#googleCredCancel').onclick = () => { googleCredModal.hidden = true; };
$('#googleCredContinue').onclick = async () => {
  const segredo = $('#googleClientSecret').value.trim(); if (!segredo) { toast('Cole a chave secreta do cliente OAuth.', 'erro'); return; }
  $('#googleCredContinue').disabled = true; toast('Abrindo autorização do Google…');
  try { const r = await window.venDesktop.driveConectar(segredo); if (!r.ok) toast(r.erro || 'Falha ao conectar ao Google.', 'erro'); else { googleCredModal.hidden = true; toast('Google Drive conectado.'); if (tela === 'config') render(); } } catch (e) { toast(e.message || 'Falha ao conectar.', 'erro'); } finally { $('#googleCredContinue').disabled = false; }
};
$('#googleClientSecret').addEventListener('keydown', e => { if (e.key === 'Enter') $('#googleCredContinue').click(); if (e.key === 'Escape') googleCredModal.hidden = true; });
async function ligarDados() {
  $('#btnAbrir').onclick = abrir; $('#btnSalvar').onclick = salvarCopia; $('#btnPasta').onclick = () => window.venDesktop.abrirPastaDados();
  try { const i = await window.venDesktop.dadosInfo(), d = dados(); $('#dadosInfo').innerHTML = `<div><span>Versão do VEN</span><b>${esc(i.versao)}</b></div><div><span>Pasta de dados</span><b class="quebra">${esc(i.pasta)}</b></div><div><span>Registros</span><b>${d.vendas.length} vendas · ${d.clientes.length} clientes · ${d.produtos.length} produtos · ${d.pagar.length} contas</b></div>`; } catch (_) { }
}
$('#btnAbrirTopo').onclick = abrir; $('#btnPaleta').onclick = paleta;
$('#btnAtualizar').onclick = async () => {
  const b = $('#btnAtualizar'); b.disabled = true;
  try {
    toast('Verificando atualizações do VEN…');
    const r = await window.venDesktop.verificarAtualizacao();
    if (!r.ok) return toast(r.erro || 'Não foi possível verificar atualizações.', 'erro');
    if (!r.disponivel) return toast('O VEN já está atualizado.');
    const sim = confirmar('Nova versão disponível', `A versão ${r.versao} está disponível. Deseja baixar e instalar agora? Os dados da loja serão preservados.`, async () => {
      toast('Baixando e verificando a atualização…');
      const x = await window.venDesktop.instalarAtualizacao();
      if (!x.ok) toast(x.erro || 'Não foi possível atualizar o VEN.', 'erro');
      else if (!x.iniciada) toast('O VEN já está atualizado.');
    }, 'Atualizar');
  } catch (e) { toast(e.message || 'Falha ao verificar atualizações.', 'erro'); }
  finally { b.disabled = false; }
};
(async () => {
  await carregarConfig();
  try { const r = await window.venDesktop.carregarSalvo(); if (r.ok && r.dados) { backup = r.dados; origem = 'Último aberto'; } else if (r.ok === false) toast(r.erro, 'erro'); } catch (_) { }
  render();
})();
