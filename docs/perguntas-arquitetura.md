# Pense como arquiteto — respostas

Respostas às perguntas propostas em cada missão da EasyFood. As decisões em si estão
registradas em [docs/adr/](adr/).

---

## Missão 1 — Novo requisito: cadastro de restaurantes

**O que precisaria mudar na aplicação para permitir o cadastro?**
Nada na estrutura, só um caminho novo. A API já existia e já sabia responder JSON;
faltava aceitar dados de entrada.

**Precisaremos criar uma nova rota? Que tipo de requisição?**
Sim: `POST /restaurants`. `GET` serve para consultar, `POST` para criar. Usar `GET`
com query string para criar quebraria a semântica do HTTP e deixaria dados sensíveis
na URL e no histórico.

**Quais informações um restaurante precisaria enviar?**
Nome (obrigatório), categoria (obrigatória) e avaliação (opcional). O `id` é gerado
pelo servidor — deixar o cliente escolher o id abriria espaço para colisão.

**Como essas informações chegariam até a API?**
No corpo da requisição, em JSON, com `Content-Type: application/json`. Foi preciso o
middleware `express.json()` para o Express entender esse corpo.

**Onde o novo restaurante seria armazenado?**
Naquele momento, no array em memória — decisão registrada na
[ADR-001](adr/ADR-001-armazenar-restaurantes-em-memoria.md).

**O desenho da arquitetura precisa mudar? Componente ou conector novo?**
O desenho ganha uma seta de entrada de dados, mas nenhum componente novo. O conector
continua o mesmo: HTTP.

**Alguma nova decisão arquitetural precisa ser tomada?**
Sim, duas: onde guardar os dados e o que validar antes de aceitar. Escolhemos validar
no servidor (nome e categoria obrigatórios) e devolver `400` com o motivo — validar só
no front seria fácil de burlar.

---

## Missão Sprint 03 — O teste de reinicialização

**O que aconteceu quando o servidor reiniciou?**
O restaurante cadastrado sumiu. O processo Node.js terminou e a memória foi liberada
junto.

**Isso é um erro?**
Não. É a consequência prevista da ADR-001. Decisões arquiteturais têm consequências, e
a diferença entre um erro e um trade-off é ter registrado a escolha antes.

**Qual banco você escolheria e por quê?**
PostgreSQL. O raciocínio completo, com as alternativas descartadas, está na
[ADR-002](adr/ADR-002-persistencia-com-postgresql.md).

---

## Missão 3 — Persistência

**Qual problema arquitetural resolvemos ao adicionar persistência?**
A durabilidade do estado. O estado da aplicação deixou de viver no processo e passou a
viver fora dele — o que também é o que permite rodar mais de uma instância.

**Por que PostgreSQL faz sentido para a EasyFood agora?**
Porque o domínio é relacional (um usuário cadastra vários restaurantes), porque é
gratuito e portátil entre notebook, container e nuvem, e porque entrega integridade
(unicidade de e-mail, chave estrangeira, transações) sem código nosso.

**Qual é a responsabilidade do Prisma?**
Traduzir. Ele converte chamadas JavaScript em SQL, devolve objetos JavaScript e
mantém o histórico de mudanças de esquema em migrations versionadas. Ele **não** é o
banco — é a camada de acesso.

**O que acontece com a API se o banco ficar indisponível?**
As rotas que dependem do banco falham. Cada acesso está dentro de `try/catch`: o erro
real vai para o log do servidor e o cliente recebe `500` com uma mensagem genérica —
detalhe de banco não deve vazar para fora. Ficamos com um ponto único de falha novo.

**Que vantagens ganhamos em relação ao array?**
Dados que sobrevivem ao restart, integridade, consultas e paginação feitas pelo banco,
e a possibilidade de mais de uma instância compartilhar o mesmo estado.

