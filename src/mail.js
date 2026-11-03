async function send(to,subject,html){
 const from=process.env.MAIL_FROM||process.env.BREVO_FROM_EMAIL;const name=process.env.MAIL_FROM_NAME||process.env.BREVO_FROM_NAME||'TI Turin';
 if(!process.env.BREVO_API_KEY||!from)throw Error('Brevo não configurado: informe BREVO_API_KEY e BREVO_FROM_EMAIL');
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'content-type':'application/json'},body:JSON.stringify({sender:{name,email:from},to:[{email:to}],subject,htmlContent:html})});
 if(!r.ok)throw Error('Brevo erro '+r.status);return r.json();
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports={send,esc};
