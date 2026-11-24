// Limpeza pontual de homologação. Executar somente via pre-deploy de 24/11/2026.
// O corte é definido em America/Sao_Paulo, independentemente da TZ do banco.
// A rotina não altera contas de usuários nem sequências de IDs.
const {Pool}=require('pg');
const cutoff="TIMESTAMPTZ '2026-11-24 00:00:00-03:00'";
const schema='homologacao_backup_20261124';
const names=['chamados','interacoes','anexos','avaliacoes_chamados','chamados_compartilhados','lembretes_aguardando_usuario'];
if(process.argv[2]!=='--execute')throw Error('Execução não autorizada: informe --execute');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL não encontrada');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});
(async()=>{
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  await db.query('SET LOCAL lock_timeout = \'20s\'');
  await db.query('SET LOCAL statement_timeout = \'120s\'');
  await db.query("SELECT pg_advisory_xact_lock(20261124, 1)");
  // Impede criação de interações/anexos entre o backup e a limpeza.
  await db.query('LOCK TABLE chamados, interacoes, anexos, avaliacoes_chamados, chamados_compartilhados, lembretes_aguardando_usuario IN SHARE ROW EXCLUSIVE MODE');
  const found=await db.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema]);
  const count=await db.query('SELECT count(*)::int AS total FROM chamados WHERE created_at < '+cutoff);
  const total=count.rows[0].total;
  if(found.rowCount){
   if(total)throw Error('Backup anterior encontrado mas ainda existem chamados legados. Interrompido para evitar sobrescrever dados.');
   console.log('HOMOLOGACAO_CLEANUP_JA_EXECUTADA',JSON.stringify({cutoff:'2026-11-24T00:00:00-03:00',deleted:0,backupSchema:schema}));
   await db.query('COMMIT');return;
  }
  const ids=(await db.query('SELECT id FROM chamados WHERE created_at < '+cutoff+' ORDER BY id')).rows.map(x=>x.id);
  if(!total){
   console.log('HOMOLOGACAO_CLEANUP_SEM_CHAMADOS',JSON.stringify({cutoff:'2026-11-24T00:00:00-03:00',deleted:0}));
   await db.query('COMMIT');return;
  }
  await db.query('CREATE SCHEMA '+schema);
  const sources={
   chamados:'SELECT * FROM chamados WHERE created_at < '+cutoff,
   interacoes:'SELECT i.* FROM interacoes i JOIN chamados c ON c.id=i.ticket_id WHERE c.created_at < '+cutoff,
   anexos:'SELECT a.* FROM anexos a JOIN chamados c ON c.id=a.ticket_id WHERE c.created_at < '+cutoff,
   avaliacoes_chamados:'SELECT a.* FROM avaliacoes_chamados a JOIN chamados c ON c.id=a.ticket_id WHERE c.created_at < '+cutoff,
   chamados_compartilhados:'SELECT s.* FROM chamados_compartilhados s JOIN chamados c ON c.id=s.ticket_id WHERE c.created_at < '+cutoff,
   lembretes_aguardando_usuario:'SELECT l.* FROM lembretes_aguardando_usuario l JOIN chamados c ON c.id=l.ticket_id WHERE c.created_at < '+cutoff
  };
  const backupCounts={};
  for(const name of names){
   await db.query('CREATE TABLE '+schema+'.'+name+' AS '+sources[name]);
   backupCounts[name]=(await db.query('SELECT count(*)::int AS n FROM '+schema+'.'+name)).rows[0].n;
  }
  if(backupCounts.chamados!==total)throw Error('Contagem de backup difere da origem. Desfazendo transação.');
  const deleted={};
  // Anexos referenciam tanto chamados quanto interações: remover antes das interações.
  for(const name of ['lembretes_aguardando_usuario','avaliacoes_chamados','chamados_compartilhados','anexos','interacoes']){
   const result=await db.query('DELETE FROM '+name+' WHERE ticket_id IN (SELECT id FROM chamados WHERE created_at < '+cutoff+')');
   deleted[name]=result.rowCount;
   if(deleted[name]!==backupCounts[name])throw Error('Contagem divergente em '+name+'. Desfazendo transação.');
  }
  deleted.chamados=(await db.query('DELETE FROM chamados WHERE created_at < '+cutoff)).rowCount;
  if(deleted.chamados!==total)throw Error('Contagem divergente em chamados. Desfazendo transação.');
  await db.query('COMMIT');
  console.log('HOMOLOGACAO_CLEANUP_OK',JSON.stringify({cutoff:'2026-11-24T00:00:00-03:00',ids,deleted,backupSchema:schema}));
 }catch(e){
  await db.query('ROLLBACK').catch(()=>{});
  console.error('HOMOLOGACAO_CLEANUP_ERRO',e.message);
  process.exitCode=1;
 }finally{db.release();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});
