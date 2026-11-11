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
- `GET    /restaurants`: lista restaurantes, com a capa em `imageUrl` (público)
- `POST   /restaurants`: cadastra restaurante; quem está logado vira o dono (exige token). Avaliação de 0 a 5
- `POST   /restaurants/:restaurantId/image`: envia a capa do restaurante (exige token, só o dono)
- `DELETE /restaurants/:restaurantId/image`: remove a capa (exige token, só o dono)

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
    ├── auth/          # cadastro, login, /me e foto de perfil
    ├── restaurant/    # restaurantes
    ├── dishes/        # cardápio e foto dos pratos
    └── shared/
        ├── activity.service.js
        ├── email.service.js
        ├── image.service.js       # otimiza (Sharp), armazena e remove imagens
        ├── upload.middleware.js   # recebe o arquivo (Multer)
        └── validation.js          # validação de texto, e-mail, número e id
public/                # interface web (HTML, CSS e JS)
uploads/               # imagens enviadas (fora do Git)
```

## Documentação

- [adrs/](adrs/): decisões de arquitetura (ADR-001 a ADR-003)
- [docs/missao-upload-de-imagens.md](docs/missao-upload-de-imagens.md): análise da correção do cadastro de pratos, testes e reflexões da missão
