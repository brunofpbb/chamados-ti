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
UPDATE usuarios SET role='ADMIN' WHERE lower(email)=lower('seu-email@turintransportes.com.br') AND enabled=true;
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

## Nomenclatura das tabelas

As tabelas PostgreSQL foram padronizadas em português: `usuarios`, `tokens_acesso`, `chamados`, `interacoes` e `anexos`. A migração é executada automaticamente na inicialização e renomeia as tabelas existentes, preservando os dados e as chaves estrangeiras. As colunas e os endpoints da API mantêm seus nomes originais, para evitar incompatibilidade com o frontend.

## Integrações e cadastro seguro

- O domínio público é `https://chamados.up.railway.app`. Configure `PUBLIC_URL` no Railway se for utilizar outro endereço.
- Configure no serviço Chamados TI: `ALTERDATA_API_BASE`, `ALTERDATA_PROXY_KEY` (quando aplicável), `BREVO_API_KEY`, `BREVO_FROM_EMAIL` e `BREVO_FROM_NAME`. Use os valores autorizados pelo administrador da infraestrutura, sem publicá-los no GitHub.
- O cadastro automático exige correspondência entre e-mail informado e e-mail confiável retornado pela API Alterdata. Sem esse dado, o funcionário solicita um convite à TI.
- O administrador pode convidar colaboradores e analistas após verificar a identidade. O convite oferece criação da senha por link temporário enviado pelo Brevo.
- A busca pública por nomes não disponibiliza e-mails funcionais.
- Confirme os campos reais de desligamento e e-mail funcional retornados pelo Alterdata antes de liberar acesso em produção.

## Identidade visual Turin e fonte de dados Alterdata

A página de login usa a paleta verde do site Turin (principal `#005B28`), com formulário no lado esquerdo, logo oficial reutilizada do repositório `turin-sitevendas` (`img/turin-wordmark-white-64h.png`) e favicon oficial (`img/turin-fav-wide-32.png`). Os assets ficam armazenados no próprio repositório `chamados-ti`.

No projeto `Analista-DP`, o arquivo `backend/src/services/alterdataClient.js` contém chamadas HTTP à API externa, não comandos SQL executados diretamente no banco Alterdata. As rotas importantes para este portal são `GET /empresas` e `GET /empresas/{codigo}/funcionarios?busca={nome}`, autenticadas por `X-Proxy-Key` quando necessário. Esse cliente também consulta folha, férias e eventos de desligamento. Os comandos SQL subjacentes pertencem à implementação do serviço da API, não foram localizados nesse cliente. Antes de cadastrar funcionários, validar os nomes reais dos campos de status/desligamento e e-mail na resposta da API.

## Cadastro por CPF e login individual (novembro/2026)

- No primeiro acesso, o usuário escolhe a empresa e informa o CPF. A API Alterdata é consultada com `situacao=ativos`; o CPF do retorno precisa corresponder exatamente ao digitado.
- O funcionário informa seu e-mail de contato, independentemente do cadastro de RH. **Várias contas podem utilizar o mesmo e-mail.**
- O sistema gera um login individual a partir do primeiro e último nome (ex.: `joao.silva`). Quando já existe, acrescenta um número (ex.: `joao.silva.2`).
- O e-mail recebe um link de uso único, válido por 30 minutos, para confirmar o endereço e criar a senha. Ao definir a senha, o sistema autentica automaticamente a sessão.
- Login: **login + senha**, não e-mail + senha. Recuperação: **login + e-mail**; isso evita ambiguidade em caixas postais compartilhadas.
- Cada conta mantém empresa, `idfuncionario`, termo de busca funcional e **HMAC-SHA256 do CPF**, sem armazenar CPF em texto puro; a situação e o CPF retornados pelo Alterdata são revalidados a cada acesso autenticado.
- Contas existentes receberam um login legado `usuario-ID`, preservando registros e senhas; podem ser migradas administrativamente para nome.sobrenome.

**Risco de identidade:** conhecer o CPF e controlar o e-mail escolhido não comprova que o solicitante é o titular do vínculo. Antes da liberação ampla, implemente verificação adicional (aprovação pelo RH/TI ou outro fator previamente vinculado ao funcionário), sobretudo quando o e-mail é compartilhado. Até lá, trate o primeiro acesso como piloto supervisionado. A confirmação do link demonstra controle da caixa de e-mail, não da identidade funcional.

## Atendimento compartilhado e dashboard administrativo

