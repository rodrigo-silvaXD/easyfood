# Missão — Correção do cadastro de pratos e upload de imagens

## Parte 1 — O que estava errado no cadastro de pratos

### Arquivos alterados pela correção (commit `70e459e` do professor)

| Arquivo | O que mudou |
|---------|-------------|
| `src/modules/dishes/dish.service.js` | Deixou de exigir `imageUrl` na criação, ganhou validação de cada campo e a checagem de dono |
| `src/modules/dishes/dish.controller.js` | Passa `req.user.id` (vindo do token) para o service em criar, editar e remover |
| `prisma/schema.prisma` | `Restaurant` ganhou `ownerId` e a relação com `User` |
| `prisma/migrations/20261029223849_add_restaurant_owner` | Cria a coluna `ownerId` e a chave estrangeira |
| `src/modules/restaurant/restaurant.service.js` | Grava o dono (`user.id` do token) ao cadastrar o restaurante |
| `src/modules/restaurant/restaurant.controller.js` | Apenas formatação |

### Causa

Na versão anterior, `createDish` recusava qualquer prato sem `imageUrl` no corpo:

```js
if (!name || !category || price === undefined || !imageUrl || !description) {
  throw httpError(400, "Campos obrigatórios: name, category, price, imageUrl, description");
}
```

Só que a imagem do prato não vem no JSON: ela é enviada **depois**, por upload, numa rota própria. Quem mandava os dados corretos do prato recebia `400`. Reproduzi isso rodando o `dish.service.js` do commit `e9bc82c` contra o banco atual:

```
VERSAO ANTIGA -> 400 Campos obrigatórios: name, category, price, imageUrl, description
```

Havia um segundo problema, de segurança: qualquer usuário logado conseguia cadastrar, editar ou apagar pratos no restaurante de outra pessoa, porque o restaurante não sabia quem era o dono.

### Como a correção resolve

- O prato é criado com `imageUrl: ""` (o campo continua obrigatório no schema) e a imagem chega depois por `POST /dishes/:dishId/image`.
- `validateDish` confere cada campo e o preço (`Number.isFinite`, não negativo) e devolve `400` com mensagem específica.
- `parseId` rejeita ids inválidos com `400` em vez de deixar o Prisma estourar.
- `ensureOwnership` compara `restaurant.ownerId` com o id do token e devolve `403` se não for o dono.

### Resultado

`POST /restaurants/:restaurantId/dishes` com um restaurante existente devolve `201`, e o prato fica gravado no PostgreSQL com `restaurantId` apontando para o restaurante. Sem token: `401`. Usuário que não é dono: `403`. Restaurante inexistente: `404`. Preço inválido: `400`.

> Observação de ambiente: depois de atualizar o projeto, é preciso rodar `npx prisma generate`. Sem isso, o Prisma Client gerado continua sendo o da versão antiga do schema e o cadastro de usuário quebra com `500`.

---

## Parte 5 — Testes

| Teste | Esperado | Obtido |
|-------|----------|--------|
| Cadastrar um prato | `201 Created` | `201` |
| Enviar foto para o perfil autenticado | Imagem vinculada ao usuário | `200`, `imageUrl` em `/uploads/users/...webp` |
| Enviar foto para um prato | Imagem vinculada ao prato | `200`, `imageUrl` em `/uploads/dishes/...webp` |
| Consultar os dados atualizados | Caminho da imagem retornado | `GET /auth/me` e `GET /restaurants/:id/dishes` trazem o `imageUrl` |
| Acessar a URL da imagem | Imagem exibida | `200`, `Content-Type: image/webp`, 800×600 (prato) e 400×400 (perfil) |
| Enviar imagem sem JWT | `401 Unauthorized` | `401` nas duas rotas |
| Enviar arquivo inválido | Erro HTTP adequado | `415` (tipo não permitido), `422` (conteúdo falso), `413` (acima de 5 MB), `400` (sem arquivo ou campo errado) |
| Enviar imagem para prato inexistente | `404 Not Found` | `404` |

Também verificado: usuário que não é dono do restaurante recebe `403`; trocar a foto apaga o arquivo antigo; uma tentativa que falha não altera a imagem atual; `GET /restaurants` continua funcionando.

---

## Revisão — bugs encontrados e corrigidos

