# ADR-007 — Ajustes de coerência nos dados e na interface

| Campo       | Valor                          |
|-------------|--------------------------------|
| **Status**  | Aceito                         |
| **Data**    | 2026-11-11                     |
| **Autores** | Rodrigo Silva                  |

---

## Contexto

Depois de terminar a missão, usei o site como cliente e como dono de restaurante, procurando o que não fazia sentido. Além da nota dada pelo próprio dono (ADR-004) e da conta apagada que continuava logada (ADR-005), **achei estes problemas**:

1. **Telas saindo do lugar.** Quando a lista tinha muitas categorias e eu clicava numa do fim, todas as telas do app deslizavam para o lado e ficavam tortas. A causa era o `scrollIntoView`, que eu usava para centralizar o chip clicado: ele rola todos os contêineres em volta, inclusive o que guarda as telas, que tinha sobra lateral por causa da animação de entrada.
2. **Entrega inventada.** Cada card mostrava "Entrega R$ 6,70 · 20–30 min", mas esses números eram calculados a partir do id do restaurante (na versão do professor, eram sorteados). Pareciam informação real e não eram.
3. **Restaurante duplicado.** O mesmo dono conseguia cadastrar "Trattoria" várias vezes.
4. **Favoritos misturados.** Os favoritos ficavam salvos no navegador, não na conta. Se eu saísse e outra pessoa entrasse no mesmo navegador, ela via os meus.
5. **Botão que não fazia nada.** A tela do professor tinha "Ordenar ▾", mas ele não ordenava nada.
6. **Cardápio sem edição.** A API do professor já tinha `PUT` e `DELETE` para pratos, mas a tela não oferecia nenhum dos dois.

---

## Decisão

Corrigi cada um, mantendo o tamanho da solução proporcional ao problema:

1. **Rolo só a fileira de categorias**, calculando a posição do chip, e troquei `overflow: hidden` por `overflow: clip` no contêiner das telas. Com `clip`, o navegador não deixa nenhum código rolar aquele contêiner.
2. **Tirei a taxa e o tempo de entrega** dos cards e da tela do restaurante. No lugar, mostro a categoria e quantas avaliações o restaurante tem.
3. **O mesmo dono não pode repetir o nome** de um restaurante (sem diferenciar maiúsculas): **409**. Donos diferentes podem usar o mesmo nome, porque dois restaurantes podem mesmo se chamar "Pizzaria Napoli".
4. **Favoritos separados por conta**: a chave no navegador inclui o id do usuário (`easyfood.favorites.<id>`), e quem não está logado tem a sua própria lista.
5. **"Ordenar" funcionando**, com relevância, melhor avaliados, nome (A–Z) e mais recentes. Em "melhor avaliados", restaurante sem avaliação vai para o fim, para não ficar na frente de um com nota baixa só por ter "0".
6. **Editar e excluir prato** na tela do restaurante, só para o dono, usando as rotas que o professor já tinha. Excluir pede confirmação e também apaga a foto do disco.

Também entraram nesta rodada a **capa do restaurante**, a **remoção de fotos** (perfil, prato e capa) e uma **imagem gerada a partir da categoria** para o restaurante ou o prato que ainda não tem foto, no mesmo estilo do site.

---

## Justificativa

- Os itens 1, 2, 5 e 6 são da interface e não mexem na arquitetura, mas cada um fazia a aplicação parecer quebrada ou mentir para o usuário.
- No item 2, preferi tirar a informação a manter um número falso. Se um dia a EasyFood tiver entrega de verdade, isso vira um campo do restaurante e uma decisão nova.
- No item 3, o 409 é a mesma resposta que a API já usa para e-mail repetido, então o comportamento fica previsível.
- No item 4, guardar favoritos no banco seria o ideal, mas exigiria tabela e rotas novas para algo que ainda não tem regra de negócio. Separar por conta no navegador resolve a incoerência com uma linha.

---

## Consequências

### Positivas

- ✅ Nenhuma tela sai do lugar ao escolher categoria, no desktop ou no celular
- ✅ Tudo o que a tela mostra corresponde a dado real
- ✅ O dono gerencia o cardápio inteiro sem sair do app

### Negativas

- ❌ Os favoritos continuam presos ao navegador: no celular e no computador, a mesma conta tem listas diferentes
- ❌ Os cards perderam a informação de entrega, que deixava a tela mais "cheia"
- ❌ A ordenação acontece no navegador, sobre a lista já carregada. Com muitos restaurantes, ela teria que ir para a API junto com a paginação

---

## Critérios de revisão

Vou reavaliar esta decisão quando:

1. A EasyFood precisar dos favoritos em vários aparelhos (aí eles vão para o banco, com rotas próprias)
2. A lista de restaurantes crescer a ponto de não caber numa resposta só (aí ordenação e paginação vão para a API)
3. A entrega virar funcionalidade real
