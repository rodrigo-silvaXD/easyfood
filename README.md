# EasyFood

[![CI](https://github.com/rodrigo-silvaXD/easyfood/actions/workflows/ci.yml/badge.svg)](https://github.com/rodrigo-silvaXD/easyfood/actions/workflows/ci.yml)

Aplicação para descobrir e cadastrar restaurantes. API REST em Node.js + Express,
persistência em PostgreSQL via Prisma, autenticação com JWT e uma interface
mobile-first servida pela própria API.

Projeto da disciplina **Software Architecture & Design Patterns** — construído missão
a missão, com cada decisão registrada em um ADR.

```
Cliente (public/)
    ↓  HTTP
app.js  →  routes  →  controller  →  service  →  database  →  PostgreSQL
```

---

## O que a aplicação faz

- Lista restaurantes com busca por nome, filtro por categoria, ordenação e paginação
- Cadastro e login de usuário com senha protegida por hash bcrypt
- Sessão por JWT, com expiração e retorno automático ao login quando o token vence
- Cadastro de restaurante restrito a usuário autenticado
- Remoção restrita ao usuário que cadastrou
- Favoritos guardados no navegador
- Interface mobile-first com tema claro e escuro

---

## Como rodar

Pré-requisitos: **Node.js 18+** e um **PostgreSQL** acessível.

```bash
npm install
```

### 1. Suba um PostgreSQL

Escolha uma das opções. Todas terminam no mesmo lugar: uma `DATABASE_URL` válida.

**a) Docker (recomendado — nada é instalado na máquina)**

```bash
docker compose up -d
```

Usuário, senha e banco já vêm configurados no `docker-compose.yml`:

```
DATABASE_URL="postgresql://easyfood:easyfood@localhost:5432/easyfood"
```

**b) PostgreSQL instalado na máquina**

Baixe em <https://www.postgresql.org/download/> e crie o banco:

```sql
CREATE DATABASE easyfood;
```

```
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/easyfood"
```

**c) Sem Docker e sem instalar PostgreSQL**

O próprio Prisma sobe um PostgreSQL local:

```bash
npx prisma dev -n easyfood -d
```

O comando imprime uma URL `postgres://postgres:postgres@localhost:PORTA/template1`.
Use essa URL na `DATABASE_URL`, acrescentando `?sslmode=disable&pgbouncer=true`
(esse servidor local trabalha com pool de conexões, e o parâmetro evita conflito de
prepared statements).

### 2. Configure o ambiente

```bash
cp .env.example .env
```

**Se você escolheu o Docker (opção a), não precisa editar nada** — a `DATABASE_URL`
do `.env.example` já usa exatamente o usuário, a senha e o banco que o
`docker-compose.yml` cria (`easyfood` / `easyfood` / `easyfood`).

Nas opções **b** e **c**, troque a `DATABASE_URL` pela do seu banco.

Em qualquer caso, antes de publicar em algum lugar gere um `JWT_SECRET` de verdade:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Crie as tabelas e popule

```bash
npx prisma migrate dev
npm run seed
```

### 4. Suba a aplicação

```bash
npm start
```

```
EasyFood rodando na porta 3000
Interface: http://localhost:3000
```

### 5. Primeiro acesso

O banco começa **sem nenhum usuário** — não existe conta padrão e o seed só cria
restaurantes. Abra <http://localhost:3000>, toque em **Criar conta** e cadastre a sua.
O cadastro já devolve o token e entra direto no app.

A partir daí: a listagem é pública, mas cadastrar e remover restaurante exige estar
logado.

### Comandos úteis

| Comando | O que faz |
|---|---|
| `npm start` | Sobe a API e a interface |
| `npm run dev` | Sobe com recarga automática (`node --watch`) |
| `npm run seed` | Insere os restaurantes iniciais (não duplica se já houver dados) |
| `npm run migrate` | Aplica mudanças do schema ao banco |
| `npm run studio` | Abre o Prisma Studio em <http://localhost:5555> |
| `npm run db:up` / `db:down` | Sobe / derruba o PostgreSQL do Docker |

---

## API

Base: `http://localhost:3000`

### Autenticação

| Método | Rota | Protegida | Descrição |
|---|---|---|---|
| `POST` | `/auth/register` | não | Cria a conta e já devolve o token |
| `POST` | `/auth/login` | não | Autentica e devolve o token |
| `GET` | `/auth/me` | **sim** | Dados do usuário do token |

### Restaurantes

