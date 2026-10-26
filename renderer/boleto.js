'use strict';
/* ===== Leitura de boletos e contas (linha digitável, código de barras, texto de PDF/OCR) ===== */
const VENBoleto=(function(){
 const so=s=>String(s==null?'':s).replace(/\D/g,'');
 const BASE=Date.UTC(1997,9,7);
 function mod10(n){let s=0,p=2;for(let i=n.length-1;i>=0;i--){let r=Number(n[i])*p;if(r>9)r=Math.floor(r/10)+r%10;s+=r;p=p===2?1:2}return (10-s%10)%10}
 function soma11(n){let s=0,p=2;for(let i=n.length-1;i>=0;i--){s+=Number(n[i])*p;p=p===9?2:p+1}return s}
 function mod11Banco(n){const d=11-soma11(n)%11;return (d===0||d===10||d===11)?1:d}
 function mod11Arrec(n){const r=soma11(n)%11;if(r===0||r===1)return 0;return 11-r}
 const isoUTC=ms=>{const d=new Date(ms);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
 const hojeMs=()=>{const d=new Date();return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())}
 function fatorParaData(f,hoje){
  f=Number(f);if(!f)return '';hoje=hoje||hojeMs();
  const c1=BASE+f*864e5,c2=c1+9000*864e5;
  const m=Math.abs(c1-hoje)<=Math.abs(c2-hoje)?c1:c2;
  return isoUTC(m);
 }
 function dataValida(y,m,d){y=+y;m=+m;d=+d;if(y<2000||y>2100||m<1||m>12||d<1||d>31)return '';const t=new Date(Date.UTC(y,m-1,d));if(t.getUTCMonth()!==m-1)return '';return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
 function dataBR(txt){
  const m=String(txt||'').match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4}|\d{2})\b/);if(!m)return '';
  let y=m[3];if(y.length===2)y='20'+y;return dataValida(y,m[2],m[1]);
 }
 // 47 dígitos (bancário) -> 44 dígitos
 function linha47Para44(L){return L.slice(0,4)+L[32]+L.slice(33,47)+L.slice(4,9)+L.slice(10,20)+L.slice(21,31)}
 function barras44Para47(B){
  const c1=B.slice(0,4)+B.slice(19,24),c2=B.slice(24,34),c3=B.slice(34,44);
  return c1+mod10(c1)+c2+mod10(c2)+c3+mod10(c3)+B[4]+B.slice(5,19);
 }
 function barras44Para48(B){let o='';for(let i=0;i<4;i++){const b=B.slice(i*11,i*11+11);o+=b+(B[2]==='6'||B[2]==='7'?mod10(b):mod11Arrec(b))}return o}
 const SEGMENTOS={1:'Prefeitura',2:'Saneamento',3:'Energia elétrica e gás',4:'Telecomunicações',5:'Órgão governamental',6:'Carnê',7:'Multa de trânsito',9:'Uso do banco'};
 const SEG_CATEGORIA={2:'Água',3:'Energia elétrica',4:'Internet e telefone',1:'Impostos e taxas',5:'Impostos e taxas',7:'Impostos e taxas'};
 /** Interpreta 44 (barras), 47 (boleto bancário) ou 48 (arrecadação) dígitos. */
 function interpretar(codigo,hoje){
  const d=so(codigo);let B='',tipo='',L='';
  if(d.length===47){tipo='banco';L=d;B=linha47Para44(d)}
  else if(d.length===48){tipo='arrec';L=d;B=d.slice(0,11)+d.slice(12,23)+d.slice(24,35)+d.slice(36,47)}
  else if(d.length===44){B=d;tipo=d[0]==='8'?'arrec':'banco';L=tipo==='banco'?barras44Para47(d):barras44Para48(d)}
  else return null;
  const r={tipo,linha:L,barras:B,valor:0,vencimento:'',ok:false,segmento:'',categoria:'',banco:'',avisos:[]};
  if(tipo==='banco'){
   r.banco=B.slice(0,3);
   const dvOk=mod11Banco(B.slice(0,4)+B.slice(5))===Number(B[4]);
   let camposOk=true;
   if(d.length===47){camposOk=mod10(L.slice(0,9))===+L[9]&&mod10(L.slice(10,20))===+L[20]&&mod10(L.slice(21,31))===+L[31]}
   r.ok=dvOk&&camposOk;
   r.valor=Number(B.slice(9,19))/100;
   const f=B.slice(5,9);if(Number(f))r.vencimento=fatorParaData(f,hoje);
  }else{
   const mod=(B[2]==='6'||B[2]==='7')?10:11;
   const dv=Number(B[3]),sem=B.slice(0,3)+B.slice(4);
   const dvOk=(mod===10?mod10(sem):mod11Arrec(sem))===dv;
   let camposOk=true;
   if(d.length===48){for(let i=0;i<4;i++){const b=d.slice(i*12,i*12+11),v=Number(d[i*12+11]);if((mod===10?mod10(b):mod11Arrec(b))!==v)camposOk=false}}
   r.ok=dvOk&&camposOk;
   r.segmento=SEGMENTOS[B[1]]||'';r.categoria=SEG_CATEGORIA[B[1]]||'';
   if(B[2]==='6'||B[2]==='7')r.valor=Number(B.slice(4,15))/100;
   // algumas empresas colocam AAAAMMDD no campo livre
   for(const ini of [19,23]){const s=B.slice(ini,ini+8);const dt=dataValida(s.slice(0,4),s.slice(4,6),s.slice(6,8));if(dt){const diff=(Date.UTC(+dt.slice(0,4),+dt.slice(5,7)-1,+dt.slice(8,10))-(hoje||hojeMs()))/864e5;if(diff>-800&&diff<800){r.vencimento=dt;break}}}
  }
  return r;
 }
 /** Procura todos os códigos de boleto presentes num texto livre. */
 function acharCodigos(texto,hoje){
  const t=String(texto||'').replace(/[   ]/g,' ');
  const out=[],vistos=new Set();
  const add=raw=>{const d=so(raw);if(![44,47,48].includes(d.length)||vistos.has(d))return;const r=interpretar(d,hoje);if(!r)return;if(d.length===44&&d[0]==='8'&&false)return;vistos.add(d);out.push(r)};
  // sequência de dígitos com separadores comuns (espaço, ponto, hífen) de 44 a 60 caracteres
  const re=/\d(?:[\d .\-]{42,66})\d/g;let m;
  while((m=re.exec(t))){
   const raw=m[0];const d=so(raw);
   if([44,47,48].includes(d.length)){add(raw);continue}
   // pode ter colado número de outra coisa: tentar janelas de 47/48/44 que validem
   for(const n of [47,48,44]){for(let i=0;i+n<=d.length;i++){const r=interpretar(d.slice(i,i+n),hoje);if(r&&r.ok){add(d.slice(i,i+n));break}}}
  }
  // linha digitável quebrada em linhas separadas pelo OCR: junta blocos e tenta de novo
  if(!out.length){
   const junto=t.split(/\n/).filter(l=>{const k=l.trim();return k&&so(k).length/k.length>=0.6}).map(l=>so(l)).join('');
   for(const n of [47,48]){for(let i=0;i+n<=junto.length&&i<400;i++){const r=interpretar(junto.slice(i,i+n),hoje);if(r&&r.ok){add(junto.slice(i,i+n));break}}}
  }
  // válidos primeiro
  out.sort((a,b)=>(b.ok?1:0)-(a.ok?1:0));
  return out;
 }
 function cnpjValido(v){
  const c=so(v);if(c.length!==14||/^(\d)\1+$/.test(c))return false;
  const calc=n=>{let s=0,p=n-7;for(let i=0;i<n;i++){s+=Number(c[i])*p;p=p===2?9:p-1}const r=s%11;return r<2?0:11-r};
  return calc(12)===Number(c[12])&&calc(13)===Number(c[13]);
 }
 const num=s=>{const v=String(s).replace(/\./g,'').replace(',','.');const n=Number(v);return isFinite(n)?n:0};
 const MOEDA='(?:R\\$|RS|r\\$)?\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})';
 function achaValor(t){
  const rotulos=['valor\\s+do\\s+documento','valor\\s+cobrado','total\\s+a\\s+pagar','valor\\s+a\\s+pagar','valor\\s+total','total\\s+da\\s+fatura','total\\s+da\\s+conta','valor\\s+da\\s+fatura','valor\\s+nominal','valor\\s+da\\s+parcela','valor\\s+principal','valor\\s+do\\s+boleto','valor'];
  for(const r of rotulos){
   const re=new RegExp('(?:^|[^a-zà-ú])'+r+'(?:\\s*\\([^)]*\\))?\\s*[:=\\-]?[^\\d\\n]{0,12}\\n?[^\\d\\n]{0,12}\\s*'+MOEDA,'i');
   const m=t.match(re);if(m){const v=num(m[1]);if(v>0)return v}
  }
  return 0;
 }
 function achaVencimento(t){
  const reData=/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/g;
  const datas=str=>{const o=[];let m;reData.lastIndex=0;while((m=reData.exec(str))){const d=dataBR(m[0]);if(d)o.push(d)}return o};
  const linhas=t.split('\n');
  // 1) tabela: linha de cabeçalho com VENCIMENTO e outras colunas; a linha seguinte traz os valores na mesma ordem
  for(let i=0;i<linhas.length;i++){
   const L=linhas[i];if(!/venc/i.test(L))continue;
   const outras=(L.match(/emiss[aã]o|refer[eê]ncia|valor|cliente|postagem|fatura|compet[eê]ncia|per[ií]odo/ig)||[]).length;
   if(outras<1)continue;
   const cols=[];const re=/venc(?:imento)?|emiss[aã]o|postagem|leitura|apresenta[cç][aã]o/ig;let m;
   while((m=re.exec(L)))cols.push(/^venc/i.test(m[0])?'v':'o');
   const idx=cols.indexOf('v');if(idx<0)continue;
   for(let k=i+1;k<Math.min(linhas.length,i+4);k++){
    const ds=datas(linhas[k]);if(!ds.length)continue;
    if(ds.length===cols.length)return ds[idx];
    break;
   }
  }
  // 2) rótulo e data na mesma linha / logo depois
  const rotulos=['data\\s+de\\s+vencimento','vencimento','vence\\s+em','pagar\\s+at[ée]','pag[aá]vel\\s+at[ée]','venc\\.?'];
  for(const r of rotulos){
   const re=new RegExp(r+'\\s*[:\\-]?[^\\d]{0,25}(\\d{1,2}\\s*[\\/.\\-]\\s*\\d{1,2}\\s*[\\/.\\-]\\s*(?:\\d{4}|\\d{2}))','i');
   const m=t.match(re);if(m){const d=dataBR(m[1]);if(d)return d}
  }
  // 3) rótulo seguido de outras linhas até a data (ex.: endereço entre o rótulo e a data)
  const re3=/venc(?:imento)?\s*\n?([\s\S]{0,170}?)(\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4})/ig;let m3;
  while((m3=re3.exec(t))){if(!/emiss[aã]o|postagem|per[ií]odo|refer[eê]ncia/i.test(m3[1])){const d=dataBR(m3[2]);if(d)return d}}
  return '';
 }
 const PROVEDORES=[
  [/ceee|equatorial\s+energia|\brge\b|cpfl|enel|cemig|copel|light\s+s|energisa|neoenergia|kwh|energia\s+el[eé]trica|unidade\s+consumidora/i,'Energia elétrica'],
  [/corsan|dmae|sanepar|sabesp|copasa|[aá]gua\s+e\s+esgoto|saneamento|consumo\s+de\s+[aá]gua|\bm3\b/i,'Água'],
  [/\bclaro\b|\bvivo\b|\btim\b|\boi\s+(?:fibra|s\.a)|telef[oô]nica|internet|fibra|banda\s+larga|\bnet\s+servi|telecom|sky\b|algar/i,'Internet e telefone'],
  [/aluguel|loca[cç][aã]o|condom[ií]nio|imobili[aá]ria/i,'Aluguel'],
  [/\bdas\b|\bdarf\b|\bgps\b|simples\s+nacional|iptu|ipva|iss\b|icms|inss|fgts|receita\s+federal|prefeitura|guia\s+de|taxa\b|tributo|imposto/i,'Impostos e taxas'],
  [/transportadora|frete|fretes|logistic|log[ií]stica|correios|jadlog|braspress/i,'Frete e transporte'],
  [/software|assinatura|licen[cç]a|hospedagem|google\s+workspace|microsoft|sistema\b|saas/i,'Sistemas e assinaturas'],
  [/sal[aá]rio|folha\s+de\s+pagamento|funcion[aá]rio|13[ºo°]|f[eé]rias|rescis[aã]o/i,'Funcionários e salários'],
  [/comiss[aã]o|comiss[oõ]es/i,'Comissões'],
  [/distribuidora|ind[uú]stria|com[eé]rcio|materiais|el[eé]trica|ferragens|atacado|fornecedor/i,'Fornecedores']
 ];
 function achaCategoria(t){for(const [re,c] of PROVEDORES)if(re.test(t))return c;return ''}
 function limpaNome(s){
  s=String(s||'').replace(/\bCNPJ\b.*$/i,'').replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,'').replace(/\bCPF\b.*$/i,'').replace(/[|_]{1,}/g,' ').replace(/\s{2,}/g,' ').trim();
  s=s.replace(/^[:\-–\s]+|[:\-–\s]+$/g,'');
  return s.slice(0,70);
 }
 function achaFornecedor(t,ignorarCnpj){
  const linhas=t.split(/\n/).map(l=>l.trim());
  const rot=/^(?:nome\s+d[oa]\s+)?(?:benefici[aá]rio(?:\s+final)?|cedente|favorecido|raz[aã]o\s+social|emitente|prestador|empresa)\b\s*[:\-]?\s*(.*)$/i;
  for(let i=0;i<linhas.length;i++){
   const m=linhas[i].match(rot);if(!m)continue;
   let cand=m[1];
   if(!cand||/^(?:cnpj|cpf|ag[eê]ncia|c[oó]digo|\d)/i.test(cand)){let j=i+1;while(j<linhas.length&&!linhas[j])j++;cand=linhas[j]||''}
   cand=limpaNome(cand);
   if(cand.length>=3&&!/^(?:cnpj|cpf|ag[eê]ncia|c[oó]digo|data|vencimento|valor|nosso|n[uú]mero|local|pagador|sacado)/i.test(cand)&&/[A-Za-zÀ-ú]{3}/.test(cand))return cand;
  }
  const SUF='(?:LTDA|S\\.?\\s?A\\.?|S\\/A|EIRELI|EPP|MEI|ME)';
  const reEmp=new RegExp('([A-ZÀ-Ú0-9][A-Za-zÀ-ú0-9&.\\-]*(?:\\s+[A-ZÀ-Ú0-9&][A-Za-zÀ-ú0-9&.\\-]*){0,5}?\\s+'+SUF+')(?![A-Za-zÀ-ú])');
  for(const l of linhas){
   if(/pagador|sacado/i.test(l)||l.length>120)continue;
   const m=l.match(reEmp);
   if(m){let n=limpaNome(m[1]).replace(/\b([A-ZÀ-Ú0-9]{2,})\s+\1\b/g,'$1');if(n.length>=4)return n}
  }
  const NOMES=[[/\bTIM\b/,'TIM'],[/\bclaro\b/i,'Claro'],[/\bvivo\b/i,'Vivo'],[/\bcorsan\b/i,'Corsan'],[/\bdmae\b/i,'DMAE'],[/\bceee\b/i,'CEEE Equatorial'],[/\bequatorial\b/i,'Equatorial'],[/\brge\b/i,'RGE'],[/\bcpfl\b/i,'CPFL'],[/\boi\s+fibra|\boi\s+s\.?a/i,'Oi'],[/\bsky\b/i,'Sky']];
  for(const [re,n] of NOMES)if(re.test(t))return n;
  return '';
 }
 function achaCnpj(t,ignorar){
  const ig=so(ignorar||'');
  const re=/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;let m;
  while((m=re.exec(t))){const c=so(m[0]);if(c!==ig&&cnpjValido(c))return c}
  return '';
 }
 function achaDocumento(t){
  const m=t.match(/(?:n[ºo°.]{0,2}\s*(?:de\s+identifica[cç][aã]o\s+do\s+)?(?:do\s+)?documento|nosso\s+n[uú]mero|nota\s+fiscal|fatura\s+n[ºo°.]?)\s*[:\-nº°.]*\s*(\d[\d\-\/.]{3,24})/i);
  return m?m[1].replace(/[.\-\/]+$/,''):'';
 }
 /** Junta tudo: devolve rascunhos (um por boleto encontrado) já com a origem de cada campo. */
 function lerTexto(texto,opc){
  opc=opc||{};
  const t=String(texto||'').replace(/\r/g,'').replace(/[   ]/g,' ').replace(/[ \t]+/g,' ');
  const codigos=acharCodigos(t,opc.hoje);
  const comuns={
   valor:achaValor(t),vencimento:achaVencimento(t),fornecedor:achaFornecedor(t),
   cnpj:achaCnpj(t,opc.ignorarCnpj),documento:achaDocumento(t),categoria:achaCategoria(t)
  };
  const rascunhos=[];
  const montar=(c)=>{
   const d={descricao:'',fornecedor:comuns.fornecedor,cnpj:comuns.cnpj,documento:comuns.documento,categoria:comuns.categoria,valor:comuns.valor,vencimento:comuns.vencimento,linha:'',origem:{},avisos:[],codigoOk:null};
   if(c){
    d.linha=c.linha;d.codigoOk=c.ok;
    if(c.valor>0){if(comuns.valor&&Math.abs(comuns.valor-c.valor)>0.009)d.avisos.push('O valor do código ('+c.valor.toFixed(2).replace('.',',')+') é diferente do valor lido no texto ('+comuns.valor.toFixed(2).replace('.',',')+'). Usei o do código.');d.valor=c.valor;d.origem.valor='codigo'}
    if(c.vencimento){if(comuns.vencimento&&comuns.vencimento!==c.vencimento&&c.tipo==='banco')d.avisos.push('A data do código difere da data lida no texto. Usei a do texto.');if(!(comuns.vencimento&&c.tipo==='banco')){d.vencimento=c.vencimento;d.origem.vencimento='codigo'}}
    if(!d.categoria&&c.categoria)d.categoria=c.categoria;
    if(!c.ok)d.avisos.push('Os dígitos do código de barras não conferem. Confira com o boleto ou use a câmera para ler o código.');
   }
   if(d.valor&&!d.origem.valor)d.origem.valor='texto';
   if(d.vencimento&&!d.origem.vencimento)d.origem.vencimento='texto';
   if(d.fornecedor)d.origem.fornecedor='texto';
   d.descricao=d.fornecedor||(d.categoria?d.categoria:'');
   return d;
  };
  if(codigos.length){codigos.forEach(c=>rascunhos.push(montar(c)))}
  else if(comuns.valor||comuns.vencimento||comuns.fornecedor){rascunhos.push(montar(null))}
  return rascunhos;
 }
 const fmtLinha=l=>{l=so(l);if(l.length===47)return l.slice(0,5)+'.'+l.slice(5,10)+' '+l.slice(10,15)+'.'+l.slice(15,21)+' '+l.slice(21,26)+'.'+l.slice(26,32)+' '+l[32]+' '+l.slice(33);if(l.length===48)return [0,1,2,3].map(i=>l.slice(i*12,i*12+12)).join(' ');return l};
 const fmtCnpj=v=>{const d=so(v);return d.length===14?d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):d};
 /** Pix "copia e cola" (EMV): valor, recebedor e cidade. */
 function lerPix(emv){
  const s=String(emv||'').trim();if(!/^000201/.test(s))return null;
  const tlv=str=>{const o={};let i=0;while(i+4<=str.length){const id=str.substr(i,2),len=parseInt(str.substr(i+2,2),10);if(isNaN(len))break;o[id]=str.substr(i+4,len);i+=4+len}return o};
  const t=tlv(s);const v=t['54']?Number(t['54']):0;
  return {pix:s,valor:isFinite(v)?v:0,fornecedor:(t['59']||'').trim(),cidade:(t['60']||'').trim()};
 }
 return {interpretar,acharCodigos,lerTexto,lerPix,fmtCnpj,cnpjValido,fmtLinha,mod10,mod11Banco,mod11Arrec,fatorParaData,barras44Para47,barras44Para48,dataBR,achaCategoria};
})();
if (typeof module !== 'undefined') module.exports = VENBoleto;
