# ADR-003 — Organizar a aplicação em camadas

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 03/09/2026 |
| **Responsável** | Equipe EasyFood |

---

## Contexto

Com a chegada do Prisma, o `server.js` virou um arquivo que faz de tudo:

```
server.js
├── inicia o Express
├── configura middlewares
├── define rotas
├── valida dados
├── acessa o Prisma
├── conversa com o banco
└── liga o servidor
```

Funciona. O problema aparece quando o sistema cresce: qualquer mudança mexe no mesmo
arquivo, fica difícil testar uma regra sem subir um servidor HTTP, e não existe um
lugar óbvio para colocar o próximo domínio (autenticação, pedidos, avaliações).

Precisamos decidir **como organizar o código** antes de adicionar responsabilidades.

## Alternativas consideradas

| # | Opção | Avaliação |
|---|---|---|
| 1 | **Monólito modular em camadas** (routes → controller → service → database) | Separa responsabilidades sem mudar o deploy. Padrão conhecido pela equipe. |
| 2 | Manter tudo no `server.js` | Zero esforço agora, custo crescente depois. Já está incômodo com dois endpoints. |
| 3 | Microsserviços | Resolveria o acoplamento, mas a EasyFood tem um domínio só, uma equipe e nenhum requisito de escala independente. Pagaríamos rede, deploy e observabilidade sem necessidade. |
| 4 | Arquitetura hexagonal / Clean Architecture completa | Boa separação, mas muitas camadas e abstrações para o tamanho atual do problema. |

## Decisão

Reorganizar a aplicação em um **monólito modular com quatro camadas**, agrupadas por
domínio:

```
src/
├── database/
│   └── prisma.js                  conexão com o banco
├── modules/
│   └── restaurants/
│       ├── restaurant.routes.js       caminhos
│       ├── restaurant.controller.js   req/res e validação de entrada
│       ├── restaurant.service.js      regras e operações
│       └── restaurant.validator.js    regras de validação isoladas
└── app.js                         middlewares e montagem das rotas

server.js                          só liga o servidor
```

Cada camada tem uma responsabilidade:

| Camada | Responsabilidade | O que **não** faz |
|---|---|---|
| `server.js` | Subir o processo na porta | Não conhece rotas nem banco |
| `app.js` | Middlewares, estáticos, montagem de rotas | Não implementa regra |
| routes | Mapear caminho → função do controller | Não acessa Prisma |
| controller | Ler `req`, validar entrada, devolver `res` | Não escreve SQL nem regra de negócio |
| service | Regras e operações do domínio | **Não conhece `req` nem `res`** |
| database | Expor a conexão do Prisma | Não tem regra |

Esta é uma **refatoração**: o comportamento externo da API não muda.

## Justificativa

- O `service` não depender de HTTP é o ponto central. Isso permite testar regra de
  negócio sem subir servidor, e reaproveitar a mesma regra em outro gatilho (um
  script de seed, uma tarefa agendada) sem duplicar código.
- Agrupar por domínio (`modules/restaurants/`, `modules/auth/`) em vez de por tipo
  técnico faz com que tudo que muda junto fique junto.
- É a menor mudança que resolve o problema real. Não estamos separando serviços nem
  criando abstrações que ainda não têm dois casos de uso.

## Consequências

### Positivas

- Cada arquivo tem um motivo claro para existir e para mudar.
- Adicionar um domínio novo é criar uma pasta, não editar um arquivo gigante.
- As regras ficam testáveis isoladamente.
- Um erro de banco fica contido no service; um erro de entrada fica no controller.

### Negativas / trade-offs

- **Mais arquivos para uma funcionalidade pequena.** Cadastrar um campo novo agora
  pode tocar validator, service e controller.
- Existe indireção: para entender uma requisição é preciso seguir quatro saltos.
- Para quem está começando, a estrutura parece burocrática perto de um único arquivo.
- Continua sendo um monólito: tudo sobe e cai junto, e não dá para escalar um domínio
  separadamente.

## Critérios de revisão

Esta decisão deve ser reavaliada quando:

1. Um domínio precisar escalar ou ser implantado de forma independente.
2. Equipes diferentes passarem a disputar o mesmo repositório.
3. O tempo de build ou de subida do processo virar um gargalo.
4. Aparecer necessidade de tecnologias diferentes por domínio.

## Notas

Continuamos com um monólito — só que agora organizado por responsabilidades e pronto
para receber novos módulos. O primeiro deles é a autenticação, registrada na
[ADR-004](ADR-004-autenticacao-com-jwt.md).
