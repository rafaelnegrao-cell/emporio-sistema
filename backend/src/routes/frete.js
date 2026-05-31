// Cotação de frete — endpoint público para o app calcular antes do checkout
const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../utils/async-handler');
const { calcularFrete } = require('../services/frete');
const { prisma } = require('../lib/prisma');
const { serializarBigInt } = require('../utils/serializar');

const router = express.Router();

const cotacaoSchema = z.object({
  cep: z.string().min(8),
  bairro: z.string().optional().default(''),
  valorPedido: z.number().nonnegative(),
  lojaId: z.union([z.string(), z.number()]).optional()
});

router.post('/cotar', asyncHandler(async (req, res) => {
  const { cep, bairro, valorPedido, lojaId } = cotacaoSchema.parse(req.body);

  // Se loja específica foi passada, cota só dela
  if (lojaId) {
    const cotacao = await calcularFrete({
      lojaId: BigInt(lojaId), cep, bairro, valorPedido
    });
    return res.json(serializarBigInt(cotacao));
  }

  // Caso contrário, cota em todas as lojas do escopo e retorna a melhor opção
  const lojas = await prisma.loja.findMany({
    where: { ativa: true, noEscopoDelivery: true }
  });

  const cotacoes = await Promise.all(
    lojas.map(async (loja) => {
      const c = await calcularFrete({ lojaId: loja.id, cep, bairro, valorPedido });
      return { lojaId: loja.id.toString(), lojaNome: loja.nome, ...c };
    })
  );

  const atendidas = cotacoes.filter(c => c.atendido);
  if (atendidas.length === 0) {
    return res.json({ atendido: false, cotacoes: cotacoes });
  }

  // Melhor opção: menor taxa; em empate, menor prazo
  atendidas.sort((a, b) => {
    if (a.taxa !== b.taxa) return a.taxa - b.taxa;
    return (a.prazoMaxHoras || 999) - (b.prazoMaxHoras || 999);
  });

  res.json({
    atendido: true,
    melhorOpcao: atendidas[0],
    todasOpcoes: atendidas
  });
}));

module.exports = router;
