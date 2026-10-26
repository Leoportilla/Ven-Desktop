'use strict';
/* Consultas públicas feitas no processo principal (sem CORS). Funções puras e testáveis. */
const HOSTS_PERMITIDOS = new Set(['brasilapi.com.br', 'open.cnpja.com', 'viacep.com.br']);

async function pegarJson(url, { tempo = 12000, fetchImpl = globalThis.fetch } = {}) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !HOSTS_PERMITIDOS.has(u.hostname)) throw new Error('indisponivel');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), tempo);
  try {
    const r = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (r.status === 404 || r.status === 400) { const e = new Error('nao-encontrado'); e.codigo = r.status; throw e; }
    if (!r.ok) throw new Error('indisponivel');
    return await r.json();
  } finally { clearTimeout(t); }
}

function cnpjValido(n) {
  n = String(n || '').replace(/\D/g, ''); if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const dv = (base, pesos) => { let t = 0; for (let i = 0; i < pesos.length; i++) t += Number(base[i]) * pesos[i]; const r = t % 11; return r < 2 ? 0 : 11 - r; };
  return dv(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(n[12]) && dv(n, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(n[13]);
}

function normalizarCnpj(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.razao_social || raw.nome_fantasia) return { razao: raw.razao_social, fantasia: raw.nome_fantasia, tipo: raw.descricao_tipo_de_logradouro, rua: raw.logradouro, numero: raw.numero, compl: raw.complemento, bairro: raw.bairro, cidade: raw.municipio, uf: raw.uf, cep: raw.cep, tel: raw.ddd_telefone_1 || raw.ddd_telefone_2, email: raw.email };
  if (raw.data && typeof raw.data === 'object') { const d = raw.data; return { razao: d.razaoSocial || d.razao_social, fantasia: d.nomeFantasia || d.nome_fantasia, tipo: d.descricao_tipo_de_logradouro || d.tipoLogradouro, rua: d.logradouro, numero: d.numero, compl: d.complemento, bairro: d.bairro, cidade: d.municipio, uf: d.uf, cep: d.cep, tel: d.telefone || d.ddd_telefone_1, email: d.email }; }
  if (raw.company) { const a = raw.address || {}, ph = (raw.phones || [])[0], em = (raw.emails || [])[0]; return { razao: raw.company.name, fantasia: raw.alias, rua: a.street, numero: a.number, compl: a.details, bairro: a.district, cidade: a.city, uf: a.state, cep: a.zip, tel: ph ? String(ph.area || '') + String(ph.number || '') : '', email: em && em.address }; }
  return null;
}

async function consultarCnpj(cnpj, opts) {
  const n = String(cnpj || '').replace(/\D/g, ''); if (!cnpjValido(n)) throw new Error('invalido');
  let falha = null;
  for (const url of ['https://brasilapi.com.br/api/cnpj/v1/' + n, 'https://open.cnpja.com/office/' + n]) {
    try { const d = normalizarCnpj(await pegarJson(url, opts)); if (d && (d.razao || d.fantasia)) return d; falha = new Error('nao-encontrado'); }
    catch (e) { falha = e; }
  }
  throw falha || new Error('nao-encontrado');
}

async function consultarCep(cep, opts) {
  const n = String(cep || '').replace(/\D/g, ''); if (n.length !== 8) throw new Error('invalido');
  let falha = null;
  try { const j = await pegarJson('https://viacep.com.br/ws/' + n + '/json/', opts); if (j && !j.erro) return { rua: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '', compl: j.complemento || '' }; falha = new Error('nao-encontrado'); }
  catch (e) { falha = e; }
  try { const j = await pegarJson('https://brasilapi.com.br/api/cep/v2/' + n, opts); if (j && (j.city || j.street)) return { rua: j.street || '', bairro: j.neighborhood || '', cidade: j.city || '', uf: j.state || '', compl: '' }; }
  catch (e) { if (!falha || falha.message !== 'nao-encontrado') falha = e; }
  throw falha || new Error('nao-encontrado');
}

async function buscarNcm(texto, opts) {
  const t = String(texto || '').trim(); if (t.length < 2) throw new Error('curto');
  const semAcento = v => v.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const consultas = [t]; if (semAcento(t).toLowerCase() !== t.toLowerCase()) consultas.push(semAcento(t));
  let l = [], erro = null;
  for (const q of consultas) {
    try {
      const r = await pegarJson('https://brasilapi.com.br/api/ncm/v1?search=' + encodeURIComponent(q), opts);
      const a = Array.isArray(r) ? r : (Array.isArray(r && r.data) ? r.data : (Array.isArray(r && r.items) ? r.items : []));
      l = a.filter(x => String(x.codigo || x.code || '').replace(/\D/g, '').length === 8); if (l.length) break;
    } catch (e) { erro = e; }
  }
  if (!l.length && erro) throw erro;
  const vistos = new Set();
  return l.map(x => ({ codigo: String(x.codigo || x.code).replace(/\D/g, ''), descricao: String(x.descricao || x.description || '') })).filter(x => !vistos.has(x.codigo) && vistos.add(x.codigo)).slice(0, 30);
}

module.exports = { cnpjValido, normalizarCnpj, consultarCnpj, consultarCep, buscarNcm, pegarJson, HOSTS_PERMITIDOS };
