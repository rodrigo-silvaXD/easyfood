# ADR-002 — Persistência com PostgreSQL e Prisma

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 27/08/2026 |
| **Responsável** | Equipe EasyFood |

---

## Contexto

A [ADR-001](ADR-001-armazenar-restaurantes-em-memoria.md) registrou que guardar os
restaurantes em um array era uma decisão temporária, e listou os critérios que
disparariam uma revisão. Um deles aconteceu.

O teste foi simples: cadastramos um restaurante pelo `POST /restaurants`, confirmamos
que ele aparecia no `GET`, paramos o servidor com `Ctrl + C` e subimos de novo. O
restaurante tinha sumido. Não é um bug — é exatamente a consequência que a ADR-001
previu.

A EasyFood precisa agora de dados que sobrevivam a reinicializações e deploys, porque
os restaurantes cadastrados passam a ser conteúdo real do produto, não dado de teste.

## Alternativas consideradas

| # | Opção | Avaliação |
|---|---|---|
| 1 | **PostgreSQL** | Relacional, ACID, open source, SQL padrão. Roda local, em container e em qualquer nuvem. |
| 2 | MongoDB | Esquema flexível ajuda no começo, mas nosso domínio é claramente relacional (usuário tem restaurantes) e perderíamos integridade referencial. |
| 3 | SQLite | Zero infraestrutura, ótimo para desenvolvimento. Mas é um arquivo local: não acompanha múltiplas instâncias nem deploy em nuvem. |
| 4 | Firebase / Firestore | Resolve rápido, porém amarra a arquitetura a um fornecedor e cobra por leitura. |
| 5 | Arquivo JSON | Persiste, mas não resolve concorrência, consulta nem integridade. |

Também decidimos como falar com o banco:

| # | Opção | Avaliação |
|---|---|---|
| A | **Prisma (ORM)** | Schema declarativo, migrations versionadas, client tipado, `prisma studio` para inspecionar. |
| B | Driver `pg` puro | Mais controle e menos dependência, mas SQL na mão em todo lugar e nenhum controle de migração. |
| C | Sequelize / TypeORM | Maduros, mas com mais configuração e uma curva maior para a equipe. |

## Decisão

Adotar **PostgreSQL** como banco de dados e o **Prisma** como camada de acesso.

O `server.js` deixa de manipular um array e passa a conversar com o Prisma, que
conversa com o PostgreSQL:

```
antes:  Cliente → Express → array em memória
agora:  Cliente → Express → Prisma → PostgreSQL
```

O contrato externo da API **não muda**: `GET /restaurants` e `POST /restaurants`
continuam iguais para quem consome.

## Justificativa

- O domínio da EasyFood é relacional. Já enxergamos "um usuário cadastra vários
  restaurantes", e o PostgreSQL resolve isso com chave estrangeira em vez de código.
- É gratuito, open source e roda igual no notebook, no container e na nuvem — não
  criamos dependência de fornecedor.
- O Prisma dá migrations versionadas. Cada mudança de esquema vira um arquivo no
  repositório, o que mantém o banco alinhado entre as máquinas da equipe.
- O Prisma isola o SQL em uma camada só. Se um dia trocarmos de banco, o impacto
  fica concentrado.

## Consequências

### Positivas

- Os dados sobrevivem a reinicialização e deploy.
- Ganhamos integridade: `email` único, chave estrangeira, tipos e restrições reais.
- Consultas ficam mais baratas de escrever (filtro por categoria, busca por nome,
  ordenação e paginação saem em uma chamada).
- A aplicação pode rodar em mais de uma instância apontando para o mesmo banco.
- `npx prisma studio` dá uma visão direta dos dados sem escrever SQL.

### Negativas / trade-offs

- **Aumentou a complexidade de ambiente.** Antes bastava `node server.js`; agora é
  preciso ter um PostgreSQL disponível e a `DATABASE_URL` configurada.
- Surgiu um ponto de falha novo: se o banco cair, a API responde `500`. Por isso todo
  acesso ao Prisma está dentro de `try/catch` e o erro é registrado no log.
- Migrations passam a ser parte do fluxo de trabalho: esquecer de rodar
  `prisma migrate dev` quebra a aplicação em outra máquina.
- O Prisma é uma dependência a mais para manter atualizada, e o client precisa ser
  gerado (`prisma generate`) depois de cada mudança de esquema.
- O campo `rating` é `Decimal` no banco e chega como objeto no JavaScript. Precisamos
  convertê-lo para número antes de devolver JSON — está isolado no service.

## Critérios de revisão

Esta decisão deve ser reavaliada quando:

1. O volume de leitura justificar cache ou réplica de leitura.
2. Aparecerem dados realmente sem esquema, que briguem com o modelo relacional.
3. O custo de manter o banco gerenciado passar a pesar no projeto.
4. A latência das consultas virar um problema medido, não suposto.

## Notas

Para desenvolvimento local o projeto traz um `docker-compose.yml` com PostgreSQL 16.
A instalação nativa e um PostgreSQL gerenciado na nuvem também funcionam — a única
coisa que muda é a `DATABASE_URL`, que fica no `.env` e não é versionada.
