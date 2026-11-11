# ADR-003 — Serviço compartilhado de imagens com Multer e Sharp

| Campo       | Valor                          |
|-------------|--------------------------------|
| **Status**  | Aceito                         |
| **Data**    | 2026-11-11                     |
| **Autores** | Rodrigo Silva                  |

---

## Contexto

A missão pedia imagens em dois lugares: a **foto de perfil** do usuário autenticado (`POST /auth/me/image`) e a **foto de cada prato** (`POST /dishes/:dishId/image`). Depois eu acrescentei um terceiro, a **capa do restaurante**.

Quando comecei, percebi que os casos fazem exatamente a mesma coisa: receber um arquivo, garantir que é imagem, reduzir o tamanho, salvar e gravar o caminho no PostgreSQL. Se eu escrevesse isso dentro de cada módulo, teria o mesmo código repetido, e qualquer ajuste de formato, qualidade, limite ou local de armazenamento precisaria ser feito em vários lugares.

O projeto do professor já tinha a pasta `src/modules/shared/` com serviços reutilizáveis (`email.service.js`, `activity.service.js`), então o lugar natural já existia.

---

## Alternativas consideradas

| # | Opção | Descrição |
|---|-------|-----------|
| 1 | Processar a imagem dentro de cada módulo | `auth.service` e `dish.service`, cada um com seu código de Sharp |
| 2 | Serviço compartilhado no próprio monólito | `shared/image.service.js` + `shared/upload.middleware.js`, usados por todos os módulos |
| 3 | Função serverless (FaaS) | Upload direto para um bucket (S3) e uma função disparada pelo evento processa a imagem |

---

## Decisão

Escolhi a **opção 2**: um `image.service.js` e um `upload.middleware.js` em `src/modules/shared/`, reutilizados por `auth`, `dishes` e `restaurant`.

- O **Multer** recebe o arquivo em memória (`memoryStorage`), aceita só JPEG, PNG e WebP e limita a **5 MB**.
- O **Sharp** corrige a orientação, recorta no tamanho pedido (perfil 400×400, prato 800×600, capa 1200×600) e converte para **WebP com qualidade 80**.
- A imagem otimizada vai para `uploads/<pasta>/<uuid>.webp` e o Express serve em `/uploads`.
- O PostgreSQL guarda só o caminho (`User.imageUrl`, `Dish.imageUrl` e `Restaurant.imageUrl`), nunca o arquivo.
- Para trocar uma imagem uso `replaceImage` e para remover uso `clearImage`. Os dois ficam no mesmo serviço.

---

## Justificativa

- **Uma responsabilidade, um lugar.** O `image.service` não sabe se a imagem é de um usuário, de um prato ou de um restaurante: quem chama informa a pasta e o tamanho. A capa do restaurante, que entrou depois, provou isso, porque não precisei escrever nenhuma linha nova de processamento.
- **Camadas respeitadas.** A rota só encadeia `authenticate → uploadImage → controller`, o controller traduz HTTP, o service do módulo aplica a regra de negócio (é o dono? é o usuário do token?) e o `image.service` cuida de arquivo e Sharp.
- **Segurança.** Coloquei o `authenticate` antes do Multer, então uma requisição sem token é recusada (401) sem nem ler o arquivo. Também não confio no mimetype que o cliente manda, porque ele pode mentir. Quem confirma se o conteúdo é imagem de verdade é o Sharp, e se não for respondo 422.
- **Proporcional ao momento do projeto.** A opção 3 escala melhor e tira o processamento pesado da API, mas exige bucket, eventos e credenciais de nuvem. Para o volume da EasyFood hoje, seria infraestrutura sem necessidade.

---

## Consequências

### Positivas

- ✅ Nenhuma lógica de processamento duplicada entre módulos
- ✅ O app nunca serve o arquivo original de vários MB: toda imagem sai já no tamanho em que é exibida e em WebP
- ✅ Troca e remoção sem arquivo órfão: na troca, a imagem nova é salva, o banco é atualizado e só então a antiga é apagada; se o banco falhar, a nova é descartada. Na remoção, limpo o banco primeiro e depois apago o arquivo, para o banco nunca apontar para algo que não existe
- ✅ Erros previsíveis: 400 (sem arquivo), 401 (sem token), 403 (não é o dono), 404 (não existe), 413 (acima de 5 MB), 415 (formato não suportado), 422 (arquivo corrompido)

### Negativas

- ❌ O processamento roda no mesmo processo da API e consome CPU durante o upload
- ❌ As imagens ficam no disco do servidor: não funcionam com várias instâncias nem sobrevivem a um deploy em ambiente efêmero
- ❌ O arquivo inteiro passa pela memória (por isso o limite de 5 MB)

---

## Critérios de revisão

Vou reavaliar esta decisão quando:

1. A aplicação rodar em mais de uma instância ou numa hospedagem com disco efêmero (aí as imagens vão para um storage de objetos, como S3 ou Cloudinary)
2. O volume de uploads começar a deixar as outras rotas lentas (aí considero a opção 3, com processamento assíncrono)
3. Eu precisar de vários tamanhos da mesma imagem (miniatura, média, original)

---

## Notas

- Como o serviço é compartilhado, ele é o único ponto que muda se o armazenamento sair do disco local. Os módulos continuam chamando `replaceImage(...)` e recebendo um caminho.
- A pasta `uploads/` está no `.gitignore`, porque imagem enviada por usuário não é código.
- Quando o restaurante ou o prato não tem foto, a interface mostra uma imagem gerada a partir da categoria. Ela é desenhada no navegador e não ocupa espaço no servidor.
