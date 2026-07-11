// backend/src/routes/pedidos.js
// Rota de pedidos do delivery — base mínima e válida.
// (O arquivo anterior aqui era, por engano, uma cópia antiga de produtos.js
//  com imports errados, que derrubava o boot do servidor.)
// Imports no padrão do projeto: prisma singleton + asyncHandler + serializarBigInt
// + middlewares autenticar / exigirPapel.

const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../utils/async-handler');
const { serializarBigInt } = require('../utils/serializar');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { notificarNovaOferta, notificarDirecionada } = require('../services/push');
const crypto = require('crypto');

const router = express.Router();

const CANAIS = new Set(['APP', 'WHATSAPP', 'TELEFONE', 'BALCAO', 'IFOOD', 'RAPPI', 'OUTRO']);

function gerarNumero() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// GET /api/pedidos — lista (mais recentes primeiro). Filtros opcionais: status, lojaId.
router.get(
  '/',
  autenticar,
  asyncHandler(async (req, res) => {
    const { status, lojaId } = req.query;
    const where = { deletadoEm: null };
    if (status) where.status = status;
    if (lojaId) where.lojaId = BigInt(lojaId);

    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { pedidoEm: 'desc' },
      take: 200,
      include: {
        cliente: { select: { id: true, nome: true, whatsapp: true } },
        loja: { select: { id: true, nome: true } },
        itens: { select: { id: true } },
        entrega: { select: { entregadorId: true, atribuidaEm: true, aceitoEm: true, saidaEm: true, entregueEm: true, entregador: { select: { id: true, nome: true, telefone: true } } } },
        avaliacaoNPS: { select: { notaGeral: true } },
      },
    });

    res.json(serializarBigInt({ data: pedidos, total: pedidos.length }));
  })
);

