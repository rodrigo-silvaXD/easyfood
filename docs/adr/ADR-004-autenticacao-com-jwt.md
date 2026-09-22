# ADR-004 — Autenticação com JWT e bcrypt

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 10/09/2026 |
| **Responsável** | Equipe EasyFood |

---

## Contexto

Hoje qualquer pessoa com acesso à URL consegue cadastrar um restaurante. Não sabemos
quem cadastrou o quê e não temos como impedir abuso.

O requisito que chegou é: **o cadastro de restaurantes precisa ser feito por um
usuário identificado**. A listagem continua pública — descobrir restaurantes é o
valor principal do produto e exigir login para isso afastaria gente.

Então precisamos de: cadastro de usuário, login, uma forma de a API saber quem está
chamando, e proteção do `POST /restaurants`.

## Alternativas consideradas

| # | Opção | Avaliação |
|---|---|---|
| 1 | **JWT assinado pela própria API** | Sem dependência externa, sem custo, sem estado no servidor. A API continua autocontida. |
| 2 | Sessão com cookie + store no servidor | Permite revogar na hora, mas exige guardar sessão (memória ou Redis) e quebra a ideia de API sem estado. Mais infraestrutura. |
| 3 | AWS Cognito | Tira de nós a responsabilidade de guardar senha, MFA, recuperação. Em troca: conta AWS, configuração, custo por usuário ativo e acoplamento a um fornecedor. |
| 4 | Login com Google (OAuth) | Ótima experiência e nenhuma senha para guardar, mas depende de cadastro no Google Cloud, obriga todo usuário a ter conta Google e ainda exigiria uma sessão própria depois do callback. |

## Decisão

Implementar autenticação **própria, com JWT para sessão e bcrypt para senha**.

Rotas:

```
POST /auth/register   cria usuário e já devolve token
POST /auth/login      valida credenciais e devolve token
GET  /auth/me         devolve o usuário do token (protegida)

GET  /restaurants     continua pública
POST /restaurants     passa a exigir token
DELETE /restaurants/:id  exige token e só funciona para o dono
```

Fluxo:

```
cadastro:  senha → bcrypt.hash → PostgreSQL
login:     bcrypt.compare → jwt.sign → token
chamada:   Authorization: Bearer <token> → middleware → rota protegida
```

O `JWT_SECRET` fica no `.env` e **nunca** no código nem no repositório.

## Justificativa

- Pelo tamanho atual da EasyFood, JWT é a opção com melhor relação entre o que
  resolve e o que custa. Não precisamos de conta em nuvem nem de infraestrutura nova.
- Mantém a API sem estado: qualquer instância consegue validar o token com o segredo,
  o que combina com a decisão de poder rodar mais de uma instância (ADR-002).
- bcrypt é o padrão para senha: gera hash com salt e é propositalmente lento, o que
  encarece ataque de força bruta. A senha nunca é gravada nem devolvida em texto.
- O módulo `auth/` se encaixa na estrutura criada na [ADR-003](ADR-003-arquitetura-em-camadas.md)
  sem inventar nada novo — mesmas camadas, mais um middleware.

## Consequências

### Positivas

- Sabemos quem cadastrou cada restaurante (`owner_id`), o que já permitiu a regra de
  "só o dono remove".
- Nenhuma dependência externa ou custo recorrente.
- O front guarda um token e pronto — não precisa lidar com cookie, CSRF ou sessão.
- Escala horizontalmente sem compartilhar estado entre instâncias.

### Negativas / trade-offs

- **Não dá para revogar um token antes de ele expirar.** Se um token vazar, ele vale
  até o fim do prazo. Mitigamos com validade curta (1 dia) e podemos, no futuro,
  adicionar refresh token ou lista de revogação.
- Assumimos a responsabilidade de guardar senha. Se o `JWT_SECRET` vazar, qualquer
  pessoa consegue forjar token.
- Guardar o token no `localStorage` do navegador o expõe a XSS. Por isso todo texto
  vindo da API é escapado antes de virar HTML no front.
- Não temos recuperação de senha, verificação de e-mail nem MFA. São funcionalidades
  que o Cognito traria prontas e que teremos que escrever se forem necessárias.
- Logout é só apagar o token no cliente — o servidor não fica sabendo.

## Critérios de revisão

Esta decisão deve ser reavaliada quando:

1. For necessário revogar acesso imediatamente (banimento, dispositivo perdido).
2. Precisarmos de recuperação de senha, verificação de e-mail ou MFA.
3. Surgir exigência de login social ou SSO corporativo.
4. O volume de usuários fizer o custo de manter autenticação própria superar o de um
   serviço gerenciado.

## Notas

A validação de entrada ficou em `auth.validator.js`, separada do controller, para que
a mesma regra possa ser testada sem HTTP. O front repete essas regras apenas por
conveniência de quem digita — **quem decide se o dado é válido é sempre o servidor**.
