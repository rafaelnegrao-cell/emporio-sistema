// Cliente Prisma singleton — evita conexões múltiplas em hot reload
const { PrismaClient } = require('@prisma/client');

const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error']
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

module.exports = { prisma };
