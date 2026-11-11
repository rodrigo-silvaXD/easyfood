# ADR-004 — A nota do restaurante vem das avaliações dos clientes

| Campo       | Valor                          |
|-------------|--------------------------------|
| **Status**  | Aceito                         |
| **Data**    | 2026-11-11                     |
| **Autores** | Rodrigo Silva                  |

---

## Contexto

Revisando o projeto atrás de incoerências, **achei este problema**: no cadastro de restaurante, o próprio dono digitava a nota. O formulário que veio do professor tinha o campo "Avaliação (0 a 5)", e o `POST /restaurants` gravava o que viesse. Na prática, qualquer um cadastrava o restaurante com 5 estrelas, e a nota exibida na lista não significava nada.

Encontrei também dois sintomas técnicos ligados ao mesmo campo: nota negativa era aceita, e nota 10 derrubava o servidor com 500, porque estoura a coluna `Decimal(2, 1)`. Isso eu já tinha corrigido com validação, mas validar o valor não resolve o problema de fundo: **quem dá a nota não deveria ser o dono**.

---

## Alternativas consideradas

| # | Opção | Descrição |
|---|-------|-----------|
| 1 | Manter a nota no cadastro, só validando de 0 a 5 | Corrige o 500, mas o dono continua se dando a nota que quiser |
| 2 | Tirar a nota da tela e mostrar sempre "Novo" | Esconde o problema sem resolver; o restaurante nunca teria nota |
| 3 | Avaliações dos clientes, com a média gravada em `Restaurant.rating` | A nota passa a ter significado e a API continua devolvendo `rating` |

---

## Decisão

Escolhi a **opção 3**. Criei um módulo novo, `src/modules/reviews/`, no mesmo padrão dos outros (routes, controller, service), e uma tabela `Review`:

- `POST /restaurants/:restaurantId/reviews` com `{ "rating": 1..5 }`: o cliente logado dá ou troca a nota dele;
- `GET /restaurants/:restaurantId/reviews/me`: devolve a nota que o usuário logado deu (para acender as estrelas na tela);
- **uma avaliação por usuário por restaurante** (`@@unique([userId, restaurantId])`). Avaliar de novo troca a nota em vez de somar outra;
- **o dono não avalia o próprio restaurante** (403);
- a nota é um inteiro de 1 a 5. Qualquer outra coisa (0, 6, 4.5, "5", null) devolve 400;
- a cada avaliação recalculo a média e gravo em `Restaurant.rating`, com uma casa decimal;
- o `POST /restaurants` passa a **ignorar** o `rating` do corpo: todo restaurante nasce com 0 e aparece como **Novo** até receber a primeira avaliação;
- `GET /restaurants` passa a devolver também `reviewsCount`.

Na migration `create_reviews` zerei a nota de todos os restaurantes existentes, porque nenhuma delas tinha vindo de cliente.

---

## Justificativa

- Resolve a incoerência na origem: a nota só pode vir de quem não é o dono.
- **Não quebra o contrato do professor.** O `GET /restaurants` continua devolvendo `rating` no mesmo campo e no mesmo formato, então qualquer tela que já lia a nota continua funcionando. Quem ainda manda `rating` no cadastro não recebe erro: o valor só é ignorado.
- Guardar a média em `Restaurant.rating`, em vez de calcular toda vez que a lista é pedida, mantém o `listRestaurants` simples e rápido. A lista é a rota mais acessada, e as avaliações são raras perto dela.
- Ficou num módulo próprio porque avaliação é um conceito de negócio novo, com regras próprias. Não quis enfiar isso no módulo de restaurante.

---

## Consequências

### Positivas

- ✅ A nota exibida é a média real de quem avaliou, e o restaurante novo aparece como "Novo" em vez de uma nota inventada
- ✅ "Ordenar por melhor avaliados" passou a fazer sentido
- ✅ Um mesmo cliente não infla a nota avaliando várias vezes

### Negativas

- ❌ **Mudei um comportamento do código do professor**: o `POST /restaurants` não respeita mais o `rating` enviado. Deixei isso registrado aqui e no README
- ❌ A média fica guardada em duas formas: as avaliações e o `Restaurant.rating`. Se alguém apagar uma conta direto no banco, as avaliações dela somem em cascata, mas a média não é recalculada sozinha. Como a aplicação não tem rota para apagar conta, isso só acontece mexendo no banco na mão
- ❌ Duas avaliações chegando exatamente ao mesmo tempo podem gravar uma média calculada antes da outra. A próxima avaliação corrige. Para o volume atual, preferi isso a uma transação

---

## Critérios de revisão

Vou reavaliar esta decisão quando:

1. Existir uma rota para apagar conta (aí ela também precisa recalcular as notas)
2. O volume de avaliações ficar alto o bastante para a corrida entre avaliações simultâneas aparecer
3. Surgir a necessidade de comentário escrito junto com a nota, ou de só aceitar avaliação de quem fez pedido
