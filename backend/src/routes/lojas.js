// CRUD de lojas
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');

const router = express.Router();

// Listar lojas (público — usado pelo app para selecionar loja)
router.get('/', asyncHandler(async (req, res) => {
  const apenasDoEscopo = req.query.escopo === 'delivery';

  const lojas = await prisma.loja.findMany({
    where: {
      ativa: true,
      ...(apenasDoEscopo && { noEscopoDelivery: true })
    },
    orderBy: { nome: 'asc' }
  });

  res.json(serializarBigInt(lojas));
}));

// Detalhe da loja
router.get('/:id', asyncHandler(async (req, res) => {
  const loja = await prisma.loja.findUnique({
    where: { id: BigInt(req.params.id) }
  });

  if (!loja) {
    return res.status(404).json({ erro: 'Loja não encontrada' });
  }

  res.json(serializarBigInt(loja));
}));

// Criar loja (apenas admin)
const criarLojaSchema = z.object({
  codigo: z.string().min(2).toUpperCase(),
  nome: z.string().min(2),
  endereco: z.string().min(5),
  telefone: z.string().optional(),
  cnpj: z.string().optional(),
  noEscopoDelivery: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

router.post('/', autenticar, exigirPapel('ADMIN'), asyncHandler(async (req, res) => {
  const dados = criarLojaSchema.parse(req.body);

  const loja = await prisma.loja.create({ data: dados });
  res.status(201).json(serializarBigInt(loja));
}));

// Atualizar loja (apenas admin)
router.put('/:id', autenticar, exigirPapel('ADMIN'), asyncHandler(async (req, res) => {
  const dados = criarLojaSchema.partial().parse(req.body);

  const loja = await prisma.loja.update({
    where: { id: BigInt(req.params.id) },
    data: dados
  });

  res.json(serializarBigInt(loja));
}));

module.exports = router;
