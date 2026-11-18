# Festeja Aki 🎉

Sistema web de reservas e gestão para o **Festeja Aki**, um salão de festas real administrado pela minha família. O sistema substituiu o controle manual (Google Agenda + WhatsApp) por um fluxo digital: o cliente escolhe a data pelo site, o proprietário recebe a notificação no celular, confirma a reserva e acompanha pagamentos, limpeza e faturamento em um painel próprio.

🔗 **Produção:** [projeto-festeja-aki.vercel.app](https://projeto-festeja-aki.vercel.app)

<!-- TODO: adicionar 2–4 prints (landing, calendário, painel, página de acompanhamento) em /docs/screenshots e referenciar aqui -->

---

## Sumário

- [Contexto](#contexto)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Modelo de dados](#modelo-de-dados)
- [Regras de negócio](#regras-de-negócio)
- [Decisões técnicas](#decisões-técnicas)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Deploy](#deploy)
- [Próximos passos](#próximos-passos)
- [Autor](#autor)

---

## Contexto

O salão funciona apenas aos fins de semana e era gerenciado por agenda e mensagens de WhatsApp. Os problemas mais comuns eram datas reservadas em duplicidade, falta de controle sobre o pagamento do sinal e nenhuma visão consolidada do faturamento.

O objetivo do projeto foi resolver esses problemas para o negócio real e, ao mesmo tempo, praticar desenvolvimento full stack de ponta a ponta: front-end, APIs, banco de dados, autenticação, PWA e deploy.

---

## Funcionalidades

### Área pública (cliente)
- Landing page com apresentação do espaço
- Calendário de disponibilidade em pt-BR, que libera apenas sábados e domingos futuros e livres
- Formulário de reserva com validação de nome, WhatsApp e e-mail
- **Página de acompanhamento da reserva** (`/reserva/<código>`), onde o cliente consulta o status do pedido sem precisar de login

### Área administrativa (proprietário)
- Acesso por **seleção de perfil no estilo Netflix**, com validação por PIN; o PIN é pedido só no primeiro acesso de cada aparelho
- Painel com a identidade visual do Festeja Aki
- Confirmação e cancelamento de reservas
- Registro e estorno manual do pagamento do sinal
- Atalhos de WhatsApp com mensagens prontas para o cliente
- **Indicadores:** faturamento e quantidade de datas reservadas no mês e no ano, entradas pagas e pendentes, próximas reservas
- **Checklist de limpeza** gerado a partir das reservas confirmadas, com lembretes
- **Notificações no celular** quando um cliente solicita uma data

### PWA
- Instalável no iPhone e no Android, para que o proprietário use o painel como um app
- A mesma camada de API está pronta para servir um futuro app nativo (Expo)

---

## Stack

| Camada | Tecnologias |
|---|---|
| Front-end | Next.js 16 (Pages Router), React, JavaScript, CSS Modules |
| Datas e calendário | React DayPicker, date-fns (pt-BR) |
| Back-end | Next.js API Routes, Node.js |
| Banco de dados | Firebase Firestore (via Firebase Admin SDK) |
| Autenticação | JWT em cookie HTTP-only |
| Infraestrutura | Vercel, Firebase, Git/GitHub |

<!-- TODO: se as notificações usam Web Push/VAPID, Firebase Cloud Messaging ou outra solução, incluir aqui -->

---

## Arquitetura

```text
┌──────────────────────────┐        ┌─────────────────────────────┐
│  Cliente (navegador)     │        │  Proprietário (PWA no celular)│
│  landing · calendário    │        │  perfis + PIN · painel        │
│  reserva · acompanhamento│        │  métricas · checklist         │
└────────────┬─────────────┘        └──────────────┬──────────────┘
             │  fetch (JSON)                        │  fetch + cookie JWT
             ▼                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes (Vercel)                   │
│  /api/reservas        → rotas públicas (sem dados pessoais)       │
│  /api/admin/*         → rotas protegidas por requireAdminCookie   │
│  /api/auth/*          → login, logout, sessão                      │
│  Validação e cálculo de valores feitos no servidor                 │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Firebase Admin SDK
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Firebase Firestore                        │
│        clientes  ·  reservas  ·  diasReservados (bloqueios)        │
└──────────────────────────────────────────────────────────────────┘
```

### Estrutura de pastas (principal)

```text
├── components/          # Componentes React reutilizáveis
├── lib/
│   ├── auth.js          # Emissão/validação de JWT e requireAdminCookie
│   └── firebaseAdmin.js # Inicialização do Admin SDK (getAdminDb)
├── pages/
│   ├── api/
│   │   ├── auth/        # login, logout, me
│   │   ├── admin/       # dashboard, metrics, reservas (protegidas)
│   │   └── reservas/    # criação e consulta públicas
│   ├── admin/           # telas do painel
│   ├── reserva/         # página de acompanhamento do cliente
│   ├── calendario.js
│   └── index.js
├── public/              # assets, manifest e ícones do PWA
└── styles/              # CSS Modules
```

<!-- TODO: conferir com a árvore real do repositório antes de publicar -->

---

## Modelo de dados

### `clientes`
```js
{ nome, whatsapp, email, createdAt, updatedAt }
```
O WhatsApp é normalizado e tratado como identificador único do cliente.

### `reservas`
```js
{
  customerId, dataReserva,          // "YYYY-MM-DD"
  horarioInicio: "09:30", horarioFim: "22:00",
  status: "PENDING" | "CONFIRMED" | "CANCELLED",
  valorEntrada, valorTotal,
  entradaPaga, entradaPagaEm,
  observacoes, createdAt, updatedAt
}
```

### `diasReservados`
O ID do documento é a própria data (`YYYY-MM-DD`). Ele guarda o `reservaId` dono do bloqueio.
```js
{ reservaId, dataReserva, createdAt }
```

---

## Regras de negócio

- Reservas **somente aos sábados e domingos**, nunca em datas passadas
- **Uma reserva ativa por data**; datas canceladas voltam a ficar disponíveis
- Período único de locação: **09h30 às 22h00**
- Valores: **R$ 750,00** no total, com **R$ 150,00** de sinal e **R$ 600,00** restantes
- Prazo de **24 horas** para pagar o sinal; depois disso, a data deve ser liberada
- Status: `PENDING` → `CONFIRMED` ou `CANCELLED`
- Para os indicadores, reserva confirmada conta como faturada
- **Limpeza:**
  - festa só no sábado → limpeza na sexta
  - festa só no domingo → limpeza no sábado
  - festa no sábado e no domingo → limpeza na sexta e outra no domingo de manhã

---

## Decisões técnicas

**MongoDB → Firestore.** O projeto começou com MongoDB/Mongoose e foi migrado por completo para o Firestore. Como o Firestore não tem índice único parcial, a regra "uma reserva ativa por data" passou a ser garantida pela coleção `diasReservados`. A reserva e o bloqueio da data são gravados na **mesma transação**, então duas pessoas que tentam reservar o mesmo dia ao mesmo tempo não geram duplicidade. No cancelamento, o bloqueio só é removido se pertencer àquela reserva.

**Servidor como fonte da verdade.** Valores financeiros, status e datas são validados e calculados nas API Routes. O front-end nunca define o preço da reserva.

**Rotas públicas sem dados pessoais.** O calendário recebe só as datas ocupadas, e a página de acompanhamento usa um código de reserva em vez de expor nome, WhatsApp ou e-mail.

**PWA antes do app nativo.** Para atender um iPhone e um Android sem publicar em lojas, o painel virou PWA. As APIs são as mesmas que um futuro app em Expo vai consumir.

**JWT em cookie HTTP-only.** A sessão administrativa fica fora do alcance de JavaScript no navegador, e uma única função (`requireAdminCookie`) protege todas as rotas do painel.

---

## Como rodar localmente

Pré-requisitos: **Node.js 20+** e um projeto no Firebase com Firestore ativado.

```powershell
# 1. Clonar o repositório
git clone https://github.com/FelipeSaito/<nome-do-repositorio>.git
cd <nome-do-repositorio>

# 2. Instalar as dependências
npm install

# 3. Criar o arquivo de variáveis de ambiente (veja a seção abaixo)
New-Item .env.local

# 4. Rodar em modo de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.

Build de produção:

```powershell
npm run build
npm start
```

---

## Variáveis de ambiente

Crie um `.env.local` na raiz (ele **não** deve ser versionado):

```env
# Administração
ADMIN_EMAIL=
ADMIN_PASSWORD=
JWT_SECRET=

# Firebase Admin SDK (conta de serviço)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

> `FIREBASE_PRIVATE_KEY` deve ficar entre aspas, com as quebras de linha como `\n`.

<!-- TODO: incluir as variáveis dos PINs de perfil e das notificações push, se existirem -->

---

## Deploy

O deploy é feito na **Vercel**, conectada ao repositório do GitHub. As mesmas variáveis do `.env.local` precisam ser cadastradas em *Project Settings → Environment Variables*.

---

## Próximos passos

- [ ] Integração com **Pix**: cobrança automática, confirmação por webhook autenticado e reserva efetivada só após o pagamento
- [ ] Liberação automática da data quando o sinal não é pago em 24h
- [ ] Estado "salão pronto" na página de acompanhamento, ligado ao checklist de limpeza
- [ ] Histórico de pagamentos e filtros por data e status no painel
- [ ] App nativo com Expo consumindo as mesmas APIs

---

## Autor

**Felipe Saito**, desenvolvedor front-end e pós-graduando em Front-End Engineering na FIAP

[LinkedIn](https://www.linkedin.com/in/felipeyukiosaito/) · [GitHub](https://github.com/FelipeSaito)
