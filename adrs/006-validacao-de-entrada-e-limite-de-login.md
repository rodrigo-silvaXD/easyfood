# ADR-006 — Validação de entrada, senha mínima e limite de tentativas de login

| Campo       | Valor                          |
|-------------|--------------------------------|
| **Status**  | Aceito                         |
| **Data**    | 2026-11-11                     |
| **Autores** | Rodrigo Silva                  |

---

## Contexto

Antes de entregar, resolvi testar a API como um professor faria: mandando de propósito o que não deveria funcionar. Escrevi uma bateria com mais de 50 tentativas e **achei vários bugs**, alguns que já vinham do código-base:

- requisição sem corpo no cadastro, login, restaurante ou prato → **500**, e ainda com uma página HTML de erro em vez de JSON;
- JSON malformado e rota inexistente → resposta em HTML;
- cadastro aceitando nome e e-mail só com espaços, e-mail sem `@` e senha de 1 caractere;
- nome com 300 caracteres, ou nome enviado como número ou objeto → **500**, porque o erro só aparecia no banco;
- `Ana@x.com` e `ana@x.com` viravam duas contas diferentes;
- dava para errar a senha quantas vezes quisesse;
- preço de prato gigante → **500**, porque estoura a coluna `Decimal(10, 2)`.

O padrão era o mesmo: a API confiava no que chegava e deixava o banco recusar. O resultado eram erros 500 que, para quem usa, parecem "o servidor caiu".

---

## Alternativas consideradas

| # | Opção | Descrição |
|---|-------|-----------|
| 1 | Biblioteca de schema (Zod, Joi) | Validação declarativa e completa, mas é mais uma dependência e mais um padrão para o resto do projeto seguir |
| 2 | Funções de validação próprias e compartilhadas | Poucas funções (`text`, `email`, `number`, `id`) em `shared/validation.js` |
| 3 | Validar só no front | Não protege nada: qualquer um chama a API direto |

Para as tentativas de login:

| # | Opção | Descrição |
|---|-------|-----------|
| A | Biblioteca (`express-rate-limit`) | Limita por IP em todas as rotas, mas não por conta |
| B | Contador próprio em memória | Bloqueia a combinação IP + e-mail depois de N erros |

---

## Decisão

Escolhi a **opção 2** para a validação e a **opção B** para o login.

- `src/modules/shared/validation.js` valida texto (tamanho mínimo e máximo, sem espaços nas pontas), e-mail, número com faixa e id. Erro de validação vira **400** com mensagem clara.
- **Senha com no mínimo 6 caracteres** e no máximo 72, que é o limite real do bcrypt (depois disso ele ignora o resto).
- O e-mail é salvo em minúsculas, e cadastro e login não diferenciam maiúsculas.
- `src/modules/auth/login.limiter.js`: depois de **5 senhas erradas** para o mesmo e-mail vindo do mesmo IP, o login fica bloqueado por **15 minutos** (**429**), mesmo com a senha certa. Um login certo antes disso zera o contador.
- No `app.js`, corpo ausente vira `{}` antes de chegar aos controllers, e erros que escapam (JSON malformado, rota inexistente) respondem em JSON, sem expor stack trace.

---

## Justificativa

- Validar na entrada é mais barato e dá mensagens melhores do que esperar o banco recusar.
- Fiquei com funções próprias porque o projeto só precisa de quatro regras. Uma biblioteca de schema seria mais uma coisa para o professor e para mim aprendermos sem necessidade agora. Como as funções estão em `shared/`, o módulo de avaliações já reaproveitou o `validate.id`.
- No login, bloquear por **e-mail + IP** protege a conta atacada sem travar todo mundo que divide o mesmo IP (uma faculdade inteira, por exemplo).
- A mensagem de erro do login é a mesma para "e-mail não existe" e "senha errada" ("E-mail ou senha incorretos"), para não revelar quais e-mails estão cadastrados.

---

## Consequências

### Positivas

- ✅ Nenhuma entrada inválida da bateria de testes gera 500
- ✅ A API sempre responde em JSON, inclusive nos erros
- ✅ Tentar adivinhar senha fica inviável na prática

### Negativas

- ❌ O contador de tentativas fica em memória: reiniciar o servidor zera tudo, e com várias instâncias cada uma teria o seu contador
- ❌ Quem tentar de vários IPs diferentes não é barrado pelo mesmo contador
- ❌ A validação ficou dividida: auth e restaurante usam `shared/validation.js`, e pratos continuam com o `validateDish` que veio do professor (só aumentei os limites dele)

---

## Critérios de revisão

Vou reavaliar esta decisão quando:

1. A aplicação rodar em mais de uma instância (aí o contador vai para o Redis ou para o banco)
2. As regras de validação crescerem a ponto de as funções próprias virarem uma biblioteca mal feita (aí migro para Zod)
