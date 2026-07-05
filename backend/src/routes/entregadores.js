// backend/src/routes/entregadores.js
// Entregadores = usuários com papel ENTREGADOR.
// Listar / criar / editar (sem exclusão física: desativa via ativo=false,
// pois um entregador pode ter entregas no histórico).

const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');
const { autenticar, exigirPapel } = require('../middlewares/auth');

const router = express.Router();

const sel = { id: true, nome: true, email: true, telefone: true, ativo: true, lojaId: true };

// GET /api/entregadores — lista (filtros: ativo, lojaId)
router.get(
  '/',
  autenticar,
  asyncHandler(async (req, res) => {
    const { ativo, lojaId } = req.query;
    const where = { papel: 'ENTREGADOR' };
    if (ativo === 'true') where.ativo = true;
    if (ativo === 'false') where.ativo = false;
    if (lojaId) where.lojaId = BigInt(lojaId);
    const lista = await prisma.usuario.findMany({
      where,
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      select: { ...sel, loja: { select: { id: true, nome: true } }, _count: { select: { entregas: true } } },
    });
    res.json(serializarBigInt({ data: lista, total: lista.length }));
  })
);

// POST /api/entregadores — cria entregador (Usuario papel ENTREGADOR)
router.post(
  '/',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (!b.nome || !b.email) return res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' });
    // Senha é opcional: se não vier (ou curta), gera uma aleatória — o entregador só
    // consegue logar no app dele depois que um admin definir uma senha de verdade.
    const senha = b.senha && String(b.senha).length >= 4 ? String(b.senha) : `${Math.random().toString(36).slice(2)}A1!`;
    const senhaHash = bcrypt.hashSync(senha, 10);
    try {
      const u = await prisma.usuario.create({
        data: {
          nome: String(b.nome).trim(),
          email: String(b.email).trim().toLowerCase(),
          senhaHash,
          papel: 'ENTREGADOR',
          telefone: b.telefone || null,
          lojaId: b.lojaId ? BigInt(b.lojaId) : null,
          ativo: b.ativo !== false,
        },
        select: sel,
      });
      res.status(201).json(serializarBigInt(u));
    } catch (e) {
      if (e && e.code === 'P2002') return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
      throw e;
    }
  })
);

// PATCH /api/entregadores/:id — edita (nome, telefone, loja, ativo, senha)
router.patch(
  '/:id',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id);
    const b = req.body || {};
    const data = {};
    if ('nome' in b) data.nome = String(b.nome).trim();
    if ('email' in b) data.email = String(b.email).trim().toLowerCase();
    if ('telefone' in b) data.telefone = b.telefone || null;
    if ('lojaId' in b) data.lojaId = b.lojaId ? BigInt(b.lojaId) : null;
    if ('ativo' in b) data.ativo = !!b.ativo;
    if (b.senha && String(b.senha).length >= 4) data.senhaHash = bcrypt.hashSync(String(b.senha), 10);
    try {
      const u = await prisma.usuario.update({ where: { id }, data, select: sel });
      res.json(serializarBigInt(u));
    } catch (e) {
      if (e && e.code === 'P2002') return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
      if (e && e.code === 'P2025') return res.status(404).json({ erro: 'Entregador não encontrado.' });
      throw e;
    }
  })
);

// ─────────────────────────────────────────────────────────────
// App do Entregador — rotas do próprio entregador logado
// ─────────────────────────────────────────────────────────────

// GET /api/entregadores/me/entregas — entregas atribuídas ao entregador logado
router.get(
  '/me/entregas',
  autenticar,
  exigirPapel('ENTREGADOR', 'ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const meuId = BigInt(req.usuario.id);
    const pedidos = await prisma.pedido.findMany({
      where: {
        deletadoEm: null,
        entrega: { entregadorId: meuId },
        status: { in: ['ACEITO', 'EM_SEPARACAO', 'SEPARADO', 'EM_ROTA', 'ENTREGUE'] },
      },
      orderBy: { pedidoEm: 'desc' },
      take: 60,
      include: {
        cliente: { select: { nome: true, whatsapp: true } },
        loja: { select: { nome: true } },
        enderecoEntrega: true,
        itens: { select: { quantidade: true, produto: { select: { nome: true } } } },
        entrega: { select: { atribuidaEm: true, aceitoEm: true, saidaEm: true, entregueEm: true } },
      },
    });
    res.json(serializarBigInt({ data: pedidos }));
  })
);

