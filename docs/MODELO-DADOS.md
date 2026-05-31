# Modelo de Dados — Empório dos Animais

> Detalhamento de cada tabela do banco. O schema técnico fica em `backend/prisma/schema.prisma`.

---

## Convenções

- Todas as tabelas têm `id` (BigInt autoincremental), `criadoEm`, `atualizadoEm`
- Soft delete via `deletadoEm` em tabelas onde apaga histórico
- Enums para status — evita strings soltas no banco
- Decimais com 2 casas para dinheiro (`Decimal(12, 2)`)
- Timestamps em UTC; conversão na camada de apresentação

---

## Grupo 1 — Estrutura organizacional

### `Loja`
Representa cada unidade física do Empório dos Animais.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `codigo` | String único | Ex: "MARINGA", "HIGIENOPOLIS", "CAMBE" |
| `nome` | String | "Av. Maringá" |
| `endereco` | String | Endereço físico |
| `telefone` | String | |
| `cnpj` | String? | |
| `ativa` | Boolean | Permite ativar/desativar sem deletar |
| `noEscopoDelivery` | Boolean | True para Maringá/Higienópolis/Cambé; false para Garcia Cid/Churchill |
| `latitude` | Decimal? | Para cálculo de distância |
| `longitude` | Decimal? | |

**Por que esses campos:** distinção entre lojas no escopo e fora permite que o sistema **veja todas as lojas** mas só **opere as 3 escolhidas** — flexibilidade para incluir Garcia Cid e Churchill no futuro sem migração.

### `Usuario`
Operadores do backoffice, entregadores, admins. **Não confundir com `Cliente`** (que é o consumidor final).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `nome` | String | |
| `email` | String único | |
| `senhaHash` | String | bcrypt |
| `papel` | Enum | `ADMIN`, `OPERADOR`, `ENTREGADOR` |
| `lojaId` | FK Loja? | Operadores são vinculados a uma loja; admins não |
| `telefone` | String? | |
| `ativo` | Boolean | |
| `ultimoLogin` | DateTime? | |

---

## Grupo 2 — Catálogo

### `Categoria`
Organização do catálogo. Hierárquica (categoria pode ter pai).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `nome` | String | "Ração", "Ração Cães", "Ração Cães Adulto" |
| `slug` | String único | "racao-caes-adulto" |
| `categoriaPaiId` | FK? | Auto-relacionamento |
| `ordem` | Int | Para ordenar no catálogo |
| `ativa` | Boolean | |
| `iconeUrl` | String? | Ícone para o app |

### `Produto`
Item vendido. Inspirado no padrão do HD TEC mas independente.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `sku` | String único | Código interno (compatível com HD TEC) |
| `codigoBarras` | String? | EAN para leitura de código de barras |
| `nome` | String | "Ração Premier Cão Adulto 15kg" |
| `descricao` | Text? | Descrição longa |
| `categoriaId` | FK Categoria | |
| `marca` | String? | "Premier" |
| `precoBase` | Decimal | Preço de tabela |
| `pesoKg` | Decimal? | Peso para cálculo de frete |
| `dimensoes` | JSON? | `{altura, largura, profundidade}` em cm |
| `controlado` | Boolean | True para medicamentos controlados (regra fiscal) |
| `precisaReceita` | Boolean | True para medicamentos veterinários com receita |
| `categoriaPet` | Enum? | `CAO`, `GATO`, `AVE`, `PEIXE`, `ROEDOR`, `OUTRO`, `MULTI` |
| `idadePet` | Enum? | `FILHOTE`, `ADULTO`, `SENIOR`, `TODAS` |
| `portePet` | Enum? | `MINI`, `PEQUENO`, `MEDIO`, `GRANDE`, `GIGANTE`, `TODOS` |
| `ativo` | Boolean | |
| `idHdTec` | String? | Referência para o ERP — usado na integração |

**Por que campos de pet (categoriaPet, idadePet, portePet):** permite filtros poderosíssimos no app ("ração para gato sênior"), recomendação cruzada por pet, e personalização do catálogo por cliente.

### `ProdutoFoto`
Múltiplas fotos por produto.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `produtoId` | FK Produto | |
| `url` | String | URL da imagem (Railway Volume ou S3) |
| `ordem` | Int | Para galeria |
| `principal` | Boolean | Foto principal do produto |

### `EstoqueLoja`
Quantidade do produto em cada loja.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `produtoId` | FK Produto | |
| `lojaId` | FK Loja | |
| `quantidade` | Int | |
| `quantidadeReservada` | Int | Reservada por pedidos em separação |
| `quantidadeMinima` | Int | Para alerta de ruptura |
| `atualizadoEm` | DateTime | Última sincronização com HD TEC |

**Constraint:** UNIQUE (produtoId, lojaId)

**Cálculo de disponibilidade:** `quantidade - quantidadeReservada >= quantidade do pedido`

