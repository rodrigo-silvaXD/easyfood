# ADR-005 — Não adotar arquitetura orientada a eventos neste momento

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 16/09/2026 |
| **Responsável** | Equipe EasyFood |

---

## Contexto

Chegou uma necessidade nova: quando um restaurante for cadastrado, a EasyFood
precisará enviar um e-mail de boas-vindas, registrar a atividade e notificar o time
comercial.

O caminho direto é o `RestaurantService` chamar os três. Funciona, e é o que a maioria
faria numa sexta-feira. Mas vale perguntar o que isso custa:

```
POST /restaurants
   ↓
Restaurant Service
   ↓ salva no banco
   ↓ envia e-mail        ← o usuário espera
   ↓ registra atividade  ← o usuário espera
   ↓ notifica comercial  ← o usuário espera
   ↓ responde
```

O `RestaurantService` passa a conhecer e-mail, log de atividade e time comercial. Se
amanhã entrarem cupom, CRM e analytics, ele conhece tudo isso também. E o usuário
espera por coisas que não precisam terminar antes da resposta.

A alternativa é publicar um evento — `restaurant.created` — e deixar que os
interessados reajam por conta própria.

## Alternativas consideradas

| # | Opção | Avaliação |
|---|---|---|
| 1 | **Comunicação direta entre componentes separados** | O service chama módulos internos. Fluxo explícito, fácil de depurar, nenhuma infraestrutura nova. |
| 2 | Eventos em processo (EventEmitter do Node) | Desacopla sem broker, mas cria fluxo implícito e some com o rastro do erro, sem entregar a durabilidade que justificaria eventos. |
| 3 | Broker de mensagens (RabbitMQ, Kafka, SQS/SNS) | Desacoplamento real, processamento assíncrono e durável. Em troca: infraestrutura nova, observabilidade, tratamento de falha e consistência eventual. |

## Decisão

**Não adotar arquitetura orientada a eventos agora.** Manter comunicação direta entre
componentes, mas com os componentes separados em módulos próprios, de modo que a
troca futura seja localizada.

```
Restaurant Service
   ├── EmailService
   ├── ActivityService
   └── CommercialService
```

## Justificativa

Eventos resolvem um problema que a EasyFood ainda não tem. Hoje temos:

- um monólito modular, com poucos componentes;
- um fluxo simples e dependências conhecidas;
- nenhuma necessidade de processamento durável ou de consumidores independentes;
- nenhum requisito de escala que justifique fila.

Adotar broker agora significaria pagar infraestrutura, observabilidade e tratamento de
falha antecipadamente — e em troca de um desacoplamento que ainda não nos incomoda.
A tecnologia vem depois da necessidade, não antes.

Manter os componentes separados desde já é o que garante que essa decisão seja barata
de reverter: quando publicarmos `restaurant.created`, os assinantes já existem como
módulos e só mudam de gatilho.

## Consequências

### Positivas

- Fluxo explícito: dá para ler o código e saber exatamente o que acontece.
- Depuração direta — um stack trace mostra a cadeia inteira.
- Nenhuma infraestrutura nova para manter, monitorar ou pagar.
- Consistência imediata: se algo falhar, falha na hora e dá para tratar.

### Negativas / trade-offs

- O `RestaurantService` conhece seus colaboradores. Cada nova reação ao cadastro
  significa editar esse service.
- Tudo acontece de forma síncrona: o tempo de resposta do `POST /restaurants` cresce
  junto com a lista de efeitos colaterais.
- Uma falha no envio de e-mail pode derrubar uma operação que já deu certo no banco.
- Adicionar um consumidor novo exige mexer no produtor, e não só assinar um evento.

## Critérios de revisão

Esta decisão deve ser reavaliada quando:

1. O número de reações ao cadastro crescer a ponto de o service ficar difícil de ler.
2. O tempo de resposta do `POST /restaurants` for afetado por efeitos colaterais.
3. Precisarmos de garantia de entrega e reprocessamento em caso de falha.
4. Times ou serviços diferentes precisarem reagir ao mesmo fato de forma independente.
5. Surgir um domínio que realmente exija processamento assíncrono (relatórios, cobrança).

## Notas

Não existe arquitetura perfeita — existem trade-offs. O que ganhamos com eventos
(menor acoplamento, flexibilidade, consumidores independentes) é real; o que pagamos
(complexidade, observabilidade, tratamento de falha, consistência eventual,
infraestrutura) também é. Para o tamanho atual da EasyFood, a conta não fecha ainda.