// GET /api/pedidos/relatorio — agregações da tela de Relatórios.
// Query: inicio=YYYY-MM-DD, fim=YYYY-MM-DD, lojaId? . Padrão: últimos 30 dias.
// IMPORTANTe: precisa vir ANTES de GET /:id, senão "relatorio" cai na rota de detalhe.
router.get(
  '/relatorio',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const { inicio, fim, lojaId } = req.query;
    const hoje = new Date();
    const fimD = fim ? new Date(`${fim}T23:59:59.999`) : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);
    const inicioD = inicio ? new Date(`${inicio}T00:00:00.000`) : new Date(fimD.getTime() - 29 * 24 * 60 * 60 * 1000);
    inicioD.setHours(0, 0, 0, 0);

    const where = { deletadoEm: null, pedidoEm: { gte: inicioD, lte: fimD } };
    if (lojaId) where.lojaId = BigInt(lojaId);

    const pedidos = await prisma.pedido.findMany({
      where,
      take: 5000,
      select: {
        id: true, numero: true, status: true, valorTotal: true, valorFrete: true, valorDesconto: true, pedidoEm: true,
        avaliacaoNPS: { select: { notaGeral: true, comentario: true, respondidoEm: true } },
        entrega: { select: { aceitoEm: true, saidaEm: true, entregueEm: true, entregador: { select: { id: true, nome: true } } } },
        itens: { select: { quantidade: true, precoTotal: true, produto: { select: { id: true, nome: true } } } },
      },
    });

    const num = (d) => (d == null ? 0 : typeof d.toNumber === 'function' ? d.toNumber() : Number(d) || 0);
    const CANC = new Set(['CANCELADO_CLIENTE', 'CANCELADO_LOJA', 'DEVOLVIDO']);
    const diffMin = (a, b) => (a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000) : null);
    const media = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);

    const validos = pedidos.filter((p) => !CANC.has(p.status));
    const cancelados = pedidos.length - validos.length;
    const entregues = validos.filter((p) => p.status === 'ENTREGUE');

    let faturamento = 0, frete = 0, desconto = 0;
    for (const p of validos) { faturamento += num(p.valorTotal); frete += num(p.valorFrete); desconto += num(p.valorDesconto); }
    const ticketMedio = validos.length ? faturamento / validos.length : 0;

    const retiradas = [], rotas = [];
    for (const p of validos) {
      const e = p.entrega; if (!e) continue;
      const r = diffMin(e.aceitoEm, e.saidaEm); if (r != null) retiradas.push(r);
      const ro = diffMin(e.saidaEm, e.entregueEm); if (ro != null) rotas.push(ro);
    }
    const dentroSla = retiradas.length ? (retiradas.filter((m) => m <= 15).length / retiradas.length) * 100 : null;

    const mapEnt = new Map();
    for (const p of entregues) {
      const e = p.entrega; if (!e || !e.entregador) continue;
      const id = String(e.entregador.id);
      if (!mapEnt.has(id)) mapEnt.set(id, { id, nome: e.entregador.nome, entregas: 0, ret: [], rota: [] });
      const o = mapEnt.get(id);
      o.entregas += 1;
      const r = diffMin(e.aceitoEm, e.saidaEm); if (r != null) o.ret.push(r);
      const ro = diffMin(e.saidaEm, e.entregueEm); if (ro != null) o.rota.push(ro);
    }
    const entregadores = [...mapEnt.values()]
      .map((o) => ({ id: o.id, nome: o.nome, entregas: o.entregas, retiradaMedMin: media(o.ret), rotaMedMin: media(o.rota) }))
      .sort((a, b) => b.entregas - a.entregas);

    const mapProd = new Map();
    for (const p of validos) {
      for (const it of p.itens || []) {
        if (!it.produto) continue;
        const id = String(it.produto.id);
        if (!mapProd.has(id)) mapProd.set(id, { id, nome: it.produto.nome, qtd: 0, receita: 0 });
        const o = mapProd.get(id);
        o.qtd += it.quantidade || 0;
        o.receita += num(it.precoTotal);
      }
    }
    const prods = [...mapProd.values()].sort((a, b) => b.receita - a.receita);
    const totalRec = prods.reduce((x, y) => x + y.receita, 0);
    let acum = 0;
    const abc = prods.map((o) => {
      const pct = totalRec ? (o.receita / totalRec) * 100 : 0;
      acum += pct;
      const classe = acum <= 80 ? 'A' : acum <= 95 ? 'B' : 'C';
      return { id: o.id, nome: o.nome, qtd: o.qtd, receita: o.receita, pct, acumPct: acum, classe };
    });

    const mapDia = new Map();
    for (const p of validos) {
      const dia = new Date(p.pedidoEm).toISOString().slice(0, 10);
      if (!mapDia.has(dia)) mapDia.set(dia, { dia, pedidos: 0, faturamento: 0 });
      const o = mapDia.get(dia);
      o.pedidos += 1; o.faturamento += num(p.valorTotal);
    }
    const porDia = [...mapDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));

    // Satisfação (NPS) — avaliações pós-entrega dos pedidos do período.
    const avaliacoes = [];
    for (const p of validos) {
      const a = p.avaliacaoNPS;
      if (a && a.notaGeral != null) {
        avaliacoes.push({ nota: a.notaGeral, comentario: a.comentario || null, respondidoEm: a.respondidoEm, numero: p.numero });
      }
    }
    const nAv = avaliacoes.length;
    const promotores = avaliacoes.filter((a) => a.nota >= 9).length;
    const neutros = avaliacoes.filter((a) => a.nota >= 7 && a.nota <= 8).length;
    const detratores = nAv - promotores - neutros;
    const avaliacao = {
      respostas: nAv,
      notaMedia: nAv ? avaliacoes.reduce((s, a) => s + a.nota, 0) / nAv : null,
      nps: nAv ? Math.round(((promotores - detratores) / nAv) * 100) : null,
      promotores, neutros, detratores,
      taxaRespostaPct: entregues.length ? (nAv / entregues.length) * 100 : null,
      comentarios: avaliacoes
        .filter((a) => a.comentario)
        .sort((a, b) => new Date(b.respondidoEm) - new Date(a.respondidoEm))
        .slice(0, 10),
    };

    res.json({
      periodo: { inicio: inicioD.toISOString().slice(0, 10), fim: fimD.toISOString().slice(0, 10) },
      resumo: { pedidos: validos.length, entregues: entregues.length, cancelados, faturamento, frete, desconto, ticketMedio },
      tempos: { retiradaMedMin: media(retiradas), rotaMedMin: media(rotas), dentroSlaPct: dentroSla, amostraRetirada: retiradas.length, amostraRota: rotas.length },
      entregadores,
      abc,
      porDia,
      avaliacao,
    });
  })
);

