# Chamados TI — Turin Transportes (MVP)

Sistema web independente para abertura e gestão de chamados. **Ainda não publicado em produção.** Estrutura preparada para Railway, Node.js e PostgreSQL.

## Implementado

- Identidade visual Turin, layout responsivo; portal do colaborador e da equipe TI.
- Primeiro acesso: empresa e busca por nome do funcionário na API Alterdata, e-mail e link de ativação de senha via Brevo.
- Login, senha com bcrypt, sessão HttpOnly, esqueci senha com link de uso único e expiração em 30 minutos.
- Verificação de vínculo ativo diretamente no Alterdata em todo acesso autenticado (falha fechada se a API estiver indisponível).
- Abertura de chamados com categoria, prioridade, assunto, descrição e até 5 arquivos por solicitação (PDF/JPG/PNG/WEBP; 10 MB cada).
- Lista, filtros, detalhes, histórico cronológico, respostas, download autenticado de anexos e cancelamento pelo solicitante.
- Analistas com visão de todos os chamados, atualização de status, atribuição a qualquer analista, independentemente da empresa de origem.
- Dashboard: quantidade por status e empresa, resolução, tempo médio e aberturas recentes.
- Convites para analistas enviados via Brevo pelo administrador; alterações e interações notificam o solicitante por e-mail.

## Integração real do Alterdata

O adaptador `src/alterdata.js` reutiliza os **caminhos e o cabeçalho** verificados no `brunofpbb/Analista-DP`:

- `GET /empresas`
- `GET /empresas/{codigo}/funcionarios?busca={texto}`
- `X-Proxy-Key`, quando definido.

Os campos usados são `codigo_empresa`, `idfuncionario`, `nome` e indicador de desligamento/situação. **Valide os nomes reais dos campos da resposta da API**, em especial a propriedade de desligamento: sem informação explícita de situação ou desligamento, a aplicação falha fechada. O código do Analista-DP foi usado como referência de integração, e não copiado integralmente nem alterado.

## Iniciar localmente

1. Crie um banco PostgreSQL separado para chamados.
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL`, `SESSION_SECRET` (mínimo 32 caracteres), `PUBLIC_URL`, `ALTERDATA_API_BASE`, `ALTERDATA_PROXY_KEY`, `BREVO_API_KEY`, `MAIL_FROM`.
3. Execute `npm install`, depois `npm start`. O schema é aplicado automaticamente na inicialização.
4. Acesse `http://localhost:3000` e faça o primeiro acesso como colaborador ativo para registrar seu usuário.
5. Promova **apenas sua conta** a administrador, no banco recém-criado (troque o e-mail):

```sql
UPDATE users SET role='ADMIN' WHERE lower(email)=lower('seu-email@turintransportes.com.br') AND enabled=true;
```

Esse passo é manual para impedir que um usuário se torne administrador por meio de parâmetros públicos. Depois, o menu "Convidar analista" fica disponível.

## Railway

Crie um projeto/serviço novo, separado dos existentes, vincule o código a um repositório, adicione um PostgreSQL e configure as variáveis. `npm start` inicia a aplicação e o Railway fornece `PORT`. Configure `PUBLIC_URL` com o domínio HTTPS final e `NODE_ENV=production`. Não compartilhe credenciais dos outros projetos em arquivos; registre-as nas variáveis secretas do Railway.

## Verificações necessárias antes de produção

1. **Alterdata:** confirmar o JSON real das empresas, funcionários e status de desligamento; validar comportamento para transferência de empresa, alteração de matrícula e páginas de resultados.
2. **E-mails:** validar domínio remetente no Brevo e entregabilidade; a implementação inicial dispara mensagens via API, mas ainda não dispõe de fila transacional com retentativa, portanto não garante a entrega durante falhas do Brevo.
3. **Anexos:** armazenamento privado em BYTEA PostgreSQL, adequado a piloto pequeno; para escala, migrar para armazenamento privado de objetos com limites e antivírus.
4. **Segurança:** incorporar 2FA para analistas, auditoria de ações de admin, política de retenção/LGPD, testes automatizados, proteção anti-abuso ampliada, observabilidade e backup.
5. **Operação:** definir categorias definitivas, SLA, prioridade e política de encerramento; eventual reabertura, avaliação de satisfação, filtros por datas e relatórios XLSX são evoluções futuras.
6. **Testar:** acesso cruzado entre funcionários, revogação por desligamento e envio de e-mail nas mudanças de status/respostas.

**Observação:** o sistema é um MVP funcional em código, não uma aplicação que já tenha sido publicada ou testada com as credenciais/infraestrutura reais.
