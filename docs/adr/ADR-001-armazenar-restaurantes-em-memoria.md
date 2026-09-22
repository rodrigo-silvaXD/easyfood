# ADR-001 — Armazenar restaurantes em memória

| Campo | Valor |
|---|---|
| **Status** | Substituída pela [ADR-002](ADR-002-persistencia-com-postgresql.md) |
| **Data** | 20/08/2026 |
| **Responsável** | Equipe EasyFood |

---

## Contexto

Estamos na primeira versão da API da EasyFood. Nesta etapa a aplicação precisa fazer
apenas duas coisas:

- consultar restaurantes (`GET /restaurants`);
- cadastrar novos restaurantes (`POST /restaurants`).

O produto ainda está em prototipação. A prioridade é validar o fluxo da aplicação
rápido, antes de aumentar a complexidade da arquitetura. Ainda não sabemos se o
modelo de dados que estamos desenhando é o certo, então travar o projeto em uma
decisão de infraestrutura agora seria caro e provavelmente prematuro.

## Alternativas consideradas

| # | Opção | Por que foi descartada agora |
|---|---|---|
| 1 | **Array em memória** | — (escolhida) |
| 2 | PostgreSQL | Exige instalar e configurar um servidor antes de existir uma API para testar |
| 3 | MongoDB | Mesma barreira de infraestrutura, e ainda não temos dados sem esquema definido |
| 4 | SQLite | Menos atrito que o PostgreSQL, mas ainda adiciona um passo de migração e ORM |
| 5 | Firebase | Traz dependência de um serviço externo e custo antes da validação do produto |
| 6 | Arquivo JSON | Persiste, mas cria problemas de concorrência e não resolve consultas |

## Decisão

Adotar um **array em memória** como mecanismo de armazenamento dos restaurantes na
versão inicial do serviço.

## Justificativa

- Permite escrever e testar `GET` e `POST` no mesmo dia em que a API nasce.
- Não exige nenhuma configuração de infraestrutura nem custo.
- A complexidade fica concentrada no que importa agora: o contrato da API.
- A decisão é barata de reverter, porque o contrato HTTP não depende do armazenamento.

## Consequências

### Positivas

- Desenvolvimento e testes mais rápidos.
- Menor complexidade inicial para quem está entrando no projeto.
- Permite validar o conceito da aplicação antes de investir em banco.

### Negativas / trade-offs

- **Os dados somem quando o servidor reinicia.** É a consequência mais visível.
- Não funciona com múltiplas instâncias da aplicação: cada processo teria sua lista.
- Não temos integridade referencial, restrições de unicidade nem transações.
- Consultas mais complexas (filtros combinados, ordenação, agregações) teriam que ser
  escritas na mão em JavaScript.

## Critérios de revisão

Esta decisão deve ser reavaliada quando:

1. O MVP for validado e houver decisão de avançar para produção.
2. Houver necessidade de manter os dados entre reinicializações e deploys.
3. O volume de dados ultrapassar o que é razoável manter em memória.
4. For necessário realizar consultas mais complexas.
5. Surgirem relacionamentos entre entidades diferentes.

## Notas

Esta é uma decisão temporária e assumida como tal. Antes da entrada em produção
precisaremos escolher um mecanismo de persistência, e essa escolha deve virar uma
nova decisão registrada.

O critério de revisão nº 2 foi atingido em 27/08/2026, quando o teste de
reinicialização mostrou que um restaurante cadastrado desaparecia. Isso gerou a
[ADR-002](ADR-002-persistencia-com-postgresql.md).
