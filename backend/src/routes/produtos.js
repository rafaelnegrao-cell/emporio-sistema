// Catálogo de produtos
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');

const router = express.Router();

// ============================================================
// LISTAR / BUSCAR produtos (público — catálogo do app)
// ============================================================
router.get('/', asyncHandler(async (req, res) => {
  const {
    q,                  // busca por nome ou SKU
    categoriaId,
    categoriaPet,       // CAO, GATO, etc.
    idadePet,
    portePet,
    lojaId,             // se passar, retorna apenas com estoque nessa loja
    pagina = 1,
    limite = 24
  } = req.query;

  const pular = (Number(pagina) - 1) * Number(limite);

  const where = {
    ativo: true,
    deletadoEm: null,
    ...(q && {
      OR: [
        { nome: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { codigoBarras: q }
      ]
    }),
    ...(categoriaId && { categoriaId: BigInt(categoriaId) }),
    ...(categoriaPet && { categoriaPet }),
    ...(idadePet && { idadePet }),
    ...(portePet && { portePet })
  };

  const [produtos, total] = await Promise.all([
    prisma.produto.findMany({
      where,
      include: {
        fotos: { where: { principal: true }, take: 1 },
        categoria: { select: { id: true, nome: true } },
        ...(lojaId && {
          estoques: {
            where: { lojaId: BigInt(lojaId) },
            select: { quantidade: true, quantidadeReservada: true }
          }
        })
      },
      skip: pular,
      take: Number(limite),
      orderBy: { nome: 'asc' }
    }),
    prisma.produto.count({ where })
  ]);

  // Filtra apenas produtos com estoque disponível, se foi pedido lojaId
  let resultado = produtos;
  if (lojaId) {
    resultado = produtos.filter(p =>
      p.estoques?.[0] &&
      (p.estoques[0].quantidade - p.estoques[0].quantidadeReservada) > 0
    );
  }

  res.json({
    produtos: serializarBigInt(resultado),
    paginacao: {
      pagina: Number(pagina),
      limite: Number(limite),
      total,
      totalPaginas: Math.ceil(total / Number(limite))
    }
  });
}));

// ============================================================
// DETALHE do produto
// ============================================================
router.get('/:id', asyncHandler(async (req, res) => {
  const produto = await prisma.produto.findUnique({
    where: { id: BigInt(req.params.id) },
    include: {
      fotos: { orderBy: { ordem: 'asc' } },
      categoria: true,
      estoques: { include: { loja: { select: { id: true, nome: true, codigo: true } } } }
    }
  });

  if (!produto || produto.deletadoEm) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }

  res.json(serializarBigInt(produto));
}));

// ============================================================
// CRIAR produto (operador/admin)
// ============================================================
const criarProdutoSchema = z.object({
  sku: z.string().min(1),
  codigoBarras: z.string().optional(),
  nome: z.string().min(2),
  descricao: z.string().optional(),
  categoriaId: z.union([z.string(), z.number()]).transform(v => BigInt(v)),
  marca: z.string().optional(),
  precoBase: z.number().positive(),
  pesoKg: z.number().positive().optional(),
  controlado: z.boolean().optional(),
  precisaReceita: z.boolean().optional(),
  categoriaPet: z.enum(['CAO', 'GATO', 'AVE', 'PEIXE', 'ROEDOR', 'REPTIL', 'OUTRO', 'MULTI']).optional(),
  idadePet: z.enum(['FILHOTE', 'ADULTO', 'SENIOR', 'TODAS']).optional(),
  portePet: z.enum(['MINI', 'PEQUENO', 'MEDIO', 'GRANDE', 'GIGANTE', 'TODOS']).optional(),
  idHdTec: z.string().optional()
});

router.post('/', autenticar, exigirPapel('ADMIN', 'OPERADOR'), asyncHandler(async (req, res) => {
  const dados = criarProdutoSchema.parse(req.body);

  const produto = await prisma.produto.create({ data: dados });
  res.status(201).json(serializarBigInt(produto));
}));

// ============================================================
// ATUALIZAR produto
// ============================================================
router.put('/:id', autenticar, exigirPapel('ADMIN', 'OPERADOR'), asyncHandler(async (req, res) => {
  const dados = criarProdutoSchema.partial().parse(req.body);

  const produto = await prisma.produto.update({
    where: { id: BigInt(req.params.id) },
    data: dados
  });

  res.json(serializarBigInt(produto));
}));

// ============================================================
// DELETAR (soft) produto
// ============================================================
router.delete('/:id', autenticar, exigirPapel('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.produto.update({
    where: { id: BigInt(req.params.id) },
    data: { deletadoEm: new Date(), ativo: false }
  });

  res.status(204).end();
}));

module.exports = router;
