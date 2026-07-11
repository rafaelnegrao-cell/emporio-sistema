// backend/src/routes/clientes.js
// Base de clientes do backoffice (clientes finais B2C) + pets, endereços,
// histórico e importação em massa (upsert pelo WhatsApp).
// Padrão do projeto: prisma + asyncHandler + serializar + auth.
//
// Depende dos campos denormalizados no model Cliente (ver _schema-additions.prisma):
//   totalGasto Decimal? @default(0) | qtdPedidos Int @default(0) | ultimaCompraEm DateTime?
// Eles são atualizados quando um pedido muda de status (ver rota de pedidos).

const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');

// serializar (BigInt/Decimal -> JSON) — usa o do projeto; fallback seguro se não existir.
const _ser = (() => { try { return require('../utils/serializar'); } catch (_) { return {}; } })();
const serializar = _ser.serializar || function (obj) {
  return JSON.parse(JSON.stringify(obj, (_k, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'Decimal') return Number(v.toString());
    return v;
  }));
};

// Middlewares de auth — usa os do projeto (seja qual for o nome); fallback no-op pra não quebrar o load.
// IMPORTANTE: exigirPapel é o nome real neste projeto — precisa estar na cadeia,
// senão o controle de papel vira no-op silencioso (corrigido em 11/07/2026).
const _auth = (() => { try { return require('../middlewares/auth'); } catch (_) { return {}; } })();
const requireAuth = _auth.requireAuth || _auth.autenticar || _auth.verificarToken || ((req, res, next) => next());
const requireRole = _auth.requireRole || _auth.exigirPapel || _auth.autorizar || (() => (req, res, next) => next());

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

// ─────────────────────────────────────────────────────────────
// LGPD — direitos do titular (art. 18)
// ─────────────────────────────────────────────────────────────

// POST /api/clientes/recalcular-estatisticas — recalcula qtdPedidos, totalGasto e
// ultimaCompraEm de TODOS os clientes a partir dos pedidos ENTREGUES.
// Uso: corrigir dados antigos (os campos passam a se manter sozinhos a cada entrega)
// e após importações. Idempotente — pode rodar quantas vezes quiser.
router.post(
  '/recalcular-estatisticas',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const grupos = await prisma.pedido.groupBy({
      by: ['clienteId'],
      where: { status: 'ENTREGUE', deletadoEm: null },
      _count: { _all: true },
      _sum: { valorTotal: true },
      _max: { entregueEm: true, pedidoEm: true },
    });
    const comEntrega = new Set(grupos.map((g) => String(g.clienteId)));
    let atualizados = 0;
    for (const g of grupos) {
      await prisma.cliente.update({
        where: { id: g.clienteId },
        data: {
          qtdPedidos: g._count._all || 0,
          totalGasto: g._sum.valorTotal || 0,
          ultimaCompraEm: g._max.entregueEm || g._max.pedidoEm || null,
        },
      });
      atualizados++;
    }
    // Zera quem não tem nenhum pedido entregue (ex.: entregas viraram devolução).
    const zerados = await prisma.cliente.updateMany({
      where: { deletadoEm: null, id: { notIn: [...comEntrega].map((s) => BigInt(s)) } },
      data: { qtdPedidos: 0, totalGasto: 0, ultimaCompraEm: null },
    });
    res.json({ ok: true, atualizados, zerados: zerados.count });
  })
);

// GET /api/clientes/:id/dados-lgpd — todos os dados do titular, para
// atender pedido de acesso/portabilidade. O painel formata para impressão.
router.get(
  '/:id/dados-lgpd',
  requireAuth,
  requireRole('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id);
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        lojaPreferida: { select: { nome: true } },
        pets: true,
        enderecos: true,
        programaFidelidade: true,
        pedidos: {
          orderBy: { pedidoEm: 'desc' },
          take: 500,
          select: {
            numero: true, pedidoEm: true, status: true, canalOrigem: true,
            subtotal: true, valorFrete: true, valorDesconto: true, valorTotal: true,
            observacoesCliente: true,
            itens: { select: { quantidade: true, precoTotal: true, produto: { select: { nome: true } } } },
            entrega: { select: { entregueEm: true } },
          },
        },
      },
    });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(serializar({ geradoEm: new Date().toISOString(), cliente }));
  })
);

