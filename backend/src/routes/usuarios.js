// backend/src/routes/usuarios.js
// Gestão de logins (todos os papéis: ADMIN, OPERADOR, ENTREGADOR). Apenas ADMIN acessa.
const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');
const { autenticar, exigirPapel } = require('../middlewares/auth');

const router = express.Router();
const PAPEIS = ['ADMIN', 'OPERADOR', 'ENTREGADOR'];
const sel = {
  id: true, nome: true, email: true, telefone: true, papel: true, ativo: true, lojaId: true,
  loja: { select: { id: true, nome: true } },
};

// GET /api/usuarios — lista (filtros opcionais: papel, ativo, lojaId)
router.get(
  '/',
  autenticar,
  exigirPapel('ADMIN'),
  asyncHandler(async (req, res) => {
    const { papel, ativo, lojaId } = req.query;
    const where = {};
    if (papel) where.papel = papel;
    if (ativo === 'true') where.ativo = true;
    if (ativo === 'false') where.ativo = false;
    if (lojaId) where.lojaId = BigInt(lojaId);
    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      select: sel,
    });
    res.json(serializarBigInt({ data: usuarios }));
  })
);

// POST /api/usuarios — cria login
router.post(
  '/',
  autenticar,
  exigirPapel('ADMIN'),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (!b.nome || !b.email || !b.senha) return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
    if (!PAPEIS.includes(b.papel)) return res.status(400).json({ erro: 'Papel inválido.' });
    if (String(b.senha).length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
    try {
      const u = await prisma.usuario.create({
        data: {
          nome: b.nome,
          email: String(b.email).trim().toLowerCase(),
          telefone: b.telefone || null,
          senhaHash: bcrypt.hashSync(b.senha, 10),
          papel: b.papel,
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

// PATCH /api/usuarios/:id — atualiza (senha só muda se enviada)
router.patch(
  '/:id',
  autenticar,
  exigirPapel('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id);
    const b = req.body || {};
    const data = {};
    if (b.nome != null) data.nome = b.nome;
    if (b.email != null) data.email = String(b.email).trim().toLowerCase();
    if (b.telefone !== undefined) data.telefone = b.telefone || null;
    if (b.papel != null) {
      if (!PAPEIS.includes(b.papel)) return res.status(400).json({ erro: 'Papel inválido.' });
      data.papel = b.papel;
    }
    if (b.lojaId !== undefined) data.lojaId = b.lojaId ? BigInt(b.lojaId) : null;
    if (b.ativo != null) data.ativo = !!b.ativo;
    if (b.senha) {
      if (String(b.senha).length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
      data.senhaHash = bcrypt.hashSync(b.senha, 10);
    }
    try {
      const u = await prisma.usuario.update({ where: { id }, data, select: sel });
      res.json(serializarBigInt(u));
    } catch (e) {
      if (e && e.code === 'P2002') return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
      if (e && e.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado.' });
      throw e;
    }
  })
);

module.exports = router;
