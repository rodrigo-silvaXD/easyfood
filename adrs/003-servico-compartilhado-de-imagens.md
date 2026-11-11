# ADR-003 — Serviço compartilhado de imagens com Multer e Sharp

| Campo       | Valor                          |
|-------------|--------------------------------|
| **Status**  | Aceito                         |
| **Data**    | 2026-11-11                     |
| **Autores** | Rodrigo Silva                  |

---

## Contexto

A EasyFood passou a precisar de imagens em dois lugares diferentes:

- **foto de perfil** do usuário autenticado (`POST /auth/me/image`);
- **foto de cada prato** do cardápio (`POST /dishes/:dishId/image`).

Os dois casos fazem a mesma coisa: receber um arquivo, garantir que é uma imagem válida, reduzir o tamanho, salvar e gravar o caminho no PostgreSQL. Se cada módulo implementasse isso sozinho, teríamos a mesma lógica duas vezes, e qualquer ajuste (formato, qualidade, limite de tamanho, local de armazenamento) teria de ser feito em dois lugares.

O projeto já tem a pasta `src/modules/shared/` para serviços reutilizáveis (`email.service.js`, `activity.service.js`).

---

## Alternativas consideradas

| # | Opção | Descrição |
|---|-------|-----------|
| 1 | Processar a imagem dentro de cada módulo | `auth.service` e `dish.service` com seu próprio código de Sharp |
| 2 | Serviço compartilhado no próprio monólito | `shared/image.service.js` + `shared/upload.middleware.js`, usados pelos dois módulos |
| 3 | Função serverless (FaaS) | Upload direto para um bucket (S3) e uma função disparada pelo evento processa a imagem |

---

## Decisão

Adotar a **opção 2**: um `image.service.js` e um `upload.middleware.js` em `src/modules/shared/`, reutilizados por `auth` e `dishes`.

- **Multer** recebe o arquivo em memória (`memoryStorage`), aceita apenas JPEG, PNG e WebP, com limite de **5 MB**.
- **Sharp** corrige a orientação, recorta no tamanho pedido (perfil 400×400, prato 800×600) e converte para **WebP com qualidade 80**.
- A imagem otimizada é salva em `uploads/<pasta>/<uuid>.webp` e servida pelo Express em `/uploads`.
- O PostgreSQL guarda só o caminho (`User.imageUrl`, `Dish.imageUrl` e `Restaurant.imageUrl`), nunca o arquivo.
- O mesmo serviço atende um terceiro caso, a capa do restaurante (1200×600), e a remoção de imagens (`clearImage`), sem código novo de processamento.

---

## Justificativa

- **Uma responsabilidade, um lugar.** O `image.service` não sabe se a imagem é de um usuário ou de um prato. Quem chama informa a pasta e o tamanho. Um terceiro módulo (logo do restaurante, por exemplo) reaproveita o serviço sem código novo.
- **Camadas respeitadas.** A rota só encadeia `authenticate → uploadImage → controller`; o controller traduz HTTP; o service do módulo aplica a regra de negócio (dono do restaurante, usuário do token); o `image.service` cuida de arquivo e Sharp.
- **Segurança.** O `authenticate` roda antes do Multer, então uma requisição sem token é recusada (401) sem ler o arquivo. O mimetype informado pelo cliente pode ser falso; o Sharp confirma se o conteúdo é uma imagem de verdade e devolve 422 caso não seja.
- **Proporcional ao momento do projeto.** A opção 3 (FaaS) escala melhor e tira o processamento pesado da API, mas exige bucket, fila de eventos e credenciais de nuvem. Para o volume atual, isso seria infraestrutura sem necessidade.

---

## Consequências

### Positivas

- ✅ Nenhuma lógica de processamento duplicada entre módulos
- ✅ O app nunca serve o arquivo original de vários MB: toda imagem sai já no tamanho em que é exibida (400×400 ou 800×600) e em WebP
- ✅ Troca de imagem sem arquivos órfãos: a nova é salva, o banco é atualizado e só então a antiga é apagada; se o banco falhar, a nova é descartada
- ✅ Erros previsíveis: 400 (sem arquivo), 401 (sem token), 403 (não é o dono), 404 (prato inexistente), 413 (acima de 5 MB), 415 (formato não suportado), 422 (arquivo corrompido)

### Negativas

- ❌ O processamento acontece no mesmo processo da API e consome CPU durante o upload
- ❌ As imagens ficam no disco do servidor: não funcionam com várias instâncias nem sobrevivem a um deploy em ambiente efêmero
- ❌ O arquivo inteiro passa pela memória (limitado a 5 MB por requisição)

---

## Critérios de revisão

Esta decisão deve ser reavaliada quando:

1. A aplicação rodar em mais de uma instância ou em hospedagem com disco efêmero (mover os arquivos para um storage de objetos, como S3 ou Cloudinary)
2. O volume de uploads começar a afetar o tempo de resposta das outras rotas (avaliar a opção 3, com processamento assíncrono via FaaS)
3. Forem necessários vários tamanhos da mesma imagem (miniatura, média, original)

---

## Notas

- Por ser compartilhado, o `image.service` é o único ponto a mudar se o armazenamento sair do disco local: os módulos continuam chamando `replaceImage(...)` e recebendo um caminho.
- A pasta `uploads/` está no `.gitignore`: imagens enviadas por usuários não são código.
