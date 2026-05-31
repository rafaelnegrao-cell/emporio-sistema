// Serializadores — converte BigInt e Decimal para tipos JSON-friendly

/**
 * Converte BigInt -> string e Decimal -> number em objetos aninhados.
 * Use antes de res.json() em respostas que tenham IDs do Prisma.
 */
function serializarBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (obj && typeof obj === 'object' && obj.constructor?.name === 'Decimal') {
    return Number(obj.toString());
  }
  if (Array.isArray(obj)) return obj.map(serializarBigInt);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializarBigInt(v);
    }
    return out;
  }
  return obj;
}

module.exports = { serializarBigInt };
