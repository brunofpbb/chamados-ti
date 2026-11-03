async function send(to,subject,html){
 if(!process.env.BREVO_API_KEY||!process.env.MAIL_FROM)throw Error('Brevo não configurado');
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'content-type':'application/json'},body:JSON.stringify({sender:{name:process.env.MAIL_FROM_NAME||'TI Turin',email:process.env.MAIL_FROM},to:[{email:to}],subject,htmlContent:html})});
 if(!r.ok)throw Error('Brevo erro '+r.status);return r.json();
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports={send,esc};