// GET /api/pedidos/:id — detalhe completo
router.get(
  '/:id',
  autenticar,
  asyncHandler(async (req, res) => {
    const pedido = await prisma.pedido.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        cliente: { select: { id: true, nome: true, whatsapp: true } },
        loja: { select: { id: true, nome: true } },
        enderecoEntrega: true,
        itens: { include: { produto: { select: { id: true, nome: true, sku: true } } } },
        entrega: { include: { entregador: { select: { id: true, nome: true, telefone: true } } } },
        historicoStatus: { orderBy: { criadoEm: 'asc' }, include: { usuario: { select: { nome: true } } } },
        avaliacaoNPS: true,
      },
    });
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
    res.json(serializarBigInt(pedido));
  })
);

// PATCH /api/pedidos/:id/status — muda o status (usado pelo Kanban)
router.patch(
  '/:id/status',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const { status, entregadorId, motivo } = req.body;
    if (!status) return res.status(400).json({ erro: 'status é obrigatório' });
    const id = BigInt(req.params.id);

    const atual = await prisma.pedido.findUnique({
      where: { id },
      select: {
        status: true, separadoEm: true, numero: true, lojaId: true, tokenAvaliacao: true,
        loja: { select: { nome: true } },
        enderecoEntrega: { select: { bairro: true } },
        entrega: { select: { entregadorId: true } },
      },
    });
    const statusAnterior = atual ? atual.status : null;

    const dataPedido = { status };
    if (status === 'SEPARADO' && atual && !atual.separadoEm) dataPedido.separadoEm = new Date();
    if (status === 'ENTREGUE') {
      dataPedido.entregueEm = new Date();
      // Token do link público de avaliação pós-entrega (gerado uma única vez).
      dataPedido.tokenAvaliacao = crypto.randomBytes(16).toString('hex');
    }
    let pedido;
    try {
      pedido = await prisma.pedido.update({ where: { id }, data: dataPedido });
    } catch (e) {
      // Colisão improvável do token (unique): tenta uma vez com outro.
      if (e && e.code === 'P2002' && dataPedido.tokenAvaliacao) {
        dataPedido.tokenAvaliacao = crypto.randomBytes(16).toString('hex');
        pedido = await prisma.pedido.update({ where: { id }, data: dataPedido });
      } else { throw e; }
    }
    // Não sobrescreve um token existente (link já enviado ao cliente continua válido).
    if (status === 'ENTREGUE' && atual && atual.tokenAvaliacao) {
      pedido = await prisma.pedido.update({ where: { id }, data: { tokenAvaliacao: atual.tokenAvaliacao } });
    }

    // Infos mínimas para o texto da notificação push.
    const infoPush = atual
      ? { numero: atual.numero, lojaId: atual.lojaId, lojaNome: atual.loja && atual.loja.nome, bairro: atual.enderecoEntrega && atual.enderecoEntrega.bairro }
      : null;

    // Modo direcionado: ao separar, manda pra UM entregador (fica aguardando o aceite dele).
    if (status === 'SEPARADO' && entregadorId) {
      await prisma.entrega.upsert({
        where: { pedidoId: id },
        update: { entregadorId: BigInt(entregadorId), atribuidaEm: new Date() },
        create: { pedidoId: id, entregadorId: BigInt(entregadorId), atribuidaEm: new Date() },
      });
      // Push só pro escolhido (best-effort, não bloqueia a resposta).
      if (infoPush) notificarDirecionada(BigInt(entregadorId), infoPush).catch(() => {});
    } else if (status === 'SEPARADO' && statusAnterior !== 'SEPARADO') {
      // Oferta aberta: avisa os entregadores da loja — mas só se o pedido ainda
      // não tem entregador atribuído (senão seria spam pra quem não pode pegar).
      const jaTemEntregador = atual && atual.entrega && atual.entrega.entregadorId;
      if (!jaTemEntregador && infoPush) notificarNovaOferta(infoPush).catch(() => {});
    }

    // Carimba horários na Entrega (se já houver entregador atribuído).
    if (status === 'EM_ROTA' || status === 'ENTREGUE') {
      const entrega = await prisma.entrega.findUnique({ where: { pedidoId: id } });
      if (entrega) {
        await prisma.entrega.update({
          where: { pedidoId: id },
          data: status === 'EM_ROTA'
            ? { saidaEm: entrega.saidaEm || new Date() }
            : { entregueEm: new Date(), saidaEm: entrega.saidaEm || new Date() },
        });
      }
    }

    // Histórico de status (não derruba a operação se falhar)
    if (statusAnterior !== status) {
      try {
        await prisma.statusPedidoHistorico.create({
          data: {
            pedidoId: id,
            statusAnterior,
            statusNovo: status,
            usuarioId: req.usuario && req.usuario.id ? BigInt(req.usuario.id) : null,
            motivo: motivo || null,
          },
        });
      } catch (e) { /* histórico é best-effort */ }
    }
    res.json(serializarBigInt(pedido));
  })
);

