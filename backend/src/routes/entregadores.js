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

module.exports = router;