// PATCH /api/entregadores/me/entregas/:pedidoId/status — marca saída/entrega (só nos pedidos do próprio entregador)
router.patch(
  '/me/entregas/:pedidoId/status',
  autenticar,
  exigirPapel('ENTREGADOR', 'ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const pedidoId = BigInt(req.params.pedidoId);
    const meuId = BigInt(req.usuario.id);
    const status = req.body && req.body.status;
    // O entregador só confirma a ENTREGA. A saída da loja é confirmada pela expedição.
    if (status !== 'ENTREGUE') {
      return res.status(400).json({ erro: 'O entregador só pode confirmar a entrega (ENTREGUE).' });
    }
    const entrega = await prisma.entrega.findUnique({ where: { pedidoId }, include: { pedido: { select: { status: true } } } });
    if (!entrega) return res.status(404).json({ erro: 'Entrega não encontrada para este pedido.' });
    const ehDono = entrega.entregadorId === meuId;
    const ehGestor = req.usuario.papel === 'ADMIN' || req.usuario.papel === 'OPERADOR';
    if (!ehDono && !ehGestor) return res.status(403).json({ erro: 'Esta entrega não está atribuída a você.' });
    if (entrega.pedido.status !== 'EM_ROTA') {
      return res.status(409).json({ erro: 'Só dá pra confirmar a entrega depois que a loja registrar a saída.' });
    }

    await prisma.pedido.update({ where: { id: pedidoId }, data: { status: 'ENTREGUE' } });
    await prisma.entrega.update({
      where: { pedidoId },
      data: { entregueEm: new Date(), saidaEm: entrega.saidaEm || new Date() },
    });
    try {
      await prisma.statusPedidoHistorico.create({
        data: { pedidoId, statusAnterior: 'EM_ROTA', statusNovo: 'ENTREGUE', usuarioId: meuId, motivo: 'Confirmada pelo entregador' },
      });
    } catch (e) { /* histórico é best-effort */ }
    res.json({ ok: true, status: 'ENTREGUE' });
  })
);

// GET /api/entregadores/me/disponiveis — pedidos SEPARADO ainda sem entregador (oferta a todos)
// Escopo por loja: entregador só vê pedidos da loja em que ele trabalha.
// Fallback seguro: se o usuário não tem lojaId (ex.: ADMIN/OPERADOR usando o app,
// ou entregador legado sem loja definida), mostra tudo — evita esconder pedidos
// por engano de cadastro.
router.get(
  '/me/disponiveis',
  autenticar,
  exigirPapel('ENTREGADOR', 'ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const meuId = BigInt(req.usuario.id);
    const eu = await prisma.usuario.findUnique({ where: { id: meuId }, select: { lojaId: true } });
    const where = { status: 'SEPARADO', deletadoEm: null, entrega: { is: null } };
    if (eu && eu.lojaId) where.lojaId = eu.lojaId;
    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { pedidoEm: 'asc' },
      take: 40,
      include: {
        cliente: { select: { nome: true, whatsapp: true } },
        loja: { select: { nome: true } },
        enderecoEntrega: true,
        itens: { select: { quantidade: true, produto: { select: { nome: true } } } },
      },
    });
    res.json(serializarBigInt({ data: pedidos }));
  })
);

// POST /api/entregadores/me/entregas/:pedidoId/aceitar — entregador assume a entrega (quem aceita primeiro leva)
router.post(
  '/me/entregas/:pedidoId/aceitar',
  autenticar,
  exigirPapel('ENTREGADOR', 'ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const pedidoId = BigInt(req.params.pedidoId);
    const meuId = BigInt(req.usuario.id);
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { id: true, status: true, deletadoEm: true } });
    if (!pedido || pedido.deletadoEm) return res.status(404).json({ erro: 'Pedido não encontrado.' });
    if (pedido.status !== 'SEPARADO') return res.status(409).json({ erro: 'Este pedido não está mais disponível.' });

    const existente = await prisma.entrega.findUnique({ where: { pedidoId } });
    if (existente) {
      // Pedido foi direcionado a um entregador específico.
      if (existente.entregadorId !== meuId) return res.status(409).json({ erro: 'Esta entrega foi direcionada a outro entregador.' });
      if (existente.aceitoEm) return res.json({ ok: true }); // já aceito por mim
      await prisma.entrega.update({ where: { pedidoId }, data: { aceitoEm: new Date() } });
      return res.json({ ok: true });
    }
    try {
      // Oferta aberta: quem aceita primeiro leva (pedidoId @unique garante).
      await prisma.entrega.create({ data: { pedidoId, entregadorId: meuId, aceitoEm: new Date() } });
      res.status(201).json({ ok: true });
    } catch (e) {
      if (e && e.code === 'P2002') return res.status(409).json({ erro: 'Esta entrega já foi aceita por outro entregador.' });
      throw e;
    }
  })
);

// GET /api/entregadores/me/direcionadas — pedidos direcionados a MIM, aguardando meu aceite
router.get(
  '/me/direcionadas',
  autenticar,
  exigirPapel('ENTREGADOR', 'ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const meuId = BigInt(req.usuario.id);
    const pedidos = await prisma.pedido.findMany({
      where: {
        status: 'SEPARADO',
        deletadoEm: null,
        entrega: { entregadorId: meuId, aceitoEm: null },
      },
      orderBy: { pedidoEm: 'asc' },
      take: 40,
      include: {
        cliente: { select: { nome: true, whatsapp: true } },
        loja: { select: { nome: true } },
        enderecoEntrega: true,
        itens: { select: { quantidade: true, produto: { select: { nome: true } } } },
      },
    });
    res.json(serializarBigInt({ data: pedidos }));
  })
);

module.exports = router;