| Método | Rota | Protegida | Descrição |
|---|---|---|---|
| `GET` | `/restaurants` | não | Lista restaurantes |
| `GET` | `/restaurants/categories` | não | Categorias aceitas |
| `GET` | `/restaurants/:id` | não | Um restaurante |
| `GET` | `/restaurants/mine` | **sim** | Restaurantes do usuário autenticado |
| `POST` | `/restaurants` | **sim** | Cadastra restaurante |
| `DELETE` | `/restaurants/:id` | **sim** | Remove — só o dono |

`GET /restaurants` aceita filtros opcionais e continua devolvendo um array JSON:

```
?category=Pizza        filtra por categoria
?search=napoli         busca por nome (ignora maiúsculas)
?sort=rating|name|recent
?page=1&limit=8        paginação
```

O total de resultados vai no header `X-Total-Count`, para não alterar o formato da
resposta.

### Rota protegida

```http
POST /restaurants
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "Cantina Roma", "category": "Italiana", "rating": 4.5 }
```

Sem o header, a resposta é `401 Unauthorized`.

### Erros de validação

Erros de campo vêm junto da resposta `400`, prontos para serem exibidos no formulário:

```json
{
  "error": "Dados inválidos",
  "fields": {
    "email": "Digite um e-mail válido, como nome@email.com.",
    "password": "A senha precisa ter pelo menos 6 caracteres."
  }
}
```

### Exemplo rápido

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Aluno","email":"aluno@easyfood.com","password":"senha123"}'
```

---

## Estrutura

```
easyfood/
├── docs/
│   ├── adr/                          decisões arquiteturais
│   └── perguntas-arquitetura.md      respostas das missões
├── prisma/
│   ├── migrations/                   histórico do esquema
│   ├── schema.prisma                 modelos User e Restaurant
│   └── seed.js                       dados iniciais
├── public/                           interface (servida pelo Express)
│   ├── css/styles.css                design system
│   ├── js/api.js                     fetch, token e erros
│   ├── js/ui.js                      toasts, diálogos, campos, tema
│   ├── js/auth.js                    login, cadastro e validação
│   ├── js/restaurants.js             lista, filtros, favoritos
│   ├── js/app.js                     navegação e sessão
│   └── index.html
├── src/
│   ├── database/prisma.js            conexão
│   ├── modules/
│   │   ├── auth/                     service, controller, middleware, routes, validator
│   │   └── restaurants/              service, controller, routes, validator
│   └── app.js                        middlewares e montagem das rotas
├── docker-compose.yml
├── server.js                         só liga o servidor
└── .env.example
```

### Responsabilidade de cada camada

| Camada | Faz | Não faz |
|---|---|---|
| `server.js` | Sobe o processo na porta | Não conhece rotas nem banco |
| `app.js` | Middlewares, estáticos, rotas | Não implementa regra |
| routes | Caminho → controller | Não acessa Prisma |
| controller | `req`/`res` e validação de entrada | Não escreve regra de negócio |
| service | Regras e operações | **Não conhece `req` nem `res`** |
| database | Conexão do Prisma | Não tem regra |

---

## Decisões arquiteturais

| ADR | Decisão | Status |
|---|---|---|
| [001](docs/adr/ADR-001-armazenar-restaurantes-em-memoria.md) | Armazenar restaurantes em memória | Substituída pela 002 |
| [002](docs/adr/ADR-002-persistencia-com-postgresql.md) | Persistência com PostgreSQL e Prisma | Aceita |
| [003](docs/adr/ADR-003-arquitetura-em-camadas.md) | Organizar a aplicação em camadas | Aceita |
| [004](docs/adr/ADR-004-autenticacao-com-jwt.md) | Autenticação com JWT e bcrypt | Aceita |
| [005](docs/adr/ADR-005-nao-adotar-event-driven-agora.md) | Não adotar eventos neste momento | Aceita |

As respostas das perguntas "pense como arquiteto" de cada missão estão em
[docs/perguntas-arquitetura.md](docs/perguntas-arquitetura.md).

---

## Segurança

- Senhas são gravadas como hash **bcrypt** (custo 10) e nunca voltam em nenhuma resposta.
- O `JWT_SECRET` fica no `.env`, que não é versionado.
- Toda entrada é validada no servidor. O front repete as regras só por conveniência de
  quem digita — quem decide é sempre a API.
- Texto vindo da API é escapado antes de virar HTML, para evitar XSS.
- Mensagens de erro internas ficam no log do servidor; o cliente recebe mensagem genérica.

---

## Tecnologias

| Camada | Escolha |
|---|---|
| Runtime | Node.js |
| HTTP | Express 5 |
| Banco | PostgreSQL 16 |
| Acesso a dados | Prisma ORM |
| Autenticação | jsonwebtoken + bcryptjs |
| Interface | HTML, CSS e JavaScript sem framework |
| Tipografia | Playfair Display SC + Karla |
