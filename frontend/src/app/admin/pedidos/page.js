// frontend/src/app/admin/pedidos/page.js
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

// Colunas operacionais do fluxo de delivery (na ordem).
const COLUNAS = [
  { key: 'RECEBIDO', label: 'Recebido', accent: '#8a6a1f' },
  { key: 'ACEITO', label: 'Aceito', accent: '#B8935A' },
  { key: 'EM_SEPARACAO', label: 'Em separação', accent: '#B8935A' },
  { key: 'SEPARADO', label: 'Separado', accent: '#3f7d5b' },
  { key: 'EM_ROTA', label: 'Em rota', accent: '#3f7d5b' },
  { key: 'ENTREGUE', label: 'Entregue', accent: '#3f7d5b' },
];
const FLUXO = COLUNAS.map((c) => c.key);
const CANCELADOS = ['CANCELADO_CLIENTE', 'CANCELADO_LOJA', 'DEVOLVIDO'];

const STATUS_LABEL = {
  RASCUNHO: 'Rascunho',
  RECEBIDO: 'Recebido',
  ACEITO: 'Aceito',
  EM_SEPARACAO: 'Em separação',
  SEPARADO: 'Separado',
  EM_ROTA: 'Em rota',
  ENTREGUE: 'Entregue',
  CANCELADO_CLIENTE: 'Cancelado (cliente)',
  CANCELADO_LOJA: 'Cancelado (loja)',
  DEVOLVIDO: 'Devolvido',
};

