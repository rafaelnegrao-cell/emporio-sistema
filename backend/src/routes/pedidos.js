// Pedidos — coração da operação
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');
const { calcularFrete } = require('../services/frete');

const router = express.Router();

// ============================================================
// KANBAN — lista pedidos agrupados por status para o backoffice
// ============================================================
router.get('/kanban', autenticar, exigirPapel('ADMIN', 'OPERADOR'), asyncHandler(async (req, res) => {
  const { lojaId } = req.query;

  // Operador só vê pedidos da própria loja
  const filtroLoja = req.usuario.papel === 'OPERADOR' && req.usuario.lojaId
    ? { lojaId: BigInt(req.usuario.lojaId) }
    : lojaId ? { lojaId: BigInt(lojaId) } : {};

  const statusAtivos = ['RECEBIDO', 'ACEITO', 'EM_SEPARACAO', 'SEPARADO', 'EM_ROTA'];

  const pedidos = await prisma.pedido.findMany({
    where: {
      ...filtroLoja,
      status: { in: statusAtivos },
      deletadoEm: null
    },
    include: {
      cliente: { select: { id: true, nome: true, whatsapp: true } },
      itens: { select: { quantidade: true } },
      enderecoEntrega: { select: { bairro: true, cidade: true } }
    },
    orderBy: { pedidoEm: 'asc' }
  });

  // Agrupa por status
  const kanban = {};
  for (const status of statusAtivos) {
    kanban[status] = [];
  }
  for (const p of pedidos) {
    kanban[p.status].push(p);
  }

  res.json(serializarBigInt(kanban));
}));

// ============================================================
// LISTAR
// ============================================================
router.get('/', autenticar, asyncHandler(async (req, res) => {
  const { status, lojaId, pagina = 1, limite = 24 } = req.query;
  const pular = (Number(pagina) - 1) * Number(limite);

  let where = { deletadoEm: null };

  // Cliente vê só os próprios pedidos
  if (req.usuario.tipo === 'cliente') {
    where.clienteId = BigInt(req.usuario.id);
  } else if (req.usuario.papel === 'OPERADOR' && req.usuario.lojaId) {
    where.lojaId = BigInt(req.usuario.lojaId);
  } else if (lojaId) {
    where.lojaId = BigInt(lojaId);
  }

  if (status) where.status = status;

  const [pedidos, total] = await Promise.all([
    prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true, whatsapp: true } },
        loja: { select: { id: true, nome: true } },
        _count: { select: { itens: true } }
      },
      skip: pular,
      take: Number(limite),
      orderBy: { pedidoEm: 'desc' }
    }),
    prisma.pedido.count({ where })
  ]);

  res.json({
    pedidos: serializarBigInt(pedidos),
    paginacao: {
      pagina: Number(pagina), limite: Number(limite), total,
      totalPaginas: Math.ceil(total / Number(limite))
    }
  });
}));

// ============================================================
// DETALHE
// ============================================================
router.get('/:id', autenticar, asyncHandler(async (req, res) => {
  const id = BigInt(req.params.id);

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: true,
      loja: true,
      enderecoEntrega: true,
      itens: { include: { produto: { select: { id: true, sku: true, nome: true, fotos: { take: 1, where: { principal: true } } } } } },
      historicoStatus: {
        orderBy: { criadoEm: 'asc' },
        include: { usuario: { select: { id: true, nome: true } } }
      },
      entrega: { include: { entregador: { select: { id: true, nome: true, telefone: true } } } },
      pagamentos: true
    }
  });

  if (!pedido || pedido.deletadoEm) {
    return res.status(404).json({ erro: 'Pedido não encontrado' });
  }

  // Cliente só vê o próprio
  if (req.usuario.tipo === 'cliente' && pedido.clienteId.toString() !== req.usuario.id) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }

  res.json(serializarBigInt(pedido));
}));

// ============================================================
// CRIAR (cliente faz pedido pelo app, ou operador registra)
// ============================================================
const criarPedidoSchema = z.object({
  clienteId: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
  lojaId: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
  enderecoEntregaId: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
  canalOrigem: z.enum(['APP', 'WHATSAPP', 'TELEFONE', 'BALCAO', 'IFOOD', 'RAPPI', 'OUTRO']),
  itens: z.array(z.object({
    produtoId: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
    quantidade: z.number().int().positive(),
    observacao: z.string().optional()
  })).min(1),
  observacoesCliente: z.string().optional()
});

