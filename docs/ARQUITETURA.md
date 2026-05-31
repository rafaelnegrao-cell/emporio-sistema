# Arquitetura do Sistema — Empório dos Animais

> **Versão:** 0.1 (pré-reunião)
> **Cliente:** Empório dos Animais
> **Consultoria:** Negrão — Diagnóstico & Soluções Empresariais
> **Premissa de escopo:** Trilha B / Híbrida — entrega em 3 fases

---

## 1. Visão geral do sistema

Sistema que conecta três frentes operacionais do Empório dos Animais:

1. **Backoffice (interno)** — operadores das lojas capturam, separam, despacham e acompanham pedidos. Resolve as dores atuais (atrasos, erros, falta de visibilidade).
2. **App do cliente (B2C)** — catálogo, carrinho, checkout, acompanhamento, programa de fidelidade. Migra progressivamente o pedido do WhatsApp para o app.
3. **Painel do entregador** — recebe rotas, confirma entregas, atualiza status. Substitui ligações e mensagens improvisadas.

Tudo opera sobre uma **base de dados única**, com integração com o **ERP HD TEC** existente (a definir formato — API ou importação periódica).

```
┌─────────────────────────────────────────────────────────────┐
│                     ERP HD TEC (existente)                  │
│            Cadastros, estoque, vendas, fiscal              │
└───────────────────┬─────────────────────────────────────────┘
                    │ Integração (a definir formato)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Node.js + Express)                │
│        API REST · Autenticação · Regras de negócio         │
│              Banco PostgreSQL via Prisma ORM               │
└───┬──────────────────┬──────────────────┬──────────────────┘
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│ App B2C │    │  Backoffice  │    │  Entregador  │
│  (PWA)  │    │   (Web)      │    │    (PWA)     │
│         │    │              │    │              │
│ Cliente │    │   Operador   │    │   Motoboy    │
└─────────┘    └──────────────┘    └──────────────┘
```

---

## 2. Stack escolhido

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Backend** | Node.js 20 + Express 4 | Consistência com Sistemapn e Abastecimento. Você já domina. |
| **Banco de dados** | PostgreSQL 15 | Padrão do mercado. Railway hospeda nativamente. Suporta transações fortes (crítico para pedidos/pagamentos). |
| **ORM** | Prisma | Schema declarativo, migrations automáticas, tipo-seguro. Reduz bugs no banco. |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS | PWA-ready out of the box. Mesma base serve cliente, backoffice e entregador. Excelente DX. |
| **UI components** | shadcn/ui + Lucide icons | Acessível, customizável, sem dependência pesada. |
| **Autenticação** | JWT + bcrypt (próprio) | Controle total sobre fluxo. Sem dependência de provider externo. |
| **Storage** | Railway Volumes (curto prazo) → S3-compatible (longo prazo) | Para fotos de produtos e comprovantes. |
| **Pagamentos** | Mercado Pago (recomendado) ou Pagar.me | Pix nativo, cartão, parcelamento. Webhooks para confirmação automática. |
| **Hospedagem** | Railway | Você já usa. Backend + DB + Frontend num único projeto. |
| **Monitoramento** | Logs estruturados (pino) + Railway metrics | Suficiente para começar. |

---

## 3. Modelo de dados — visão geral

O modelo tem **5 grupos de entidades**:

**Grupo 1 — Estrutura organizacional**
- `Loja` — as 3 lojas do escopo + flag para futuras
- `Usuario` — operadores do backoffice e entregadores
- `Permissao` — controle de acesso por papel

**Grupo 2 — Catálogo**
- `Categoria` — ração, medicamento, brinquedo, etc.
- `Produto` — SKU, descrição, preço base, peso
- `EstoqueLoja` — quantidade do produto por loja
- `PrecoLoja` — preços podem variar por loja (opcional)

**Grupo 3 — Cliente final (B2C)**
- `Cliente` — pessoa que compra (CPF, contato, dados)
- `Pet` — animais do cliente (ração certa, idade, peso)
- `Endereco` — múltiplos endereços por cliente
- `ZonaEntrega` — qual loja atende qual CEP/bairro + taxa de frete + prazo

**Grupo 4 — Operação de pedido**
- `Pedido` — cabeçalho do pedido (cliente, loja, status, valores)
- `ItemPedido` — linhas do pedido (produto, qtd, preço)
- `StatusPedido` — histórico de mudanças de status
- `Entrega` — rota, entregador, comprovante
- `Pagamento` — Pix, cartão, dinheiro, status

**Grupo 5 — Engajamento (Fase 3)**
- `ProgramaFidelidade` — pontos do cliente
- `Cupom` — códigos promocionais
- `Recompra` — agendamento automático de compras recorrentes
- `AvaliacaoNPS` — pesquisa pós-entrega

📄 **Diagrama completo e schema Prisma:** ver `docs/modelo-dados.md` e `backend/prisma/schema.prisma`

---

## 4. Mapa de telas

### 4.1 App do Cliente (B2C — PWA)