const BRL = (n) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const hora = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [lojaId, setLojaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [drag, setDrag] = useState(null); // id sendo arrastado
  const [hover, setHover] = useState(null); // coluna em hover no drop
  const [detalhe, setDetalhe] = useState(null); // pedido aberto no painel
  const [novo, setNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const r = await api.get('/api/pedidos', lojaId ? { lojaId } : {});
      setPedidos(Array.isArray(r?.data) ? r.data : []);
    } catch (e) {
      setErro(e.message);
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    api.get('/api/lojas').then((r) => {
      const lista = Array.isArray(r) ? r : r?.data || [];
      setLojas(lista);
    }).catch(() => {});
  }, []);

  const porColuna = useMemo(() => {
    const m = {};
    for (const c of COLUNAS) m[c.key] = [];
    m.CANCELADOS = [];
    for (const p of pedidos) {
      if (m[p.status]) m[p.status].push(p);
      else if (CANCELADOS.includes(p.status)) m.CANCELADOS.push(p);
      // RASCUNHO e qualquer outro status não operacional ficam de fora do quadro
    }
    return m;
  }, [pedidos]);

  const kpis = useMemo(() => {
    const ativos = pedidos.filter((p) => FLUXO.includes(p.status) && p.status !== 'ENTREGUE').length;
    const emRota = pedidos.filter((p) => p.status === 'EM_ROTA').length;
    const entregues = pedidos.filter((p) => p.status === 'ENTREGUE').length;
    const valorAtivo = pedidos
      .filter((p) => FLUXO.includes(p.status) && p.status !== 'ENTREGUE')
      .reduce((s, p) => s + Number(p.valorTotal || 0), 0);
    return { ativos, emRota, entregues, valorAtivo };
  }, [pedidos]);

  // Muda status com atualização otimista; em erro, recarrega.
  const mudarStatus = useCallback(async (id, novo) => {
    const alvo = pedidos.find((p) => String(p.id) === String(id));
    if (!alvo || alvo.status === novo) return;
    setSalvando(true);
    setPedidos((arr) => arr.map((p) => (String(p.id) === String(id) ? { ...p, status: novo } : p)));
    setDetalhe((d) => (d && String(d.id) === String(id) ? { ...d, status: novo } : d));
    try {
      await api.patch(`/api/pedidos/${id}/status`, { status: novo });
    } catch (e) {
      alert('Não consegui mudar o status: ' + e.message);
      carregar();
    } finally {
      setSalvando(false);
    }
  }, [pedidos, carregar]);

  const abrirDetalhe = async (p) => {
    setDetalhe(p); // mostra o que já tem na hora
    try {
      const full = await api.get(`/api/pedidos/${p.id}`);
      setDetalhe(full && full.id ? full : p);
    } catch (_) { /* mantém o resumo */ }
  };

  const proximo = (status) => {
    const i = FLUXO.indexOf(status);
    return i >= 0 && i < FLUXO.length - 1 ? FLUXO[i + 1] : null;
  };

  return (
    <>
      {/* Topbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3ddcf] bg-white px-7 py-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Operação</div>
          <h1 className="font-serif text-[22px] font-bold text-[#1F3A2E]">Pedidos</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            value={lojaId}
            onChange={(e) => setLojaId(e.target.value)}
            className="rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-3 py-2 text-[13px] font-semibold text-[#1F3A2E] outline-none focus:border-[#B8935A]"
          >
            <option value="">Todas as lojas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
          <button
            onClick={carregar}
            className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2 text-[13px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]"
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button
            onClick={() => setNovo(true)}
            className="rounded-lg bg-[#B8935A] px-4 py-2 text-[13px] font-semibold text-[#16291f] hover:bg-[#a8824a]"
          >
            + Novo pedido
          </button>
        </div>
      </div>

      <div className="flex-1 px-7 pb-10 pt-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Kpi lab="Pedidos ativos" val={kpis.ativos} note="em andamento" />
          <Kpi lab="Em rota" val={kpis.emRota} note="saíram para entrega" />
          <Kpi lab="Entregues" val={kpis.entregues} note="no período carregado" />
          <Kpi lab="Valor em andamento" val={BRL(kpis.valorAtivo)} note="soma dos ativos" />
        </div>

        {erro && (
          <div className="mb-4 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-4 py-3 text-[13px] text-[#b23b3b]">
            Erro ao carregar pedidos: {erro}
          </div>
        )}

        {!loading && !erro && pedidos.length === 0 && (
          <div className="mb-4 rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-4 py-3 text-[13px] text-[#6b6757]">
            Nenhum pedido ainda. Os pedidos aparecem aqui conforme entram (pelo app, WhatsApp ou balcão) e você
            os move entre as colunas arrastando os cartões.
          </div>
        )}

        {/* Kanban */}
        <div className="flex gap-3.5 overflow-x-auto pb-3">
          {COLUNAS.map((col) => {
            const itens = porColuna[col.key] || [];
            const ativo = hover === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setHover(col.key); }}
                onDragLeave={() => setHover((h) => (h === col.key ? null : h))}
                onDrop={(e) => { e.preventDefault(); setHover(null); if (drag) mudarStatus(drag, col.key); setDrag(null); }}
                className={`flex w-[270px] flex-none flex-col rounded-xl border bg-[#faf8f2] ${ativo ? 'border-[#B8935A] ring-2 ring-[#B8935A]/30' : 'border-[#e3ddcf]'}`}
              >
                <div className="flex items-center justify-between border-b border-[#e3ddcf] px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-[8px] w-[8px] rounded-full" style={{ background: col.accent }} />
                    <span className="text-[12.5px] font-semibold uppercase tracking-wide text-[#5e5a4e]">{col.label}</span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#8a8678]">{itens.length}</span>
                </div>
                <div className="flex min-h-[120px] flex-col gap-2.5 p-2.5">
                  {itens.map((p) => (
                    <Card key={p.id} p={p} onDragStart={() => setDrag(String(p.id))} onClick={() => abrirDetalhe(p)} />
                  ))}
                  {itens.length === 0 && (
                    <div className="grid flex-1 place-items-center py-6 text-center text-[11.5px] text-[#b9b3a3]">
                      {ativo ? 'Solte aqui' : '—'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Coluna de cancelados / devolvidos (só leitura) */}
          {porColuna.CANCELADOS && porColuna.CANCELADOS.length > 0 && (
            <div className="flex w-[270px] flex-none flex-col rounded-xl border border-[#e9ddda] bg-[#fbf3f1]">
              <div className="flex items-center justify-between border-b border-[#e9ddda] px-3.5 py-2.5">
                <span className="text-[12.5px] font-semibold uppercase tracking-wide text-[#a85a52]">Cancelados / Devolvidos</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#a85a52]">{porColuna.CANCELADOS.length}</span>
              </div>
              <div className="flex flex-col gap-2.5 p-2.5">
                {porColuna.CANCELADOS.map((p) => (
                  <Card key={p.id} p={p} onClick={() => abrirDetalhe(p)} muted />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel de detalhe */}
      {detalhe && (
        <Drawer
          p={detalhe}
          salvando={salvando}
          onClose={() => setDetalhe(null)}
          onAvancar={() => { const n = proximo(detalhe.status); if (n) mudarStatus(detalhe.id, n); }}
          onStatus={(s) => mudarStatus(detalhe.id, s)}
        />
      )}

      {/* Novo pedido */}
      {novo && (
        <NovoPedido
          lojas={lojas}
          onClose={() => setNovo(false)}
          onCreated={() => { setNovo(false); carregar(); }}
        />
      )}
    </>
  );
}

function Kpi({ lab, val, note }) {
  return (
    <div className="rounded-xl border border-[#e3ddcf] bg-white px-4 py-3.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">{lab}</div>
      <div className="mt-1 font-serif text-[24px] font-bold text-[#1F3A2E]">{val}</div>
      <div className="text-[11.5px] text-[#9a9483]">{note}</div>
    </div>
  );
}

function Card({ p, onDragStart, onClick, muted }) {
  const nItens = Array.isArray(p.itens) ? p.itens.length : null;
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border bg-white p-3 transition hover:border-[#B8935A] ${muted ? 'border-[#e9ddda] opacity-80' : 'border-[#e3ddcf]'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#1F3A2E]">#{p.numero || p.id}</span>
        <span className="text-[10.5px] text-[#9a9483]">{hora(p.pedidoEm)}</span>
      </div>
      <div className="mt-1 truncate text-[13px] text-[#3a3730]">{p.cliente?.nome || 'Cliente'}</div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="truncate text-[11px] text-[#8a8678]">{p.loja?.nome || ''}{nItens != null ? ` · ${nItens} item(s)` : ''}</span>
        <span className="text-[12.5px] font-semibold text-[#1F3A2E]">{BRL(p.valorTotal)}</span>
      </div>
    </div>
  );
}

function Drawer({ p, salvando, onClose, onAvancar, onStatus }) {
  const itens = Array.isArray(p.itens) ? p.itens : [];
  const podeAvancar = FLUXO.indexOf(p.status) >= 0 && p.status !== 'ENTREGUE';
  const cancelado = CANCELADOS.includes(p.status);
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#e3ddcf] px-6 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Pedido</div>
            <h3 className="font-serif text-[20px] font-bold text-[#1F3A2E]">#{p.numero || p.id}</h3>
            <span className="mt-1 inline-block rounded-full bg-[#F4F1EA] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#5e5a4e]">{STATUS_LABEL[p.status] || p.status}</span>
          </div>
          <button onClick={onClose} className="text-[20px] leading-none text-[#8a8678] hover:text-[#1F3A2E]">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 text-[13px] text-[#3a3730]">
          <Linha lab="Cliente" val={p.cliente?.nome} />
          <Linha lab="WhatsApp" val={p.cliente?.whatsapp} />
          <Linha lab="Loja" val={p.loja?.nome} />
          <Linha lab="Entrada" val={hora(p.pedidoEm)} />
          {p.enderecoEntrega && (
            <Linha lab="Entrega" val={[p.enderecoEntrega.logradouro, p.enderecoEntrega.numero, p.enderecoEntrega.bairro, p.enderecoEntrega.cidade].filter(Boolean).join(', ')} />
          )}

          {itens.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Itens</div>
              <div className="rounded-lg border border-[#e3ddcf]">
                {itens.map((it, i) => (
                  <div key={it.id || i} className="flex items-center justify-between border-b border-[#eee7d8] px-3 py-2 last:border-b-0">
                    <span className="truncate pr-2">{it.quantidade ? `${it.quantidade}× ` : ''}{it.produto?.nome || it.descricao || 'Item'}</span>
                    <span className="font-semibold text-[#1F3A2E]">{BRL(it.precoTotal ?? it.precoUnitario)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg bg-[#F4F1EA] px-3.5 py-3">
            <div className="flex items-center justify-between"><span className="text-[#8a8678]">Subtotal</span><span>{BRL(p.subtotal)}</span></div>
            <div className="flex items-center justify-between"><span className="text-[#8a8678]">Frete</span><span>{BRL(p.valorFrete)}</span></div>
            {Number(p.valorDesconto) > 0 && (
              <div className="flex items-center justify-between"><span className="text-[#8a8678]">Desconto</span><span>- {BRL(p.valorDesconto)}</span></div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-[#e3ddcf] pt-2 text-[15px] font-bold text-[#1F3A2E]"><span>Total</span><span>{BRL(p.valorTotal)}</span></div>
          </div>
        </div>

        {/* Ações */}
        <div className="border-t border-[#e3ddcf] px-6 py-4">
          {podeAvancar && (
            <button
              onClick={onAvancar}
              disabled={salvando}
              className="mb-2 w-full rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50"
            >
              Avançar para “{STATUS_LABEL[FLUXO[FLUXO.indexOf(p.status) + 1]]}”
            </button>
          )}
          {!cancelado && (
            <div className="flex gap-2">
              <button onClick={() => onStatus('CANCELADO_LOJA')} disabled={salvando} className="flex-1 rounded-lg border border-[#e9ddda] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#a85a52] hover:border-[#d8a59c] disabled:opacity-50">Cancelar</button>
              {p.status === 'ENTREGUE' && (
                <button onClick={() => onStatus('DEVOLVIDO')} disabled={salvando} className="flex-1 rounded-lg border border-[#e9ddda] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#a85a52] hover:border-[#d8a59c] disabled:opacity-50">Devolvido</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Linha({ lab, val }) {
  if (!val) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-[#f0ece0] py-2 last:border-b-0">
      <span className="text-[#8a8678]">{lab}</span>
      <span className="text-right">{val}</span>
    </div>
  );
}

const CANAL_OPTS = [
  { v: 'WHATSAPP', t: 'WhatsApp' },
  { v: 'TELEFONE', t: 'Telefone' },
  { v: 'BALCAO', t: 'Balcão' },
  { v: 'APP', t: 'App' },
  { v: 'OUTRO', t: 'Outro' },
];

function NovoPedido({ lojas, onClose, onCreated }) {
  const [cliente, setCliente] = useState(null);
  const [cBusca, setCBusca] = useState('');
  const [cRes, setCRes] = useState([]);
  const [enderecos, setEnderecos] = useState([]);
  const [endSel, setEndSel] = useState('novo'); // id do endereço ou 'novo'
  const [end, setEnd] = useState({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'PR' });
  const [lojaId, setLojaId] = useState('');
  const [canal, setCanal] = useState('WHATSAPP');
  const [itens, setItens] = useState([]); // {produtoId, nome, preco, quantidade}
  const [pBusca, setPBusca] = useState('');
  const [pRes, setPRes] = useState([]);
  const [frete, setFrete] = useState('');
  const [desconto, setDesconto] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState(null);
  const tc = useState(() => ({ t: null }))[0];
  const tp = useState(() => ({ t: null }))[0];

  useEffect(() => { if (lojas.length === 1) setLojaId(String(lojas[0].id)); }, [lojas]);

  const buscarClientes = (txt) => {
    setCBusca(txt);
    clearTimeout(tc.t);
    if (txt.trim().length < 2) { setCRes([]); return; }
    tc.t = setTimeout(async () => {
      try { const r = await api.get('/api/clientes', { q: txt, perPage: 8 }); setCRes(Array.isArray(r?.data) ? r.data : []); }
      catch (_) { setCRes([]); }
    }, 250);
  };

  const escolherCliente = async (c) => {
    setCliente(c); setCRes([]); setCBusca('');
    setEnderecos([]); setEndSel('novo');
    try {
      const det = await api.get(`/api/clientes/${c.id}`);
      const eds = Array.isArray(det?.enderecos) ? det.enderecos : [];
      setEnderecos(eds);
      if (eds.length) {
        const principal = eds.find((e) => e.principal) || eds[0];
        setEndSel(String(principal.id));
      }
    } catch (_) { /* segue com endereço novo */ }
  };

  const buscarProdutos = (txt) => {
    setPBusca(txt);
    clearTimeout(tp.t);
    if (txt.trim().length < 2) { setPRes([]); return; }
    tp.t = setTimeout(async () => {
      try { const r = await api.get('/api/produtos', { q: txt, perPage: 8 }); setPRes(Array.isArray(r?.data) ? r.data : []); }
      catch (_) { setPRes([]); }
    }, 250);
  };

  const addItem = (p) => {
    setPRes([]); setPBusca('');
    setItens((arr) => {
      const ex = arr.find((i) => String(i.produtoId) === String(p.id));
      if (ex) return arr.map((i) => (String(i.produtoId) === String(p.id) ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [...arr, { produtoId: p.id, nome: p.nome, preco: Number(p.preco || 0), quantidade: 1 }];
    });
  };
  const setQtd = (id, q) => setItens((arr) => arr.map((i) => (String(i.produtoId) === String(id) ? { ...i, quantidade: Math.max(1, parseInt(q, 10) || 1) } : i)));
  const remItem = (id) => setItens((arr) => arr.filter((i) => String(i.produtoId) !== String(id)));

  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const total = subtotal + (Number(frete) || 0) - (Number(desconto) || 0);
  const usaEndNovo = endSel === 'novo' || !enderecos.length;

  const criar = async () => {
    setErro(null);
    if (!cliente) return setErro('Selecione o cliente.');
    if (!lojaId) return setErro('Selecione a loja.');
    if (!itens.length) return setErro('Adicione ao menos um item.');
    if (usaEndNovo && !end.logradouro && !end.bairro && !end.cidade) return setErro('Informe o endereço de entrega.');
    setCriando(true);
    try {
      await api.post('/api/pedidos', {
        clienteId: cliente.id,
        lojaId,
        canalOrigem: canal,
        enderecoEntregaId: usaEndNovo ? undefined : endSel,
        endereco: usaEndNovo ? end : undefined,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        valorFrete: Number(frete) || 0,
        valorDesconto: Number(desconto) || 0,
      });
      onCreated();
    } catch (e) {
      setErro(e.message);
      setCriando(false);
    }
  };

  const inp = 'w-full rounded-lg border border-[#e3ddcf] px-3 py-2 text-[13.5px] outline-none focus:border-[#B8935A]';
  const lab = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-[480px] flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#e3ddcf] px-6 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Operação</div>
            <h3 className="font-serif text-[20px] font-bold text-[#1F3A2E]">Novo pedido</h3>
          </div>
          <button onClick={onClose} className="text-[20px] leading-none text-[#8a8678] hover:text-[#1F3A2E]">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Cliente */}
          <label className={lab}>Cliente</label>
          {cliente ? (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-3 py-2">
              <span className="text-[13.5px] text-[#1F3A2E]">{cliente.nome}<span className="ml-2 text-[12px] text-[#8a8678]">{cliente.whatsapp || ''}</span></span>
              <button onClick={() => { setCliente(null); setEnderecos([]); }} className="text-[12px] font-semibold text-[#B8935A]">trocar</button>
            </div>
          ) : (
            <div className="relative mb-3">
              <input className={inp} value={cBusca} onChange={(e) => buscarClientes(e.target.value)} placeholder="Buscar por nome ou WhatsApp…" />
              {cRes.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#e3ddcf] bg-white shadow">
                  {cRes.map((c) => (
                    <button key={c.id} onClick={() => escolherCliente(c)} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F4F1EA]">
                      {c.nome} <span className="text-[#8a8678]">· {c.whatsapp || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loja + Canal */}
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className={lab}>Loja</label>
              <select className={inp} value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
                <option value="">Selecione…</option>
                {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={lab}>Canal</label>
              <select className={inp} value={canal} onChange={(e) => setCanal(e.target.value)}>
                {CANAL_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select>
            </div>
          </div>

          {/* Endereço */}
          <label className={lab}>Endereço de entrega</label>
          {enderecos.length > 0 && (
            <select className={`${inp} mb-2`} value={endSel} onChange={(e) => setEndSel(e.target.value)}>
              {enderecos.map((e) => (
                <option key={e.id} value={e.id}>{[e.logradouro, e.numero, e.bairro].filter(Boolean).join(', ')}</option>
              ))}
              <option value="novo">+ Outro endereço</option>
            </select>
          )}
          {usaEndNovo && (
            <div className="mb-3 grid grid-cols-6 gap-2">
              <input className={`${inp} col-span-4`} value={end.logradouro} onChange={(e) => setEnd({ ...end, logradouro: e.target.value })} placeholder="Rua / logradouro" />
              <input className={`${inp} col-span-2`} value={end.numero} onChange={(e) => setEnd({ ...end, numero: e.target.value })} placeholder="Nº" />
              <input className={`${inp} col-span-3`} value={end.bairro} onChange={(e) => setEnd({ ...end, bairro: e.target.value })} placeholder="Bairro" />
              <input className={`${inp} col-span-3`} value={end.cidade} onChange={(e) => setEnd({ ...end, cidade: e.target.value })} placeholder="Cidade" />
              <input className={`${inp} col-span-2`} value={end.cep} onChange={(e) => setEnd({ ...end, cep: e.target.value })} placeholder="CEP" />
              <input className={`${inp} col-span-4`} value={end.complemento} onChange={(e) => setEnd({ ...end, complemento: e.target.value })} placeholder="Complemento (opcional)" />
            </div>
          )}

          {/* Itens */}
          <label className={lab}>Itens</label>
          <div className="relative mb-2">
            <input className={inp} value={pBusca} onChange={(e) => buscarProdutos(e.target.value)} placeholder="Buscar produto por nome ou SKU…" />
            {pRes.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#e3ddcf] bg-white shadow">
                {pRes.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[#F4F1EA]">
                    <span className="truncate pr-2">{p.nome}</span>
                    <span className="text-[#1F3A2E]">{BRL(p.preco)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {itens.length > 0 && (
            <div className="mb-3 rounded-lg border border-[#e3ddcf]">
              {itens.map((i) => (
                <div key={i.produtoId} className="flex items-center gap-2 border-b border-[#eee7d8] px-3 py-2 last:border-b-0">
                  <span className="flex-1 truncate text-[13px] text-[#3a3730]">{i.nome}</span>
                  <input type="number" min="1" value={i.quantidade} onChange={(e) => setQtd(i.produtoId, e.target.value)} className="w-14 rounded-md border border-[#e3ddcf] px-2 py-1 text-center text-[13px] outline-none focus:border-[#B8935A]" />
                  <span className="w-20 text-right text-[13px] font-semibold text-[#1F3A2E]">{BRL(i.preco * i.quantidade)}</span>
                  <button onClick={() => remItem(i.produtoId)} className="text-[16px] leading-none text-[#b9b3a3] hover:text-[#a85a52]">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Frete / desconto */}
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className={lab}>Frete (R$)</label>
              <input type="number" min="0" step="0.01" className={inp} value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className={lab}>Desconto (R$)</label>
              <input type="number" min="0" step="0.01" className={inp} value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="rounded-lg bg-[#F4F1EA] px-3.5 py-3 text-[13px]">
            <div className="flex justify-between"><span className="text-[#8a8678]">Subtotal</span><span>{BRL(subtotal)}</span></div>
            <div className="mt-1 flex justify-between border-t border-[#e3ddcf] pt-2 text-[15px] font-bold text-[#1F3A2E]"><span>Total</span><span>{BRL(total)}</span></div>
          </div>

          {erro && <div className="mt-3 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}
        </div>

        <div className="border-t border-[#e3ddcf] px-6 py-4">
          <button onClick={criar} disabled={criando} className="w-full rounded-lg bg-[#B8935A] px-4 py-2.5 text-[14px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50">
            {criando ? 'Criando…' : 'Criar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
