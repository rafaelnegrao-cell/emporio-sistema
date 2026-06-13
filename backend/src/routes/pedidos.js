// backend/src/routes/produtos.js
// Catálogo de produtos do backoffice.
// Substitui a versão de exemplo. Mantém o padrão do projeto:
//   prisma singleton + asyncHandler + serializar (BigInt->string) + auth.
//
// IMPORTANTE — adições no schema.prisma (ver _schema-additions.prisma):
//   custoMedio    Decimal?  @db.Decimal(12,2)   // custo do HD TEC
//   margem        Decimal?  @db.Decimal(6,2)    // % calculada (preço x custo)
//   alertaCadastro String?  @default("ok")      // ok | prejuizo | custo_suspeito | sem_custo | venda_zero | revisar
//   giroMes       Int       @default(0)         // unidades vendidas no período de referência
// Rode a migration depois de adicioná-los.

const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/async-handler');
const { serializar } = require('../utils/serializar');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

const SORT_FIELDS = {
  nome: 'nome',
  marca: 'marca',
  custo: 'custoMedio',
  preco: 'precoBase',
  margem: 'margem',
  giro: 'giroMes',
  sku: 'sku',
};

// Calcula margem (%) e flag de cadastro a partir de custo e preço.
// Mesma lógica usada na higiene de dados / protótipo.
function avaliarCadastro(precoBase, custoMedio) {
  const preco = Number(precoBase ?? 0);
  const custo = Number(custoMedio ?? 0);
  if (preco <= 0.05) return { margem: null, alertaCadastro: 'venda_zero' };
  if (custo <= 0) return { margem: 100, alertaCadastro: 'sem_custo' };
  const margem = Math.round(((preco - custo) / preco) * 1000) / 10;
  const markup = (preco / custo - 1) * 100;
  if (preco < custo) return { margem, alertaCadastro: 'prejuizo' };
  if (markup > 200) return { margem, alertaCadastro: 'custo_suspeito' };
  if (margem < 10) return { margem, alertaCadastro: 'revisar' };
  return { margem, alertaCadastro: 'ok' };
}