**Que nova complexidade foi adicionada?**
Ambiente: agora é preciso ter um PostgreSQL rodando e a `DATABASE_URL` configurada.
Fluxo: migrations passam a fazer parte do trabalho. Operação: alguém precisa cuidar
de backup e disponibilidade do banco.

**Quais trade-offs surgiram?**
Trocamos simplicidade de ambiente por durabilidade, e velocidade de desenvolvimento
por garantias. Também aceitamos uma dependência (Prisma) e um ponto de falha novo.

**O desenho arquitetural precisa ser atualizado?**
Sim: `Cliente → Express → array` virou `Cliente → Express → Prisma → PostgreSQL`.

---

## Missão 4 — Arquitetura em camadas

**Por que não deixamos tudo dentro do `server.js`?**
Porque um arquivo que faz tudo tem vários motivos para mudar ao mesmo tempo. Com dois
endpoints é só incômodo; com dez domínios vira o gargalo do projeto.

**Responsabilidade de cada camada**

| Camada | Responsabilidade |
|---|---|
| `server.js` | Subir o processo na porta. Só isso. |
| `app.js` | Middlewares, arquivos estáticos e montagem das rotas. |
| routes | Mapear caminho e método → função do controller. |
| controller | Ler `req`, validar entrada, chamar o service, devolver `res`. |
| service | Regras e operações do domínio. |
| database | Expor a conexão do Prisma. |

**Por que o Service não deveria depender de `req` e `res`?**
Porque regra de negócio não é uma regra de HTTP. Sem `req`/`res`, o service pode ser
chamado por um script de seed, uma tarefa agendada ou um teste — e pode ser testado
sem subir servidor. No dia em que a EasyFood ganhar uma CLI ou uma fila, a regra é a
mesma; só o gatilho muda.

**Por que as Routes não acessam diretamente o Prisma?**
Porque isso misturaria roteamento com acesso a dados e espalharia SQL pelo projeto.
Trocar o Prisma passaria a exigir mexer em todas as rotas, em vez de em uma camada.

**O comportamento externo da API mudou?**
Não. `GET /restaurants` e `POST /restaurants` continuam iguais. Mudar organização
interna sem mudar comportamento externo é exatamente a definição de refatoração.

**Que vantagem essa organização traz quando o sistema crescer?**
Um domínio novo é uma pasta nova, não uma edição num arquivo compartilhado. Reduz
conflito de merge e encurta o caminho entre "entendi o problema" e "sei onde mexer".

**Que nova complexidade ela adiciona?**
Mais arquivos por funcionalidade e indireção: uma requisição atravessa quatro saltos
antes de chegar ao banco. Para uma mudança pequena, é mais navegação.

**Como o domínio de autenticação se encaixaria?**
Como `src/modules/auth/`, nas mesmas camadas, mais um `auth.middleware.js` — que é a
peça nova, porque autenticação é uma preocupação transversal e precisa poder
proteger rotas de qualquer módulo.

**Qual solução de autenticação você escolheria e por quê?**
JWT com bcrypt. A comparação com Cognito, login com Google e sessão em servidor está
na [ADR-004](adr/ADR-004-autenticacao-com-jwt.md).

---

## Aula 6 — Arquitetura orientada a eventos

**Comando ou evento?**
Comando é `sendWelcomeEmail()` — "faça isso", uma instrução direta. Evento é
`restaurant.created` — "isso aconteceu", uma informação que outros podem usar. Quem
publica um evento não sabe nem decide quem vai reagir.

**Síncrono ou assíncrono?**
Síncrono é solicitar, esperar e só então continuar — é o que o login precisa ser,
porque sem validar credenciais não há token. Assíncrono é informar que algo aconteceu
e seguir — nem toda ação precisa terminar antes de responder ao usuário.

**A EasyFood vai adotar eventos?**
Não agora. O porquê, com o que ganharíamos e o que pagaríamos, está na
[ADR-005](adr/ADR-005-nao-adotar-event-driven-agora.md).