| Tela | Rota | Função |
|---|---|---|
| Boas-vindas | `/` | Login / cadastro |
| Login | `/login` | E-mail + senha ou WhatsApp + código |
| Cadastro | `/cadastro` | Dados do cliente + primeiro pet |
| Home | `/home` | Última compra, recompra rápida, destaques |
| Catálogo | `/catalogo` | Produtos por categoria, filtros, busca |
| Produto | `/produto/[id]` | Detalhes, fotos, adicionar ao carrinho |
| Carrinho | `/carrinho` | Revisar itens, calcular frete |
| Checkout | `/checkout` | Endereço, pagamento, confirmação |
| Pedido | `/pedido/[id]` | Status, rastreio, contato com loja |
| Meus pedidos | `/pedidos` | Histórico |
| Meus pets | `/pets` | Adicionar/editar pets |
| Meu perfil | `/perfil` | Dados, endereços, preferências |

### 4.2 Backoffice (operação interna)

| Tela | Rota | Função |
|---|---|---|
| Login operador | `/admin/login` | |
| Dashboard | `/admin` | Pedidos do dia, alertas, indicadores |
| Pedidos | `/admin/pedidos` | Fila de pedidos por status (Kanban) |
| Pedido detalhe | `/admin/pedidos/[id]` | Aceitar, separar, despachar, problemas |
| Produtos | `/admin/produtos` | Catálogo, estoque, preços |
| Clientes | `/admin/clientes` | Base de clientes, histórico |
| Entregadores | `/admin/entregadores` | Frota, escalas, desempenho |
| Zonas de entrega | `/admin/zonas` | CEP × loja × taxa × prazo |
| Relatórios | `/admin/relatorios` | Vendas, custos, NPS, indicadores |
| Configurações | `/admin/config` | Horários, taxas, regras |

### 4.3 Painel do Entregador (PWA)

| Tela | Rota | Função |
|---|---|---|
| Login entregador | `/entregador/login` | |
| Minha rota | `/entregador` | Lista de entregas do dia |
| Entrega ativa | `/entregador/entrega/[id]` | Endereço, mapa, contato cliente, confirmar |
| Histórico | `/entregador/historico` | Entregas anteriores |
| Pendências | `/entregador/pendencias` | Devoluções, problemas |

📄 **Fluxos detalhados:** ver `docs/mapa-telas.md`

---

## 5. Fases de implementação

### Fase 1 — MVP de Operação (foco: dores atuais)
**Backend:**
- Modelo de dados completo (todas as tabelas, mesmo as da Fase 3, criadas vazias)
- Autenticação e papéis (operador, entregador, admin)
- CRUD de produtos, clientes, pedidos, zonas de entrega
- Cálculo de frete por CEP
- Status de pedido (recebido → separando → pronto → em rota → entregue)
- Integração inicial com HD TEC (a definir)

**Frontend:**
- Backoffice completo (Kanban de pedidos, cadastros, dashboard)
- Painel do entregador (rota do dia + confirmar entrega)
- App cliente **mínimo:** acompanhamento de pedido via link (sem catálogo ainda)

**Resultado:** equipe usa o sistema internamente. Cliente recebe link de acompanhamento por WhatsApp. Resolve atrasos e erros de separação.

### Fase 2 — App B2C de Pedidos
**Backend:**
- Endpoints públicos do catálogo
- Carrinho persistente
- Pagamento online (Mercado Pago)
- Notificações push (FCM)

**Frontend:**
- App cliente completo: catálogo, carrinho, checkout, histórico, pets
- Login do cliente (e-mail/senha + WhatsApp)
- PWA instalável

**Resultado:** pedido começa a migrar do WhatsApp para o app.

### Fase 3 — Plataforma Completa
**Backend:**
- Programa de fidelidade (pontos)
- Cupons e promoções
- Recompra automática (cron + e-mail/push)
- Avaliação NPS
- Dashboard analítico avançado

**Frontend:**
- Telas de fidelidade, cupons, recompras programadas
- Dashboard executivo

**Resultado:** plataforma de e-commerce competitiva com Cobasi/Petz/Petlove.

---

## 6. O que este esqueleto entrega hoje

✅ **Banco de dados:** todas as tabelas criadas (Fases 1, 2, 3)
✅ **Backend:** estrutura rodando, autenticação funcional, rotas de exemplo
✅ **Frontend:** layout do app + 3-4 telas de exemplo com padrão visual
✅ **Painel admin:** dashboard básico para você visualizar dados
✅ **Seeds:** dados de teste (lojas, produtos, clientes fictícios)
✅ **Docs:** schema completo, fluxos, decisões técnicas

🚧 **Não entrega ainda (depende de decisões da reunião + meses de dev):**
- Catálogo completo com fotos e busca
- Carrinho e checkout funcionando ponta a ponta
- Pagamento online integrado
- Notificações push
- Integração real com HD TEC
- Programa de fidelidade

---

## 7. Próximos passos sugeridos

1. **Subir o esqueleto no Railway** — seguir o `DEPLOY.md` na raiz
2. **Validar com Bruno na reunião** — confirmar modelo de dados + fluxos
3. **Receber arquivos de referência** — cadastro de produtos, clientes, frete do HD TEC
4. **Decidir integração HD TEC** — API? Importação CSV diária? Webhook?
5. **Priorizar 3 telas da Fase 1** para começar — sugestão: Kanban de pedidos, Cadastro de produto, Painel do entregador
