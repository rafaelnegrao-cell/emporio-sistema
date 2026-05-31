// Autenticação — operadores (Usuario) e clientes (Cliente)
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { gerarToken } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

// ============================================================
// LOGIN DE OPERADOR (backoffice e entregador)
// ============================================================
const loginOperadorSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1)
});

router.post('/operador/login', asyncHandler(async (req, res) => {
  const { email, senha } = loginOperadorSchema.parse(req.body);

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { loja: true }
  });

  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaCorreta) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date() }
  });

  const token = gerarToken({
    id: usuario.id.toString(),
    email: usuario.email,
    papel: usuario.papel,
    lojaId: usuario.lojaId?.toString() || null,
    tipo: 'operador'
  });

  res.json({
    token,
    usuario: {
      id: usuario.id.toString(),
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      loja: usuario.loja ? { id: usuario.loja.id.toString(), nome: usuario.loja.nome } : null
    }
  });
}));

// ============================================================
// LOGIN DE CLIENTE
// ============================================================
const loginClienteSchema = z.object({
  whatsapp: z.string().min(10),
  senha: z.string().min(1)
});

router.post('/cliente/login', asyncHandler(async (req, res) => {
  const { whatsapp, senha } = loginClienteSchema.parse(req.body);

  const cliente = await prisma.cliente.findUnique({
    where: { whatsapp: normalizarTelefone(whatsapp) }
  });

  if (!cliente || cliente.deletadoEm || !cliente.senhaHash) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const senhaCorreta = await bcrypt.compare(senha, cliente.senhaHash);
  if (!senhaCorreta) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { ultimoLogin: new Date() }
  });

  const token = gerarToken({
    id: cliente.id.toString(),
    whatsapp: cliente.whatsapp,
    tipo: 'cliente'
  });

  res.json({
    token,
    cliente: {
      id: cliente.id.toString(),
      nome: cliente.nome,
      whatsapp: cliente.whatsapp,
      email: cliente.email
    }
  });
}));

// ============================================================
// CADASTRO DE CLIENTE
// ============================================================
const cadastroClienteSchema = z.object({
  nome: z.string().min(2),
  whatsapp: z.string().min(10),
  senha: z.string().min(6),
  email: z.string().email().optional(),
  cpf: z.string().optional(),
  optInMarketing: z.boolean().optional()
});

router.post('/cliente/cadastro', asyncHandler(async (req, res) => {
  const dados = cadastroClienteSchema.parse(req.body);
  const whatsapp = normalizarTelefone(dados.whatsapp);

  const existente = await prisma.cliente.findUnique({ where: { whatsapp } });
  if (existente) {
    return res.status(409).json({ erro: 'WhatsApp já cadastrado' });
  }

  const senhaHash = await bcrypt.hash(dados.senha, 10);

  const cliente = await prisma.cliente.create({
    data: {
      nome: dados.nome,
      whatsapp,
      senhaHash,
      email: dados.email,
      cpf: dados.cpf,
      optInMarketing: dados.optInMarketing ?? false
    }
  });

  const token = gerarToken({
    id: cliente.id.toString(),
    whatsapp: cliente.whatsapp,
    tipo: 'cliente'
  });

  res.status(201).json({
    token,
    cliente: {
      id: cliente.id.toString(),
      nome: cliente.nome,
      whatsapp: cliente.whatsapp
    }
  });
}));

/** Remove caracteres não-numéricos do telefone */
function normalizarTelefone(tel) {
  return tel.replace(/\D/g, '');
}

module.exports = router;
