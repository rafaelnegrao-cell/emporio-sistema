// backend/src/routes/clientes.js
// Base de clientes do backoffice (clientes finais B2C) + pets, endereços,
// histórico e importação em massa (upsert pelo WhatsApp).
// Padrão do projeto: prisma + asyncHandler + serializar + auth.
//
// Depende dos campos denormalizados no model Cliente (ver _schema-additions.prisma):
//   totalGasto Decimal? @default(0) | qtdPedidos Int @default(0) | ultimaCompraEm DateTime?
// Eles são atualizados quando um pedido muda de status (ver rota de pedidos).

const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/async-handler');
const { serializar } = require('../utils/serializar');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

const DIAS_ATIVO = 60;       // cliente "ativo" = comprou nos últimos 60 dias
const CICLO_RECOMPRA = 30;   // ciclo médio default p/ estimar recompra de ração

const SORT = { nome: 'nome', totalGasto: 'totalGasto', qtdPedidos: 'qtdPedidos', ultima: 'ultimaCompraEm', criado: 'criadoEm' };
const somenteDigitos = (s) => (s == null ? '' : String(s)).replace(/\D/g, '');

function enriquecer(c) {
  const dias = c.ultimaCompraEm ? Math.floor((Date.now() - new Date(c.ultimaCompraEm)) / 86400000) : null;
  return {
    ...c,
    diasUlt: dias,
    ativo: dias != null && dias <= DIAS_ATIVO,
    recompra: dias != null ? CICLO_RECOMPRA - dias : null, // dias até a recompra estimada
    qtdPets: c._count ? c._count.pets : undefined,
  };
}

/**
 * GET /api/clientes
 * Query: q, status(ativo|inativo|recompra), loja, especie, sort, order, page, perPage
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { q = '', status, lojaId, especie, sort = 'totalGasto', order = 'desc', page = '1', perPage = '12' } = req.query;
    const take = Math.min(Math.max(parseInt(perPage, 10) || 12, 1), 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const orderField = SORT[sort] || 'totalGasto';

    const agora = new Date();
    const limiteAtivo = new Date(agora.getTime() - DIAS_ATIVO * 86400000);
    // janela de recompra: faltam 0..7 dias => última compra entre (ciclo-7) e ciclo dias atrás
    const recIni = new Date(agora.getTime() - CICLO_RECOMPRA * 86400000);
    const recFim = new Date(agora.getTime() - (CICLO_RECOMPRA - 7) * 86400000);

    const where = { AND: [{ deletadoEm: null }] };
    if (q.trim()) {
      where.AND.push({
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { whatsapp: { contains: somenteDigitos(q) || q } },
          { cpf: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (lojaId) where.AND.push({ lojaPreferidaId: BigInt(lojaId) });
    if (especie) where.AND.push({ pets: { some: { especie } } });
    if (status === 'ativo') where.AND.push({ ultimaCompraEm: { gte: limiteAtivo } });
    if (status === 'inativo') where.AND.push({ OR: [{ ultimaCompraEm: null }, { ultimaCompraEm: { lt: limiteAtivo } }] });
    if (status === 'recompra') where.AND.push({ ultimaCompraEm: { gte: recIni, lte: recFim } });

    const [total, rows, lojas, ltvAgg, ativos, comPet, recompra] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        where,
        orderBy: [{ [orderField]: order === 'asc' ? 'asc' : 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: {
          lojaPreferida: { select: { id: true, nome: true } },
          pets: { select: { especie: true, nome: true } },
          enderecos: { where: { principal: true }, select: { bairro: true, cidade: true }, take: 1 },
          _count: { select: { pets: true } },
        },
      }),
      prisma.loja.findMany({ where: { ativa: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      prisma.cliente.aggregate({ where, _avg: { totalGasto: true } }),
      prisma.cliente.count({ where: { ...where, AND: [...where.AND, { ultimaCompraEm: { gte: limiteAtivo } }] } }),
      prisma.cliente.count({ where: { ...where, AND: [...where.AND, { pets: { some: {} } }] } }),
      prisma.cliente.count({ where: { ...where, AND: [...where.AND, { ultimaCompraEm: { gte: recIni, lte: recFim } }] } }),
    ]);

    const data = rows.map((c) => {
      const end = c.enderecos && c.enderecos[0];
      return enriquecer({
        id: c.id,
        nome: c.nome,
        whatsapp: c.whatsapp,
        cpf: c.cpf,
        email: c.email,
        cidade: end ? end.cidade : null,
        bairro: end ? end.bairro : null,
        loja: c.lojaPreferida ? c.lojaPreferida.nome : null,
        optIn: c.optInMarketing,
        totalGasto: c.totalGasto,
        qtdPedidos: c.qtdPedidos,
        ultimaCompraEm: c.ultimaCompraEm,
        pets: c.pets,
        _count: c._count,
      });
    });

    res.json(
      serializar({
        data,
        page: parseInt(page, 10) || 1,
        perPage: take,
        total,
        totalPages: Math.ceil(total / take),
        facets: { lojas },
        kpis: {
          total,
          ativos,
          comPet,
          recompra7: recompra,
          ltvMedio: ltvAgg._avg.totalGasto || 0,
        },
      })
    );
  })
);

// GET /api/clientes/:id — detalhe com pets, endereços e histórico
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const cliente = await prisma.cliente.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        lojaPreferida: { select: { id: true, nome: true } },
        pets: true,
        enderecos: { orderBy: { principal: 'desc' } },
        pedidos: {
          orderBy: { pedidoEm: 'desc' },
          take: 10,
          select: { id: true, numero: true, pedidoEm: true, valorTotal: true, status: true },
        },
      },
    });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(serializar(enriquecer(cliente)));
  })
);

// POST /api/clientes — cria cliente (+ pet opcional)
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const cliente = await prisma.cliente.create({
      data: {
        nome: b.nome,
        whatsapp: somenteDigitos(b.whatsapp),
        cpf: b.cpf || null,
        email: b.email || null,
        optInMarketing: !!b.optInMarketing,
        lojaPreferidaId: b.lojaPreferidaId ? BigInt(b.lojaPreferidaId) : null,
        pets: b.pet ? { create: { nome: b.pet.nome, especie: b.pet.especie, raca: b.pet.raca || null } } : undefined,
      },
    });
    res.status(201).json(serializar(cliente));
  })
);

// PATCH /api/clientes/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id);
    const b = req.body;
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...('nome' in b && { nome: b.nome }),
        ...('whatsapp' in b && { whatsapp: somenteDigitos(b.whatsapp) }),
        ...('cpf' in b && { cpf: b.cpf }),
        ...('email' in b && { email: b.email }),
        ...('optInMarketing' in b && { optInMarketing: !!b.optInMarketing }),
        ...('lojaPreferidaId' in b && { lojaPreferidaId: b.lojaPreferidaId ? BigInt(b.lojaPreferidaId) : null }),
      },
    });
    res.json(serializar(cliente));
  })
);

/**
 * POST /api/clientes/importar
 * Body: { clientes: [{ nome, whatsapp, cpf?, email?, cidade?, bairro?, loja?, optIn?, pet?{nome,especie,raca} }] }
 * Upsert pelo WhatsApp (cria ou atualiza, sem duplicar). Retorna o resumo.
 */