### `PrecoLoja` (opcional, para Fase 2+)
Permite preços diferentes por loja. Se não houver registro, usa `Produto.precoBase`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `produtoId` | FK Produto | |
| `lojaId` | FK Loja | |
| `preco` | Decimal | |
| `precoPromocional` | Decimal? | |
| `inicioPromocao` | DateTime? | |
| `fimPromocao` | DateTime? | |

---

## Grupo 3 — Cliente final (B2C)

### `Cliente`
Pessoa física que compra. **Distinto de Usuario.**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `nome` | String | |
| `cpf` | String único? | Nullable porque cadastro pode começar só com WhatsApp |
| `email` | String único? | |
| `senhaHash` | String? | Nullable se autenticação só por WhatsApp |
| `whatsapp` | String único | Identificador principal — pet shop usa muito WhatsApp |
| `dataNascimento` | Date? | |
| `optInMarketing` | Boolean | LGPD: consentimento explícito |
| `criadoEm` | DateTime | |
| `lojaPreferida` | FK Loja? | Para roteirização e relacionamento |

**Decisão importante:** WhatsApp é único e identificador principal porque é o canal real de captura. CPF e e-mail vêm depois.

### `Pet`
Animal de estimação do cliente. **Diferencial competitivo do app.**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `clienteId` | FK Cliente | |
| `nome` | String | "Thor", "Mel" |
| `especie` | Enum | `CAO`, `GATO`, `AVE`, `PEIXE`, `ROEDOR`, `OUTRO` |
| `raca` | String? | |
| `porte` | Enum? | `MINI`, `PEQUENO`, `MEDIO`, `GRANDE`, `GIGANTE` |
| `dataNascimento` | Date? | Para sugerir ração por idade |
| `pesoKg` | Decimal? | Para dose de medicamento |
| `castrado` | Boolean? | |
| `observacoes` | Text? | Alergias, condições de saúde |
| `fotoUrl` | String? | |

**Por que tantos campos opcionais:** começa simples (só nome + espécie) e enriquece à medida que o cliente engaja com o app.

### `Endereco`
Cliente pode ter vários (casa, trabalho, casa de praia).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `clienteId` | FK Cliente | |
| `apelido` | String | "Casa", "Trabalho" |
| `cep` | String | |
| `logradouro` | String | |
| `numero` | String | |
| `complemento` | String? | |
| `bairro` | String | |
| `cidade` | String | |
| `uf` | String | |
| `pontoReferencia` | String? | |
| `latitude` | Decimal? | Geocoding via API externa |
| `longitude` | Decimal? | |
| `principal` | Boolean | Endereço padrão |

### `ZonaEntrega`
**Tabela crítica para o cálculo de frete e atendimento.**

Define qual loja atende qual região, com qual taxa e qual prazo.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `lojaId` | FK Loja | Qual loja atende esta zona |
| `nome` | String | "Centro de Londrina", "Cambé Centro" |
| `bairros` | String[] | Array de bairros atendidos |
| `cepInicio` | String? | Alternativa: faixa de CEP |
| `cepFim` | String? | |
| `taxaFrete` | Decimal | Taxa padrão |
| `taxaFreteAcimaDe` | Decimal? | Taxa diferente acima de X reais |
| `valorFreteGratis` | Decimal? | Frete grátis acima de Y reais |
| `prazoMinHoras` | Int | Prazo mínimo de entrega |
| `prazoMaxHoras` | Int | Prazo máximo |
| `ativa` | Boolean | |
| `prioridade` | Int | Em caso de sobreposição entre lojas, qual atende? |

**Decisão importante:** o campo `prioridade` resolve o problema identificado no briefing — "sobreposição entre lojas". Quando duas lojas atendem o mesmo bairro, a de maior prioridade pega o pedido.

---

## Grupo 4 — Operação de pedido

### `Pedido`
Cabeçalho do pedido. Tabela central do sistema.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `numero` | String único | Número amigável: "PED-2026-0001" |
| `clienteId` | FK Cliente | |
| `lojaId` | FK Loja | Loja que vai despachar |
| `enderecoEntregaId` | FK Endereco | Snapshot — endereço pode mudar depois |
| `status` | Enum | Ver `StatusPedidoEnum` abaixo |
| `canalOrigem` | Enum | `APP`, `WHATSAPP`, `TELEFONE`, `BALCAO`, `IFOOD`, `RAPPI`, `OUTRO` |
| `subtotal` | Decimal | Soma dos itens |
| `valorFrete` | Decimal | |
| `valorDesconto` | Decimal | |
| `valorTotal` | Decimal | subtotal + frete - desconto |
| `cupomId` | FK Cupom? | |
| `observacoesCliente` | Text? | "Troco para R$ 100" |
| `observacoesInternas` | Text? | "Cliente VIP, prioridade" |
| `pedidoEm` | DateTime | Hora exata do pedido |
| `previsaoEntrega` | DateTime? | |
| `entregueEm` | DateTime? | |