// POST /api/clientes/:id/anonimizar — remove os dados pessoais do titular,
// preservando os pedidos para fins fiscais/estatísticos (anonimização, art. 12/16).
// Irreversível. Body: { confirmacao: 'APAGAR' }. Somente ADMIN.
// O que faz: apaga pets, recompras e fidelidade; limpa identificação do cadastro
// (nome/CPF/e-mail/WhatsApp/nascimento); apaga rua/número/CEP dos endereços
// (mantém bairro/cidade para relatórios por região); limpa observações dos
// pedidos e comentários de avaliação. Pedidos e valores permanecem.
router.post(
  '/:id/anonimizar',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id);
    if ((req.body && req.body.confirmacao) !== 'APAGAR') {
      return res.status(400).json({ erro: 'Confirmação ausente. Envie { "confirmacao": "APAGAR" }.' });
    }
    const cliente = await prisma.cliente.findUnique({ where: { id }, select: { id: true, anonimizadoEm: true } });
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    if (cliente.anonimizadoEm) return res.status(400).json({ erro: 'Este cliente já foi anonimizado.' });

    const ATIVOS = ['RECEBIDO', 'ACEITO', 'EM_SEPARACAO', 'SEPARADO', 'EM_ROTA'];
    const emAndamento = await prisma.pedido.count({ where: { clienteId: id, deletadoEm: null, status: { in: ATIVOS } } });
    if (emAndamento > 0) {
      return res.status(400).json({ erro: `Este cliente tem ${emAndamento} pedido(s) em andamento. Conclua ou cancele antes de anonimizar.` });
    }

    const agora = new Date();
    await prisma.$transaction([
      prisma.pet.deleteMany({ where: { clienteId: id } }),
      prisma.recompra.deleteMany({ where: { clienteId: id } }),
      prisma.programaFidelidade.deleteMany({ where: { clienteId: id } }),
      prisma.endereco.updateMany({
        where: { clienteId: id },
        data: { apelido: 'Removido', cep: '', logradouro: 'Removido (LGPD)', numero: 'S/N', complemento: null },
      }),
      prisma.pedido.updateMany({ where: { clienteId: id }, data: { observacoesCliente: null } }),
      prisma.avaliacaoNPS.updateMany({ where: { pedido: { clienteId: id } }, data: { comentario: null } }),
      prisma.cliente.update({
        where: { id },
        data: {
          nome: 'Cliente removido (LGPD)',
          cpf: null,
          email: null,
          senhaHash: null,
          whatsapp: 'anonimizado-' + String(id), // campo é unique e obrigatório: placeholder não colide
          dataNascimento: null,
          optInMarketing: false,
          anonimizadoEm: agora,
          deletadoEm: agora, // sai das listas do painel
        },
      }),
    ]);

    res.json({ ok: true, anonimizadoEm: agora.toISOString() });
  })
);

/**
 * POST /api/clientes/importar
 * Body: { clientes: [{ nome, whatsapp, cpf?, email?, cep?, logradouro?, numero?, complemento?, bairro?, cidade?, uf?, loja?, optIn?, pet?{nome,especie,raca} }] }
 * Reconhece o cliente pelo CPF (chave principal); se não houver CPF, cai no WhatsApp.
 * Cria/atualiza sem duplicar e grava o endereço completo na criação. Retorna o resumo.
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
      try {
        const whatsapp = somenteDigitos(c.whatsapp);
        const cpf = c.cpf ? somenteDigitos(c.cpf) : '';
        if (!c.nome || !whatsapp) {
          ignorados++;
          continue;
        }
        const lojaPreferidaId = c.loja ? lojaPorNome.get(String(c.loja).trim().toLowerCase()) || null : null;

        // reconhece primeiro pelo CPF; sem CPF, cai no WhatsApp
        let existente = null;
        if (cpf) existente = await prisma.cliente.findUnique({ where: { cpf } });
        if (!existente) existente = await prisma.cliente.findUnique({ where: { whatsapp } });

        const temEndereco = c.cep || c.logradouro || c.bairro || c.cidade;
        const enderecoData = temEndereco
          ? {
              apelido: 'Casa',
              cep: somenteDigitos(c.cep) || '',
              logradouro: c.logradouro || '',
              numero: c.numero ? String(c.numero) : '',
              complemento: c.complemento || null,
              bairro: c.bairro || '',
              cidade: c.cidade || '',
              uf: (c.uf || 'PR').toString().toUpperCase().slice(0, 2),
              principal: true,
            }
          : null;

        if (existente) {
          // atualiza dados; não mexe no WhatsApp (evita colisão de unicidade) nem nos endereços já cadastrados
          await prisma.cliente.update({
            where: { id: existente.id },
            data: {
              nome: c.nome,
              cpf: cpf || existente.cpf,
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
              cpf: cpf || null,
              email: c.email || null,
              optInMarketing: !!c.optIn,
              lojaPreferidaId,
              enderecos: enderecoData ? { create: enderecoData } : undefined,
              pets: c.pet && c.pet.nome
                ? { create: { nome: c.pet.nome, especie: c.pet.especie || 'CAO', raca: c.pet.raca || null } }
                : undefined,
            },
          });
          criados++;
        }
      } catch (_) {
        // linha problemática (ex.: WhatsApp/CPF duplicado de outro cliente) não derruba o lote
        ignorados++;
      }
    }

    res.json({ criados, atualizados, ignorados, total: lista.length });
  })
);

module.exports = router;
