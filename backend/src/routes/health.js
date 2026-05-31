// Health check — Railway usa para verificar se o serviço está vivo
const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  // Confirma conexão com o banco
  await prisma.$queryRaw`SELECT 1`;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    versao: '0.1.0'
  });
}));

module.exports = router;