**Enum `StatusPedido`:**
1. `RASCUNHO` — carrinho ainda não finalizado
2. `RECEBIDO` — confirmado pelo cliente, aguardando loja
3. `ACEITO` — loja aceitou
4. `EM_SEPARACAO` — separando os itens
5. `SEPARADO` — pronto para sair
6. `EM_ROTA` — entregador a caminho
7. `ENTREGUE` — concluído
8. `CANCELADO_CLIENTE` — cliente desistiu
9. `CANCELADO_LOJA` — loja cancelou (ruptura, etc.)
10. `DEVOLVIDO` — entregue mas devolvido

### `ItemPedido`
Linhas do pedido.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `pedidoId` | FK Pedido | |
| `produtoId` | FK Produto | |
| `quantidade` | Int | |
| `precoUnitario` | Decimal | Snapshot — preço no momento do pedido |
| `precoTotal` | Decimal | preco * quantidade |
| `observacao` | String? | Específica do item |

### `StatusPedidoHistorico`
Auditoria de todas as mudanças de status — ouro para análise.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `pedidoId` | FK Pedido | |
| `statusAnterior` | Enum | |
| `statusNovo` | Enum | |
| `usuarioId` | FK Usuario? | Quem mudou |
| `motivo` | String? | Especialmente útil em cancelamentos |
| `criadoEm` | DateTime | |

### `Entrega`
Vinculada ao pedido quando vai para rota.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `pedidoId` | FK Pedido único | 1-para-1 |
| `entregadorId` | FK Usuario | |
| `saidaEm` | DateTime? | |
| `entregueEm` | DateTime? | |
| `tentativasEntrega` | Int | Contagem de tentativas |
| `latitudeEntrega` | Decimal? | Onde foi entregue (geo do app do entregador) |
| `longitudeEntrega` | Decimal? | |
| `fotoComprovanteUrl` | String? | Foto da entrega |
| `assinaturaUrl` | String? | Assinatura digital |
| `observacao` | Text? | "Entregue ao porteiro João" |

### `Pagamento`
Pode ter múltiplos por pedido (parcial em Pix + cartão).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `pedidoId` | FK Pedido | |
| `metodo` | Enum | `PIX`, `CARTAO_CREDITO`, `CARTAO_DEBITO`, `DINHEIRO`, `MAQUININHA` |
| `valor` | Decimal | |
| `status` | Enum | `PENDENTE`, `APROVADO`, `RECUSADO`, `ESTORNADO` |
| `gatewayTransacaoId` | String? | ID no Mercado Pago / Pagar.me |
| `gatewayResposta` | JSON? | Resposta completa do gateway |
| `pagoEm` | DateTime? | |

---

## Grupo 5 — Engajamento (Fase 3, criado mas vazio)

### `Cupom`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `codigo` | String único | "PRIMEIRACOMPRA10" |
| `tipo` | Enum | `PERCENTUAL`, `VALOR_FIXO`, `FRETE_GRATIS` |
| `valor` | Decimal? | 10 (= 10% ou R$ 10) |
| `valorMinimoCompra` | Decimal? | |
| `validoAte` | DateTime | |
| `usosMaximos` | Int? | |
| `usosAtuais` | Int | |
| `ativo` | Boolean | |

### `ProgramaFidelidade`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `clienteId` | FK Cliente único | |
| `pontosAcumulados` | Int | |
| `pontosResgatados` | Int | |
| `pontosSaldo` | Int | calculado |
| `nivel` | Enum | `BRONZE`, `PRATA`, `OURO`, `DIAMANTE` |

### `Recompra`
Agenda de recompras automáticas (ração mensal, areia quinzenal).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `clienteId` | FK Cliente | |
| `produtoId` | FK Produto | |
| `quantidade` | Int | |
| `frequenciaDias` | Int | A cada N dias |
| `proximaCompra` | Date | |
| `ativa` | Boolean | |

### `AvaliacaoNPS`
3 perguntas pós-entrega.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | BigInt PK | |
| `pedidoId` | FK Pedido único | |
| `notaGeral` | Int | 0-10 (NPS clássico) |
| `notaEntregador` | Int? | |
| `notaProduto` | Int? | |
| `comentario` | Text? | |
| `respondidoEm` | DateTime | |

---

## Decisões de modelagem que importam

**1. Snapshots em vez de FK pura para dados que mudam**
O `ItemPedido.precoUnitario` é cópia, não FK para `Produto.precoBase`. Se o preço do produto mudar amanhã, o pedido antigo mantém o valor original. Mesma lógica para endereço de entrega.

**2. Soft delete onde apaga histórico**
Cliente, Pedido, Produto NUNCA são apagados de verdade (compliance fiscal + análise histórica). Usar `deletadoEm`.

**3. Auditoria via histórico, não via campo único**
`StatusPedidoHistorico` em vez de só `Pedido.status` — permite responder "quanto tempo o pedido X ficou em separação?" para otimizar processos.

**4. Cliente identificado por WhatsApp**
CPF e e-mail são opcionais. Espelha a realidade do pet shop hoje (WhatsApp é o canal real).

**5. Tabelas da Fase 3 já criadas (vazias)**
Migrations futuras são caras. Criar a estrutura toda agora — mesmo sem usar — evita dor depois.
