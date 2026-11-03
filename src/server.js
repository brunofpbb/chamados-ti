require('dotenv').config();
const express=require('express'),helmet=require('helmet'),cookie=require('cookie-parser'),rateLimit=require('express-rate-limit'),multer=require('multer'),crypto=require('crypto'),bcrypt=require('bcryptjs'),{Pool}=require('pg'),fs=require('fs'),path=require('path');
const alter=require('./alterdata'),{send,esc}=require('./mail');
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"]}}}));app.use(express.json({limit:'70kb'}));app.use(cookie());
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});
const safe=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const publicUrl=process.env.PUBLIC_URL||'https://chamados.up.railway.app';
const secret=process.env.SESSION_SECRET;
// A chave precisa ser configurada como variável secreta no Railway, nunca no repositório.
if(!secret||secret.length<32)throw Error('Configuração ausente: SESSION_SECRET deve conter pelo menos 32 caracteres. Defina em Railway > Serviço > Variables.');
if(!process.env.DATABASE_URL)throw Error('Configuração ausente: DATABASE_URL. Adicione um PostgreSQL ao projeto e vincule a variável DATABASE_URL ao serviço chamados-ti.');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const cpfHash=cpf=>crypto.createHmac('sha256',secret).update(String(cpf||'').replace(/\D/g,'')).digest('hex');
const loginBase=name=>{const words=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[];return [words[0],words.length>1?words[words.length-1]:''].filter(Boolean).join('.')||'colaborador';};
async function allocateLogin(db,name){const base=loginBase(name);for(let i=0;i<10000;i++){const login=i?base+'.'+(i+1):base;const r=await db.query('SELECT 1 FROM usuarios WHERE login=$1',[login]);if(!r.rowCount)return login;}throw Error('Não foi possível gerar um login único');}
async function checkEmployee(u){return alter.findActive(u.company_code,u.employee_id,u.employee_lookup||u.name,u.cpf_hash,cpfHash);}

const sign=s=>crypto.createHmac('sha256',secret).update(s).digest('base64url');
const session=u=>{const v=Buffer.from(JSON.stringify({id:u.id,exp:Date.now()+8*3600000})).toString('base64url');return v+'.'+sign(v);};
function setCookie(res,u){res.cookie('turin_ti',session(u),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:8*3600000,path:'/'});}
// Origin check for state-changing operations and cookies; same-site POSTs are not enough alone.
app.use('/api',(req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){const origin=req.get('origin');if(origin&&origin!==new URL(publicUrl).origin)return res.status(403).json({erro:'Origem não permitida'});}next();});
async function auth(req,res,next){try{const raw=req.cookies.turin_ti||'',split=raw.split('.');if(split.length!==2||split[1].length!==sign(split[0]).length||!crypto.timingSafeEqual(Buffer.from(sign(split[0])),Buffer.from(split[1])))return res.status(401).json({erro:'Entre novamente'});const payload=JSON.parse(Buffer.from(split[0],'base64url').toString());if(Date.now()>payload.exp)return res.status(401).json({erro:'Sessão expirada'});const q=await pool.query('SELECT id,name,login,email,company_code,employee_id,employee_lookup,cpf_hash,role,enabled FROM usuarios WHERE id=$1',[payload.id]);const u=q.rows[0];if(!u?.enabled)return res.status(401).json({erro:'Usuário inativo'});
 // TODOS os perfis vinculados ao Alterdata; impedir acesso mesmo com sessão existente.
 const current=await checkEmployee(u);
 if(!current)return res.status(403).json({erro:'Funcionário desligado ou não localizado no Alterdata'});
 req.user=u;next();}catch(e){next(e);}}
