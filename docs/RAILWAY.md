# Implantação do Chamados TI no Railway

O sistema é um serviço Node.js com PostgreSQL. **Não** salve credenciais no GitHub; configure-as em **Railway > chamados-ti > Variables**.

## 1. Banco
No projeto Railway da aplicação, adicione um serviço **PostgreSQL**. Em `chamados-ti > Variables`, defina:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

O nome da referência (`Postgres`) deve ser igual ao nome real do serviço de banco. A aplicação cria as tabelas ao iniciar.

## 2. Variáveis do serviço
- `SESSION_SECRET`: string aleatória secreta, com **ao menos 32 caracteres**. Não use a chave do `.env.example`.
- `NODE_ENV=production`
- `PUBLIC_URL=https://<dominio-publico-do-servico>` (sem barra no final)
- `ALTERDATA_API_BASE`: base HTTPS real da API usada no Analista-DP
- `ALTERDATA_PROXY_KEY`: chave da API, se exigida
- `BREVO_API_KEY`: chave de envio de e-mails
- `MAIL_FROM`: remetente aprovado no Brevo
- `MAIL_FROM_NAME=TI Turin`
- `DATABASE_SSL`: deixe ausente/false para conexão interna Railway com PostgreSQL; só true se o servidor exigir TLS com certificado válido

Não é necessário configurar `PORT`: o Railway fornece automaticamente. `npm start` é o comando de execução.

## 3. Domínio e verificação
Gere um domínio público do Railway para o serviço e copie seu HTTPS para `PUBLIC_URL`. Com o banco configurado, verifique `GET /api/health`, que deve retornar `{"ok":true}`.

Se o serviço falhar na inicialização, consulte os logs de deploy:
- `SESSION_SECRET...`: falta configurar a chave secreta
- `DATABASE_URL...`: não há referência ao PostgreSQL
- `ECONNREFUSED`, `ENOTFOUND`, `password authentication failed`: credenciais/endereço do banco incorretos ou banco indisponível
- Mensagens do Alterdata/Brevo: verifique as respectivas variáveis, conectividade e respostas reais

## 4. Segurança
O cadastro de colaborador usa vínculo funcional Alterdata, mas a correspondência entre a pessoa e o e-mail informado ainda precisa de validação de identidade antes de produção real. Também valide o campo de desligamento do Alterdata. Não altere o código para ignorar o `SESSION_SECRET` ou a checagem funcional.

## 5. Estado do primeiro deploy
No primeiro deploy de 03/11/2026, o serviço tinha **zero variáveis de aplicação** e **nenhum serviço de banco PostgreSQL** no projeto. O erro do log enviado foi a ausência de `SESSION_SECRET`. A chave e `NODE_ENV` foram configurados diretamente no Railway, mas `DATABASE_URL` ainda precisa ser vinculada ao banco. Sem o banco, o serviço não consegue iniciar.