router.post('/', autenticar, asyncHandler(async (req, res) => {
  const dados = criarPedidoSchema.parse(req.body);

  // Cliente só pode criar pedidos para si mesmo
  if (req.usuario.tipo === 'cliente' && req.usuario.id !== dados.clienteId.toString()) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }

  // Busca produtos e valida preços + estoque
  const produtoIds = dados.itens.map(i => i.produtoId);
  const produtos = await prisma.produto.findMany({
    where: { id: { in: produtoIds }, ativo: true, deletadoEm: null },
    include: { estoques: { where: { lojaId: dados.lojaId } } }
  });

  const produtosMap = new Map(produtos.map(p => [p.id.toString(), p]));

  // Valida itens
  const itensProcessados = [];
  let subtotal = 0;

  for (const item of dados.itens) {
    const produto = produtosMap.get(item.produtoId.toString());
    if (!produto) {
      return res.status(400).json({ erro: `Produto ${item.produtoId} indisponível` });
    }
    const estoque = produto.estoques[0];
    const disponivel = estoque ? estoque.quantidade - estoque.quantidadeReservada : 0;
    if (disponivel < item.quantidade) {
      return res.status(400).json({
        erro: `Estoque insuficiente para ${produto.nome}`,
        disponivel,
        solicitado: item.quantidade
      });
    }
    const precoUnit = Number(produto.precoBase);
    const precoTotal = precoUnit * item.quantidade;
    subtotal += precoTotal;
    itensProcessados.push({
      produtoId: produto.id,
      quantidade: item.quantidade,
      precoUnitario: precoUnit,
      precoTotal,
      observacao: item.observacao
    });
  }

  // Calcula frete
  const endereco = await prisma.endereco.findUnique({ where: { id: dados.enderecoEntregaId } });
  if (!endereco) return res.status(400).json({ erro: 'Endereço inválido' });

  const cotacao = await calcularFrete({
    lojaId: dados.lojaId,
    cep: endereco.cep,
    bairro: endereco.bairro,
    valorPedido: subtotal
  });

  if (!cotacao.atendido) {
    return res.status(400).json({ erro: 'Esta loja não atende este endereço' });
  }

  const valorTotal = subtotal + cotacao.taxa;

  // Cria pedido em transação
  const pedido = await prisma.$transaction(async (tx) => {
    // Gera número humano
    const ano = new Date().getFullYear();
    const ultimoNumero = await tx.pedido.count({ where: { numero: { startsWith: `PED-${ano}-` } } });
    const numero = `PED-${ano}-${String(ultimoNumero + 1).padStart(5, '0')}`;

    const novoPedido = await tx.pedido.create({
      data: {
        numero,
        clienteId: dados.clienteId,
        lojaId: dados.lojaId,
        enderecoEntregaId: dados.enderecoEntregaId,
        status: 'RECEBIDO',
        canalOrigem: dados.canalOrigem,
        subtotal,
        valorFrete: cotacao.taxa,
        valorDesconto: 0,
        valorTotal,
        observacoesCliente: dados.observacoesCliente,
        itens: { create: itensProcessados },
        historicoStatus: {
          create: {
            statusAnterior: null,
            statusNovo: 'RECEBIDO',
            usuarioId: req.usuario.tipo === 'operador' ? BigInt(req.usuario.id) : null,
            motivo: 'Pedido criado'
          }
        }
      },
      include: { itens: true }
    });

    // Reserva estoque
    for (const item of itensProcessados) {
      await tx.estoqueLoja.update({
        where: { produtoId_lojaId: { produtoId: item.produtoId, lojaId: dados.lojaId } },
        data: { quantidadeReservada: { increment: item.quantidade } }
      });
    }

    return novoPedido;
  });

  res.status(201).json(serializarBigInt(pedido));
}));

// ============================================================
// MUDAR STATUS
// ============================================================
const mudarStatusSchema = z.object({
  status: z.enum(['ACEITO', 'EM_SEPARACAO', 'SEPARADO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO_CLIENTE', 'CANCELADO_LOJA']),
  motivo: z.string().optional()
});

router.patch('/:id/status', autenticar, asyncHandler(async (req, res) => {
  const id = BigInt(req.params.id);
  const { status, motivo } = mudarStatusSchema.parse(req.body);

  const pedidoAtual = await prisma.pedido.findUnique({ where: { id } });
  if (!pedidoAtual) return res.status(404).json({ erro: 'Pedido não encontrado' });

  // Cliente só pode cancelar o próprio
  if (req.usuario.tipo === 'cliente') {
    if (pedidoAtual.clienteId.toString() !== req.usuario.id) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    if (status !== 'CANCELADO_CLIENTE') {
      return res.status(403).json({ erro: 'Cliente só pode cancelar pedidos' });
    }
  }

  const pedido = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.pedido.update({
      where: { id },
      data: {
        status,
        ...(status === 'ENTREGUE' && { entregueEm: new Date() })
      }
    });

    await tx.statusPedidoHistorico.create({
      data: {
        pedidoId: id,
        statusAnterior: pedidoAtual.status,
        statusNovo: status,
        usuarioId: req.usuario.tipo === 'operador' ? BigInt(req.usuario.id) : null,
        motivo
      }
    });

    // Devolve estoque em caso de cancelamento
    if (status.startsWith('CANCELADO')) {
      const itens = await tx.itemPedido.findMany({ where: { pedidoId: id } });
      for (const item of itens) {
        await tx.estoqueLoja.update({
          where: { produtoId_lojaId: { produtoId: item.produtoId, lojaId: pedidoAtual.lojaId } },
          data: { quantidadeReservada: { decrement: item.quantidade } }
        });
      }
    }

    // Baixa estoque definitiva quando entregue
    if (status === 'ENTREGUE') {
      const itens = await tx.itemPedido.findMany({ where: { pedidoId: id } });
      for (const item of itens) {
        await tx.estoqueLoja.update({
          where: { produtoId_lojaId: { produtoId: item.produtoId, lojaId: pedidoAtual.lojaId } },
          data: {
            quantidade: { decrement: item.quantidade },
            quantidadeReservada: { decrement: item.quantidade }
          }
        });
      }
    }

    return atualizado;
  });

  res.json(serializarBigInt(pedido));
}));

module.exports = router;