const manager=(req,res,next)=>['ANALISTA','ADMIN'].includes(req.user.role)?next():res.status(403).json({erro:'Acesso restrito à equipe de TI'});
const admin=(req,res,next)=>req.user.role==='ADMIN'?next():res.status(403).json({erro:'Apenas administrador'});
const throttle=rateLimit({windowMs:15*60000,limit:15,standardHeaders:'draft-7',legacyHeaders:false});
app.get('/api/health',safe(async(req,res)=>{await pool.query('SELECT 1');res.json({ok:true});}));
app.get('/api/public/companies',throttle,safe(async(req,res)=>res.json(await alter.companies())));
app.get('/api/public/employees',throttle,safe(async(req,res)=>{const company=String(req.query.company||''),term=String(req.query.term||'').trim();if(!company||term.length<3)return res.json([]);const companies=await alter.companies();if(!companies.some(c=>c.code===company))return res.status(400).json({erro:'Empresa inválida'});const list=await alter.employees(company,term);res.json(list.map(alter.normalize).filter(e=>e.active&&e.name.toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR'))).slice(0,20).map(e=>({id:e.id,name:e.name})));}));
async function tokenFor(user,purpose){const raw=crypto.randomBytes(32).toString('base64url');await pool.query('INSERT INTO tokens_acesso(user_id,token_hash,purpose,expires_at) VALUES($1,$2,$3,now()+interval \'30 minutes\')',[user.id,sha(raw),purpose]);return raw;}
const link=(token)=>new URL('/?token='+encodeURIComponent(token),publicUrl).toString();
app.post('/api/public/register',throttle,safe(async(req,res)=>{
 const company=String(req.body?.company||'').trim(),cpf=String(req.body?.cpf||'').replace(/\D/g,''),email=String(req.body?.email||'').trim().toLowerCase();
 if(!/^\d{11}$/.test(cpf))return res.status(400).json({erro:'Informe um CPF com 11 dígitos'});
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return res.status(400).json({erro:'E-mail inválido'});
 const companies=await alter.companies();if(!companies.some(x=>x.code===company))return res.status(400).json({erro:'Empresa inválida'});
 const employee=await alter.findActiveByCpf(company,cpf);
 if(!employee)return res.status(400).json({erro:'Não foi localizado vínculo ativo para o CPF e empresa informados'});
 const existing=await pool.query('SELECT 1 FROM usuarios WHERE company_code=$1 AND (employee_id=$2 OR cpf_hash=$3)',[company,employee.id,cpfHash(cpf)]);
 if(existing.rowCount)return res.status(409).json({erro:'Funcionário já cadastrado. Use o login existente ou recupere sua senha.'});
 let user;
 const client=await pool.connect();
 try{await client.query('BEGIN');
   const login=await allocateLogin(client,employee.name);
   const q=await client.query("INSERT INTO usuarios(company_code,employee_id,employee_lookup,cpf_hash,login,name,email,role) VALUES($1,$2,$3,$4,$5,$6,$7,'COLABORADOR') RETURNING id,email,login",[company,employee.id,employee.lookup||employee.name,cpfHash(cpf),login,employee.name,email]);user=q.rows[0];await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({erro:'Funcionário ou login já cadastrado. Atualize a página e tente novamente.'});throw e;}finally{client.release();}
 const code=await tokenFor(user,'ATIVACAO');
 try{await send(email,'Ativação de acesso | Chamados TI Turin',`<p>Olá, ${esc(employee.name)}!</p><p>Seu login: <strong>${esc(user.login)}</strong></p><p>Confirme o endereço informado e crie sua senha pelo link (válido por 30 minutos):</p><p><a href="${esc(link(code))}">Validar e-mail e criar senha</a></p><p>Se não solicitou o cadastro, ignore esta mensagem e avise a TI.</p>`);}
 catch(e){console.error('Falha ao enviar ativação',e);return res.status(503).json({erro:'Cadastro registrado, mas envio do e-mail falhou. Solicite recuperação por login e e-mail.'});}
 res.json({ok:true,login:user.login,mensagem:'Confira seu e-mail para confirmar o endereço e criar a senha. Seu login é '+user.login+'.'});
}));
app.post('/api/public/reset',throttle,safe(async(req,res)=>{
 const login=String(req.body?.login||'').trim().toLowerCase(),email=String(req.body?.email||'').trim().toLowerCase();
 if(login&&email){const q=await pool.query('SELECT * FROM usuarios WHERE login=$1 AND lower(email)=$2 AND enabled=true',[login,email]);
  if(q.rowCount){const u=q.rows[0];if(await checkEmployee(u)){const token=await tokenFor(u,'RESET');await send(email,'Recuperar senha | Chamados TI Turin',`<p>Login: <strong>${esc(u.login)}</strong></p><p><a href="${esc(link(token))}">Criar nova senha (30 minutos)</a></p>`);}}}
 res.json({ok:true,mensagem:'Se o login e e-mail estiverem corretos e o vínculo ativo, enviaremos um link.'});
}));
app.post('/api/public/set-password',throttle,safe(async(req,res)=>{
 const raw=String(req.body?.token||''),password=String(req.body?.password||'');
 if(password.length<10||password.length>128)return res.status(400).json({erro:'Senha deve ter de 10 a 128 caracteres'});
 const q=await pool.query('SELECT t.*,u.company_code,u.employee_id,u.employee_lookup,u.name,u.cpf_hash,u.enabled,u.login FROM tokens_acesso t JOIN usuarios u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now()',[sha(raw)]);
 const t=q.rows[0];if(!t?.enabled)return res.status(400).json({erro:'Link inválido ou expirado'});
 if(!await checkEmployee(t))return res.status(403).json({erro:'Funcionário desligado ou vínculo indisponível'});
 const client=await pool.connect();try{await client.query('BEGIN');
 const updated=await client.query('UPDATE tokens_acesso SET used_at=now() WHERE id=$1 AND used_at IS NULL RETURNING id',[t.id]);
 if(!updated.rowCount)throw Object.assign(Error('Link já utilizado'),{status:409});
 await client.query('UPDATE usuarios SET passhash=$1 WHERE id=$2',[await bcrypt.hash(password,12),t.user_id]);
 await client.query('UPDATE tokens_acesso SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[t.user_id]);
 await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 setCookie(res,{id:t.user_id});res.json({ok:true,login:t.login,authenticated:true});
}));
app.post('/api/public/login',throttle,safe(async(req,res)=>{
 const login=String(req.body?.login||'').trim().toLowerCase(),password=String(req.body?.password||'');
 const q=await pool.query('SELECT * FROM usuarios WHERE login=$1 AND enabled=true',[login]);
 const u=q.rows[0];if(!u?.passhash||!await bcrypt.compare(password,u.passhash))return res.status(401).json({erro:'Login ou senha incorretos'});
 if(!await checkEmployee(u))return res.status(403).json({erro:'Funcionário desligado ou vínculo funcional indisponível'});
 setCookie(res,u);res.json({id:u.id,name:u.name,login:u.login,role:u.role});
}));
app.post('/api/logout',(_req,res)=>{res.clearCookie('turin_ti',{path:'/'});res.json({ok:true});});
app.get('/api/me',auth,(req,res)=>res.json(req.user));
const allowed=['image/jpeg','image/png','image/webp','application/pdf'];const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:5},fileFilter:(req,file,cb)=>cb(null,allowed.includes(file.mimetype))});
async function saveAttachments(client,files,ticket,user,interaction=null){for(const f of files||[]){if(!allowed.includes(f.mimetype))continue;const magic=f.buffer;const ok=f.mimetype==='application/pdf'?magic.subarray(0,5).toString()==='%PDF-':f.mimetype==='image/png'?magic.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):f.mimetype==='image/jpeg'?magic.subarray(0,3).equals(Buffer.from('ffd8ff','hex')):magic.subarray(0,4).toString()==='RIFF'&&magic.subarray(8,12).toString()==='WEBP';if(!ok)throw Object.assign(Error('Arquivo inválido: '+f.originalname),{status:400});await client.query('INSERT INTO anexos(ticket_id,interaction_id,filename,mime,data,uploaded_by) VALUES($1,$2,$3,$4,$5,$6)',[ticket,interaction,path.basename(f.originalname).slice(0,180),f.mimetype,f.buffer,user]);}}
const listSql='SELECT t.id,t.subject,t.category,t.description,t.urgency,t.status,t.company_code,t.assignee_id,t.requester_id,t.created_at,t.updated_at,t.resolved_at,u.name AS requester_name,a.name AS assignee_name FROM chamados t JOIN usuarios u ON u.id=t.requester_id LEFT JOIN usuarios a ON a.id=t.assignee_id';
app.get('/api/tickets',auth,safe(async(req,res)=>{const analyst=req.user.role!=='COLABORADOR';const q=await pool.query(listSql+(analyst?'':' WHERE t.requester_id=$1')+' ORDER BY t.created_at DESC LIMIT 500',analyst?[]:[req.user.id]);res.json(q.rows);}));
app.post('/api/tickets',auth,upload.array('files',5),safe(async(req,res)=>{const {subject,description,category,urgency}=req.body;if(!subject?.trim()||subject.length>180||!description?.trim()||description.length>5000)return res.status(400).json({erro:'Informe assunto e descrição'});const urg=['BAIXA','NORMAL','ALTA','CRITICA'].includes(urgency)?urgency:'NORMAL';const client=await pool.connect();let row;try{await client.query('BEGIN');const r=await client.query('INSERT INTO chamados(requester_id,company_code,subject,description,category,urgency) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[req.user.id,req.user.company_code,subject.trim(),description.trim(),String(category||'Outros').slice(0,80),urg]);row=r.rows[0];await client.query("INSERT INTO interacoes(ticket_id,author_id,kind,body) VALUES($1,$2,'ABERTURA',$3)",[row.id,req.user.id,description.trim()]);await saveAttachments(client,req.files,row.id,req.user.id);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}send(req.user.email,'Chamado #'+row.id+' aberto | Turin',`<p>Seu chamado <b>#${row.id}</b> foi registrado.</p><p>${esc(subject)}</p>`).catch(e=>console.error('Notificação',e));res.status(201).json({id:row.id});}));
async function ticketAccess(req,res,next){try{const q=await pool.query(listSql+' WHERE t.id=$1',[req.params.id]);const t=q.rows[0];if(!t)return res.status(404).json({erro:'Chamado não encontrado'});if(req.user.role==='COLABORADOR'&&String(t.requester_id)!==String(req.user.id))return res.status(403).json({erro:'Sem acesso'});req.ticket=t;next();}catch(e){next(e);}}
app.get('/api/tickets/:id',auth,ticketAccess,safe(async(req,res)=>{const i=await pool.query('SELECT i.id,i.kind,i.body,i.created_at,u.name AS author FROM interacoes i JOIN usuarios u ON u.id=i.author_id WHERE i.ticket_id=$1 ORDER BY i.created_at',[req.params.id]);const a=await pool.query('SELECT id,interaction_id,filename,mime,created_at FROM anexos WHERE ticket_id=$1 ORDER BY id',[req.params.id]);res.json({ticket:req.ticket,interactions:i.rows,attachments:a.rows});}));
app.get('/api/attachments/:id',auth,safe(async(req,res)=>{const q=await pool.query('SELECT a.*,t.requester_id FROM anexos a JOIN chamados t ON t.id=a.ticket_id WHERE a.id=$1',[req.params.id]);const f=q.rows[0];if(!f)return res.sendStatus(404);if(req.user.role==='COLABORADOR'&&String(f.requester_id)!==String(req.user.id))return res.sendStatus(403);res.set({'Content-Type':f.mime,'Content-Disposition':'attachment; filename="'+f.filename.replace(/["\r\n]/g,'_')+'"','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'});res.send(f.data);}));
const statuses=['ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO','RESOLVIDO','CANCELADO'];
app.post('/api/tickets/:id/interaction',auth,ticketAccess,upload.array('files',5),safe(async(req,res)=>{const body=String(req.body?.body||'').trim();if(!body||body.length>5000)return res.status(400).json({erro:'Escreva uma mensagem'});if(['CANCELADO','RESOLVIDO'].includes(req.ticket.status))return res.status(409).json({erro:'Chamado encerrado'});const client=await pool.connect();try{await client.query('BEGIN');const q=await client.query("INSERT INTO interacoes(ticket_id,author_id,kind,body) VALUES($1,$2,'MENSAGEM',$3) RETURNING id",[req.params.id,req.user.id,body]);await saveAttachments(client,req.files,req.params.id,req.user.id,q.rows[0].id);await client.query('UPDATE chamados SET updated_at=now() WHERE id=$1',[req.params.id]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}const owner=await pool.query('SELECT email FROM usuarios WHERE id=$1',[req.ticket.requester_id]);send(owner.rows[0].email,'Nova interação no chamado #'+req.params.id,`<p>Há uma nova interação no seu chamado:</p><blockquote>${esc(body)}</blockquote>`).catch(console.error);res.json({ok:true});}));
app.patch('/api/tickets/:id',auth,ticketAccess,safe(async(req,res)=>{const t=req.ticket;const isManager=req.user.role!=='COLABORADOR';const status=String(req.body?.status||t.status);const assignee=req.body?.assigneeId===null?null:req.body?.assigneeId===undefined?t.assignee_id:Number(req.body.assigneeId);if(!statuses.includes(status))return res.status(400).json({erro:'Status inválido'});if(!isManager&&(status!=='CANCELADO'||!['ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO'].includes(t.status)))return res.status(403).json({erro:'Só é permitido cancelar chamado em andamento'});if(t.status==='CANCELADO'||t.status==='RESOLVIDO')return res.status(409).json({erro:'Chamado encerrado'});if(isManager&&assignee!==null){const q=await pool.query("SELECT id FROM usuarios WHERE id=$1 AND role IN ('ANALISTA','ADMIN') AND enabled=true",[assignee]);if(!q.rowCount)return res.status(400).json({erro:'Analista inválido'});}const client=await pool.connect();try{await client.query('BEGIN');await client.query('UPDATE chamados SET status=$1,assignee_id=$2,updated_at=now(),resolved_at=CASE WHEN $1=\'RESOLVIDO\' THEN now() ELSE NULL END WHERE id=$3',[status,isManager?assignee:t.assignee_id,t.id]);await client.query('INSERT INTO interacoes(ticket_id,author_id,kind,body) VALUES($1,$2,$3,$4)',[t.id,req.user.id,'ALTERACAO',`Status: ${t.status} → ${status}; responsável: ${isManager?assignee??'não atribuído':t.assignee_id??'não atribuído'}`]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}const q=await pool.query('SELECT email FROM usuarios WHERE id=$1',[t.requester_id]);send(q.rows[0].email,'Atualização do chamado #'+t.id,`<p>Seu chamado foi atualizado.</p><p>Status: <b>${esc(status)}</b></p>`).catch(console.error);res.json({ok:true});}));
app.get('/api/analysts',auth,manager,safe(async(req,res)=>{const q=await pool.query("SELECT id,name,company_code,email,role FROM usuarios WHERE role IN ('ANALISTA','ADMIN') AND enabled=true ORDER BY name");res.json(q.rows);}));
app.get('/api/dashboard',auth,manager,safe(async(req,res)=>{const q=await pool.query("SELECT status,count(*)::int AS total FROM chamados GROUP BY status");const daily=await pool.query("SELECT to_char(date_trunc('day',created_at AT TIME ZONE 'America/Sao_Paulo'),'DD/MM') AS dia,count(*)::int AS total FROM chamados WHERE created_at>=now()-interval '14 days' GROUP BY 1,date_trunc('day',created_at AT TIME ZONE 'America/Sao_Paulo') ORDER BY 2");const unit=await pool.query('SELECT company_code,count(*)::int total FROM chamados GROUP BY company_code ORDER BY total DESC');const avg=await pool.query("SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at-created_at))/3600)::numeric,1) AS hours FROM chamados WHERE resolved_at IS NOT NULL");res.json({statuses:q.rows,daily:daily.rows,units:unit.rows,meanResolutionHours:avg.rows[0].hours});}));
app.post('/api/admin/invite',auth,admin,throttle,safe(async(req,res)=>{
 const company=String(req.body?.company||''),eid=String(req.body?.employeeId||'');
 const email=String(req.body?.email||'').trim().toLowerCase();
 const role=String(req.body?.role||'ANALISTA');
 if(!['ANALISTA','COLABORADOR'].includes(role))return res.status(400).json({erro:'Perfil inválido'});
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return res.status(400).json({erro:'E-mail inválido'});
 const employee=await alter.findActive(company,eid);
 if(!employee)return res.status(400).json({erro:'Funcionário ativo não localizado'});
 const existing=await pool.query('SELECT id,email,role FROM usuarios WHERE company_code=$1 AND employee_id=$2',[company,eid]);
 if(existing.rowCount){
   const current=existing.rows[0];
   if(current.email.toLowerCase()!==email)return res.status(409).json({erro:'Este funcionário possui outro e-mail cadastrado. Verifique manualmente antes de alterar.'});
   if(current.role==='ADMIN')return res.status(403).json({erro:'Não é permitido modificar um administrador por convite'});
   if(current.role==='ANALISTA'&&role==='COLABORADOR')return res.status(409).json({erro:'Analista existente não pode ser rebaixado por convite'});
   await pool.query('UPDATE usuarios SET enabled=true,role=$1 WHERE id=$2',[role,current.id]);
 }else{
   const login=await allocateLogin(pool,employee.name);await pool.query('INSERT INTO usuarios(company_code,employee_id,employee_lookup,cpf_hash,login,name,email,role) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[company,eid,employee.lookup||employee.name,employee.cpf?cpfHash(employee.cpf):null,login,employee.name,email,role]);
 }
 const q=await pool.query('SELECT id,email,login FROM usuarios WHERE company_code=$1 AND employee_id=$2',[company,eid]);
 const token=await tokenFor(q.rows[0],'CONVITE');
 await send(email,role==='ANALISTA'?'Convite para equipe de TI | Turin':'Convite de acesso aos chamados | Turin',`<p>${esc(employee.name)}, seu acesso ao portal de chamados da Turin foi autorizado pela equipe de TI.</p><p>Login: <strong>${esc(q.rows[0].login)}</strong></p><p><a href="${esc(link(token))}">Criar senha (válido por 30 minutos)</a></p>`);
 res.json({ok:true});
}));
app.use('/api',(req,res)=>res.status(404).json({erro:'Rota não encontrada'}));app.use(express.static(path.join(__dirname,'../public')));app.get('*',(_req,res)=>res.sendFile(path.join(__dirname,'../public/index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(err.status|| (err instanceof multer.MulterError?400:500)).json({erro:err instanceof multer.MulterError?err.message:err.status?err.message:'Ocorreu um erro interno. Tente novamente.'});});
async function start(){const c=await pool.connect();try{await c.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));}finally{c.release();}app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Chamados TI iniciado'));}
start().catch(e=>{console.error('Falha na inicialização',e);process.exit(1)});