Antes da entrega, rodei uma bateria de 52 testes tentando quebrar a API, como um professor faria. Parte dos problemas já existia no código-base; todos foram corrigidos.

| Problema encontrado | Antes | Depois |
|---------------------|-------|--------|
| Requisição sem corpo (cadastro, login, restaurante, prato) | `500` com página HTML de erro | `400` com mensagem em JSON |
| JSON malformado | `400` em HTML | `400` em JSON |
| Rota inexistente | Página HTML | `404` em JSON |
| Cadastro com nome/e-mail só de espaços, e-mail sem `@`, senha curta | Aceito (`201`) | `400`. Senha mínima de 6 caracteres |
| Nome longo demais ou tipo errado (número, objeto) | `500` | `400` |
| Mesmo e-mail com maiúsculas diferentes | Criava uma segunda conta | `409`. O login também ignora maiúsculas |
| Senha errada repetidas vezes | Tentativas ilimitadas | Após 5 erros, `429` por 15 minutos |
| Restaurante com nota negativa | Aceito | `400` (nota de 0 a 5) |
| Restaurante com nota 10 ou texto | `500` (estoura `Decimal(2,1)`) | `400` |
| Prato com preço gigante | `500` (estoura `Decimal(10,2)`) | `400` |

Na interface, clicar numa categoria do fim da lista deslocava **todas** as telas para o lado. O `scrollIntoView`, usado para centralizar o chip, rolava também o contêiner das telas. A correção rola só a fileira de categorias, e o contêiner passou a usar `overflow: clip`, que não pode ser rolado por código.

Também entraram:
- remover a foto de perfil, a foto de um prato e a capa (`DELETE .../image`), apagando o arquivo do disco;
- capa do restaurante (`POST /restaurants/:id/image`), reutilizando o mesmo `image.service`;
- imagem gerada a partir da categoria quando o restaurante ou o prato não tem foto.

---

## Parte 6 — Pense como arquiteto

**Por que faz sentido reutilizar o mesmo serviço de imagens?**
Porque perfil e prato fazem exatamente a mesma operação: validar, otimizar, salvar e devolver um caminho. Com um serviço só, uma mudança (outro formato, outro tamanho, mover para a nuvem) é feita em um lugar e vale para todo mundo. O `image.service` nem sabe quem está chamando: recebe a pasta e o tamanho como parâmetros.

**Qual é a responsabilidade do Controller e qual é a do Service?**
O controller fala HTTP: lê `req.params`, `req.user` e `req.file`, chama o service e escolhe o status da resposta. O service guarda a regra de negócio: o prato existe? quem está pedindo é o dono do restaurante? O `image.service` guarda a regra técnica da imagem. Nenhum service conhece `req` ou `res`.

**Por que não implementar o processamento diretamente nas rotas?**
A rota misturaria HTTP, regra de negócio e manipulação de arquivo no mesmo lugar, e o código teria de ser copiado para cada rota nova de upload. Fora da rota, o processamento pode ser reutilizado e testado sem subir um servidor.

**Como o middleware de autenticação protege a alteração da imagem de perfil?**
`authenticate` vem antes do upload na rota. Ele valida o JWT e coloca o usuário em `req.user`; sem token válido, a requisição para ali com `401`, antes mesmo de o arquivo ser lido. O id usado para gravar a foto é o `req.user.id` que veio do token. Não existe parâmetro de id na rota, então ninguém consegue trocar a foto de outra pessoa.

**O que deve acontecer se o processamento de uma imagem falhar?**
Nada pode ficar pela metade. Se o Sharp não conseguir ler o arquivo, a API responde `422` e o banco não é tocado. Se a imagem for salva mas a atualização no banco falhar, a imagem nova é apagada. A imagem antiga só é removida depois que o banco confirma a nova. Assim o usuário continua com a foto anterior e não sobra arquivo órfão no disco.

**Nossa arquitetura atual permite adicionar novas funcionalidades sem modificar toda a aplicação?**
Sim. Esta missão é o exemplo: o upload entrou como dois arquivos novos em `shared/`, uma rota e uma função de service em cada módulo, e uma coluna no banco. Nenhum outro módulo mudou. Uma logo para o restaurante, por exemplo, seria só mais uma chamada ao mesmo `image.service`.