router.post(
  '/importar',
  requireAuth,
  requireRole('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const lista = Array.isArray(req.body.clientes) ? req.body.clientes : [];
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    // resolve nomes de loja -> id uma vez só
    const lojas = await prisma.loja.findMany({ select: { id: true, nome: true } });
    const lojaPorNome = new Map(lojas.map((l) => [l.nome.trim().toLowerCase(), l.id]));

    for (const c of lista) {
      const whatsapp = somenteDigitos(c.whatsapp);
      if (!c.nome || !whatsapp) {
        ignorados++;
        continue;
      }
      const lojaPreferidaId = c.loja ? lojaPorNome.get(String(c.loja).trim().toLowerCase()) || null : null;
      const existente = await prisma.cliente.findUnique({ where: { whatsapp } });

      if (existente) {
        await prisma.cliente.update({
          where: { whatsapp },
          data: {
            nome: c.nome,
            cpf: c.cpf || existente.cpf,
            email: c.email || existente.email,
            optInMarketing: c.optIn != null ? !!c.optIn : existente.optInMarketing,
            ...(lojaPreferidaId && { lojaPreferidaId }),
          },
        });
        atualizados++;
      } else {
        await prisma.cliente.create({
          data: {
            nome: c.nome,
            whatsapp,
            cpf: c.cpf || null,
            email: c.email || null,
            optInMarketing: !!c.optIn,
            lojaPreferidaId,
            enderecos: c.bairro || c.cidade
              ? { create: { apelido: 'Casa', cep: c.cep || '', logradouro: '', numero: '', bairro: c.bairro || '', cidade: c.cidade || '', uf: 'PR', principal: true } }
              : undefined,
            pets: c.pet && c.pet.nome
              ? { create: { nome: c.pet.nome, especie: c.pet.especie || 'CAO', raca: c.pet.raca || null } }
              : undefined,
          },
        });
        criados++;
      }
    }

    res.json({ criados, atualizados, ignorados, total: lista.length });
  })
);

module.exports = router;
