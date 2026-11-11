# ADR-005 — O middleware de autenticação confere se a conta ainda existe

| Campo       | Valor                          |
|-------------|--------------------------------|
| **Status**  | Aceito                         |
| **Data**    | 2026-11-11                     |
| **Autores** | Rodrigo Silva                  |

---

## Contexto

**Achei este bug** quando apaguei uma conta de teste do banco: o celular que estava logado com ela continuou aparecendo como logado.

O motivo: o `auth.middleware.js` só conferia a **assinatura** do JWT. O token vale por 1 dia, então, mesmo com a conta apagada, ele continuava válido e a requisição seguia normalmente. O `req.user` era montado com os dados que estavam dentro do token, não com o que existe no banco.

Na prática:

- `GET /auth/me` respondia 404 ("Usuário não encontrado"), e a tela ignorava esse erro e continuava mostrando a pessoa logada;
- `POST /restaurants` tentava gravar um restaurante com `ownerId` de um usuário que não existe mais. O PostgreSQL recusava pela chave estrangeira e a API devolvia **500**.

---

## Alternativas consideradas

| # | Opção | Descrição |
|---|-------|-----------|
| 1 | Tratar o erro de chave estrangeira em cada rota | Cada service teria que lembrar desse caso; fácil esquecer numa rota nova |
| 2 | Lista de tokens revogados | Resolve também o logout, mas exige guardar estado e consultar a lista a cada requisição |
| 3 | O middleware busca o usuário no banco | Um `findUnique` por id em cada rota protegida |

---

## Decisão

Escolhi a **opção 3**. Depois de validar a assinatura, o `authenticate` busca o usuário pelo `sub` do token:

- se a conta não existe mais, responde **401** com "Sua conta não existe mais. Faça login novamente.";
- se existe, o `req.user` passa a ser montado com os dados **do banco** (id, nome e e-mail atuais), não com os do token;
- um token sem `sub` numérico também é recusado com 401, antes de chegar ao banco.

No front, qualquer 401 recebido com sessão ativa encerra a sessão e mostra a mensagem do servidor. Quem abre o site com um token de conta apagada sai sozinho e vê o motivo.

---

## Justificativa

- Corrige o problema num lugar só. Toda rota protegida, inclusive as que ainda vão ser criadas, já passa pelo middleware.
- A consulta é por chave primária, a mais barata que existe, e só acontece em rotas que exigem login. A listagem pública de restaurantes não é afetada.
- De quebra, se o usuário mudar de nome, as rotas passam a ver o nome atual, e não o que estava no token no momento do login.
- A lista de revogação (opção 2) seria a escolha se eu precisasse invalidar tokens no logout, mas isso não é um problema hoje: o token fica só no navegador de quem saiu.

---

## Consequências

### Positivas

- ✅ Conta apagada perde o acesso na hora, não só quando o token expira
- ✅ O `POST /restaurants` com token de conta apagada devolve 401 em vez de 500
- ✅ `req.user` sempre reflete o banco

### Negativas

- ❌ Toda rota protegida faz uma consulta a mais no banco
- ❌ O JWT deixa de ser totalmente "stateless". Isso contraria um pouco a justificativa original de usar JWT, mas é o preço de não confiar em dados velhos

---

## Critérios de revisão

Vou reavaliar esta decisão quando:

1. O número de requisições autenticadas for grande o bastante para essa consulta pesar (aí entra um cache curto)
2. Surgir a necessidade de derrubar sessões no logout ou na troca de senha (aí a lista de revogação passa a valer a pena)