// PATCH /api/pedidos/:id/entregador — atribui (ou remove) o entregador do pedido
router.patch(
  '/:id/entregador',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const pedidoId = BigInt(req.params.id);
    const { entregadorId } = req.body || {};
    if (!entregadorId) {
      await prisma.entrega.deleteMany({ where: { pedidoId } });
      return res.json({ ok: true, entregadorId: null });
    }
    const entrega = await prisma.entrega.upsert({
      where: { pedidoId },
      update: { entregadorId: BigInt(entregadorId) },
      create: { pedidoId, entregadorId: BigInt(entregadorId) },
      include: { entregador: { select: { id: true, nome: true, telefone: true } } },
    });
    // Avisa o entregador escolhido (best-effort).
    try {
      const p = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: { numero: true, lojaId: true, loja: { select: { nome: true } }, enderecoEntrega: { select: { bairro: true } } },
      });
      if (p) {
        notificarDirecionada(BigInt(entregadorId), {
          numero: p.numero, lojaId: p.lojaId, lojaNome: p.loja && p.loja.nome, bairro: p.enderecoEntrega && p.enderecoEntrega.bairro,
        }).catch(() => {});
      }
    } catch (e) { /* push é best-effort */ }
    res.json(serializarBigInt(entrega));
  })
);

// POST /api/pedidos/:id/reofertar — reenvia o aviso de oferta aberta aos
// entregadores da loja. Uso: pedido parado em SEPARADO sem ninguém aceitar.
// Só vale para oferta aberta (sem entregador atribuído/aceito).
router.post(
  '/:id/reofertar',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id);
    const p = await prisma.pedido.findUnique({
      where: { id },
      select: {
        numero: true, lojaId: true, status: true, deletadoEm: true,
        loja: { select: { nome: true } },
        enderecoEntrega: { select: { bairro: true } },
        entrega: { select: { entregadorId: true, aceitoEm: true } },
      },
    });
    if (!p || p.deletadoEm) return res.status(404).json({ erro: 'Pedido não encontrado.' });
    if (p.status !== 'SEPARADO') {
      return res.status(400).json({ erro: 'O aviso só pode ser reenviado com o pedido em Separado.' });
    }
    if (p.entrega && p.entrega.aceitoEm) {
      return res.status(400).json({ erro: 'Este pedido já foi aceito por um entregador.' });
    }
    if (p.entrega && p.entrega.entregadorId) {
      return res.status(400).json({ erro: 'Este pedido está direcionado a um entregador. Aguarde o aceite ou troque o entregador.' });
    }
    const r = await notificarNovaOferta({
      numero: p.numero,
      lojaId: p.lojaId,
      lojaNome: p.loja && p.loja.nome,
      bairro: p.enderecoEntrega && p.enderecoEntrega.bairro,
    });
    if (!r || r.ok === false) {
      const msg = r && r.motivo === 'nao-configurado'
        ? 'Push não configurado no servidor (chaves VAPID ausentes).'
        : 'Não foi possível enviar o aviso agora. Tente novamente.';
      return res.status(503).json({ erro: msg });
    }
    res.json({ ok: true, entregadores: r.entregadores, enviados: r.enviados });
  })
);