- Um chamado conserva **um responsável principal**. Esse responsável ou um administrador pode adicionar outros analistas/administradores em **Equipe de apoio**, sem alterar a atribuição original.
- O compartilhamento é registrado na tabela `chamados_compartilhados`, com rastreamento no histórico de interações. Os participantes recebem e-mail quando convidados e nas mensagens/atualizações do chamado. O compartilhamento pode ser removido pelo responsável principal ou administrador.
- Somente o perfil **ADMIN** pode visualizar o menu e acessar `GET /api/dashboard`. Os filtros do painel são 7, 30, 90, 365 dias ou todo o histórico.
- Indicadores: volume, resoluções, taxa, tempo médio, status, pendências sem responsável, categorias, prioridades, unidades, evolução diária, idade dos chamados e desempenho dos analistas.
- O desempenho do analista considera o **responsável principal atual** de cada chamado aberto no período, inclusive se foi atribuído depois da abertura. Participantes compartilhados **não duplicam** volume ou resolução. A taxa de resolução é resolvidos / atribuídos; o tempo de primeira resposta considera a primeira mensagem de um analista ou administrador (não mudança de status).
- A idade dos pendentes usa horas corridas, não SLA. A ausência de registro de primeira resposta ou resolução é exibida como travessão, não zero.
- O design inclui cards separados com espaçamento consistente, formulário de atendimento organizado, equipe de apoio separada e e-mails em duas colunas (marca Turin à esquerda, central de serviços à direita).

## Filtros do dashboard (empresa, analista e categoria)
Na aba **Indicadores** (somente administradores), os filtros de **período, empresa, analista responsável e categoria** são independentes e cumulativos. Qualquer alteração recarrega todos os KPIs, gráficos, backlog e tabela de produtividade a partir do mesmo filtro SQL. O botão **Limpar filtros** retorna para os últimos 30 dias e todas as empresas, analistas e categorias.

- **Empresa:** empresa de abertura do chamado (não a empresa de lotação do analista).
- **Analista:** responsável principal atual; chamados sem responsável não entram quando se seleciona um analista específico.
- **Categoria:** categoria registrada na abertura do chamado.
- **Período:** data de abertura do chamado, inclusive na análise de desempenho.
- Listas de seleção vêm dos registros existentes (empresas e categorias) e dos usuários ativos da TI; permanecem disponíveis mesmo que o filtro atual não tenha chamados.
- O código da empresa é preservado e identificado por nome fantasia quando a API Alterdata permite carregar a lista de empresas.
- Os indicadores de desempenho por analista não somam participantes compartilhados, evitando duplicação de resultados.

## Contas de teste sem e-mail

No painel **Usuários → Criar conta de teste**, informe apenas nome e perfil. O backend gera uma senha aleatória individual (forte), grava somente o hash bcrypt, ativa a conta imediatamente e exibe **login e senha uma única vez** para o administrador copiar. Não há envio de e-mail nem consulta ao Alterdata. A conta expira em sete dias e pode ser desativada antes do prazo. A opção **Nova senha** na listagem de usuários permite redefinir uma credencial temporária e invalida a anterior.

Por segurança, **não** é utilizada uma senha compartilhada curta como `0000`: esta instalação é pública e permite contas de teste com perfil ADMIN. Um campo interno de e-mail no esquema legado recebe identificador não roteável `@example.invalid`, oculto na interface; o sistema não tenta enviar notificações para contas de teste. Senhas geradas não são incluídas em logs, e-mails ou no banco em texto claro.

## Avaliações de atendimento e notas internas da equipe

- Ao alterar um chamado para **Resolvido**, o analista pode informar a **Solução aplicada**. O sistema registra o texto no chamado e comunica ao solicitante no e-mail de atualização.
- O solicitante encontra no menu **🔔 Avaliações pendentes** os chamados resolvidos ainda não avaliados, com assunto, responsável, tempo de execução e solução descrita. No detalhe, pode avaliar em três dimensões (1–5 estrelas): **atendimento, solução apresentada e prazo**, com comentário opcional. Uma única avaliação é aceita por chamado, apenas pelo próprio solicitante.
- O **Dashboard do administrador** inclui quantidade e médias das avaliações, além das notas consolidadas por analista responsável principal, respeitando os filtros de empresa, categoria, analista e período.
- No formulário de interação, analistas e administradores escolhem o destino: **Solicitante** (mensagem pública, com notificação por e-mail) ou **Equipe de TI** (nota interna, sem e-mail para o solicitante).
- A visibilidade é protegida pela API e pelo banco: ao colaborador, as consultas do histórico e dos anexos ocultam notas internas, e o download direto desses anexos é negado. Mensagens anteriores à alteração ficam visíveis ao solicitante (valor padrão `SOLICITANTE`).
- As mensagens internas ficam destacadas em tom âmbar para a equipe. O status e os demais registros operacionais permanecem no histórico, sem revelar mensagens marcadas como internas.
- Contas de teste podem avaliar seus próprios chamados sem usar Brevo.