/**
 * GET /api/produtos
 * Query:
 *   q           busca em nome, sku e marca
 *   categoriaId filtro por categoria (id)
 *   marca       filtro por marca (string exata)
 *   pet         filtro por categoriaPet (CAO|GATO|AVE|PEIXE|ROEDOR|MULTI|OUTRO)
 *   status      'alerta' (qualquer flag != ok) | 'ok'
 *   sort        nome|marca|custo|preco|margem|giro|sku   (default: giro)
 *   order       asc|desc                                  (default: desc)
 *   page        1..n                                       (default: 1)
 *   perPage     1..100                                     (default: 25)
 *   lojaId      para somar o estoque da loja escolhida
 * Retorna: { data, page, perPage, total, totalPages, facets, kpis }
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const {
      q = '',
      categoriaId,
      marca,
      pet,
      status,
      sort = 'giro',
      order = 'desc',
      page = '1',
      perPage = '25',
      lojaId,
    } = req.query;

    const take = Math.min(Math.max(parseInt(perPage, 10) || 25, 1), 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const orderField = SORT_FIELDS[sort] || 'giroMes';
    const orderDir = order === 'asc' ? 'asc' : 'desc';

    const where = { AND: [] };
    if (q.trim()) {
      where.AND.push({
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { marca: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (categoriaId) where.AND.push({ categoriaId: BigInt(categoriaId) });
    if (marca) where.AND.push({ marca });
    if (pet) where.AND.push({ categoriaPet: pet });
    if (status === 'alerta') where.AND.push({ NOT: { alertaCadastro: 'ok' } });
    if (status === 'ok') where.AND.push({ alertaCadastro: 'ok' });

    const lojaFilter = lojaId ? { where: { lojaId: BigInt(lojaId) } } : {};

    const [total, rows, marcas, categorias, kpiAgg, alertaCount] = await Promise.all([
      prisma.produto.count({ where }),
      prisma.produto.findMany({
        where,
        orderBy: [{ [orderField]: orderDir }, { id: 'asc' }],
        skip,
        take,
        include: {
          categoria: { select: { id: true, nome: true } },
          estoques: { ...lojaFilter, select: { quantidade: true, quantidadeReservada: true, quantidadeMinima: true } },
        },
      }),
      prisma.produto.findMany({ where, distinct: ['marca'], select: { marca: true }, orderBy: { marca: 'asc' } }),
      prisma.categoria.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      prisma.produto.aggregate({ where, _sum: { giroMes: true }, _count: true }),
      prisma.produto.count({ where: { ...where, AND: [...where.AND, { NOT: { alertaCadastro: 'ok' } }] } }),
    ]);

    const data = rows.map((p) => {
      const estoque = (p.estoques || []).reduce((s, e) => s + (e.quantidade || 0), 0);
      const reservado = (p.estoques || []).reduce((s, e) => s + (e.quantidadeReservada || 0), 0);
      const minimo = (p.estoques || []).reduce((s, e) => s + (e.quantidadeMinima || 0), 0);
      return {
        id: p.id,
        sku: p.sku,
        nome: p.nome,
        marca: p.marca,
        categoria: p.categoria ? p.categoria.nome : null,
        categoriaId: p.categoriaId,
        pet: p.categoriaPet || 'OUTRO',
        custo: p.custoMedio,
        preco: p.precoBase,
        margem: p.margem,
        giro: p.giroMes,
        estoque: p.estoques && p.estoques.length ? estoque : null,
        reservado,
        estoqueMin: minimo || null,
        ativo: p.ativo,
        flag: p.alertaCadastro || 'ok',
      };
    });

    res.json(
      serializar({
        data,
        page: parseInt(page, 10) || 1,
        perPage: take,
        total,
        totalPages: Math.ceil(total / take),
        facets: {
          marcas: marcas.map((m) => m.marca).filter(Boolean),
          categorias,
        },
        kpis: {
          skus: kpiAgg._count,
          comAlerta: alertaCount,
          giroTotal: kpiAgg._sum.giroMes || 0,
        },
      })
    );
  })
);

// GET /api/produtos/:id — detalhe (com estoque por loja)
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const produto = await prisma.produto.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        categoria: { select: { id: true, nome: true } },
        estoques: { include: { loja: { select: { id: true, nome: true, codigo: true } } } },
        fotos: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(serializar(produto));
  })
);

// POST /api/produtos — cria (admin/operador)
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { margem, alertaCadastro } = avaliarCadastro(b.precoBase, b.custoMedio);
    const produto = await prisma.produto.create({
      data: {
        sku: b.sku,
        codigoBarras: b.codigoBarras || null,
        nome: b.nome,
        descricao: b.descricao || null,
        categoriaId: b.categoriaId ? BigInt(b.categoriaId) : null,
        marca: b.marca || null,
        precoBase: b.precoBase ?? 0,
        custoMedio: b.custoMedio ?? null,
        pesoKg: b.pesoKg ?? null,
        categoriaPet: b.categoriaPet || null,
        idadePet: b.idadePet || null,
        portePet: b.portePet || null,
        controlado: !!b.controlado,
        precisaReceita: !!b.precisaReceita,
        ativo: b.ativo !== false,
        margem,
        alertaCadastro,
      },
    });
    res.status(201).json(serializar(produto));
  })
);

// PATCH /api/produtos/:id — edita (admin/operador)
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id);
    const atual = await prisma.produto.findUnique({ where: { id } });
    if (!atual) return res.status(404).json({ erro: 'Produto não encontrado' });

    const b = req.body;
    const precoBase = b.precoBase ?? atual.precoBase;
    const custoMedio = b.custoMedio ?? atual.custoMedio;
    const { margem, alertaCadastro } = avaliarCadastro(precoBase, custoMedio);

    const produto = await prisma.produto.update({
      where: { id },
      data: {
        ...('sku' in b && { sku: b.sku }),
        ...('codigoBarras' in b && { codigoBarras: b.codigoBarras }),
        ...('nome' in b && { nome: b.nome }),
        ...('descricao' in b && { descricao: b.descricao }),
        ...('categoriaId' in b && { categoriaId: b.categoriaId ? BigInt(b.categoriaId) : null }),
        ...('marca' in b && { marca: b.marca }),
        ...('precoBase' in b && { precoBase: b.precoBase }),
        ...('custoMedio' in b && { custoMedio: b.custoMedio }),
        ...('pesoKg' in b && { pesoKg: b.pesoKg }),
        ...('categoriaPet' in b && { categoriaPet: b.categoriaPet }),
        ...('idadePet' in b && { idadePet: b.idadePet }),
        ...('portePet' in b && { portePet: b.portePet }),
        ...('controlado' in b && { controlado: !!b.controlado }),
        ...('precisaReceita' in b && { precisaReceita: !!b.precisaReceita }),
        ...('ativo' in b && { ativo: !!b.ativo }),
        margem,
        alertaCadastro,
      },
    });
    res.json(serializar(produto));
  })
);

// PATCH /api/produtos/:id/estoque — ajusta estoque numa loja
router.patch(
  '/:id/estoque',
  requireAuth,
  requireRole('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const produtoId = BigInt(req.params.id);
    const { lojaId, quantidade, quantidadeMinima } = req.body;
    const estoque = await prisma.estoqueLoja.upsert({
      where: { produtoId_lojaId: { produtoId, lojaId: BigInt(lojaId) } },
      update: {
        ...(quantidade != null && { quantidade: parseInt(quantidade, 10) }),
        ...(quantidadeMinima != null && { quantidadeMinima: parseInt(quantidadeMinima, 10) }),
        atualizadoEm: new Date(),
      },
      create: {
        produtoId,
        lojaId: BigInt(lojaId),
        quantidade: parseInt(quantidade, 10) || 0,
        quantidadeReservada: 0,
        quantidadeMinima: parseInt(quantidadeMinima, 10) || 0,
      },
    });
    res.json(serializar(estoque));
  })
);

module.exports = router;
