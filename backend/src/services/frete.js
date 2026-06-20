// Serviço de cálculo de frete
// Regra: encontra a zona de entrega que atende o CEP/bairro, da loja escolhida
const { prisma } = require('../lib/prisma');

/**
 * Calcula o frete para uma entrega.
 * @param {Object} params
 * @param {BigInt} params.lojaId - Loja que vai despachar
 * @param {string} params.cep - CEP destino (apenas dígitos)
 * @param {string} params.bairro - Bairro destino
 * @param {number} params.valorPedido - Valor do pedido para validar frete grátis
 * @returns {Promise<{atendido: boolean, taxa: number, prazoMinHoras?: number, prazoMaxHoras?: number, zonaId?: string}>}
 */
async function calcularFrete({ lojaId, cep, bairro, valorPedido }) {
  const cepLimpo = (cep || '').replace(/\D/g, '');

  // Busca zonas ativas dessa loja, ordenadas por prioridade
  const zonas = await prisma.zonaEntrega.findMany({
    where: { lojaId, ativa: true },
    orderBy: { prioridade: 'desc' }
  });

  // Encontra a primeira zona que atende
  let zonaEncontrada = null;
  for (const zona of zonas) {
    // Match por faixa de CEP
    if (zona.cepInicio && zona.cepFim) {
      if (cepLimpo >= zona.cepInicio.replace(/\D/g, '') && cepLimpo <= zona.cepFim.replace(/\D/g, '')) {
        zonaEncontrada = zona;
        break;
      }
    }
    // Match por bairro (ignora acento e maiúsc/minúsc)
    if (zona.bairros && bairro) {
      const norm = (x) => (x || '').toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const alvo = norm(bairro);
      const match = zona.bairros.some((b) => norm(b) === alvo);
      if (match) {
        zonaEncontrada = zona;
        break;
      }
    }
  }

  if (!zonaEncontrada) {
    return { atendido: false, taxa: 0 };
  }

  // Determina a taxa
  let taxa = Number(zonaEncontrada.taxaFrete);

  // Frete grátis se aplicável
  if (zonaEncontrada.valorFreteGratis && valorPedido >= Number(zonaEncontrada.valorFreteGratis)) {
    taxa = 0;
  }
  // Taxa diferente acima de certo valor (opcional)
  else if (zonaEncontrada.taxaFreteAcimaDe && valorPedido >= Number(zonaEncontrada.taxaFreteAcimaDe)) {
    taxa = Number(zonaEncontrada.taxaFreteAcimaDe);
  }

  return {
    atendido: true,
    taxa,
    prazoMinHoras: zonaEncontrada.prazoMinHoras,
    prazoMaxHoras: zonaEncontrada.prazoMaxHoras,
    zonaId: zonaEncontrada.id.toString()
  };
}

module.exports = { calcularFrete };
