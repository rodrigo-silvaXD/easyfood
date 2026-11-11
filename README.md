# EasyFood API

API de restaurantes construída com Node.js, Express, Prisma e PostgreSQL.
Autenticação via JWT. Upload de imagens com Multer e Sharp.

Projeto da disciplina Software Architecture & Design Patterns (UniFECAF), baseado no repositório [FelipeDiasR/easy-food](https://github.com/FelipeDiasR/easy-food).

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie o arquivo `.env` a partir do `.env.example` e preencha os valores.

3. Rode as migrations e gere o Prisma Client:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. Inicie o servidor:
   ```bash
   node server.js
   ```

5. Abra **http://localhost:3000** no navegador.

## Endpoints

### Autenticação
- `POST   /auth/register`: cadastra usuário (senha com no mínimo 6 caracteres)
- `POST   /auth/login`: faz login e devolve um token JWT
- `GET    /auth/me`: dados do usuário logado, incluindo a foto (exige token)
- `POST   /auth/me/image`: envia a foto de perfil do usuário logado (exige token)
- `DELETE /auth/me/image`: remove a foto de perfil (exige token)

Regras do cadastro e do login:
- nome com 2 a 150 caracteres, e-mail válido, senha de 6 a 72 caracteres
- o e-mail não diferencia maiúsculas de minúsculas (`Ana@x.com` e `ana@x.com` são a mesma conta)
- depois de 5 senhas erradas para o mesmo e-mail, o login fica bloqueado por 15 minutos (`429`)

### Restaurantes
- `GET    /restaurants`: lista restaurantes com a capa (`imageUrl`), a nota média (`rating`) e o número de avaliações (`reviewsCount`) (público)
- `POST   /restaurants`: cadastra restaurante com `name` e `category`; quem está logado vira o dono (exige token)
- `POST   /restaurants/:restaurantId/image`: envia a capa do restaurante (exige token, só o dono)
- `DELETE /restaurants/:restaurantId/image`: remove a capa (exige token, só o dono)

Regras do cadastro de restaurante:
- a nota **não** é definida pelo dono: o `rating` enviado no cadastro é ignorado, e todo restaurante começa com 0, como "Novo" ([ADR-004](adrs/004-nota-vem-das-avaliacoes.md))
- o mesmo dono não pode ter dois restaurantes com o mesmo nome (`409`)

### Avaliações
- `POST /restaurants/:restaurantId/reviews`: dá ou troca a nota do usuário logado, com `{ "rating": 1 }` a `{ "rating": 5 }` (exige token)
- `GET  /restaurants/:restaurantId/reviews/me`: nota que o usuário logado deu a esse restaurante, ou `null` (exige token)

Regras: uma avaliação por usuário por restaurante (avaliar de novo troca a nota), o dono não avalia o próprio restaurante (`403`) e a nota é um inteiro de 1 a 5. A cada avaliação, a média é recalculada e gravada em `rating`.

### Pratos
- `GET    /restaurants/:restaurantId/dishes`: cardápio do restaurante, com `imageUrl` (público)
- `POST   /restaurants/:restaurantId/dishes`: cadastra prato (exige token, só o dono)
- `GET    /dishes/:dishId`: detalhe do prato (público)
- `PUT    /dishes/:dishId`: edita prato (exige token, só o dono)
- `DELETE /dishes/:dishId`: remove prato (exige token, só o dono)
- `POST   /dishes/:dishId/image`: envia a foto do prato (exige token, só o dono)
- `DELETE /dishes/:dishId/image`: remove a foto do prato (exige token, só o dono)

### Upload de imagens

As rotas de imagem recebem `multipart/form-data` com o arquivo no campo **`image`**:

```bash
curl -X POST http://localhost:3000/auth/me/image \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "image=@foto.jpg"
```

- Formatos aceitos: JPEG, PNG e WebP, até **5 MB**
- A imagem é redimensionada (perfil 400×400, prato 800×600, capa 1200×600) e convertida para WebP
- Fica disponível em `http://localhost:3000/uploads/...`, no caminho devolvido em `imageUrl`
- Ao trocar ou remover, o arquivo antigo é apagado do disco
- Sem foto enviada, a interface mostra uma imagem gerada a partir da categoria do restaurante ou do prato

| Situação | Resposta |
|----------|----------|
| Sem token | `401` |
| Usuário não é dono do restaurante | `403` |
| Prato inexistente | `404` |
| Sem arquivo ou campo com outro nome | `400` |
| Arquivo maior que 5 MB | `413` |
| Formato não suportado | `415` |
| Arquivo corrompido / não é imagem | `422` |

## Estrutura

```
src/
├── app.js
├── database/prisma.js
└── modules/
    ├── auth/          # cadastro, login (com limite de tentativas), /me e foto de perfil
    ├── restaurant/    # restaurantes e capa
    ├── dishes/        # cardápio e foto dos pratos
    ├── reviews/       # avaliações dos clientes e nota média
    └── shared/
        ├── activity.service.js
        ├── email.service.js
        ├── image.service.js       # otimiza (Sharp), armazena e remove imagens
        ├── upload.middleware.js   # recebe o arquivo (Multer)
        └── validation.js          # validação de texto, e-mail, número e id
public/                # interface web (HTML, CSS e JS)
uploads/               # imagens enviadas (fora do Git)
```

## Interface

Em `http://localhost:3000`:
- lista de restaurantes com busca, categorias, ordenação (melhor avaliados, nome, mais recentes) e favoritos (separados por conta)
- login e cadastro, perfil com foto
- tela do restaurante com cardápio e avaliação por estrelas; o dono envia e remove a capa e as fotos, e cadastra, edita e exclui pratos

## Decisões de arquitetura

| ADR | Decisão |
|-----|---------|
| [001](adrs/001-storage-in-memory%20copy.md) | Restaurantes em memória na primeira versão (professor) |
| [002](adrs/002-Data-base-PostgresSql.md) | PostgreSQL como banco (professor) |
| [003](adrs/003-servico-compartilhado-de-imagens.md) | Serviço compartilhado de imagens com Multer e Sharp |
| [004](adrs/004-nota-vem-das-avaliacoes.md) | A nota do restaurante vem das avaliações dos clientes |
| [005](adrs/005-autenticacao-confere-se-a-conta-existe.md) | O middleware de autenticação confere se a conta ainda existe |
| [006](adrs/006-validacao-de-entrada-e-limite-de-login.md) | Validação de entrada, senha mínima e limite de tentativas de login |
| [007](adrs/007-coerencia-dos-dados-e-da-interface.md) | Ajustes de coerência nos dados e na interface |

A análise da correção do cadastro de pratos, os testes e as reflexões da missão estão em [docs/missao-upload-de-imagens.md](docs/missao-upload-de-imagens.md).
