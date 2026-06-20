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
    const { status, entregadorId } = req.body;
    if (!status) return res.status(400).json({ erro: 'status é obrigatório' });
    const id = BigInt(req.params.id);

    const dataPedido = { status };
    if (status === 'SEPARADO') {
      const atual = await prisma.pedido.findUnique({ where: { id }, select: { separadoEm: true } });
      if (atual && !atual.separadoEm) dataPedido.separadoEm = new Date();
    }
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
