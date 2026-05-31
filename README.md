# Sistema de Delivery — Empório dos Animais

> Esqueleto v0.1 · Negrão — Diagnóstico & Soluções Empresariais

Sistema integrado de gestão de delivery para a rede Empório dos Animais (3 lojas no escopo inicial: Av. Maringá, Av. Higienópolis, Cambé).

## O que é este pacote

Esta é a **base fundacional** sobre a qual o sistema será construído mês a mês. Não é um produto final pronto para uso — é o **alicerce profissional** que evita meses de retrabalho.

**Inclui:**
- Documentação completa (arquitetura + modelo de dados)
- Backend Node.js + Express + Prisma + PostgreSQL rodando
- Frontend Next.js 14 + Tailwind com 3 áreas (cliente, backoffice, entregador)
- Seed com dados de teste das 3 lojas
- Configuração pronta para deploy no Railway

**Não inclui (ainda):**
- Catálogo completo com fotos reais
- Carrinho e checkout ponta a ponta
- Integração com Mercado Pago
- Integração real com ERP HD TEC
- Programa de fidelidade
- App mobile nativo (vem na próxima fase, conforme combinado)

## Estrutura

```
emporio-sistema/
├── docs/
│   ├── ARQUITETURA.md           Visão completa do sistema, stack, fases
│   └── MODELO-DADOS.md          Detalhamento de cada tabela
├── backend/
│   ├── prisma/                  Schema + seed
│   ├── src/                     Servidor Express + rotas
│   ├── README.md                Como rodar e fazer deploy
│   └── package.json
├── frontend/
│   ├── src/                     Next.js App Router
│   ├── README.md                Como rodar e fazer deploy
│   └── package.json
└── DEPLOY.md                    Passo a passo Railway (backend + frontend + banco)
```

## Como começar

### 1. Ler a documentação
Comece por:
1. `docs/ARQUITETURA.md` — entender o todo
2. `docs/MODELO-DADOS.md` — entender as tabelas
3. `backend/README.md` — rodar o backend local
4. `frontend/README.md` — rodar o frontend local

### 2. Subir no Railway
Ver `DEPLOY.md` na raiz — passo a passo para deploy completo (banco + backend + frontend).

### 3. Validar com o cliente
Antes de implementar mais funcionalidades:
- Validar modelo de dados com Bruno
- Confirmar trilha (A interno × B híbrido × C completo)
- Receber arquivos de referência (cadastro de produtos do HD TEC, etc.)
- Definir integração com HD TEC (API? import diário?)

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 20 + Express 4 |
| Banco | PostgreSQL 15 (via Prisma ORM) |
| Frontend | Next.js 14 (App Router) + Tailwind |
| Hospedagem | Railway |
| Autenticação | JWT + bcrypt |
| Validação | Zod |
| Logs | pino |

## Padrão visual

Sistema usa a identidade da **Negrão Consultoria** durante a fase inicial — porque o esqueleto é apresentado como entregável de consultoria. Quando entrar em produção para o Empório, basta trocar a paleta no `tailwind.config.js` para usar a marca do cliente final.

Paleta atual:
- Verde escuro `#1F3A2E`
- Dourado `#B8935A`
- Off-white `#F4F1EA`
- Fontes: Playfair Display + Inter

## Credenciais de teste (após seed)

| Papel | Login | Senha |
|---|---|---|
| Admin (você) | `rafael@negraoconsultoria.com.br` | `emporio123` |
| Admin (Bruno) | `bruno@emporiodosanimais.com.br` | `emporio123` |
| Operador Maringá | `op.maringa@emporio.com.br` | `emporio123` |
| Entregador | `joao@emporio.com.br` | `emporio123` |
| Cliente | WhatsApp `43999991111` | `cliente123` |

## Próximos passos recomendados

1. **Subir no Railway** seguindo `DEPLOY.md`
2. **Apresentar ao Bruno** uma demonstração funcional (login, dashboard, kanban)
3. **Coletar feedback** sobre o modelo de dados — especialmente nomenclatura de status, campos do produto, regras de frete
4. **Priorizar 3 telas** para a próxima sprint (sugestão: detalhe do pedido, cadastro de produto, painel do entregador real)
5. **Decidir integração HD TEC** — esse é o maior risco técnico do projeto

## Suporte

Construído por Negrão Consultoria. Dúvidas técnicas sobre o esqueleto: comigo, Rafael.
