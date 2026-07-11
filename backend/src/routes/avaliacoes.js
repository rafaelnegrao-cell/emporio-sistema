// backend/src/routes/avaliacoes.js
// Avaliação pós-entrega (NPS) — rotas PÚBLICAS, acessadas pelo link que o
// cliente recebe no WhatsApp após a entrega (/avaliar?t=TOKEN no frontend).
// Segurança: o token é aleatório (32 hex), único por pedido, gerado só quando
// o pedido vira ENTREGUE. Sem token válido, nada é lido nem gravado.

const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');

const router = express.Router();

function tokenValido(t) {
  return typeof t === 'string' && /^[a-f0-9]{24,64}$/i.test(t);
}

// GET /api/avaliacoes/:token — dados mínimos para montar a tela de avaliação.
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    if (!tokenValido(token)) return res.status(404).json({ erro: 'Link inválido.' });
    const p = await prisma.pedido.findUnique({
      where: { tokenAvaliacao: token },
      select: {
        numero: true,
        status: true,
        entregueEm: true,
        cliente: { select: { nome: true } },
        loja: { select: { nome: true } },
        avaliacaoNPS: { select: { notaGeral: true, respondidoEm: true } },
      },
    });
    if (!p) return res.status(404).json({ erro: 'Link inválido ou expirado.' });
    if (p.status !== 'ENTREGUE') return res.status(400).json({ erro: 'Este pedido ainda não foi entregue.' });
    const primeiroNome = (p.cliente && p.cliente.nome ? p.cliente.nome : '').trim().split(' ')[0] || null;
    res.json(serializarBigInt({
      numero: p.numero,
      loja: p.loja && p.loja.nome,
      cliente: primeiroNome,
      entregueEm: p.entregueEm,
      jaAvaliado: !!p.avaliacaoNPS,
      notaAnterior: p.avaliacaoNPS ? p.avaliacaoNPS.notaGeral : null,
    }));
  })
);

// POST /api/avaliacoes/:token — grava a avaliação. Body: { notaGeral: 0-10, comentario? }
// Uma avaliação por pedido (pedidoId é unique no modelo).
router.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    if (!tokenValido(token)) return res.status(404).json({ erro: 'Link inválido.' });
    const b = req.body || {};
    const nota = parseInt(b.notaGeral, 10);
    if (!(nota >= 0 && nota <= 10)) return res.status(400).json({ erro: 'Escolha uma nota de 0 a 10.' });
    let comentario = typeof b.comentario === 'string' ? b.comentario.trim().slice(0, 1000) : null;
    if (!comentario) comentario = null;

    const p = await prisma.pedido.findUnique({
      where: { tokenAvaliacao: token },
      select: { id: true, status: true, avaliacaoNPS: { select: { id: true } } },
    });
    if (!p) return res.status(404).json({ erro: 'Link inválido ou expirado.' });
    if (p.status !== 'ENTREGUE') return res.status(400).json({ erro: 'Este pedido ainda não foi entregue.' });
    if (p.avaliacaoNPS) return res.status(409).json({ erro: 'Este pedido já foi avaliado. Obrigado!' });

    try {
      await prisma.avaliacaoNPS.create({
        data: { pedidoId: p.id, notaGeral: nota, comentario },
      });
    } catch (e) {
      if (e && e.code === 'P2002') return res.status(409).json({ erro: 'Este pedido já foi avaliado. Obrigado!' });
      throw e;
    }
    res.status(201).json({ ok: true });
  })
);

module.exports = router;
