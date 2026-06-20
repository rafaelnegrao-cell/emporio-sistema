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
        id: true, status: true, valorTotal: true, valorFrete: true, valorDesconto: true, pedidoEm: true,
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

    res.json({
      periodo: { inicio: inicioD.toISOString().slice(0, 10), fim: fimD.toISOString().slice(0, 10) },
      resumo: { pedidos: validos.length, entregues: entregues.length, cancelados, faturamento, frete, desconto, ticketMedio },
      tempos: { retiradaMedMin: media(retiradas), rotaMedMin: media(rotas), dentroSlaPct: dentroSla, amostraRetirada: retiradas.length, amostraRota: rotas.length },
      entregadores,
      abc,
      porDia,
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

    const atual = await prisma.pedido.findUnique({ where: { id }, select: { status: true, separadoEm: true } });
    const statusAnterior = atual ? atual.status : null;

    const dataPedido = { status };
    if (status === 'SEPARADO' && atual && !atual.separadoEm) dataPedido.separadoEm = new Date();
    const pedido = await prisma.pedido.update({ where: { id }, data: dataPedido });

    // Modo direcionado: ao separar, manda pra UM entregador (fica aguardando o aceite dele).
    if (status === 'SEPARADO' && entregadorId) {
      await prisma.entrega.upsert({
        where: { pedidoId: id },
        update: { entregadorId: BigInt(entregadorId), atribuidaEm: new Date() },
        create: { pedidoId: id, entregadorId: BigInt(entregadorId), atribuidaEm: new Date() },
      });
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
    res.json(serializarBigInt(entrega));
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