## Automação do andamento dos chamados (novembro/2026)

Regras aplicadas no servidor, **na mesma transação** que salva cada mensagem ou atribuição, com histórico `ALTERACAO` identificando o motivo:
- Abertura: `ABERTO` até um analista assumir/ser atribuído.
- Atribuição de um chamado `ABERTO` a analista/administrador: `EM_ATENDIMENTO` automaticamente, exceto quando outro status for escolhido explicitamente.
- Resposta pública da TI com a opção **Aguardar resposta do solicitante** marcada (padrão): `AGUARDANDO_USUARIO`.
- Resposta pública da TI sem essa opção: `EM_ATENDIMENTO` quando estava `ABERTO` ou `AGUARDANDO_USUARIO`.
- Mensagem do solicitante enquanto o chamado está `AGUARDANDO_USUARIO`: `EM_ATENDIMENTO` se houver responsável, ou `ABERTO` se ainda não houver atribuição.
- Nota interna `EQUIPE`: nunca muda status e nunca envia e-mail ao solicitante.
- Compartilhar com outro analista: não altera status, nem o responsável principal.
- Resolução/cancelamento continuam explícitos, sem encerramento automático por inatividade.

Mensagens e status são gravados atomicamente sob bloqueio da linha (`FOR UPDATE`), impedindo inconsistências em envios concorrentes. O backend valida o destino e a opção de aguardar resposta, independentemente do frontend. O histórico registra o motivo e a transição. O frontend atualiza o status após enviar a mensagem.

## Lembretes automáticos — aguardando usuário (24h e 48h)

O serviço web verifica lembretes pendentes a cada **15 minutos**, iniciando logo após conectar e migrar o banco. O relógio usa horas corridas desde o ingresso no status `AGUARDANDO_USUARIO` (`chamados.waiting_since`); a abertura do chamado ou uma nota interna não reinicia esse prazo.

- **24h**: primeiro aviso ao e-mail cadastrado do solicitante. **48h**: segundo e último aviso do mesmo ciclo.
- Se o serviço voltar após 48h sem envio anterior, envia apenas o de **48h**, evitando dois e-mails simultâneos.
- Uma resposta ou mudança de status encerra o ciclo: os lembretes futuros deixam de ser elegíveis. Se o chamado voltar a `AGUARDANDO_USUARIO`, começa um novo ciclo (`waiting_cycle`).
- Os registros de envio ficam em `lembretes_aguardando_usuario`, com chave única por chamado, ciclo e etapa. O processamento usa bloqueio de linha `FOR UPDATE SKIP LOCKED` para evitar duplicidade entre instâncias do Railway.
- Somente destinatários ativos e não-testes recebem o e-mail; falhas de envio são registradas em logs e tentadas novamente no próximo ciclo de verificação. Não há cancelamento ou resolução automática.
- O Brevo possui timeout de 20 segundos para não bloquear o processamento. Um erro muito raro entre aceitação do envio e confirmação no banco ainda pode causar reenvio, como ocorre em filas com entrega pelo menos uma vez.
- Para pausar, definir `REMINDERS_ENABLED=false` no ambiente Railway e reiniciar. Por padrão permanece ativo.
- Na primeira implantação, chamados que já estavam aguardando recebem `waiting_since=now()` para não disparar lembretes antigos em massa.

## Notificações de abertura e histórico de atribuições
- Ao criar um chamado, o solicitante real continua recebendo a confirmação de abertura.
- Após a gravação bem-sucedida, analistas e administradores **ativos, não-testes**, de todas as empresas, recebem via Brevo uma comunicação com número, solicitante, empresa, assunto, categoria, prioridade, status e link para o portal.
- O aviso é consolidado por endereço de e-mail em minúsculas para não enviar cópias repetidas quando várias contas compartilham o mesmo e-mail; se o solicitante também usa esse endereço, prevalece a confirmação do próprio solicitante.
- Contas de teste não recebem e-mail, pois não possuem caixa de correio válida. Falhas de envio da notificação para a equipe são registradas no log e não desfazem o chamado.
- A partir dessa atualização, o histórico da atribuição registra o **nome** do antigo e do novo responsável (incluindo `Não atribuído`) em vez dos IDs internos. Os registros históricos anteriores não são alterados.
