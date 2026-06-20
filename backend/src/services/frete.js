// Serviço de cálculo de frete
// Regra: encontra a zona de entrega que atende o destino, da loja escolhida.
// Precedência de match: 1) faixa de CEP  2) CIDADE (desambigua cidades vizinhas)  3) BAIRRO (cidade de origem)
const { prisma } = require('../lib/prisma');

const _norm = (x) => (x == null ? '' : String(x)).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const _normBairro = (x) => _norm(x).replace(/^(jardim|jd|jdim|vila|vl|conjunto|conj|cj|parque|pq|residencial|resid|chacara|gleba|setor)\s+/i, '').trim();

/**
 * Calcula o frete para uma entrega.
 * @param {Object} params
 * @param {BigInt} params.lojaId - Loja que vai despachar
 * @param {string} params.cep - CEP destino
 * @param {string} params.bairro - Bairro destino
 * @param {string} params.cidade - Cidade destino
 * @param {number} params.valorPedido - Valor do pedido (para frete grátis)
 * @returns {Promise<{atendido: boolean, taxa: number, prazoMinHoras?: number, prazoMaxHoras?: number, zonaId?: string}>}
 */
async function calcularFrete({ lojaId, cep, bairro, cidade, valorPedido }) {
  const cepLimpo = (cep || '').replace(/\D/g, '');

  const zonas = await prisma.zonaEntrega.findMany({
    where: { lojaId, ativa: true },
    orderBy: { prioridade: 'desc' },
  });

  let zonaEncontrada = null;

  // 1) Faixa de CEP (mais especifico)
  for (const z of zonas) {
    if (z.cepInicio && z.cepFim) {
      const ini = z.cepInicio.replace(/\D/g, '');
      const fim = z.cepFim.replace(/\D/g, '');
      if (cepLimpo && cepLimpo >= ini && cepLimpo <= fim) { zonaEncontrada = z; break; }
    }
  }

  // 2) Cidade (resolve cidades vizinhas: Cambe, Ibipora, etc.)
  if (!zonaEncontrada && cidade) {
    const alvo = _norm(cidade);
    for (const z of zonas) {
      if (z.cidades && z.cidades.some((c) => _norm(c) === alvo)) { zonaEncontrada = z; break; }
    }
  }

  // 3) Bairro (cidade de origem da loja) — casa por nome exato OU ignorando prefixo (Jardim/Vila/Conj.)
  if (!zonaEncontrada && bairro) {
    const alvo = _norm(bairro);
    const alvoB = _normBairro(bairro);
    for (const z of zonas) {
      if (z.bairros && z.bairros.some((b) => _norm(b) === alvo || _normBairro(b) === alvoB)) { zonaEncontrada = z; break; }
    }
  }

  if (!zonaEncontrada) {
    return { atendido: false, taxa: 0 };
  }

  let taxa = Number(zonaEncontrada.taxaFrete);
  if (zonaEncontrada.valorFreteGratis && valorPedido >= Number(zonaEncontrada.valorFreteGratis)) {
    taxa = 0;
  } else if (zonaEncontrada.taxaFreteAcimaDe && valorPedido >= Number(zonaEncontrada.taxaFreteAcimaDe)) {
    taxa = Number(zonaEncontrada.taxaFreteAcimaDe);
  }

  return {
    atendido: true,
    taxa,
    prazoMinHoras: zonaEncontrada.prazoMinHoras,
    prazoMaxHoras: zonaEncontrada.prazoMaxHoras,
    zonaId: zonaEncontrada.id.toString(),
  };
}

module.exports = { calcularFrete };
