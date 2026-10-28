'use strict';
/* VENSync: mescla os dados do celular e do PC (mesmo código nos dois apps).
   Entrada e saída: objetos {chave: "json em texto"} no formato do backup (storage).
   Usa o estado da última sincronização (base, só hashes) para saber o que mudou em cada lado. */
(function (root) {
  const estavel = v => Array.isArray(v) ? '[' + v.map(estavel).join(',') + ']' : (v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
  const cyrb = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
  const H = v => cyrb(estavel(v));
  const parse = (t, pad) => { if (t == null) return pad; try { const v = JSON.parse(t); return v == null ? pad : v; } catch (_) { return pad; } };
  const arr = v => Array.isArray(v) ? v : [];
  const LISTAS = { ven_vendas: r => String(r.numero), ven_orcamentosSalvos: r => String(r.numero), ven_clientes: r => String(r.id), ven_produtosManuais: r => String(r.id), ven_contasPagar: r => String(r.id), ven_receberAvulso: r => String(r.id) };
  const ESCALARES = ['ven_empresa'];
  const LOCAL_APENAS = /^(ven_syncBase|ven_drive|ven_backupAuto|ven_cart|ven_cfg|ven_visual|ven_pin|ven_update|ven_ultimoNumero|ven_nfe_importadas|ven_catalogoImportado|ven_cpa_)/;
  const mais = (a, b) => String(a.atualizado || '') >= String(b.atualizado || '') ? a : b;

  function mesclarLista(chave, L, R, B, rel, idf) {
    const mL = new Map(L.map(r => [idf(r), r])), mR = new Map(R.map(r => [idf(r), r])), ids = [...new Set([...mL.keys(), ...mR.keys()])], saida = [], novaBase = {};
    ids.forEach(id => {
      const l = mL.get(id), r = mR.get(id), hb = B ? B[id] : undefined; let esc = null;
      if (l && r) {
        const hl = H(l), hr = H(r);
        if (hl === hr) esc = l; else if (hb === hl) { esc = r; rel.alterados++; } else if (hb === hr) { esc = l; } else { esc = (l.atualizado && r.atualizado) ? mais(l, r) : l; rel.conflitos++; }
      } else if (l) { if (hb !== undefined && H(l) === hb) rel.removidos++; else esc = l; }
      else { if (hb !== undefined && H(r) === hb) rel.removidos++; else { esc = r; rel.adicionados++; } }
      if (esc) { saida.push(esc); novaBase[id] = H(esc); }
    });
    return { lista: saida, base: novaBase };
  }

  function mesclar(local, remoto, base) {
    local = local || {}; remoto = remoto || {}; base = base || {};
    const rel = { adicionados: 0, removidos: 0, alterados: 0, conflitos: 0, renumerados: 0 };
    const out = {}, novaBase = {};
    let lp = arr(parse(local.ven_orcamentosSalvos, [])), rp = arr(parse(remoto.ven_orcamentosSalvos, [])), lv = arr(parse(local.ven_vendas, [])), rv = arr(parse(remoto.ven_vendas, []));
    const num = x => Number(x) || 0;
    // numeração: dois aparelhos podem ter criado o mesmo número para pedidos diferentes
    let maxP = Math.max(0, num(parse(local.ven_ultimoNumeroOrcamento, 0)), num(parse(remoto.ven_ultimoNumeroOrcamento, 0)), ...lp.map(p => num(p.numero)), ...rp.map(p => num(p.numero)));
    let maxV = Math.max(0, num(parse(local.ven_ultimoNumeroVenda, 0)), num(parse(remoto.ven_ultimoNumeroVenda, 0)), ...lv.map(v => num(v.numero)), ...rv.map(v => num(v.numero)));
    const mapP = {}, mapV = {};
    rp = rp.map(p => { const l = lp.find(x => String(x.numero) === String(p.numero)); if (l && String(l.data) !== String(p.data)) { const n = ++maxP; mapP[p.numero] = n; rel.renumerados++; return { ...p, numero: n }; } return p; });
    rv = rv.map(v => (mapP[v.orcamentoNumero] ? { ...v, orcamentoNumero: mapP[v.orcamentoNumero] } : v));
    rv = rv.map(v => { const l = lv.find(x => String(x.numero) === String(v.numero)); if (l && String(l.orcamentoNumero) !== String(v.orcamentoNumero)) { const n = ++maxV; mapV[v.numero] = { de: v.numero, para: n, orc: v.orcamentoNumero }; rel.renumerados++; return { ...v, numero: n }; } return v; });
    const porOrc = {}; Object.values(mapV).forEach(m => { porOrc[m.orc] = m.para; });
    rp = rp.map(p => (porOrc[p.numero] ? { ...p, vendaNumero: porOrc[p.numero] } : p));
    const listasRemotas = { ven_orcamentosSalvos: rp, ven_vendas: rv };
    Object.keys(LISTAS).forEach(k => {
      const L = arr(parse(local[k], [])), R = listasRemotas[k] || arr(parse(remoto[k], []));
      if (local[k] == null && remoto[k] == null) return;
      const r = mesclarLista(k, L, R, base[k], rel, LISTAS[k]); let l = r.lista;
      if (k === 'ven_vendas' || k === 'ven_orcamentosSalvos') l = l.slice().sort((a, b) => num(b.numero) - num(a.numero));
      out[k] = JSON.stringify(l); novaBase[k] = r.base;
    });
    // contadores
    const pedidos = parse(out.ven_orcamentosSalvos, []), vendas = parse(out.ven_vendas, []);
    out.ven_ultimoNumeroOrcamento = JSON.stringify(Math.max(maxP, ...pedidos.map(p => num(p.numero)))); out.ven_ultimoNumeroVenda = JSON.stringify(Math.max(maxV, ...vendas.map(v => num(v.numero))));
    // dados da empresa
    ESCALARES.forEach(k => {
      const l = parse(local[k], undefined), r = parse(remoto[k], undefined); if (l === undefined && r === undefined) return;
      let esc; if (l === undefined) esc = r; else if (r === undefined) esc = l; else { const hl = H(l), hr = H(r), hb = base[k]; esc = hl === hr ? l : (hb === hl ? r : l); }
      out[k] = JSON.stringify(esc); novaBase[k] = H(esc);
    });
    // catálogo importado: vale o mais recente
    const cl = parse(local.ven_catalogoImportado, null), cr = parse(remoto.ven_catalogoImportado, null);
    if (cl || cr) out.ven_catalogoImportado = JSON.stringify(!cl ? cr : !cr ? cl : (String(cr.date || '') > String(cl.date || '') ? cr : cl));
    // NF-e já importadas
    const nl = arr(parse(local.ven_nfe_importadas, [])), nr = arr(parse(remoto.ven_nfe_importadas, []));
    if (local.ven_nfe_importadas != null || remoto.ven_nfe_importadas != null) { const vistos = new Set(), u = []; [...nl, ...nr].forEach(x => { const s = estavel(x); if (!vistos.has(s)) { vistos.add(s); u.push(x); } }); out.ven_nfe_importadas = JSON.stringify(u); }
    // anexos das contas: só das contas que continuam existindo
    const contas = new Set(parse(out.ven_contasPagar, []).map(c => String(c.id)));
    [...new Set([...Object.keys(local), ...Object.keys(remoto)])].filter(k => k.startsWith('ven_cpa_')).forEach(k => { if (contas.has(k.slice(8))) out[k] = local[k] != null ? local[k] : remoto[k]; });
    // demais chaves: o que é do aparelho fica como está; o resto, local primeiro e depois remoto
    [...new Set([...Object.keys(local), ...Object.keys(remoto)])].forEach(k => {
      if (k in out || !k.startsWith('ven_') || k.startsWith('ven_cpa_') || LISTAS[k] || ESCALARES.includes(k)) return;
      if (local[k] != null) out[k] = local[k]; else if (!LOCAL_APENAS.test(k)) out[k] = remoto[k];
    });
    delete out.ven_syncBase;
    return { storage: out, base: novaBase, resumo: rel };
  }
  const api = { mesclar, hash: H, resumoTexto: r => { const p = []; if (r.adicionados) p.push(r.adicionados + ' novo' + (r.adicionados === 1 ? '' : 's')); if (r.alterados) p.push(r.alterados + ' atualizado' + (r.alterados === 1 ? '' : 's')); if (r.removidos) p.push(r.removidos + ' removido' + (r.removidos === 1 ? '' : 's')); if (r.renumerados) p.push(r.renumerados + ' renumerado' + (r.renumerados === 1 ? '' : 's')); if (r.conflitos) p.push(r.conflitos + ' conflito' + (r.conflitos === 1 ? '' : 's') + ' resolvido' + (r.conflitos === 1 ? '' : 's')); return p.length ? p.join(', ') : 'nada novo'; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VENSync = api;
})(typeof self !== 'undefined' ? self : this);