// POST /api/pedidos — cria pedido (entrada manual: WhatsApp, telefone, balcão)
// Body: { clienteId, lojaId, canalOrigem, enderecoEntregaId? | endereco?{...},
//         itens:[{produtoId, quantidade, observacao?}], valorFrete?, valorDesconto?, observacoesCliente? }
router.post(
  '/',
  autenticar,
  exigirPapel('ADMIN', 'OPERADOR'),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const clienteId = b.clienteId ? BigInt(b.clienteId) : null;
    const lojaId = b.lojaId ? BigInt(b.lojaId) : null;
    const itensIn = Array.isArray(b.itens)
      ? b.itens.filter((i) => i && i.produtoId && Number(i.quantidade) > 0)
      : [];
    let canal = String(b.canalOrigem || 'WHATSAPP').toUpperCase();
    if (!CANAIS.has(canal)) canal = 'OUTRO';

    if (!clienteId) return res.status(400).json({ erro: 'Selecione o cliente.' });
    if (!lojaId) return res.status(400).json({ erro: 'Selecione a loja.' });
    if (!itensIn.length) return res.status(400).json({ erro: 'Adicione ao menos um item.' });

    // Endereço de entrega é obrigatório no schema: usa um existente ou cria a partir do inline.
    let enderecoEntregaId = b.enderecoEntregaId ? BigInt(b.enderecoEntregaId) : null;
    if (!enderecoEntregaId) {
      const e = b.endereco || {};
      if (!e.logradouro && !e.bairro && !e.cidade) {
        return res.status(400).json({ erro: 'Informe o endereço de entrega.' });
      }
      const novoEnd = await prisma.endereco.create({
        data: {
          clienteId,
          apelido: e.apelido || 'Entrega',
          cep: e.cep || '',
          logradouro: e.logradouro || '',
          numero: e.numero || 'S/N',
          complemento: e.complemento || null,
          bairro: e.bairro || '',
          cidade: e.cidade || '',
          uf: (e.uf || 'PR').slice(0, 2).toUpperCase(),
        },
      });
      enderecoEntregaId = novoEnd.id;
    }

    // Preços vêm do catálogo (precoBase), não do cliente.
    const ids = itensIn.map((i) => BigInt(i.produtoId));
    const produtos = await prisma.produto.findMany({
      where: { id: { in: ids } },
      select: { id: true, precoBase: true },
    });
    const precoPorId = new Map(produtos.map((p) => [String(p.id), Number(p.precoBase || 0)]));

    let subtotal = 0;
    const itensData = itensIn.map((i) => {
      const qtd = parseInt(i.quantidade, 10) || 1;
      const unit = precoPorId.get(String(i.produtoId)) ?? 0;
      const total = Math.round(unit * qtd * 100) / 100;
      subtotal += total;
      return {
        produtoId: BigInt(i.produtoId),
        quantidade: qtd,
        precoUnitario: unit,
        precoTotal: total,
        observacao: i.observacao || null,
      };
    });
    subtotal = Math.round(subtotal * 100) / 100;
    const valorFrete = Number(b.valorFrete || 0) || 0;
    const valorDesconto = Number(b.valorDesconto || 0) || 0;
    const valorTotal = Math.round((subtotal + valorFrete - valorDesconto) * 100) / 100;

    // Cria com retry caso o numero (unique) colida.
    let pedido;
    let tentativa = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        pedido = await prisma.pedido.create({
          data: {
            numero: gerarNumero(),
            clienteId,
            lojaId,
            enderecoEntregaId,
            status: 'RECEBIDO',
            canalOrigem: canal,
            subtotal,
            valorFrete,
            valorDesconto,
            valorTotal,
            observacoesCliente: b.observacoesCliente || null,
            itens: { create: itensData },
          },
          include: {
            cliente: { select: { id: true, nome: true, whatsapp: true } },
            loja: { select: { id: true, nome: true } },
            itens: { select: { id: true } },
          },
        });
        break;
      } catch (e) {
        if (e && e.code === 'P2002' && tentativa < 3) {
          tentativa++;
          continue;
        }
        throw e;
      }
    }

    res.status(201).json(serializarBigInt(pedido));
  })
);

module.exports = router;
