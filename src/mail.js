const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const portal=()=>process.env.PUBLIC_URL||'https://chamados.up.railway.app';
function template(subject,inner){
 const title=esc(subject);
 const content=String(inner||'')
   .replace(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,(_m,href,text)=>'<a href="'+esc(href)+'" style="display:inline-block;padding:13px 22px;background:#005b28;color:#fff!important;text-decoration:none;border-radius:9px;font-size:15px;font-weight:700;margin:12px 0">'+text+'</a>')
   .replace(/<blockquote>/gi,'<blockquote style="border-left:4px solid #008c48;margin:20px 0;padding:13px 18px;background:#f3f8f4;border-radius:0 8px 8px 0;color:#263c2d;white-space:pre-wrap">');
 return '<!doctype html><html lang="pt-br"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f0f4f1;padding:30px 12px;font-family:Arial,Helvetica,sans-serif;color:#18352a">'+
 '<div style="max-width:620px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e1e9e3">'+
 '<div style="background:#005b28;padding:27px 32px;color:#fff"><img src="'+esc(portal())+'/brand/turin-logo-white.png" alt="Turin Transportes" width="166" style="display:block;max-width:100%;height:auto;margin-bottom:18px"><div style="font-size:12px;letter-spacing:2px;opacity:.9">CENTRAL DE SERVIÇOS · TI</div></div>'+
 '<div style="padding:33px 34px 26px"><h1 style="font-size:23px;line-height:1.25;margin:0 0 20px;color:#143e29">'+title+'</h1><div style="font-size:15px;line-height:1.75;color:#354a3d">'+content+'</div>'+
 '<p style="margin:22px 0 0;font-size:14px;color:#53685b">Acesse o portal para acompanhar sua solicitação:</p><a href="'+esc(portal())+'" style="font-weight:700;color:#005b28;text-decoration:underline">'+esc(portal())+'</a></div>'+
 '<div style="padding:20px 34px;background:#f6faf7;border-top:1px solid #e2ebe5;color:#64766a;font-size:12px;line-height:1.6">Turin Transportes · Equipe de Tecnologia da Informação<br>Mensagem automática do sistema Chamados TI. Não responda a este e-mail.</div></div></body></html>';
}
async function send(to,subject,html){
 const from=process.env.MAIL_FROM||process.env.BREVO_FROM_EMAIL;
 const name=process.env.MAIL_FROM_NAME||process.env.BREVO_FROM_NAME||'Turin Transportes';
 if(!process.env.BREVO_API_KEY||!from)throw Error('Brevo não configurado: informe BREVO_API_KEY e BREVO_FROM_EMAIL');
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'content-type':'application/json'},body:JSON.stringify({sender:{name,email:from},to:[{email:to}],subject,htmlContent:template(subject,html)})});
 if(!r.ok)throw Error('Brevo erro '+r.status);return r.json();
}
module.exports={send,esc,template};
