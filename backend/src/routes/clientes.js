// Clientes — cadastro e gestão (visão do backoffice + perfil do próprio cliente)
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');

const router = express.Router();

// ============================================================
// LISTAR (backoffice)
// ============================================================
router.get('/', autenticar, exigirPapel('ADMIN', 'OPERADOR'), asyncHandler(async (req, res) => {
  const { q, pagina = 1, limite = 24 } = req.query;
  const pular = (Number(pagina) - 1) * Number(limite);

  const where = {
    deletadoEm: null,
    ...(q && {
      OR: [
        { nome: { contains: q, mode: 'insensitive' } },
        { whatsapp: { contains: q.replace(/\D/g, '') } },
        { email: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q.replace(/\D/g, '') } }
      ]
    })
  };

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      include: {
        _count: { select: { pedidos: true, pets: true } },
        lojaPreferida: { select: { id: true, nome: true } }
      },
      skip: pular,
      take: Number(limite),
      orderBy: { criadoEm: 'desc' }
    }),
    prisma.cliente.count({ where })
  ]);

  res.json({
    clientes: serializarBigInt(clientes),
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

  // Cliente só pode ver os próprios dados; operador/admin veem qualquer um
  if (req.usuario.tipo === 'cliente' && req.usuario.id !== req.params.id) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      pets: true,
      enderecos: true,
      lojaPreferida: { select: { id: true, nome: true } }
    }
  });

  if (!cliente || cliente.deletadoEm) {
    return res.status(404).json({ erro: 'Cliente não encontrado' });
  }

  res.json(serializarBigInt(cliente));
}));

// ============================================================
// PETS — adicionar pet ao cliente
// ============================================================
const petSchema = z.object({
  nome: z.string().min(1),
  especie: z.enum(['CAO', 'GATO', 'AVE', 'PEIXE', 'ROEDOR', 'REPTIL', 'OUTRO']),
  raca: z.string().optional(),
  porte: z.enum(['MINI', 'PEQUENO', 'MEDIO', 'GRANDE', 'GIGANTE']).optional(),
  dataNascimento: z.string().datetime().optional(),
  pesoKg: z.number().positive().optional(),
  castrado: z.boolean().optional(),
  observacoes: z.string().optional()
});

router.post('/:id/pets', autenticar, asyncHandler(async (req, res) => {
  const dados = petSchema.parse(req.body);
  const clienteId = BigInt(req.params.id);

  if (req.usuario.tipo === 'cliente' && req.usuario.id !== req.params.id) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }

  const pet = await prisma.pet.create({
    data: {
      ...dados,
      clienteId,
      dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : undefined
    }
  });

  res.status(201).json(serializarBigInt(pet));
}));

// ============================================================
// ENDEREÇOS
// ============================================================
const enderecoSchema = z.object({
  apelido: z.string().optional(),
  cep: z.string().min(8),
  logradouro: z.string().min(2),
  numero: z.string(),
  complemento: z.string().optional(),
  bairro: z.string().min(2),
  cidade: z.string().min(2),
  uf: z.string().length(2),
  pontoReferencia: z.string().optional(),
  principal: z.boolean().optional()
});

router.post('/:id/enderecos', autenticar, asyncHandler(async (req, res) => {
  const dados = enderecoSchema.parse(req.body);
  const clienteId = BigInt(req.params.id);

  if (req.usuario.tipo === 'cliente' && req.usuario.id !== req.params.id) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }

  // Se este novo é principal, desmarca outros
  if (dados.principal) {
    await prisma.endereco.updateMany({
      where: { clienteId },
      data: { principal: false }
    });
  }

  const endereco = await prisma.endereco.create({
    data: {
      ...dados,
      clienteId,
      cep: dados.cep.replace(/\D/g, ''),
      uf: dados.uf.toUpperCase()
    }
  });

  res.status(201).json(serializarBigInt(endereco));
}));

module.exports = router;
