# Frontend — Empório dos Animais

Next.js 14 + Tailwind CSS, PWA-ready. Mesma base serve cliente, backoffice e entregador.

## Estrutura

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.js       Layout raiz + metadata PWA
│   │   ├── page.js         Landing institucional (3 áreas)
│   │   ├── loja/           App do cliente (PWA mobile)
│   │   ├── admin/          Backoffice (Kanban de pedidos)
│   │   └── entregador/     Painel do entregador (PWA mobile)
│   ├── lib/
│   │   ├── api.js          Cliente HTTP do backend
│   │   └── cn.js           classnames helper
│   └── styles/
│       └── globals.css     Tailwind + fontes
├── public/
│   └── manifest.json       PWA manifest
├── tailwind.config.js      Paleta Negrão Consultoria
├── next.config.js
└── package.json
```

## Rodar localmente

```bash
npm install
cp .env.example .env.local
# Editar NEXT_PUBLIC_API_URL conforme onde o backend está rodando
npm run dev
```

Acesse: http://localhost:3000

## Subir no Railway

1. Suba o frontend para o GitHub (pode ser o mesmo repo do backend, em pasta separada — Railway permite múltiplos serviços por repo)
2. No Railway, **New Service** → **GitHub Repo** → selecione e aponte para a pasta `frontend/`
3. Configure as variáveis:
   - `NEXT_PUBLIC_API_URL` — URL pública do backend Railway (algo como `https://emporio-backend.up.railway.app`)
4. Generate Domain
5. Pronto

## Paleta visual (Negrão Consultoria)

Definida em `tailwind.config.js` e disponível via classes Tailwind:

- `negrao-verde-escuro` (#1F3A2E) — fundo de headers, CTAs principais
- `negrao-dourado` (#B8935A) — destaques, selos, links
- `negrao-off-white` (#F4F1EA) — fundo principal
- `negrao-grafite` (#2B2B2B) — texto corpo

Fontes:
- `font-serif` → Playfair Display (títulos)
- `font-sans` → Inter (corpo)

## Próximas evoluções

Esta versão entrega:
- ✅ Layout, paleta visual, fontes
- ✅ Landing institucional
- ✅ Esqueleto das 3 áreas (loja, admin, entregador)
- ✅ Cliente HTTP do backend
- ✅ Kanban de pedidos no admin

Pendente (cada uma é uma sprint própria):
- Telas internas de cada área (login, catálogo, carrinho, checkout, etc.)
- Estados de carregamento, erro, vazio em todos os fetches
- Cache de catálogo no client (Tanstack Query recomendado)
- Service worker para PWA real
- Drag-and-drop no Kanban
- Detalhe de pedido em modal
- Captura de foto no painel do entregador
