// backend/src/routes/pedidos.js
// Rota de pedidos do delivery — base mínima e válida.
// (O arquivo anterior aqui era, por engano, uma cópia antiga de produtos.js
//  com imports errados, que derrubava o boot do servidor.)
// Imports no padrão do projeto: prisma singleton + asyncHandler + serializarBigInt
// + middlewares autenticar / exigirPapel.

const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');
const { autenticar, exigirPapel } = require('../middlewares/auth');

const router = express.Router();

// GET /api/pedidos — lista (mais recentes primeiro). Filtros opcionais: status, lojaId.
router.get(
  '/',
  autenticar,
  asyncHandler(async (req, res) => {
    const { status, lojaId } = req.query;
    const where = { deletadoEm: null };
    if (status) where.status = status;
    if (lojaId) where.lojaId = BigInt(lojaId);

    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { pedidoEm: 'desc' },
      take: 200,
      include: {
        cliente: { select: { id: true, nome: true, whatsapp: true } },
        loja: { select: { id: true, nome: true } },
        itens: { select: { id: true } },
      },
    });

    res.json(serializarBigInt({ data: pedidos, total: pedidos.length }));
  })
);

// GET /api/pedidos/:id — detalhe completo
router.get(
  '/:id',
  autenticar,
  asyncHandler(async (req, res) => {
    const pedido = await prisma.pedido.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        cliente: { select: { id: true, nome: true, whatsapp: true } },
        loja: { select: { id: true, nome: true } },
        enderecoEntrega: true,
        itens: { include: { produto: { select: { id: true, nome: true, sku: true } } } },
      },
    });
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
    res.json(serializarBigInt(pedido));
  })
);

// PATCH /api/pedidos/:id/status — muda o status (usado pelo Kanban)
router.patch(
  '/:id/status',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ erro: 'status é obrigatório' });
    const pedido = await prisma.pedido.update({
      where: { id: BigInt(req.params.id) },
      data: { status },
    });
    res.json(serializarBigInt(pedido));
  })
);

module.exports = router;
