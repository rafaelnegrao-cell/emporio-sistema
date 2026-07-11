// backend/src/routes/push.js
// Inscrição de aparelhos para notificações push (Web Push/VAPID).
// Montada em /api/push no server.js. Todas as rotas exigem login.

const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');
const { autenticar } = require('../middlewares/auth');
const { pushDisponivel, chavePublica, enviarParaUsuarios } = require('../services/push');

const router = express.Router();

// GET /api/push/chave-publica — o navegador precisa dela para se inscrever.
router.get(
  '/chave-publica',
  autenticar,
  asyncHandler(async (req, res) => {
    if (!pushDisponivel()) {
      return res.status(503).json({ erro: 'Push não configurado no servidor (chaves VAPID ausentes).' });
    }
    res.json({ chave: chavePublica() });
  })
);

// POST /api/push/inscrever — registra (ou atualiza) a inscrição deste aparelho.
// Body: { endpoint, keys: { p256dh, auth } }  (formato do PushSubscription.toJSON())
router.post(
  '/inscrever',
  autenticar,
  asyncHandler(async (req, res) => {
    if (!pushDisponivel()) {
      return res.status(503).json({ erro: 'Push não configurado no servidor.' });
    }
    const b = req.body || {};
    const keys = b.keys || {};
    if (!b.endpoint || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ erro: 'Inscrição inválida (endpoint/keys ausentes).' });
    }
    const usuarioId = BigInt(req.usuario.id);
    // endpoint é @unique: se o mesmo aparelho reinscrever (até por outro usuário
    // no mesmo celular), a inscrição passa a valer para o usuário logado agora.
    await prisma.pushSubscription.upsert({
      where: { endpoint: b.endpoint },
      update: { usuarioId, p256dh: keys.p256dh, auth: keys.auth },
      create: { usuarioId, endpoint: b.endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ ok: true });
  })
);

// POST /api/push/desinscrever — remove a inscrição deste aparelho.
// Body: { endpoint }
router.post(
  '/desinscrever',
  autenticar,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (!b.endpoint) return res.status(400).json({ erro: 'endpoint é obrigatório.' });
    await prisma.pushSubscription.deleteMany({ where: { endpoint: b.endpoint } });
    res.json({ ok: true });
  })
);

// POST /api/push/teste — envia uma notificação de teste para o PRÓPRIO usuário.
// Usado logo após ativar, para o entregador ver na hora que funcionou.
router.post(
  '/teste',
  autenticar,
  asyncHandler(async (req, res) => {
    if (!pushDisponivel()) {
      return res.status(503).json({ erro: 'Push não configurado no servidor.' });
    }
    const r = await enviarParaUsuarios([BigInt(req.usuario.id)], {
      titulo: 'Notificações ativadas ✓',
      corpo: 'Este aparelho vai avisar quando houver entrega nova para você.',
      url: '/entregador',
      tag: 'teste-push',
    });
    res.json({ ok: true, enviados: r.enviados });
  })
);

module.exports = router;
