// Empório dos Animais — Servidor principal
// Stack: Node.js + Express + Prisma + PostgreSQL

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { logger } = require('./lib/logger');
const { prisma } = require('./lib/prisma');

// Rotas
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const lojaRoutes = require('./routes/lojas');
const produtoRoutes = require('./routes/produtos');
const clienteRoutes = require('./routes/clientes');
const pedidoRoutes = require('./routes/pedidos');
const zonaEntregaRoutes = require('./routes/zonas-entrega');
const freteRoutes = require('./routes/frete');
const entregadorRoutes = require('./routes/entregadores');
const usuarioRoutes = require('./routes/usuarios');
const pushRoutes = require('./routes/push');

const app = express();
const PORT = process.env.PORT || 3001;

// =====================
// Middlewares globais
// =====================
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Rate limit para a API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// =====================
// Rotas
// =====================
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/lojas', lojaRoutes);
app.use('/api/produtos', produtoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/zonas-entrega', zonaEntregaRoutes);
app.use('/api/frete', freteRoutes);
app.use('/api/entregadores', entregadorRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/push', pushRoutes);

// Página inicial — informativa
app.get('/', (req, res) => {
  res.json({
    sistema: 'Empório dos Animais — API',
    versao: '0.1.0',
    consultoria: 'Negrão — Diagnóstico & Soluções Empresariais',
    health: '/health',
    api: '/api/*'
  });
});

// =====================
// Tratamento de erros
// =====================
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada', caminho: req.path });
});

app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack, path: req.path }, 'Erro não tratado');
  res.status(err.status || 500).json({
    erro: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV !== 'production' && { detalhes: err.stack })
  });
});

// =====================
// Inicialização
// =====================
async function start() {
  try {
    await prisma.$connect();
    logger.info('Conectado ao banco de dados');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Servidor rodando na porta ${PORT}`);
      logger.info(`Acesse: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Falha ao iniciar o servidor');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido, fechando conexões...');
  await prisma.$disconnect();
  process.exit(0);
});

start();
