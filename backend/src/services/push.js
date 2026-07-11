// backend/src/services/push.js
// Web Push (VAPID) — notificações reais para o app do entregador.
//
// Configuração (variáveis no Railway, serviço do backend):
//   VAPID_PUBLIC_KEY   — chave pública (também vai pro navegador)
//   VAPID_PRIVATE_KEY  — chave privada (só no servidor)
//   VAPID_SUBJECT      — contato do responsável (opcional; default mailto do Rafael)
//
// Tudo aqui é BEST-EFFORT: falha de push nunca derruba a operação do pedido.
// Inscrições mortas (endpoint respondendo 404/410) são removidas do banco.

const webpush = require('web-push');
const { prisma } = require('../lib/prisma');
const { logger } = require('../lib/logger');

let configurado = false;
(function configurar() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:rafaelmnegrao@gmail.com';
  if (!pub || !priv) {
    logger.warn('Push desativado: defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no Railway.');
    return;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configurado = true;
    logger.info('Web Push configurado (VAPID).');
  } catch (e) {
    logger.error({ err: e.message }, 'Chaves VAPID inválidas — push desativado.');
  }
})();

function pushDisponivel() {
  return configurado;
}

function chavePublica() {
  return configurado ? process.env.VAPID_PUBLIC_KEY : null;
}

// Envia um payload para TODAS as inscrições dos usuários informados.
// usuarioIds: array de BigInt. payload: { titulo, corpo, url?, tag? }.
async function enviarParaUsuarios(usuarioIds, payload) {
  if (!configurado || !usuarioIds || !usuarioIds.length) return { enviados: 0 };
  const subs = await prisma.pushSubscription.findMany({
    where: { usuarioId: { in: usuarioIds } },
  });
  if (!subs.length) return { enviados: 0 };

  const corpo = JSON.stringify(payload);
  let enviados = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          corpo,
          { TTL: 15 * 60 } // oferta perde a validade rápido; 15 min de fila basta
        );
        enviados++;
      } catch (e) {
        const code = e && e.statusCode;
        if (code === 404 || code === 410) {
          // Aparelho desinscrito/expirado: limpa do banco.
          try { await prisma.pushSubscription.delete({ where: { id: s.id } }); } catch (_) {}
        } else {
          logger.warn({ err: e.message, code }, 'Falha ao enviar push (ignorada).');
        }
      }
    })
  );
  return { enviados };
}

// Oferta aberta: notifica os entregadores ativos da loja do pedido.
// Mesma regra do escopo por loja: entregador SEM loja definida vê (e recebe) tudo.
async function notificarNovaOferta(pedido) {
  if (!configurado) return;
  try {
    const entregadores = await prisma.usuario.findMany({
      where: {
        papel: 'ENTREGADOR',
        ativo: true,
        OR: [{ lojaId: pedido.lojaId }, { lojaId: null }],
      },
      select: { id: true },
    });
    if (!entregadores.length) return;
    await enviarParaUsuarios(
      entregadores.map((u) => u.id),
      {
        titulo: 'Nova entrega disponível',
        corpo: `Pedido ${pedido.numero}${pedido.lojaNome ? ' · ' + pedido.lojaNome : ''}${pedido.bairro ? ' — ' + pedido.bairro : ''}. Quem aceitar primeiro leva.`,
        url: '/entregador',
        tag: `oferta-${pedido.numero}`,
      }
    );
  } catch (e) {
    logger.warn({ err: e.message }, 'notificarNovaOferta falhou (ignorada).');
  }
}

// Direcionamento: notifica SÓ o entregador escolhido pela expedição.
async function notificarDirecionada(entregadorId, pedido) {
  if (!configurado) return;
  try {
    await enviarParaUsuarios([entregadorId], {
      titulo: 'Entrega direcionada a você',
      corpo: `Pedido ${pedido.numero}${pedido.lojaNome ? ' · ' + pedido.lojaNome : ''}${pedido.bairro ? ' — ' + pedido.bairro : ''}. Abra o app para aceitar.`,
      url: '/entregador',
      tag: `direcionada-${pedido.numero}`,
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'notificarDirecionada falhou (ignorada).');
  }
}

module.exports = { pushDisponivel, chavePublica, enviarParaUsuarios, notificarNovaOferta, notificarDirecionada };
