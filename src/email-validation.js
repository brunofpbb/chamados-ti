'use strict';
const dns=require('node:dns').promises;

function normalizeEmail(value){return String(value??'').trim().toLowerCase();}
function basicEmailError(email){
 if(email.length<5||email.length>254||/[\s\x00-\x1f\x7f]/.test(email))return 'Informe um endereço de e-mail válido.';
 const parts=email.split('@');
 if(parts.length!==2)return 'Informe um endereço de e-mail válido.';
 const [local,domain]=parts;
 if(domain==='turintransportescom.br')return 'Confira o domínio: o correto é @turintransportes.com.br (com o ponto antes de com).';
 if(!local||local.length>64||!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/i.test(local)||local.startsWith('.')||local.endsWith('.')||local.includes('..'))return 'A parte anterior ao @ do e-mail é inválida.';
 if(!domain||domain.length>253||domain.endsWith('.')||domain.includes('..'))return 'O domínio do e-mail é inválido.';
 const labels=domain.split('.');
 if(labels.length<2||labels.some(l=>l.length<1||l.length>63||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/.test(l))||labels.at(-1).length<2||!/[a-z]/.test(labels.at(-1)))return 'O domínio do e-mail é inválido.';
 return null;
}
const cache=new Map();
const MAX_CACHE=300;
const negative=new Set(['ENOTFOUND','ENODATA','ENONAME','NXDOMAIN','NOTFOUND']);
async function checkDns(domain,resolver){
 const mx=await resolver.resolveMx(domain).catch(e=>{if(negative.has(e.code))return [];throw e;});
 if(mx.length){if(mx.length===1&&mx[0].priority===0&&mx[0].exchange==='.')return false;return true;}
 // Em SMTP, o domínio pode usar o fallback de endereço A/AAAA sem MX.
 for(const method of ['resolve4','resolve6']){
  const ip=await resolver[method](domain).catch(e=>{if(negative.has(e.code))return [];throw e;});
  if(ip.length)return true;
 }
 return false;
}
async function validateEmail(value,{resolver=dns}={}){
 const email=normalizeEmail(value),formatError=basicEmailError(email);
 if(formatError)throw Object.assign(new Error(formatError),{status:400});
 const domain=email.split('@')[1],now=Date.now();
 const cached=resolver===dns?cache.get(domain):null;
 if(cached&&cached.expires>now){
  if(!cached.valid)throw Object.assign(new Error('O domínio do e-mail não existe ou não recebe mensagens. Confira o endereço digitado.'),{status:400});
  return email;
 }
 let valid;
 try{valid=await checkDns(domain,resolver);}
 catch(e){
  console.warn('Consulta DNS de e-mail indisponível:',e.code||e.message);
  throw Object.assign(new Error('Não foi possível verificar o domínio do e-mail agora. Tente novamente em instantes.'),{status:503});
 }
 if(resolver===dns){if(cache.size>=MAX_CACHE)cache.clear();cache.set(domain,{valid,expires:now+(valid?5*60000:60000)});}
 if(!valid)throw Object.assign(new Error('O domínio do e-mail não existe ou não recebe mensagens. Confira o endereço digitado.'),{status:400});
 return email;
}
module.exports={validateEmail,normalizeEmail,basicEmailError};
