# Backend — Empório dos Animais

API REST do sistema. Node.js + Express + Prisma + PostgreSQL.

## Estrutura

```
backend/
├── prisma/
│   ├── schema.prisma       Modelo de dados completo
│   └── seed.js             Dados de teste das 3 lojas
├── src/
│   ├── server.js           Servidor Express
│   ├── lib/
│   │   ├── prisma.js       Cliente Prisma singleton
│   │   └── logger.js       Logger estruturado
│   ├── middlewares/
│   │   └── auth.js         JWT + controle de papel
│   ├── routes/
│   │   ├── auth.js         Login/cadastro
│   │   ├── lojas.js        CRUD de lojas
│   │   ├── produtos.js     Catálogo + busca
│   │   ├── clientes.js     Clientes, pets, endereços
│   │   ├── pedidos.js      Kanban, criação, mudança de status
│   │   ├── zonas-entrega.js
│   │   ├── frete.js        Cotação pública
│   │   └── health.js       Health check
│   ├── services/
│   │   └── frete.js        Lógica de cálculo de frete
│   └── utils/
│       ├── async-handler.js
│       └── serializar.js   BigInt → string nas respostas
├── .env.example            Variáveis de ambiente
├── railway.json            Configuração Railway
└── package.json
```

## Rodar localmente

### 1. Pré-requisitos
- Node.js 20+
- PostgreSQL local (ou use Docker)

### 2. Instalar
```bash
npm install
```

### 3. Configurar .env
```bash
cp .env.example .env
# Editar .env com a URL do seu Postgres local
```

### 4. Criar tabelas e popular com dados de teste
```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Rodar
```bash
npm run dev
```

Acesse: http://localhost:3001

### Comandos úteis

```bash
npm run db:studio       # Abre o Prisma Studio (interface visual do banco)
npm run db:seed         # Repopula com dados de teste
npx prisma migrate dev  # Cria nova migration depois de mudar o schema
```

## Subir no Railway

### Passo a passo

1. Suba o repositório para o GitHub
2. No Railway, crie um **New Project** → **Deploy from GitHub repo**
3. Selecione este repositório
4. Aguarde o deploy automático (Railway detecta Node.js)
5. **Adicione o plugin PostgreSQL:**
   - Botão "+ New" → "Database" → "Add PostgreSQL"
   - O Railway define `DATABASE_URL` automaticamente
6. **Adicione as outras variáveis** em Settings → Variables:
   - `JWT_SECRET` (gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `CORS_ORIGIN` (URL do frontend)
   - `NODE_ENV=production`
7. **Gere o domínio:** Settings → Networking → Generate Domain
8. **Rode o seed** (uma vez, manualmente):
   - Settings → abrir terminal do serviço
   - Rodar: `npm run db:seed`

## Endpoints principais

### Autenticação
- `POST /api/auth/operador/login` — login do backoffice
- `POST /api/auth/cliente/login` — login do app cliente
- `POST /api/auth/cliente/cadastro` — cadastro de cliente

### Catálogo
- `GET /api/produtos?q=racao&categoriaPet=CAO` — listar/buscar
- `GET /api/produtos/:id` — detalhe
- `POST /api/produtos` — criar (admin)

### Pedidos
- `GET /api/pedidos/kanban` — visão Kanban (backoffice)
- `GET /api/pedidos` — listar
- `POST /api/pedidos` — criar pedido
- `PATCH /api/pedidos/:id/status` — mudar status

### Frete
- `POST /api/frete/cotar` — cotação pública (chamada pelo app antes do checkout)

### Lojas e zonas
- `GET /api/lojas?escopo=delivery` — lojas no escopo
- `GET /api/zonas-entrega` — zonas cadastradas

## Credenciais de teste (após seed)

| Papel | E-mail | Senha |
|---|---|---|
| Admin | `rafael@negraoconsultoria.com.br` | `emporio123` |
| Admin (cliente) | `bruno@emporiodosanimais.com.br` | `emporio123` |
| Operador Maringá | `op.maringa@emporio.com.br` | `emporio123` |
| Entregador | `joao@emporio.com.br` | `emporio123` |
| Cliente | WhatsApp `43999991111` | `cliente123` |
