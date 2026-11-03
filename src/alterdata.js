// Mesmos caminhos e cabeçalho utilizados em Analista-DP/backend/src/services/alterdataClient.js.
const base=(process.env.ALTERDATA_API_BASE||'').replace(/\/$/,'');
async function get(path){
 if(!base)throw Error('Integração Alterdata não configurada');
 const r=await fetch(base+path,{headers:process.env.ALTERDATA_PROXY_KEY?{'X-Proxy-Key':process.env.ALTERDATA_PROXY_KEY}:{},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Alterdata indisponível ('+r.status+')');return r.json();
}
const companies=async()=>{const v=await get('/empresas');if(!Array.isArray(v))throw Error('Empresas inválidas');return v.map(x=>({code:String(x.codigo_empresa??x.codigo??''),name:String(x.razao_social??x.nome_fantasia??x.nome??x.descricao??x.codigo_empresa)})).filter(x=>x.code);};
const employees=async(company,term='')=>{const v=await get('/empresas/'+encodeURIComponent(company)+'/funcionarios?'+new URLSearchParams({busca:term}));if(!Array.isArray(v))throw Error('Funcionários inválidos');return v;};
function normalize(e){
 const id=e.idfuncionario??e.idFuncionario??e.funcionario_id??e.id;
 const name=e.nome??e.nome_funcionario;
 const off=e.data_desligamento??e.dataDesligamento??e.dt_desligamento??e.dtDesligamento??e.dataDemissao??e.data_demissao;
 const offKnown=['data_desligamento','dataDesligamento','dt_desligamento','dtDesligamento','dataDemissao','data_demissao'].some(k=>Object.hasOwn(e,k));
 const status=e.situacao??e.status??e.ativo;
 const inactive=/^(demitido|desligado|inativo|false|0)$/i.test(String(status??''));
 // Falha fechada: não apresentar um funcionário se não houver confirmação da situação funcional.
 if(!offKnown && status===undefined)throw Error('Mapear o campo de desligamento/situação da API Alterdata');
 const ended=off!==null&&off!==undefined&&String(off).trim()!=='';
 return {id:String(id??''),name:String(name??''),active:!ended&&!inactive};
}
async function findActive(company,id){const list=await employees(company,'');const matched=list.find(e=>normalize(e).id===String(id));if(!matched)return null;const n=normalize(matched);return n.active?n:null;}
module.exports={companies,employees,normalize,findActive};
