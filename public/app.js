const root=document.getElementById('root');let testCredentials=null;
let notifications={pending:0,items:[]};
let me=null,tickets=[],analysts=[],companies=[],users=[],view='home',ticketId=null,filter='',statusFilter=[],companyFilter=[],priorityFilter=[],ticketPeriod='all',ticketSort={key:'created_at',direction:'desc'},dashboard=null,message='',error=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>d?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d)):'—';
const label=s=>({ABERTO:'Aberto',EM_ATENDIMENTO:'Em atendimento',AGUARDANDO_USUARIO:'Aguardando usuário',RESOLVIDO:'Resolvido',CANCELADO:'Cancelado'}[s]||s);
const priorityLabel=p=>({BAIXA:'Baixa',NORMAL:'Normal',ALTA:'Alta',CRITICA:'Crítica'}[p]||p||'Normal');
const priorityClass=p=>['BAIXA','NORMAL','ALTA','CRITICA'].includes(p)?p:'NORMAL';
const priorityBadge=p=>`<span class="priority-label priority-${priorityClass(p)}">${esc(priorityLabel(p))}</span>`;
const statusOptions=['ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO','RESOLVIDO','CANCELADO'];
const priorityOptions=['CRITICA','ALTA','NORMAL','BAIXA'];
function multiFilter(id,title,values,selected,format){
 const count=selected.length;
 return `<details class="multi-filter" id="${id}"><summary class="multi-filter-summary" aria-label="${esc(title)}: ${count?count+' selecionado(s)':'todos'}"><span>${esc(title)}${count?' · '+count:''}</span><span class="multi-filter-chevron" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></summary><div class="multi-filter-options"><div class="multi-filter-actions"><button type="button" class="multi-filter-all" data-filter="${id}">Selecionar todos</button><button type="button" class="multi-filter-clear" data-filter="${id}">Limpar</button></div>${values.map(value=>`<label class="multi-filter-option"><input type="checkbox" data-filter-id="${id}" value="${esc(value)}" ${selected.includes(value)?'checked':''}><span>${esc(format(value))}</span></label>`).join('')}</div></details>`;
}
const pill=s=>`<span class="pill ${esc(s)}">${label(s)}</span>`;
async function api(url,{method='GET',body,files}={}){const opts={method,credentials:'same-origin',headers:{}};if(files){opts.body=files;}else if(body!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}const r=await fetch('/api'+url,opts);const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.erro||'Falha na solicitação');return data;}
let notificationTimer=null;
function alertMsg(msg,isError=false){
 const previous=document.getElementById('app-notification');if(previous)previous.remove();
 if(notificationTimer)clearTimeout(notificationTimer);
 const notice=document.createElement('div');notice.id='app-notification';notice.className='app-toast '+(isError?'toast-error':'toast-success');
 notice.setAttribute('role',isError?'alert':'status');
 notice.innerHTML='<span class="toast-symbol" aria-hidden="true">'+(isError?'!':'✓')+'</span><span class="toast-content"></span><button type="button" class="toast-close" aria-label="Fechar notificação">×</button>';
 notice.querySelector('.toast-content').textContent=String(msg);
 notice.querySelector('.toast-close').onclick=()=>{notice.remove();if(notificationTimer)clearTimeout(notificationTimer);notificationTimer=null;};
 document.body.appendChild(notice);
 notificationTimer=setTimeout(()=>{notice.remove();notificationTimer=null;},isError?6500:4000);
}
const navigationIcons={
 overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 tickets:'<path d="M8 6h13M8 12h13M8 18h13"/><path d="m3 6 1 1 2-2M3 12h3M3 18h3"/>',
 shared:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 10-4.5M16 8h5m-2.5-2.5L21 8l-2.5 2.5M21 17h-7m2.5-2.5L14 17l2.5 2.5"/>',
 new:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
 reviews:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
 dashboard:'<path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-8"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
 invite:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M19 8v8M15 12h8"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 collapse:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-12-3 3 3 3"/>',
 expand:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m3-12 3 3-3 3"/>'
};
function navIcon(name){return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(navigationIcons[name]||navigationIcons.tickets)+'</svg>';}
let sidebarCollapsed=false;
try{sidebarCollapsed=localStorage.getItem('chamados-ti-sidebar-collapsed')==='1';}catch(_){}
function shell(content){const a=me.role!=='COLABORADOR';return `<div class="layout ${sidebarCollapsed?'sidebar-collapsed':''}"><header class="mobile-header"><img src="/brand/turin-logo-white.png" alt="Turin Transportes"><div class="mobile-header-actions">${notifications.pending?`<button class="mobile-notification" type="button" data-go="notifications" title="Avaliações" aria-label="${notifications.pending} avaliações pendentes">🔔 <span>${notifications.pending}</span></button>`:''}<button class="mobile-menu-toggle" type="button" id="mobileMenuToggle" aria-controls="mainNavigation" aria-expanded="false" aria-label="Abrir menu"><span></span><span></span><span></span></button></div></header><button class="mobile-backdrop" type="button" id="mobileBackdrop" aria-label="Fechar menu" tabindex="-1"></button><aside class="sidebar" id="mainNavigation" aria-label="Navegação principal"><div class="mobile-drawer-heading"><span>Menu</span><button id="mobileMenuClose" type="button" aria-label="Fechar menu">✕</button></div><div class="sidebar-heading"><div class="brand"><img class="brand-image" src="/brand/turin-logo-white.png" alt="Turin Transportes"></div><button type="button" class="desktop-sidebar-toggle" id="desktopSidebarToggle" aria-controls="mainNavigation" aria-label="${sidebarCollapsed?'Expandir menu lateral':'Recolher menu lateral'}" title="${sidebarCollapsed?'Expandir menu lateral':'Recolher menu lateral'}">${navIcon(sidebarCollapsed?'expand':'collapse')}</button></div><div class="navs"><button class="nav ${view==='home'?'active':''}" data-go="home" title="Visão geral"><span class="nav-icon">${navIcon('overview')}</span><span class="nav-label">Visão geral</span></button><button class="nav ${view==='tickets'||view==='detail'?'active':''}" data-go="tickets" title="${a?'Todos os chamados':'Meus chamados'}"><span class="nav-icon">${navIcon('tickets')}</span><span class="nav-label">${a?'Todos os chamados':'Meus chamados'}</span></button>${a?`<button class="nav shared-nav ${view==='shared'?'active':''}" data-go="shared" title="Compartilhados comigo"><span class="nav-icon">${navIcon('shared')}</span><span class="nav-label">Compartilhados comigo</span>${tickets.filter(t=>t.shared_with_me&&!['RESOLVIDO','CANCELADO'].includes(t.status)).length?`<span class="shared-nav-count">${tickets.filter(t=>t.shared_with_me&&!['RESOLVIDO','CANCELADO'].includes(t.status)).length}</span>`:''}</button>`:''}<button class="nav ${view==='new'?'active':''}" data-go="new" title="Abrir chamado"><span class="nav-icon">${navIcon('new')}</span><span class="nav-label">Abrir chamado</span></button><button class="nav ${view==='notifications'?'active':''}" data-go="notifications"><span class="nav-icon">${navIcon('reviews')}</span><span class="nav-label">Avaliações</span> ${notifications.pending?`<span class="nav-count">${notifications.pending}</span>`:''}</button>${me.role==='ADMIN'?`<button class="nav ${view==='dashboard'?'active':''}" data-go="dashboard" title="Indicadores"><span class="nav-icon">${navIcon('dashboard')}</span><span class="nav-label">Indicadores</span></button>`:''}${me.role==='ADMIN'?`<button class="nav ${view==='users'?'active':''}" data-go="users" title="Usuários"><span class="nav-icon">${navIcon('users')}</span><span class="nav-label">Usuários</span></button><button class="nav ${view==='invite'?'active':''}" data-go="invite" title="Convidar funcionário"><span class="nav-icon">${navIcon('invite')}</span><span class="nav-label">Convidar funcionário</span></button>`:''}</div><div class="side-bottom"><div><strong>${esc(me.name)}</strong><p>${esc(me.email)} · ${esc(me.role)}</p></div><button class="nav" id="logout" title="Sair"><span class="nav-icon">${navIcon('logout')}</span><span class="nav-label">Sair</span></button></div></aside><main class="main">${content}</main></div>`;}
function reviewStars(n){return '★'.repeat(Number(n||0))+'☆'.repeat(5-Number(n||0));}
function notificationsPage(){
 return header('Avaliações pendentes','Chamados resolvidos aguardando sua opinião.')+
 `<section class="card"><h2>Atendimentos para avaliar</h2>${notifications.items.length?notifications.items.map(n=>`<button class="review-notice" data-id="${n.id}"><strong>#${String(n.id).padStart(5,'0')} · ${esc(n.subject)}</strong><span>Responsável: ${esc(n.assignee_name||'Não atribuído')} · Resolução: ${n.duration_hours==null?'—':esc(n.duration_hours)+' h'}</span>${n.resolution_summary?`<em>Solução: ${esc(n.resolution_summary)}</em>`:'<em>Solução: não detalhada</em>'}<small>Concluído em ${fmt(n.resolved_at)} · Avaliar atendimento ›</small></button>`).join(''):'<p class="muted">Nenhuma avaliação pendente.</p>'}</section>`;
}
function header(title,subtitle,action=''){return `<div class="top"><div><div class="eyebrow">CENTRAL DE SERVIÇOS · TI</div><h1>${title}</h1><div class="muted">${subtitle}</div></div>${action}</div>`;}
function companyLabel(code){const c=companies.find(item=>String(item.code)===String(code));return c?.name||(String(code)==='TESTE'?'Empresa TESTE':'Empresa não identificada');}
function ticketCompanyOptions(){return [...new Set(tickets.map(t=>String(t.company_code||'')).filter(Boolean))].sort((a,b)=>companyLabel(a).localeCompare(companyLabel(b),'pt-BR'));}
function count(s){return tickets.filter(t=>t.status===s).length;}function metrics(){
 const cells=[
  {label:'Total de chamados',total:tickets.length,filter:'',icon:'☷',sub:'Todos os registros'},
  {label:'Em aberto',total:tickets.filter(t=>t.status==='ABERTO').length,filter:'ABERTO',icon:'◷',sub:'Aguardando atendimento'},
  {label:'Em andamento',total:tickets.filter(t=>['EM_ATENDIMENTO','AGUARDANDO_USUARIO'].includes(t.status)).length,filter:'ATIVOS',icon:'◎',sub:'Atendimentos ativos'},
  {label:'Resolvidos',total:tickets.filter(t=>t.status==='RESOLVIDO').length,filter:'RESOLVIDO',icon:'✓',sub:'Chamados concluídos'}
 ];
 return `<div class="cards">${cells.map(c=>`<button class="card metric metric-action" type="button" data-metric-status="${c.filter}" aria-label="Filtrar chamados: ${c.label}"><span class="dot">${c.icon}</span><div class="muted">${c.label}</div><div class="num">${c.total}</div><div class="sub">${c.sub}</div><span class="metric-link">Ver chamados ›</span></button>`).join('')}</div>`;
}const ticketSortColumns=[['id','Chamado'],['subject','Assunto'],['requester_name','Solicitante'],['company_code','Empresa'],['assignee_name','Responsável'],['created_at','Aberto em'],['status','Status']];
function table(items,{sortable=false}={}){
 const heads=sortable?ticketSortColumns.map(([key,title])=>`<th aria-sort="${ticketSort.key===key?(ticketSort.direction==='asc'?'ascending':'descending'):'none'}"><button type="button" class="ticket-sort-btn" data-ticket-sort="${key}" title="Ordenar por ${title}" aria-label="Ordenar por ${title}"><span>${title}</span><span class="ticket-sort-indicator" aria-hidden="true">${ticketSort.key===key?(ticketSort.direction==='asc'?'↑':'↓'):'↕'}</span></button></th>`).join(''):'<th>Chamado</th><th>Assunto</th><th>Solicitante</th><th>Empresa</th><th>Responsável</th><th>Aberto em</th><th>Status</th>';
 return items.length?`<div class="table-wrap"><table><thead><tr>${heads}</tr></thead><tbody>${items.map(t=>`<tr data-id="${t.id}" class="ticket-row priority-row-${priorityClass(t.urgency)}"><td><strong>#${String(t.id).padStart(5,'0')}</strong></td><td><strong>${esc(t.subject)}</strong><div class="ticket-subtitle"><span class="muted ticket-category">${esc(t.category)}</span><div class="ticket-priority-line">${priorityBadge(t.urgency)}${t.shared_with_me?'<span class="shared-ticket-tag">Compartilhado comigo</span>':''}</div></div></td><td>${esc(t.requester_name)}</td><td class="ticket-company">${esc(companyLabel(t.company_code))}</td><td>${esc(t.assignee_name||'Não atribuído')}</td><td>${fmt(t.created_at)}</td><td>${pill(t.status)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><div class="symbol">◫</div>Nenhum chamado encontrado.</div>`;}
function sharedTickets(){return tickets.filter(t=>t.shared_with_me);}
function sharedPage(){
 if(me.role==='COLABORADOR')return home();
 const items=sharedTickets();
 const pending=items.filter(t=>!['RESOLVIDO','CANCELADO'].includes(t.status));
 const complete=items.filter(t=>['RESOLVIDO','CANCELADO'].includes(t.status));
 return header('Compartilhados comigo','Chamados em que você participa como apoio, sem substituir o responsável principal.')+
 `<section class="card shared-list-card"><div class="sectionhead"><h2>Em acompanhamento <span class="shared-heading-count">${pending.length}</span></h2></div><p class="muted">Chamados abertos ou em atendimento compartilhados diretamente com você.</p>${pending.length?table(pending):'<div class="shared-empty">Nenhum chamado compartilhado pendente.</div>'}</section>`+
 (complete.length?`<section class="card shared-list-card"><div class="sectionhead"><h2>Concluídos e cancelados</h2></div>${table(complete)}</section>`:'');
}
function home(){
 const pending=me.role!=='COLABORADOR'?sharedTickets().filter(t=>!['RESOLVIDO','CANCELADO'].includes(t.status)):[];
 return header(`Olá, ${esc(me.name.split(' ')[0])}! 👋`,'Acompanhe suas solicitações de suporte.',`<button class="primary" data-go="new">＋ Novo chamado</button>`)+
 metrics()+
 (pending.length?`<section class="card shared-home-card"><div class="sectionhead"><div><h2>Compartilhados com você <span class="shared-heading-count">${pending.length}</span></h2><p class="muted">Você foi incluído como apoio nestes atendimentos.</p></div><button class="secondary" data-go="shared">Ver todos</button></div>${table(pending.slice(0,5))}</section>`:'')+
 `<div class="card"><div class="sectionhead"><h2>Chamados recentes</h2><button class="secondary" data-go="tickets">Ver todos</button></div>${table(tickets.slice(0,8))}</div>`;
}
function ticketsPage(){
 const periodDays=ticketPeriod==='all'?null:Number(ticketPeriod);
 const cutoff=periodDays===null?null:Date.now()-periodDays*86400000;
 const list=tickets.filter(t=>
  (!statusFilter.length||statusFilter.includes(t.status)) &&
  (!companyFilter.length||companyFilter.includes(String(t.company_code))) &&
  (!priorityFilter.length||priorityFilter.includes(priorityClass(t.urgency))) &&
  (cutoff===null||new Date(t.created_at).getTime()>=cutoff) &&
  (!filter||[t.id,t.subject,t.category,t.requester_name,companyLabel(t.company_code)].join(' ').toLowerCase().includes(filter.toLowerCase()))
 ).sort((a,b)=>{
  const key=ticketSort.key,dir=ticketSort.direction==='asc'?1:-1;
  const get=t=>key==='company_code'?companyLabel(t.company_code):key==='id'?Number(t.id):key==='created_at'?new Date(t.created_at).getTime():key==='status'?label(t.status):t[key]||'';
  const v1=get(a),v2=get(b);
  const order=typeof v1==='number'&&typeof v2==='number'?v1-v2:String(v1).localeCompare(String(v2),'pt-BR',{sensitivity:'base',numeric:true});
  return dir*order||Number(b.id)-Number(a.id);
 });
 return header(me.role==='COLABORADOR'?'Meus chamados':'Gerenciar chamados','Consulte, acompanhe e interaja com as solicitações.',`<button class="primary" data-go="new">＋ Abrir chamado</button>`)+
 `<div class="card ticket-list-card"><div class="filters multi-filters"><input id="search" type="search" placeholder="Buscar por número, assunto ou nome" aria-label="Buscar chamados" value="${esc(filter)}"><button type="button" class="secondary clear-ticket-filters" id="clearTicketFilters">Limpar filtros</button>${multiFilter('companyFilter','Empresas',ticketCompanyOptions(),companyFilter,companyLabel)}${multiFilter('statusFilter','Status',statusOptions,statusFilter,label)}${multiFilter('priorityFilter','Prioridade',priorityOptions,priorityFilter,priorityLabel)}<div class="ticket-period-field"><label for="ticketPeriod">Abertura</label><select id="ticketPeriod" aria-label="Período de abertura"><option value="7" ${ticketPeriod==='7'?'selected':''}>Abertura: últimos 7 dias</option><option value="30" ${ticketPeriod==='30'?'selected':''}>Abertura: últimos 30 dias</option><option value="90" ${ticketPeriod==='90'?'selected':''}>Abertura: últimos 90 dias</option><option value="365" ${ticketPeriod==='365'?'selected':''}>Abertura: últimos 12 meses</option><option value="all" ${ticketPeriod==='all'?'selected':''}>Abertura: todo o histórico</option></select></div></div><div class="ticket-filter-total">${list.length} chamado(s) encontrado(s) · Ordenação: ${esc(ticketSortColumns.find(x=>x[0]===ticketSort.key)?.[1]||'Abertura')} (${ticketSort.direction==='asc'?'crescente':'decrescente'})</div>${table(list,{sortable:true})}</div>`;
}
const categories=['Computadores e notebooks','Sistemas e aplicativos','Internet e rede','Impressoras','E-mail e acessos','Telefonia','Outros'];
function newPage(){return header('Abrir novo chamado','Descreva o problema para nossa equipe ajudar você.')+`<div class="card new-ticket-card"><form id="newForm" class="form-grid"><div class="field"><label>Categoria</label><select name="category" required>${categories.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Prioridade</label><select name="urgency"><option value="NORMAL">Normal</option><option value="BAIXA">Baixa</option><option value="ALTA">Alta</option><option value="CRITICA">Crítica</option></select></div><div class="field wide"><label>Assunto</label><input name="subject" maxlength="180" required placeholder="Ex.: Computador não liga"></div><div class="field wide"><label>Descreva o que está acontecendo</label><textarea name="description" maxlength="5000" required placeholder="Informe os detalhes, mensagens de erro e quando o problema começou..."></textarea></div><div class="field wide"><label>Anexos (até 5 arquivos; JPG, PNG, WEBP e PDF; 10 MB por arquivo)</label><div class="file-picker"><input id="newFiles" class="file-native" name="files" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" aria-describedby="newFileCount"><label for="newFiles" class="file-picker-button">📎 &nbsp; Selecionar arquivos</label><span class="file-picker-count" id="newFileCount">Nenhum arquivo selecionado</span></div></div><div class="wide btnrow"><button type="button" class="secondary" data-go="tickets">Cancelar</button><button class="primary" type="submit">Registrar chamado</button></div></form><dialog id="attachmentReminder" class="attachment-reminder" aria-labelledby="attachmentReminderTitle" aria-describedby="attachmentReminderDescription"><div class="attachment-reminder-body"><div class="attachment-reminder-heading"><div class="attachment-reminder-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.58-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></div><h2 id="attachmentReminderTitle">Nos ajude a te ajudar!</h2></div><p id="attachmentReminderDescription">Uma foto, captura de tela ou documento pode ajudar a equipe de TI a entender e resolver seu chamado mais rápido.</p><p class="attachment-reminder-note">Não tem nenhum arquivo? Sem problema! Você pode registrar seu chamado mesmo assim.</p><div class="attachment-reminder-actions"><button class="primary" type="button" id="attachmentReminderAdd">Selecionar anexo</button><button class="secondary" type="button" id="attachmentReminderContinue">Não tenho anexo</button></div><button type="button" class="attachment-reminder-back" id="attachmentReminderBack">Voltar ao formulário</button></div></dialog></div>`;}
function detailPage(){return header('Chamado #'+String(ticketId).padStart(5,'0'),'Histórico e acompanhamento do atendimento.')+'<div class="card spinner">Carregando detalhes...</div>';}
function details(d){
 const t=d.ticket,manager=me.role!=='COLABORADOR',closed=['CANCELADO','RESOLVIDO'].includes(t.status);
 const shares=d.shared||[];
 const canShare=!closed&&manager&&(me.role==='ADMIN'||String(t.assignee_id)===String(me.id));
 const options=analysts.filter(a=>String(a.id)!==String(t.assignee_id)&&!shares.some(x=>String(x.id)===String(a.id)));
 return header('Chamado #'+String(t.id).padStart(5,'0'),fmt(t.created_at),'<button class="secondary" data-go="tickets">← Voltar</button>')+
 `<div class="ticket-layout"><button type="button" class="secondary mobile-ticket-panel-toggle" id="mobileTicketPanelToggle" aria-controls="ticketAside" aria-expanded="false"><span aria-hidden="true">⌄</span> Mostrar informações do atendimento</button><div class="ticket-main"><section class="card ticket-section priority-detail-${priorityClass(t.urgency)}"><div class="ticket-heading"><div><div class="eyebrow">${esc(t.category)}</div><h2>${esc(t.subject)}</h2></div>${pill(t.status)}</div><p class="ticket-description">${esc(t.description)}</p><div class="ticket-meta"><span class="priority-caption">Prioridade: ${priorityBadge(t.urgency)}</span><span class="badge-sm">Empresa: ${esc(companyLabel(t.company_code))}</span>${t.shared_with_me?'<span class="shared-ticket-tag">Compartilhado com você</span>':''}</div>${t.status==='RESOLVIDO'&&t.resolution_summary?`<div class="solution-summary"><strong>Solução aplicada</strong><p>${esc(t.resolution_summary)}</p></div>`:''}</section>
 <section class="card ticket-section"><h2>Histórico do chamado</h2><div class="timeline">${d.interactions.map(i=>`<div class="event ${i.visibility==='EQUIPE'?'event-internal':''}"><strong>${esc(i.author)}</strong> · <span class="muted">${esc(i.kind==='MENSAGEM'?(i.visibility==='EQUIPE'?'Nota interna · Equipe de TI':String(i.author_id)===String(t.requester_id)?'Mensagem do solicitante':'Resposta da equipe de TI'):i.kind)}</span><p>${esc(i.body)}</p><small>${fmt(i.created_at)}</small></div>`).join('')}</div>${d.attachments.length?`<h3>Anexos</h3><div class="filelist">${d.attachments.map(file=>`<a class="filelink" href="/api/attachments/${file.id}" target="_blank" rel="noopener" title="${esc(file.filename)}" aria-label="Abrir anexo: ${esc(file.filename)}"><span aria-hidden="true">📎</span><span class="filelink-name">${esc(file.filename)}</span></a>`).join('')}</div>`:''}${!closed?`<form id="replyForm">${manager?'<div class="field reply-recipient"><label>Mensagem destinada a</label><select name="visibility" id="replyVisibility"><option value="SOLICITANTE">Solicitante · visível para o colaborador</option><option value="EQUIPE">Equipe de TI · mensagem interna</option></select><small id="replyVisibilityHelp">O solicitante poderá visualizar esta mensagem e receberá notificação por e-mail.</small><label class="await-reply-choice" id="awaitReplyChoice"><input type="checkbox" name="awaitingReply" value="true" checked><span><strong>Aguardar resposta do solicitante</strong><small id="awaitReplyHelp">Ao enviar, o chamado mudará automaticamente para Aguardando usuário.</small></span></label></div>':'<input type="hidden" name="visibility" value="SOLICITANTE">'}<div class="field reply-field"><label>Mensagem</label><textarea name="body" required placeholder="Escreva uma atualização..."></textarea></div><div class="field reply-field"><label>Anexar arquivos</label><div class="file-picker"><input id="replyFiles" class="file-native" type="file" name="files" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" aria-describedby="replyFileCount"><label for="replyFiles" class="file-picker-button">📎 &nbsp; Selecionar arquivos</label><span class="file-picker-count" id="replyFileCount">Nenhum arquivo selecionado</span></div></div><div class="btnrow"><button class="primary">Enviar mensagem</button></div></form>`:''}</section>${t.status==='RESOLVIDO'?`<section class="card ticket-review"><h2>Avaliação do atendimento</h2><div class="review-meta"><span>Responsável: <strong>${esc(t.assignee_name||'Não atribuído')}</strong></span><span>Tempo até resolução: <strong>${t.resolved_at?Math.max(0,(new Date(t.resolved_at)-new Date(t.created_at))/3600000).toFixed(1).replace('.',',')+' h':'—'}</strong></span></div>${d.review?`<div class="review-result"><p><strong>Atendimento:</strong> ${reviewStars(d.review.rating)}</p><p><strong>Solução:</strong> ${reviewStars(d.review.solution_rating)}</p><p><strong>Tempo:</strong> ${reviewStars(d.review.time_rating)}</p>${d.review.comment?`<p>${esc(d.review.comment)}</p>`:''}<small>Avaliado em ${fmt(d.review.created_at)}</small></div>`:String(t.requester_id)===String(me.id)?`<form id="reviewForm"><p class="muted">Avalie de 1 a 5 estrelas para ajudar a melhorar o suporte de TI.</p>${[['rating','Qualidade do atendimento'],['solutionRating','Solução apresentada'],['timeRating','Tempo de resolução']].map(([key,label])=>`<div class="field"><label>${label}</label><div class="star-rating" role="group" aria-label="${esc(label)}">${[5,4,3,2,1].map(n=>`<label class="star-option"><input type="radio" name="${key}" value="${n}" required aria-label="${n} estrela${n>1?'s':''}"><span aria-hidden="true">★</span></label>`).join('')}</div></div>`).join('')}<div class="field"><label>Comentário (opcional)</label><textarea name="comment" maxlength="1000" placeholder="Conte como foi o atendimento"></textarea></div><button class="primary" type="submit">Enviar avaliação</button></form>`:'<p class="muted">Aguardando avaliação do solicitante.</p>'}</section>`:''}</div>
 <aside class="ticket-aside" id="ticketAside"><section class="card ticket-section"><h2>Atendimento</h2><div class="attendee"><div class="attendee-label">Solicitante</div><strong class="attendee-name">${esc(t.requester_name)}</strong><small>Abriu a solicitação</small></div><div class="attendee"><div class="attendee-label">Responsável principal</div><strong class="attendee-name">${esc(t.assignee_name||'Não atribuído')}</strong><small>${t.assignee_id?'Conduz o atendimento':'Aguardando atribuição'}</small></div>${manager&&!closed?`<form id="updateForm" class="ticket-manage-form"><h3>Gerenciar chamado</h3><div class="field"><label>Situação</label><select name="status">${['ABERTO','EM_ATENDIMENTO','AGUARDANDO_USUARIO','RESOLVIDO','CANCELADO'].map(st=>`<option value="${st}" ${st===t.status?'selected':''}>${label(st)}</option>`).join('')}</select></div><div class="field"><label>Responsável principal</label><select name="assigneeId"><option value="">Não atribuído</option>${analysts.map(a=>`<option value="${a.id}" ${String(a.id)===String(t.assignee_id)?'selected':''}>${esc(a.name)} · ${esc(companyLabel(a.company_code))}</option>`).join('')}</select></div><div class="field" id="resolutionField" ${t.status==='RESOLVIDO'?'':'hidden'}><label>Solução aplicada</label><textarea name="resolutionSummary" maxlength="2000" placeholder="Descreva o que foi feito para resolver o chamado...">${esc(t.resolution_summary||'')}</textarea></div><div class="btnrow"><button class="primary">Salvar alterações</button></div></form>`:''}${!manager&&!closed?`<div class="btnrow"><button class="secondary" id="cancelTicket">Cancelar chamado</button></div>`:''}</section>
 ${manager?`<section class="card ticket-section"><h2>Equipe de apoio</h2><p class="muted">Analistas convidados para acompanhar e colaborar. O responsável principal não muda.</p>${shares.length?`<div class="shared-team">${shares.map(u=>`<div class="shared-person"><div><strong>${esc(u.name)}</strong><small>${u.role==='ADMIN'?'Administrador':'Analista de TI'}</small></div>${canShare?`<button type="button" class="secondary shared-remove" data-shared-id="${u.id}" aria-label="Remover ${esc(u.name)}">Remover</button>`:''}</div>`).join('')}</div>`:'<p class="muted">Nenhum analista adicional.</p>'}${canShare?`<form id="shareForm" class="share-form"><div class="field"><label>Compartilhar com</label><select name="userId" required><option value="">Selecione um analista</option>${options.map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.role==='ADMIN'?'Administrador':'Analista'} · ${esc(companyLabel(a.company_code))}</option>`).join('')}</select></div><button class="secondary" type="submit" ${options.length?'':'disabled'}>Compartilhar chamado</button></form>`:''}</section>`:''}</aside></div>`;
}

function indicatorIcon(kind){
 const paths={
  total:'<path d="M3 12a9 9 0 0 1 18 0v7h-4v-6h4M3 13h4v6H3z"/>',
  resolved:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
  progress:'<path d="M20 7a9 9 0 0 0-15-1M4 3v4h4M4 17a9 9 0 0 0 15 1m1 3v-4h-4"/>',
  waiting:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  goal:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  hour:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/>',
  company:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2"/>',
  flag:'<path d="M5 22V3m0 1c5-4 9 3 14-1v11c-5 4-9-3-14 1"/>',
  trend:'<path d="M3 17 9 11l4 4 8-9m-6 0h6v6"/>',
  team:'<circle cx="9" cy="8" r="3"/><circle cx="18" cy="9" r="2"/><path d="M2 20v-2a7 7 0 0 1 14 0v2zm15-5a5 5 0 0 1 5 5"/>',
  status:'<path d="M4 20V10m6 10V4m6 16v-7m5 7V7"/>',
  category:'<path d="M20 12 12 20a2 2 0 0 1-3 0l-6-6V4h10l7 7a2 2 0 0 1 0 1z"/><circle cx="8" cy="9" r="1"/>',
  review:'<path d="m12 2 3 6 7 .9-5 4.9 1.2 7-6.2-3.3L5.8 21l1.2-7-5-4.9 7-.9z"/>',
  insight:'<path d="M9 18h6m-5 3h4M9 14a7 7 0 1 1 6 0c-.9.7-1 1.7-1 2h-4c0-.3-.1-1.3-1-2z"/>'
 };
 return '<svg class="dash-icon" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[kind]||paths.status)+'</svg>';
}
function dashboardDailyChart(items){
 if(!items.length)return '<p class="empty">Sem aberturas no período</p>';
 const data=items.slice(-15),values=data.map(x=>Number(x.total||0));
 const max=Math.max(1,...values),left=37,right=497,top=22,bottom=148;
 const pts=data.map((x,i)=>({x:left+(data.length===1?0.5:i/(data.length-1))*(right-left),y:bottom-(Number(x.total||0)/max)*(bottom-top),value:Number(x.total||0),day:String(x.day)}));
 const line=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 const area=line+' L '+pts[pts.length-1].x.toFixed(1)+' '+bottom+' L '+pts[0].x.toFixed(1)+' '+bottom+' Z';
 const ticks=[0,0.5,1].map(n=>'<line x1="'+left+'" y1="'+(bottom-n*(bottom-top))+'" x2="'+right+'" y2="'+(bottom-n*(bottom-top))+'" stroke="#e6eee8"/><text x="7" y="'+(bottom-n*(bottom-top)+4)+'" font-size="11" fill="#84968a">'+Math.round(n*max)+'</text>').join('');
 const chosen=pts.filter((p,i)=>i===0||i===pts.length-1||i===Math.floor(pts.length/2));
 return '<svg class="dashboard-sparkline" role="img" aria-label="Aberturas diárias por data" viewBox="0 0 520 182" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="dashboard-area-green" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#37a46a" stop-opacity=".22"/><stop offset="100%" stop-color="#37a46a" stop-opacity=".015"/></linearGradient></defs>'+ticks+'<path d="'+area+'" fill="url(#dashboard-area-green)"/><path d="'+line+'" stroke="#08773d" stroke-width="2.5" fill="none" stroke-linejoin="round"/>'+pts.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" stroke="#08773d" stroke-width="2" fill="white"><title>'+p.day+': '+p.value+' abertura(s)</title></circle>').join('')+chosen.map(p=>'<text x="'+p.x+'" y="'+(p.y-10)+'" font-size="12" text-anchor="middle" font-weight="700" fill="#086637">'+p.value+'</text><text x="'+p.x+'" y="173" font-size="11" text-anchor="middle" fill="#64786b">'+esc(p.day.slice(8,10)+'/'+p.day.slice(5,7))+'</text>').join('')+'</svg>';
}
function dashboardPage(){
 if(me.role!=='ADMIN')return header('Acesso restrito','Indicadores exclusivos do administrador.');
 if(!dashboard)return header('Indicadores','Acompanhamento dos chamados e da equipe.')+'<div class="card">Não foi possível carregar os indicadores.</div>';
 const o=dashboard.overview||{},aging=dashboard.aging||{},total=Number(o.total||0),resolved=Number(o.resolved||0);
 const ratio=total?Math.round(resolved/total*100):0;
 const people=dashboard.analysts||[];
 const fmtHours=h=>h==null?'—':Number(h).toLocaleString('pt-BR',{maximumFractionDigits:1})+' h';
 const fmtRating=n=>n==null?'—':Number(n).toLocaleString('pt-BR',{maximumFractionDigits:1})+' / 5';
 const statusesColors={ABERTO:'#7253ba',EM_ATENDIMENTO:'#2477d3',AGUARDANDO_USUARIO:'#e5a515',RESOLVIDO:'#16934e',CANCELADO:'#d45841'};
 const prioritiesColors={BAIXA:'#6f9980',NORMAL:'#139f83',ALTA:'#e78a21',CRITICA:'#d84542'};
 const bars=(items,describe,colorFor)=>{
  const max=Math.max(1,...items.map(x=>Number(x.total||0)));
  return items.length?items.map(x=>{
   const n=Number(x.total||0),name=describe(x),color=colorFor(x);
   return `<div class="indicator-bar-row"><div class="indicator-bar-info"><span>${esc(name)}</span><strong>${n} <small>(${total?Math.round(n/total*100):0}%)</small></strong></div><div class="indicator-bar-track"><div class="indicator-bar-fill" style="--bar-color:${color};width:${n/max*100}%"></div></div></div>`;
  }).join(''):'<div class="empty">Sem chamados no período</div>';
 };
 const kpis=[
  ['total','Total de chamados',total],
  ['resolved','Resolvidos',resolved],
  ['progress','Em atendimento',Number(o.in_progress||0)],
  ['waiting','Pendentes',Number(o.open||0)+Number(o.in_progress||0)+Number(o.waiting||0)],
  ['goal','Taxa de resolução',ratio+'%'],
  ['hour','Tempo médio de resolução',fmtHours(o.avg_resolution_hours)]
 ];
 const topFilter=`<section class="dashboard-filterbar dashboard-filterbar-compact"><div class="dashboard-filterhead"><div><h2>Filtros dos indicadores</h2><p class="muted">Todos os números abaixo respeitam os filtros selecionados.</p></div><button class="secondary" type="button" id="dashboardClear">Limpar filtros</button></div><div class="dashboard-filtergrid">
 <div class="field"><label for="dashboardPeriod">Período de abertura</label><select id="dashboardPeriod"><option value="7" ${dashboard.period==='7'?'selected':''}>Últimos 7 dias</option><option value="30" ${dashboard.period==='30'?'selected':''}>Últimos 30 dias</option><option value="90" ${dashboard.period==='90'?'selected':''}>Últimos 90 dias</option><option value="365" ${dashboard.period==='365'?'selected':''}>Últimos 12 meses</option><option value="all" ${dashboard.period==='all'?'selected':''}>Todo o histórico</option></select></div>
 <div class="field"><label for="dashboardCompany">Empresa</label><select id="dashboardCompany"><option value="">Todas as empresas</option>${(dashboard.filterOptions?.companies||[]).map(code=>`<option value="${esc(code)}" ${dashboard.filters?.company===code?'selected':''}>${esc(companyLabel(code))}</option>`).join('')}</select></div>
 <div class="field"><label for="dashboardAnalyst">Analista responsável</label><select id="dashboardAnalyst"><option value="">Todos os analistas</option>${(dashboard.filterOptions?.analysts||[]).map(a=>`<option value="${esc(a.id)}" ${dashboard.filters?.analyst===String(a.id)?'selected':''}>${esc(a.name)} · ${esc(companyLabel(a.company_code))}</option>`).join('')}</select></div>
 <div class="field"><label for="dashboardCategory">Categoria</label><select id="dashboardCategory"><option value="">Todas as categorias</option>${(dashboard.filterOptions?.categories||[]).map(name=>`<option value="${esc(name)}" ${dashboard.filters?.category===name?'selected':''}>${esc(name)}</option>`).join('')}</select></div>
 </div><p class="dashboard-filterhint">O filtro de analista considera o responsável principal. As contribuições em compartilhamentos usam o mesmo período, empresa e categoria, independentemente do responsável principal.</p></section>`;
 const reviews=dashboard.reviews||{};
 const feedback=`<section class="card dashboard-feedback"><div class="dash-section-title">${indicatorIcon('review')}<h2>Avaliações do atendimento</h2></div><div class="feedback-values"><div><small>Avaliações</small><strong>${Number(reviews.reviews_count||0)}</strong></div><div><small>Atendimento</small><strong>${fmtRating(reviews.avg_service)}</strong></div><div><small>Solução</small><strong>${fmtRating(reviews.avg_solution)}</strong></div><div><small>Prazo</small><strong>${fmtRating(reviews.avg_time)}</strong></div></div></section>`;
 const peopleTable=`<section class="card dash-analysts"><div class="dash-section-title">${indicatorIcon('team')}<h2>Desempenho dos analistas</h2></div><p class="muted">Volume atribuído, contribuição em compartilhados, resolução e qualidade dos atendimentos.</p><div class="table-wrap"><table class="analyst-table"><thead><tr><th>Analista</th><th>Atribuídos</th><th>Ativos</th><th>Resolvidos</th><th>Taxa resolução</th><th class="dash-highlight-col">Compartilhados / contribuições</th><th>1ª resposta média</th><th>Resolução média</th><th>Nota atendimento</th><th>Solução</th><th>Tempo</th></tr></thead><tbody>${people.map(p=>{
  const assigned=Number(p.total_assigned||0),done=Number(p.resolved||0);
  return `<tr><td><strong>${esc(p.name)}</strong><small>${esc(companyLabel(p.company_code))} · ${p.role==='ADMIN'?'Administrador':'Analista'}</small></td><td>${assigned}</td><td>${Number(p.active||0)}</td><td>${done}</td><td>${assigned?Math.round(done/assigned*100)+'%':'—'}</td><td class="dash-highlight-col"><strong>${Number(p.shared_tickets_contributed||0)} / ${Number(p.shared_contributions||0)}</strong><small>de ${Number(p.shared_tickets||0)} compartilhado(s)</small></td><td>${fmtHours(p.avg_first_response_hours)}</td><td>${fmtHours(p.avg_resolution_hours)}</td><td>${fmtRating(p.avg_rating)}</td><td>${fmtRating(p.avg_solution_rating)}</td><td>${fmtRating(p.avg_time_rating)}</td></tr>`;
 }).join('')||'<tr><td colspan="11" class="empty">Sem analistas cadastrados</td></tr>'}</tbody></table></div><p class="dashboard-note">Compartilhados / contribuições: quantidade de chamados compartilhados em que o analista escreveu mensagens / total de mensagens nesses chamados. Não conta apenas o convite. As demais métricas de resolução consideram o responsável principal atual.</p></section>`;
 const card=(title,kind,content,extra='')=>`<section class="card dash-chart-card ${extra}"><div class="dash-section-title">${indicatorIcon(kind)}<h2>${title}</h2></div>${content}</section>`;
 const cardsTop=`<div class="dash-chart-grid">
 ${card('Chamados por empresa','company',bars(dashboard.units||[],x=>companyLabel(x.company_code),()=> '#08763e'))}
 ${card('Prioridades dos chamados','flag',bars(dashboard.priorities||[],x=>({BAIXA:'Baixa',NORMAL:'Normal',ALTA:'Alta',CRITICA:'Crítica'}[x.urgency]||x.urgency),x=>prioritiesColors[x.urgency]||'#08763e'))}
 ${card('Evolução diária de aberturas','trend',dashboardDailyChart(dashboard.daily||[]),'dash-daily-card')}
 ${card('Idade dos chamados pendentes','hour',`<div class="aging-grid"><div><strong>${Number(aging.older_24h||0)}</strong><span>Mais de 24 horas</span></div><div><strong>${Number(aging.older_48h||0)}</strong><span>Mais de 48 horas</span></div><div><strong>${Number(aging.older_7d||0)}</strong><span>Mais de 7 dias</span></div></div><p class="dashboard-note">Tempo corrido desde a abertura, sem SLA contratual.</p>`)}
 </div>`;
 const statusCard=card('Chamados por situação','status',bars(dashboard.statuses||[],x=>label(x.status),x=>statusesColors[x.status]||'#08763e'));
 const categoryCard=card('Categorias mais solicitadas','category',bars(dashboard.categories||[],x=>x.category,()=> '#21925b'));
 const sharingTotal=people.reduce((v,p)=>v+Number(p.shared_contributions||0),0);
 const contributors=[...people].sort((a,b)=>Number(b.shared_contributions||0)-Number(a.shared_contributions||0));
 const insight=`<section class="card dash-insights"><div class="dash-section-title">${indicatorIcon('insight')}<h2>Destaques do período</h2></div><div class="dash-insight-grid"><div><small>Chamados resolvidos</small><strong>${resolved}</strong><span>do total de ${total} aberturas</span></div><div><small>Resolução média</small><strong>${fmtHours(o.avg_resolution_hours)}</strong><span>da abertura à resolução</span></div><div><small>Maior taxa de resolução</small><strong>${people.filter(p=>Number(p.total_assigned||0)>0).length?Math.max(...people.filter(p=>Number(p.total_assigned||0)>0).map(p=>Math.round(Number(p.resolved||0)/Number(p.total_assigned||1)*100)))+'%':'—'}</strong><span>entre analistas com atribuições</span></div><div><small>Mensagens em compartilhados</small><strong>${sharingTotal}</strong><span>${esc(contributors[0]?.shared_contributions>0?contributors[0].name:'Sem contribuições registradas')}</span></div></div></section>`;
 return header('Indicadores','Acompanhe o volume, as prioridades, o desempenho e a qualidade dos chamados de TI.')+
 topFilter+
 `<section class="dash-summary-band">${kpis.map(([kind,name,value])=>`<div class="dash-summary-item">${indicatorIcon(kind)}<div><span>${name}</span><strong>${value}</strong></div></div>`).join('')}</section>`+
 cardsTop+
 `<div class="dash-bottom-grid"><div class="dash-bottom-main">${peopleTable}${insight}${feedback}</div><div class="dash-bottom-side">${statusCard}${categoryCard}</div></div>`;
}
function usersPage(){
 const roleLabel={ADMIN:'Administrador',ANALISTA:'Analista de TI',COLABORADOR:'Colaborador'};
 const active=users.filter(u=>u.enabled).length;
 return header('Gestão de usuários','Perfis de acesso, convites e contas temporárias para testes.',
   '<button class="primary" type="button" id="toggleTestForm">＋ Criar conta de teste</button>')+
 `${testCredentials?`<div class="card test-credentials" role="status"><h3>Credenciais de teste criadas</h3><p>Copie os dados agora. A senha não será exibida novamente, mas pode ser redefinida pelo administrador.</p><div class="test-credential-fields"><div><small>Login</small><strong>${esc(testCredentials.login)}</strong></div><div><small>Senha temporária</small><strong class="test-password">${esc(testCredentials.password)}</strong></div></div><button class="secondary" type="button" id="copyTestCredentials">Copiar login e senha</button><button class="secondary" type="button" id="dismissTestCredentials">Ocultar credenciais</button></div>`:''}<div class="users-summary"><div class="card"><small>Total de usuários</small><strong>${users.length}</strong></div><div class="card"><small>Usuários ativos</small><strong>${active}</strong></div><div class="card"><small>Analistas e administradores</small><strong>${users.filter(u=>u.enabled&&['ANALISTA','ADMIN'].includes(u.role)).length}</strong></div></div>`+
 `<div class="card test-user-panel" id="testUserPanel" hidden><h2>Nova conta de teste</h2><p class="muted">Conta de teste pronta para acessar imediatamente, sem e-mail e sem Alterdata. Válida por 7 dias. Uma senha forte será gerada e exibida somente uma vez.</p><form id="testUserForm" class="form-grid"><div class="field"><label>Nome de exibição</label><input name="name" required minlength="3" maxlength="120" placeholder="Analista de Teste"></div><div class="field"><label>Perfil de teste</label><select name="role"><option value="ANALISTA">Analista de TI</option><option value="ADMIN">Administrador</option><option value="COLABORADOR">Colaborador (apenas seus chamados)</option></select></div><div class="wide btnrow"><button class="primary" type="submit">Criar usuário de teste</button></div></form></div>`+
 `<div class="card users-list-card"><div class="users-list-toolbar"><h2>Usuários cadastrados</h2><div class="users-list-filters"><input id="userSearch" type="search" aria-label="Pesquisar usuários" placeholder="Buscar por nome, login ou e-mail"><select id="userStatus" aria-label="Filtrar situação dos usuários"><option value="">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></div></div><div class="table-wrap"><table class="users-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Origem</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${users.map(u=>`<tr class="user-row" data-user-search="${esc([u.name,u.login,u.email,u.role,u.company_code].join(' ').toLowerCase())}" data-user-active="${u.enabled?'active':'inactive'}"><td><strong>${esc(u.name)}</strong><div class="muted">${esc(u.login)}${u.is_test?' · Sem e-mail':' · '+esc(u.email)}</div></td><td><select class="user-role" data-user-id="${u.id}">${Object.keys(roleLabel).map(k=>`<option value="${k}" ${u.role===k?'selected':''}>${roleLabel[k]}</option>`).join('')}</select></td><td><span class="user-tag ${u.is_test?'test':''}">${u.is_test?'TESTE':'Alterdata · '+esc(u.company_code)}</span>${u.is_test?`<div class="muted">Expira: ${fmt(u.test_expires_at)}</div>`:''}</td><td><label class="user-enable"><input type="checkbox" class="user-active" data-user-id="${u.id}" ${u.enabled?'checked':''}> Ativo</label></td><td><div class="user-actions"><button type="button" class="secondary user-save" data-user-id="${u.id}">Salvar</button>${u.is_test?`<button type="button" class="secondary user-reset-test" data-user-id="${u.id}">Nova senha</button>`:`<button type="button" class="secondary user-invite" data-user-id="${u.id}">Convidar</button>`}</div></td></tr>`).join('')}</tbody></table></div></div>`;
}
function invitePage(){return header('Convidar funcionário','Autorize o acesso de colaboradores e analistas após conferir a identidade. Analistas atendem todas as unidades.')+`<div class="card" style="max-width:760px"><form id="inviteForm" class="form-grid"><div class="field wide"><label>Perfil de acesso</label><select name="role" required><option value="ANALISTA">Analista de TI</option><option value="COLABORADOR">Colaborador</option></select></div><div class="field wide"><label>Empresa do funcionário</label><input id="companySearch" type="search" placeholder="Pesquisar empresa ou código" aria-label="Pesquisar empresa"><select id="company" name="company" required><option value="">Selecione</option>${companies.map(c=>`<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('')}</select></div><div class="field wide"><label>Nome do funcionário</label><input id="employeeSearch" autocomplete="off" placeholder="Digite ao menos três letras"><select id="employeeId" name="employeeId" required><option value="">Selecione o funcionário</option></select></div><div class="field wide"><label>E-mail para convite</label><input name="email" type="email" required></div><div class="wide btnrow"><button class="primary">Enviar convite</button></div></form></div>`;}
function authPage(tab='login',msg=''){const token=new URLSearchParams(location.search).get('token');if(token)tab='password';return `<div class="auth-page"><div class="auth-left"><div class="brand" style="font-size:31px"><img class="brand-image" src="/brand/turin-logo-white.png" alt="Turin Transportes"></div><h1>Suporte de TI,<br>mais próximo de você.</h1><p>Abra chamados, acompanhe cada etapa e resolva suas solicitações em um só lugar.</p><span class="auth-tagline">PORTAL DE ATENDIMENTO · TURIN TRANSPORTES</span></div><div class="auth-right"><div class="auth-box"><div class="auth-logo">Chamados<span style="color:#00743a">TI</span><small>PORTAL DE SUPORTE</small></div><h2>${tab==='register'?'Primeiro acesso':tab==='reset'?'Recuperar senha':tab==='password'?'Criar nova senha':'Bem-vindo de volta'}</h2><p class="muted">${tab==='register'?'Informe o CPF para localizar seu vínculo no Alterdata. O e-mail pode ser pessoal ou compartilhado.':tab==='reset'?'Informe seu login e e-mail para recuperar a conta correta.':tab==='password'?'Defina sua senha de acesso.':'Entre para acompanhar seus chamados.'}</p><form id="authForm" data-tab="${tab}">${tab==='register'?`<div class="field"><label>Empresa</label><input id="companySearch" type="search" placeholder="Pesquisar empresa ou código" aria-label="Pesquisar empresa"><select id="company" name="company" required><option value="">Selecione</option>${companies.map(c=>`<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>CPF</label><input id="registerCpf" name="cpf" inputmode="numeric" maxlength="14" required autocomplete="off" placeholder="000.000.000-00"><small id="employeeInfo" class="muted">Informe o CPF para consultar o vínculo ativo.</small></div>`:''}${['register','reset'].includes(tab)?`<div class="field"><label>E-mail</label><input name="email" type="email" required placeholder="seuemail@empresa.com.br"></div>`:''}${['login','reset'].includes(tab)?'<div class="field"><label>Login</label><input name="login" required autocomplete="username" placeholder="nome.sobrenome"></div>':''}${['login','password'].includes(tab)?`<div class="field"><label>Senha ${tab==='password'?'(mínimo 10 caracteres)':''}</label><div class="password-control"><input id="authPassword" type="password" name="password" autocomplete="${tab==='password'?'new-password':'current-password'}" required minlength="${tab==='password'?10:1}" placeholder="••••••••••"><button type="button" class="password-toggle" data-password-toggle="authPassword" aria-controls="authPassword" aria-pressed="false" aria-label="Mostrar senha" title="Mostrar senha"><span class="password-eye" aria-hidden="true">◉</span><span class="password-toggle-label">Mostrar</span></button></div></div>`:''}<button type="submit" class="primary" style="width:100%;margin-top:15px">${tab==='register'?'Enviar ativação':tab==='reset'?'Enviar link':tab==='password'?'Criar senha e entrar':'Entrar no sistema'}</button></form><div class="auth-links"><a data-auth="${tab==='login'?'register':'login'}">${tab==='login'?'Primeiro acesso':'Voltar ao login'}</a>${tab==='login'?'<a data-auth="reset">Esqueci minha senha</a>':''}</div></div></div></div>`;}
let authTab='login',authMessage='';function render(){document.body.classList.remove('mobile-menu-open');root.innerHTML=me?shell(({home,tickets:ticketsPage,shared:sharedPage,new:newPage,detail:detailPage,notifications:notificationsPage,dashboard:dashboardPage,users:usersPage,invite:invitePage})[view]?.()||home()):authPage(authTab,authMessage);bind();}
async function go(v,id=null){view=v;ticketId=id;message='';filter='';statusFilter=[];companyFilter=[];priorityFilter=[];if(v==='dashboard'){if(me?.role!=='ADMIN'){view='home';render();return;}if(!companies.length)companies=await api('/public/companies').catch(()=>[]);const query=new URLSearchParams({period:dashboard?.period||'30',...(dashboard?.filters||{})});dashboard=await api('/dashboard?'+query).catch(e=>(alertMsg(e.message,true),null));}if(v==='notifications')notifications=await api('/notifications').catch(()=>({pending:0,items:[]}));if(v==='users'&&me?.role==='ADMIN')users=await api('/admin/users').catch(e=>(alertMsg(e.message,true),[]));render();if(v==='detail')loadDetail();if(v==='invite'&&!companies.length)loadCompanies();}
async function refresh(){me=await api('/me').catch(()=>null);if(me){const [newTickets,newAnalysts,newCompanies]=await Promise.all([api('/tickets').catch(()=>[]),me.role==='COLABORADOR'?Promise.resolve([]):api('/analysts').catch(()=>[]),companies.length?Promise.resolve(companies):api('/public/companies').catch(()=>[])]);tickets=newTickets;analysts=newAnalysts;companies=newCompanies;notifications=await api('/notifications').catch(()=>({pending:0,items:[]}));}render();}
async function loadCompanies(){try{companies=await api('/public/companies');render();}catch(e){alertMsg(e.message,true);}}
async function loadDetail(){try{const d=await api('/tickets/'+ticketId);root.querySelector('.main').innerHTML=details(d);bind();}catch(e){alertMsg(e.message,true);}}
let lookupTimer;async function lookup(){const search=document.getElementById('employeeSearch'),company=document.getElementById('company'),out=document.getElementById('employeeId');if(!search||!company||!out)return;const term=search.value.trim();if(term.length<3||!company.value){out.innerHTML='<option value="">Digite três letras e selecione a empresa</option>';return;}clearTimeout(lookupTimer);lookupTimer=setTimeout(async()=>{try{const list=await api('/public/employees?company='+encodeURIComponent(company.value)+'&term='+encodeURIComponent(term));out.innerHTML='<option value="">Selecione o funcionário</option>'+list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');}catch(e){out.innerHTML='<option value="">Não foi possível consultar</option>';}},450);}
function bind(){
 // Rebind sem acumular listeners: um clique fora fecha todos os filtros abertos.
 document.onclick=event=>{
  if(!event.target.closest?.('.multi-filter'))root.querySelectorAll('.multi-filter[open]').forEach(x=>x.open=false);
 };
 document.onkeydown=event=>{
  if(event.key==='Escape')root.querySelectorAll('.multi-filter[open]').forEach(x=>x.open=false);
 };
 root.querySelectorAll('.multi-filter').forEach(element=>element.addEventListener('toggle',()=>{
  if(element.open)root.querySelectorAll('.multi-filter[open]').forEach(other=>{if(other!==element)other.open=false;});
 }));
 const ticketPanelToggle=root.querySelector('#mobileTicketPanelToggle');
 if(ticketPanelToggle)ticketPanelToggle.onclick=()=>{
  const container=ticketPanelToggle.closest('.ticket-layout');
  if(!container)return;
  const expanded=container.classList.toggle('ticket-aside-expanded');
  ticketPanelToggle.setAttribute('aria-expanded',String(expanded));
  ticketPanelToggle.innerHTML=expanded?'<span aria-hidden="true">⌃</span> Ocultar informações do atendimento':'<span aria-hidden="true">⌄</span> Mostrar informações do atendimento';
 };
 const desktopToggle=root.querySelector('#desktopSidebarToggle');
 if(desktopToggle)desktopToggle.onclick=()=>{
  sidebarCollapsed=!sidebarCollapsed;
  root.querySelector('.layout')?.classList.toggle('sidebar-collapsed',sidebarCollapsed);
  const action=sidebarCollapsed?'Expandir menu lateral':'Recolher menu lateral';
  desktopToggle.setAttribute('aria-label',action);
  desktopToggle.title=action;
  desktopToggle.innerHTML=navIcon(sidebarCollapsed?'expand':'collapse');
  try{localStorage.setItem('chamados-ti-sidebar-collapsed',sidebarCollapsed?'1':'0');}catch(_){}
 };
 const sidebar=root.querySelector('#mainNavigation'),menuToggle=root.querySelector('#mobileMenuToggle'),backdrop=root.querySelector('#mobileBackdrop');
 const closeMenu=()=>{sidebar?.classList.remove('is-open');backdrop?.classList.remove('is-visible');menuToggle?.setAttribute('aria-expanded','false');document.body.classList.remove('mobile-menu-open');};
 const openMenu=()=>{sidebar?.classList.add('is-open');backdrop?.classList.add('is-visible');menuToggle?.setAttribute('aria-expanded','true');document.body.classList.add('mobile-menu-open');};
 if(menuToggle)menuToggle.onclick=()=>sidebar?.classList.contains('is-open')?closeMenu():openMenu();
 const closeButton=root.querySelector('#mobileMenuClose');if(closeButton)closeButton.onclick=closeMenu;
 if(backdrop)backdrop.onclick=closeMenu;
 root.querySelectorAll('.sidebar [data-go]').forEach(b=>b.addEventListener('click',closeMenu));
 root.querySelectorAll('[data-password-toggle]').forEach(button=>{button.onclick=()=>{const input=document.getElementById(button.dataset.passwordToggle);if(!input)return;const visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');button.title=visible?'Ocultar senha':'Mostrar senha';button.querySelector('.password-toggle-label').textContent=visible?'Ocultar':'Mostrar';};});
 root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));root.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>go('detail',b.dataset.id));root.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>{authTab=b.dataset.auth;authMessage='';render();if(authTab==='register')loadCompanies();});const testToggle=document.getElementById('toggleTestForm');if(testToggle)testToggle.onclick=()=>{const panel=document.getElementById('testUserPanel');panel.hidden=!panel.hidden;};
 const updateDashboard=async(override={})=>{const previous=dashboard||{};const state={period:previous.period||'30',company:previous.filters?.company||'',analyst:previous.filters?.analyst||'',category:previous.filters?.category||'',...override};try{dashboard=await api('/dashboard?'+new URLSearchParams(state));render();}catch(e){alertMsg(e.message,true);}};
 for(const [id,key] of [['dashboardPeriod','period'],['dashboardCompany','company'],['dashboardAnalyst','analyst'],['dashboardCategory','category']]){const control=document.getElementById(id);if(control)control.onchange=()=>updateDashboard({[key]:control.value});}
 const clearDashboard=document.getElementById('dashboardClear');if(clearDashboard)clearDashboard.onclick=()=>updateDashboard({period:'30',company:'',analyst:'',category:''});
 const userFilter=()=>{const term=(document.getElementById('userSearch')?.value||'').toLowerCase(),status=document.getElementById('userStatus')?.value||'';root.querySelectorAll('.user-row').forEach(r=>{r.hidden=!(r.dataset.userSearch.includes(term)&&(!status||r.dataset.userActive===status));});};
 const searchUsers=document.getElementById('userSearch');if(searchUsers)searchUsers.oninput=userFilter;
 const statusUsers=document.getElementById('userStatus');if(statusUsers)statusUsers.onchange=userFilter;
 const tf=document.getElementById('testUserForm');if(tf)tf.onsubmit=async ev=>{ev.preventDefault();const data=new FormData(tf);try{const u=await api('/admin/test-users',{method:'POST',body:{name:data.get('name'),role:data.get('role')}});testCredentials={login:u.login,password:u.temporaryPassword};users=await api('/admin/users');render();alertMsg('Conta de teste criada. Copie as credenciais exibidas na tela.');}catch(e){alertMsg(e.message,true);}};
 const copyTest=document.getElementById('copyTestCredentials');if(copyTest)copyTest.onclick=async()=>{if(!testCredentials)return;const value='Login: '+testCredentials.login+'\nSenha: '+testCredentials.password;try{await navigator.clipboard.writeText(value);alertMsg('Credenciais copiadas.');}catch(e){alertMsg('Não foi possível copiar automaticamente.',true);}};
 const dismissTest=document.getElementById('dismissTestCredentials');if(dismissTest)dismissTest.onclick=()=>{testCredentials=null;render();};
 root.querySelectorAll('.user-reset-test').forEach(b=>b.onclick=async()=>{if(!confirm('Gerar nova senha para este usuário de teste? A senha anterior deixará de funcionar.'))return;try{const u=await api('/admin/test-users/'+b.dataset.userId+'/reset-password',{method:'POST'});testCredentials={login:u.login,password:u.temporaryPassword};render();alertMsg('Nova senha gerada. Copie as credenciais.');}catch(e){alertMsg(e.message,true);}});

 root.querySelectorAll('.user-save').forEach(b=>b.onclick=async()=>{const id=b.dataset.userId,row=b.closest('.user-row');const role=row.querySelector('.user-role').value,enabled=row.querySelector('.user-active').checked;if(!confirm('Salvar as alterações de acesso deste usuário?'))return;try{await api('/admin/users/'+id,{method:'PATCH',body:{role,enabled}});users=await api('/admin/users');alertMsg('Permissões atualizadas.');}catch(e){alertMsg(e.message,true);}});
 root.querySelectorAll('.user-invite').forEach(b=>b.onclick=async()=>{if(!confirm('Enviar convite de acesso para o e-mail cadastrado?'))return;try{await api('/admin/users/'+b.dataset.userId+'/invite',{method:'POST'});alertMsg('Convite enviado por e-mail.');}catch(e){alertMsg(e.message,true);}});
 const logout=document.getElementById('logout');if(logout)logout.onclick=async()=>{await api('/logout',{method:'POST'});me=null;testCredentials=null;view='home';render();};const search=document.getElementById('search');if(search)search.oninput=()=>{filter=search.value;const p=search.selectionStart;render();const n=document.getElementById('search');n.focus();n.setSelectionRange(p,p);};root.querySelectorAll('[data-metric-status]').forEach(b=>b.onclick=()=>{statusFilter=b.dataset.metricStatus==='ATIVOS'?['EM_ATENDIMENTO','AGUARDANDO_USUARIO']:b.dataset.metricStatus?[b.dataset.metricStatus]:[];filter='';message='';view='tickets';render();});const refreshList=()=>{
  const searchValue=document.getElementById('search')?.value??filter;
  const selection=document.getElementById('search');
  const focused=document.activeElement===selection;
  const cursor=focused?selection.selectionStart:null;
  filter=searchValue;render();
  if(focused){const next=document.getElementById('search');next?.focus();if(cursor!==null)next?.setSelectionRange(cursor,cursor);}
 };
 root.querySelectorAll('.multi-filter input[type="checkbox"]').forEach(input=>input.onchange=()=>{
  const target=input.dataset.filterId==='companyFilter'?companyFilter:input.dataset.filterId==='priorityFilter'?priorityFilter:statusFilter;
  if(input.checked&&!target.includes(input.value))target.push(input.value);
  if(!input.checked){const ix=target.indexOf(input.value);if(ix>=0)target.splice(ix,1);}
  refreshList();
  const detail=document.getElementById(input.dataset.filterId);
  if(detail){detail.open=true;detail.querySelector('input[value="'+CSS.escape(input.value)+'"]')?.focus();}
 });
 root.querySelectorAll('.multi-filter-all,.multi-filter-clear').forEach(button=>button.onclick=()=>{
  const id=button.dataset.filter;
  const target=id==='companyFilter'?companyFilter:id==='priorityFilter'?priorityFilter:statusFilter;
  target.splice(0,target.length,...(button.classList.contains('multi-filter-all')?(id==='companyFilter'?ticketCompanyOptions():id==='priorityFilter'?priorityOptions:statusOptions):[]));
  refreshList();const detail=document.getElementById(id);if(detail)detail.open=true;
 });
 const ticketPeriodSelect=document.getElementById('ticketPeriod');
 if(ticketPeriodSelect)ticketPeriodSelect.onchange=()=>{ticketPeriod=ticketPeriodSelect.value;render();};
 root.querySelectorAll('[data-ticket-sort]').forEach(button=>button.onclick=()=>{
  const key=button.dataset.ticketSort;
  if(!ticketSortColumns.some(([candidate])=>candidate===key))return;
  ticketSort=ticketSort.key===key?{key,direction:ticketSort.direction==='asc'?'desc':'asc'}:{key,direction:key==='created_at'||key==='id'?'desc':'asc'};
  render();
 });
 const clearTicketFilters=document.getElementById('clearTicketFilters');
 if(clearTicketFilters)clearTicketFilters.onclick=()=>{companyFilter=[];statusFilter=[];priorityFilter=[];ticketPeriod='all';ticketSort={key:'created_at',direction:'desc'};filter='';render();};
const cpfEl=document.getElementById('registerCpf');if(cpfEl)cpfEl.onblur=async()=>{const company=document.getElementById('company')?.value;const digits=cpfEl.value.replace(/\D/g,'');const info=document.getElementById('employeeInfo');if(!info||!company||digits.length!==11)return;info.textContent='Consultando vínculo...';try{const x=await api('/public/identify?company='+encodeURIComponent(company)+'&cpf='+digits);info.textContent='Funcionário ativo: '+x.name;}catch(e){info.textContent=e.message;}};const es=document.getElementById('employeeSearch');if(es)es.oninput=lookup;const co=document.getElementById('company');if(co)co.onchange=lookup;const cs=document.getElementById('companySearch');if(cs&&co)cs.oninput=()=>{for(const opt of co.options){opt.hidden=!!cs.value&&!opt.textContent.toLowerCase().includes(cs.value.toLowerCase());}if(co.selectedOptions[0]?.hidden)co.value='';};
 const af=document.getElementById('authForm');if(af)af.onsubmit=async ev=>{ev.preventDefault();const f=new FormData(af),tab=af.dataset.tab;try{if(tab==='login'){await api('/public/login',{method:'POST',body:{login:f.get('login'),password:f.get('password')}});history.replaceState({},'',location.pathname);authTab='login';await refresh();}else if(tab==='register'){const r=await api('/public/register',{method:'POST',body:{company:f.get('company'),cpf:f.get('cpf'),email:f.get('email')}});authMessage='';authTab='login';render();alertMsg(r.mensagem||'Confira seu e-mail.');}else if(tab==='reset'){const r=await api('/public/reset',{method:'POST',body:{login:f.get('login'),email:f.get('email')}});authMessage='';authTab='login';render();alertMsg(r.mensagem||'Confira seu e-mail.');}else{await api('/public/set-password',{method:'POST',body:{token:new URLSearchParams(location.search).get('token'),password:f.get('password')}});history.replaceState({},'',location.pathname);authTab='login';authMessage='';await refresh();}}catch(e){authMessage='';alertMsg(e.message,true);}};
 root.querySelectorAll('.file-picker input[type="file"]').forEach(i=>i.onchange=()=>{const files=Array.from(i.files||[]),msg=i.closest('.file-picker').querySelector('.file-picker-count');if(files.length>5||files.some(f=>f.size>10*1024*1024)){i.value='';msg.textContent='Máximo de 5 arquivos, até 10 MB cada.';msg.classList.add('file-error');return;}msg.classList.remove('file-error');msg.textContent=files.length?files.length+' arquivo(s): '+files.map(f=>f.name).join(', '):'Nenhum arquivo selecionado';});
 const nf=document.getElementById('newForm');
 if(nf){
  const reminder=document.getElementById('attachmentReminder');
  const fileInput=nf.querySelector('input[name="files"]');
  let sending=false;
  const saveTicket=async()=>{
   if(sending)return;
   sending=true;
   const submit=nf.querySelector('[type="submit"]');
   if(submit)submit.disabled=true;
   try{
    const r=await api('/tickets',{method:'POST',files:new FormData(nf)});
    await refresh();await go('detail',r.id);
    alertMsg('Chamado #'+String(r.id).padStart(5,'0')+' registrado com sucesso.');
   }catch(e){alertMsg(e.message,true);if(submit)submit.disabled=false;}
   finally{sending=false;}
  };
  nf.onsubmit=event=>{
   event.preventDefault();
   if(sending)return;
   if(!fileInput?.files?.length&&reminder){reminder.showModal();return;}
   saveTicket();
  };
  const add=document.getElementById('attachmentReminderAdd');
  if(add)add.onclick=()=>{reminder.close();fileInput?.click();};
  const continueWithout=document.getElementById('attachmentReminderContinue');
  if(continueWithout)continueWithout.onclick=()=>{reminder.close();saveTicket();};
  const back=document.getElementById('attachmentReminderBack');
  if(back)back.onclick=()=>reminder.close();
  if(reminder)reminder.onclick=event=>{if(event.target===reminder)reminder.close();};
 }
 const visibilitySelect=document.getElementById('replyVisibility');
 const awaitingReplyInput=document.querySelector('#replyForm input[name="awaitingReply"]');
 const refreshReplyOptions=()=>{
  if(!visibilitySelect)return;
  const internal=visibilitySelect.value==='EQUIPE';
  const helper=document.getElementById('replyVisibilityHelp');
  const choice=document.getElementById('awaitReplyChoice');
  const help=document.getElementById('awaitReplyHelp');
  if(choice)choice.hidden=internal;
  if(awaitingReplyInput)awaitingReplyInput.disabled=internal;
  if(helper)helper.textContent=internal?'Nota interna: visível somente à equipe de TI e sem alteração automática de status.':'O solicitante verá a mensagem e receberá uma notificação por e-mail.';
  if(help)help.textContent=awaitingReplyInput?.checked?'Ao enviar, o chamado mudará automaticamente para Aguardando usuário.':'O atendimento continuará com a equipe de TI (status Em atendimento quando já estiver aguardando usuário).';
 };
 if(visibilitySelect)visibilitySelect.onchange=refreshReplyOptions;
 if(awaitingReplyInput)awaitingReplyInput.onchange=refreshReplyOptions;
 refreshReplyOptions();
 const reviewForm=document.getElementById('reviewForm');if(reviewForm)reviewForm.onsubmit=async ev=>{ev.preventDefault();const form=new FormData(reviewForm);try{await api('/tickets/'+ticketId+'/review',{method:'POST',body:{rating:Number(form.get('rating')),solutionRating:Number(form.get('solutionRating')),timeRating:Number(form.get('timeRating')),comment:form.get('comment')}});notifications=await api('/notifications');render();await loadDetail();alertMsg('Avaliação enviada com sucesso.');}catch(e){alertMsg(e.message,true);}};
 const rf=document.getElementById('replyForm');if(rf)rf.onsubmit=async ev=>{
  ev.preventDefault();
  const submit=rf.querySelector('button[type="submit"],button.primary');
  if(submit?.disabled)return;
  if(submit)submit.disabled=true;
  try{
   const result=await api('/tickets/'+ticketId+'/interaction',{method:'POST',files:new FormData(rf)});
   tickets=await api('/tickets');
   await loadDetail();
   alertMsg(result.statusChanged?'Mensagem enviada. Situação atualizada para '+label(result.status)+'.':'Mensagem enviada com sucesso.');
  }catch(e){if(submit)submit.disabled=false;alertMsg(e.message,true);}
 };
 const shareForm=document.getElementById('shareForm');if(shareForm)shareForm.onsubmit=async ev=>{ev.preventDefault();const id=Number(new FormData(shareForm).get('userId'));if(!id)return;try{await api('/tickets/'+ticketId+'/share',{method:'POST',body:{userId:id}});await loadDetail();alertMsg('Chamado compartilhado com sucesso.');}catch(e){alertMsg(e.message,true);}};
 root.querySelectorAll('.shared-remove').forEach(b=>b.onclick=async()=>{if(!confirm('Remover o compartilhamento deste analista?'))return;try{await api('/tickets/'+ticketId+'/share/'+b.dataset.sharedId,{method:'DELETE'});await loadDetail();alertMsg('Compartilhamento removido.');}catch(e){alertMsg(e.message,true);}});
 const statusEdit=document.querySelector('#updateForm select[name="status"]');if(statusEdit)statusEdit.onchange=()=>{const el=document.getElementById('resolutionField');if(el)el.hidden=statusEdit.value!=='RESOLVIDO';};
 const uf=document.getElementById('updateForm');if(uf)uf.onsubmit=async ev=>{ev.preventDefault();const f=new FormData(uf);try{await api('/tickets/'+ticketId,{method:'PATCH',body:{status:f.get('status'),assigneeId:f.get('assigneeId')?Number(f.get('assigneeId')):null,resolutionSummary:f.get('resolutionSummary')}});tickets=await api('/tickets');await loadDetail();alertMsg('Chamado atualizado com sucesso.');}catch(e){alertMsg(e.message,true);}};
 const ct=document.getElementById('cancelTicket');if(ct)ct.onclick=async()=>{if(!confirm('Cancelar este chamado?'))return;try{await api('/tickets/'+ticketId,{method:'PATCH',body:{status:'CANCELADO'}});tickets=await api('/tickets');await loadDetail();alertMsg('Chamado cancelado com sucesso.');}catch(e){alertMsg(e.message,true);}};
 const inf=document.getElementById('inviteForm');if(inf)inf.onsubmit=async ev=>{ev.preventDefault();const f=new FormData(inf);try{await api('/admin/invite',{method:'POST',body:{company:f.get('company'),employeeId:f.get('employeeId'),employeeName:document.getElementById('employeeId')?.selectedOptions?.[0]?.textContent||'',email:f.get('email'),role:f.get('role')}});alertMsg('Convite enviado por e-mail.');}catch(e){alertMsg(e.message,true);}};}
refresh().then(()=>{if(!me&&(new URLSearchParams(location.search).has('token')))render();});
