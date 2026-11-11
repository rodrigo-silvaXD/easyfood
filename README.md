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
- `POST /auth/register`: cadastra usuário
- `POST /auth/login`: faz login e devolve um token JWT
- `GET  /auth/me`: dados do usuário logado, incluindo a foto (exige token)
- `POST /auth/me/image`: envia a foto de perfil do usuário logado (exige token)

### Restaurantes
- `GET  /restaurants`: lista restaurantes (público)
- `POST /restaurants`: cadastra restaurante; quem está logado vira o dono (exige token)

### Pratos
- `GET    /restaurants/:restaurantId/dishes`: cardápio do restaurante, com `imageUrl` (público)
- `POST   /restaurants/:restaurantId/dishes`: cadastra prato (exige token, só o dono)
- `GET    /dishes/:dishId`: detalhe do prato (público)
- `PUT    /dishes/:dishId`: edita prato (exige token, só o dono)
- `DELETE /dishes/:dishId`: remove prato (exige token, só o dono)
- `POST   /dishes/:dishId/image`: envia a foto do prato (exige token, só o dono)

### Upload de imagens

As rotas de imagem recebem `multipart/form-data` com o arquivo no campo **`image`**:

```bash
curl -X POST http://localhost:3000/auth/me/image \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "image=@foto.jpg"
```

- Formatos aceitos: JPEG, PNG e WebP, até **5 MB**
- A imagem é redimensionada (perfil 400×400, prato 800×600) e convertida para WebP
- Fica disponível em `http://localhost:3000/uploads/...`, no caminho devolvido em `imageUrl`

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
    ├── auth/          # cadastro, login, /me e foto de perfil
    ├── restaurant/    # restaurantes
    ├── dishes/        # cardápio e foto dos pratos
    └── shared/
        ├── activity.service.js
        ├── email.service.js
        ├── image.service.js       # otimiza (Sharp) e armazena imagens
        └── upload.middleware.js   # recebe o arquivo (Multer)
public/                # interface web (HTML, CSS e JS)
uploads/               # imagens enviadas (fora do Git)
```

## Documentação

- [adrs/](adrs/): decisões de arquitetura (ADR-001 a ADR-003)
- [docs/missao-upload-de-imagens.md](docs/missao-upload-de-imagens.md): análise da correção do cadastro de pratos, testes e reflexões da missão
