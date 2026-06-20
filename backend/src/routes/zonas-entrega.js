// Zonas de entrega — gestão pelo backoffice
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');

const router = express.Router();

router.get('/', autenticar, exigirPapel('ADMIN', 'OPERADOR'), asyncHandler(async (req, res) => {
  const { lojaId } = req.query;

  const zonas = await prisma.zonaEntrega.findMany({
    where: { ...(lojaId && { lojaId: BigInt(lojaId) }) },
    include: { loja: { select: { id: true, nome: true } } },
    orderBy: [{ lojaId: 'asc' }, { prioridade: 'desc' }]
  });

  res.json(serializarBigInt(zonas));
}));

const zonaSchema = z.object({
  lojaId: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
  nome: z.string().min(2),
  bairros: z.array(z.string()).optional().default([]),
  cidades: z.array(z.string()).optional().default([]),
  cepInicio: z.string().optional(),
  cepFim: z.string().optional(),
  taxaFrete: z.number().nonnegative(),
  taxaFreteAcimaDe: z.number().nonnegative().optional(),
  valorFreteGratis: z.number().nonnegative().optional(),
  prazoMinHoras: z.number().int().positive(),
  prazoMaxHoras: z.number().int().positive(),
  prioridade: z.number().int().optional().default(0)
});

router.post('/', autenticar, exigirPapel('ADMIN'), asyncHandler(async (req, res) => {
  const dados = zonaSchema.parse(req.body);
  const zona = await prisma.zonaEntrega.create({ data: dados });
  res.status(201).json(serializarBigInt(zona));
}));

router.put('/:id', autenticar, exigirPapel('ADMIN'), asyncHandler(async (req, res) => {
  const dados = zonaSchema.partial().parse(req.body);
  const zona = await prisma.zonaEntrega.update({
    where: { id: BigInt(req.params.id) },
    data: dados
  });
  res.json(serializarBigInt(zona));
}));

router.delete('/:id', autenticar, exigirPapel('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.zonaEntrega.update({
    where: { id: BigInt(req.params.id) },
    data: { ativa: false }
  });
  res.status(204).end();
}));

module.exports = router;
