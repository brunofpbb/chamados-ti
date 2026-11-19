// Mesmos caminhos e cabeçalho utilizados em Analista-DP/backend/src/services/alterdataClient.js.
const base=(process.env.ALTERDATA_API_BASE||'').replace(/\/$/,'');
async function get(path){
 if(!base)throw Error('Integração Alterdata não configurada');
 const r=await fetch(base+path,{headers:process.env.ALTERDATA_PROXY_KEY?{'X-Proxy-Key':process.env.ALTERDATA_PROXY_KEY}:{},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Alterdata indisponível ('+r.status+')');return r.json();
}
const companies=async()=>{const v=await get('/empresas');if(!Array.isArray(v))throw Error('Empresas inválidas');return v.map(x=>({code:String(x.codigo_empresa??x.codigo??''),name:[x.fantasia,x.nome_fantasia,x.razao_social,x.nome,x.descricao,x.codigo_empresa,x.codigo].map(v=>String(v??'').trim()).find(Boolean)||''})).filter(x=>x.code);};
const employees=async(company,term='',situacao='ativos')=>{const v=await get('/empresas/'+encodeURIComponent(company)+'/funcionarios?'+new URLSearchParams({busca:term,situacao}));if(!Array.isArray(v))throw Error('Funcionários inválidos');return v;};
function normalize(e){
 const id=e.idfuncionario??e.idFuncionario??e.funcionario_id??e.id;
 const name=e.nome??e.nome_funcionario;
 const off=e.data_desligamento??e.dataDesligamento??e.dt_desligamento??e.dtDesligamento??e.dataDemissao??e.data_demissao??e.dtdemissao;
 const offKnown=['data_desligamento','dataDesligamento','dt_desligamento','dtDesligamento','dataDemissao','data_demissao','dtdemissao'].some(k=>Object.hasOwn(e,k));
 const status=e.situacao??e.status??e.ativo;
 const activeStatus=/^(ativo|true|1)$/i.test(String(status??''));
 // Falha fechada: não apresentar um funcionário se não houver confirmação da situação funcional.
 if(!offKnown && status===undefined)throw Error('Mapear o campo de desligamento/situação da API Alterdata');
 const ended=off!==null&&off!==undefined&&String(off).trim()!=='';
 const officialEmail=String(e.email_corporativo??e.emailCorporativo??e.email_funcional??e.emailFuncionario??e.email??e.email_funcionario??'').trim().toLowerCase();
 return {id:String(id??''),name:String(name??''),active:!ended&&(status===undefined?offKnown:activeStatus),cpf:String(e.cpf??e.nrcpf??'').replace(/\D/g,''),lookup:String(e.matricula??e.cdchamada??e.nome??'').trim(),email:/^\S+@\S+\.\S+$/.test(officialEmail)?officialEmail:null};
}
async function findActiveByCpf(company,cpf){
 const clean=String(cpf||'').replace(/\D/g,'');
 if(!/^\d{11}$/.test(clean))return null;
 // Alguns bancos armazenam CPF com pontos e traço; a busca textual da API não normaliza o campo.
 const formatted=clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
 let list=await employees(company,clean,'ativos');
 if(!list.some(e=>normalize(e).cpf===clean))list=await employees(company,formatted,'ativos');
 const found=list.map(normalize).find(e=>e.active&&e.cpf===clean&&e.id&&e.name);
 return found||null;
}
async function findActive(company,id,term='',cpfHash=null,hashCpf=null){
 const list=await employees(company,term||'','ativos');
 const found=list.map(normalize).find(e=>e.id===String(id)&&e.active);
 if(!found)return null;
 if(cpfHash&&(!found.cpf||typeof hashCpf!=='function'||hashCpf(found.cpf)!==cpfHash))return null;
 return found;
}
// Lista elegível para novos vínculos. Cache somente de código e nome.
let activeCompaniesCache=null,activeCompaniesPending=null;
async function activeCompanies(){
 if(activeCompaniesCache&&Date.now()<activeCompaniesCache.expires)return activeCompaniesCache.items;
 if(activeCompaniesPending)return activeCompaniesPending;
 activeCompaniesPending=(async()=>{
  const catalog=await companies(),result=new Array(catalog.length);
  let index=0,failures=0;
  async function worker(){
   while(index<catalog.length){
    const i=index++,company=catalog[i];
    try{
     const rows=await employees(company.code,'','ativos');
     if(rows.some(row=>normalize(row).active))result[i]=company;
    }catch(err){
     failures++;
     console.warn('Não foi possível confirmar funcionários ativos na empresa '+company.code+': '+err.message);
    }
   }
  }
  await Promise.all(Array.from({length:Math.min(6,catalog.length)},()=>worker()));
  if(catalog.length&&failures===catalog.length)throw Object.assign(Error('Não foi possível validar empresas no Alterdata. Tente novamente.'),{status:503});
  const items=result.filter(Boolean);
  activeCompaniesCache={items,expires:Date.now()+(failures?15000:60000)};
  return items;
 })();
 try{return await activeCompaniesPending;}finally{activeCompaniesPending=null;}
}
module.exports={companies,activeCompanies,employees,normalize,findActive,findActiveByCpf};
