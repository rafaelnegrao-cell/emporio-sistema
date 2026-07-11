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
function slaInfo(aceitoEm) {
  if (!aceitoEm) return null;
  const min = Math.max(0, Math.floor((Date.now() - new Date(aceitoEm).getTime()) / 60000));
  const tier = min >= 15 ? 'estourou' : min >= 10 ? 'atencao' : 'ok';
  return { min, tier };
}
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

const quando = (d) =>
  !d ? '' : new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const hora = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// ── Aviso ao cliente via WhatsApp (custo zero: abre o wa.me com o texto pronto) ──
const digitos = (s) => String(s || '').replace(/\D/g, '');
function msgStatusCliente(p) {
  const nome = ((p.cliente && p.cliente.nome) || '').trim().split(' ')[0] || 'tudo bem';
  const num = p.numero || p.id;
  const entregador = p.entrega && p.entrega.entregador && p.entrega.entregador.nome ? p.entrega.entregador.nome.trim().split(' ')[0] : null;
  switch (p.status) {
    case 'RECEBIDO':
      return `Olá, ${nome}! 🐾 Recebemos seu pedido #${num} aqui no Empório dos Animais. Já estamos cuidando de tudo e avisamos assim que sair para entrega.`;
    case 'ACEITO':
    case 'EM_SEPARACAO':
      return `Olá, ${nome}! Seu pedido #${num} do Empório dos Animais está sendo separado com todo o carinho. 🐾`;
    case 'SEPARADO':
      return `Olá, ${nome}! Seu pedido #${num} do Empório dos Animais está prontinho e já vai sair para entrega. 🐾`;
    case 'EM_ROTA':
      return `Olá, ${nome}! 🛵 Seu pedido #${num} do Empório dos Animais saiu para entrega${entregador ? ` com o ${entregador}` : ''} e chega em breve!`;
    case 'ENTREGUE': {
      const linkAvaliacao = p.tokenAvaliacao && typeof window !== 'undefined'
        ? `${window.location.origin}/avaliar?t=${p.tokenAvaliacao}`
        : null;
      return `Olá, ${nome}! Seu pedido #${num} foi entregue. Obrigado pela preferência! 🐾${linkAvaliacao ? `\n\nComo foi a entrega? Conta pra gente em 10 segundos: ${linkAvaliacao}` : ' Qualquer coisa, estamos por aqui.'}`;
    }
    default:
      return `Olá, ${nome}! Sobre o seu pedido #${num} no Empório dos Animais: `;
  }
}
function linkWhatsCliente(p) {
  const tel = digitos(p.cliente && p.cliente.whatsapp);
  if (tel.length < 10) return null;
  return `https://wa.me/55${tel}?text=${encodeURIComponent(msgStatusCliente(p))}`;
}
const ICONE_WA = (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 15, height: 15 }} aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zM6.597 20.13c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 0 0 1.51 5.26l-.999 3.648 3.978-1.043z" />
  </svg>
);

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
  const [entregadores, setEntregadores] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setErro(null);
    try {
      const r = await api.get('/api/pedidos', lojaId ? { lojaId } : {});
      setPedidos(Array.isArray(r?.data) ? r.data : []);
    } catch (e) {
      if (!silent) { setErro(e.message); setPedidos([]); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);
  // Atualização automática (não interrompe arrasto nem painéis abertos)
  useEffect(() => {
    const t = setInterval(() => { if (!drag && !detalhe && !novo) carregar(true); }, 20000);
    return () => clearInterval(t);
  }, [carregar, drag, detalhe, novo]);
  useEffect(() => {
    api.get('/api/lojas').then((r) => {
      const lista = Array.isArray(r) ? r : r?.data || [];
      setLojas(lista);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    api.get('/api/entregadores', { ativo: 'true' })
      .then((r) => setEntregadores(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {});
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

  const atrasos = useMemo(() => {
    let estourou = 0, atencao = 0;
    for (const p of pedidos) {
      if (p.status === 'SEPARADO' && p.entrega && p.entrega.aceitoEm) {
        const min = Math.floor((Date.now() - new Date(p.entrega.aceitoEm).getTime()) / 60000);
        if (min >= 15) estourou++; else if (min >= 10) atencao++;
      }
    }
    return { estourou, atencao };
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
    setDetalhe(p); // mostra o resumo na hora
    try {
      const full = await api.get(`/api/pedidos/${p.id}`);
      setDetalhe(full && full.id ? full : p);
    } catch (_) { /* mantém o resumo */ }
  };

  // Atribui (ou remove) o entregador do pedido, com atualização otimista.
  const atribuirEntregador = useCallback(async (id, entregadorId) => {
    const ent = entregadores.find((e) => String(e.id) === String(entregadorId));
    const novaEntrega = entregadorId ? { entregadorId, entregador: ent ? { id: ent.id, nome: ent.nome, telefone: ent.telefone } : null } : null;
    setPedidos((arr) => arr.map((p) => (String(p.id) === String(id) ? { ...p, entrega: novaEntrega } : p)));
    setDetalhe((d) => (d && String(d.id) === String(id) ? { ...d, entrega: novaEntrega } : d));
    try {
      await api.patch(`/api/pedidos/${id}/entregador`, { entregadorId: entregadorId || null });
    } catch (e) {
      alert('Não consegui atribuir o entregador: ' + e.message);
      carregar();
    }
  }, [entregadores, carregar]);

  // Direciona o pedido SEPARADO a UM entregador (em paralelo à oferta aberta).
  const direcionar = useCallback(async (id, entregadorId) => {
    const ent = entregadores.find((e) => String(e.id) === String(entregadorId));
    const novaEntrega = { entregadorId, atribuidaEm: new Date().toISOString(), aceitoEm: null, entregador: ent ? { id: ent.id, nome: ent.nome, telefone: ent.telefone } : null };
    setPedidos((arr) => arr.map((pp) => (String(pp.id) === String(id) ? { ...pp, status: 'SEPARADO', entrega: novaEntrega } : pp)));
    try {
      await api.patch(`/api/pedidos/${id}/status`, { status: 'SEPARADO', entregadorId });
      carregar(true);
    } catch (e) {
      alert('Não consegui direcionar: ' + e.message);
      carregar();
    }
  }, [entregadores, carregar]);

  // Reenvia o aviso de oferta aberta (push) aos entregadores da loja.
  // Estado por pedido: 'enviando' | { enviados, entregadores } (some sozinho após 5s).
  const [reoferta, setReoferta] = useState({});
  const reofertar = useCallback(async (id) => {
    setReoferta((m) => ({ ...m, [id]: 'enviando' }));
    try {
      const r = await api.post(`/api/pedidos/${id}/reofertar`);
      setReoferta((m) => ({ ...m, [id]: { enviados: r && r.enviados != null ? r.enviados : 0, entregadores: r && r.entregadores != null ? r.entregadores : 0 } }));
    } catch (e) {
      setReoferta((m) => { const n = { ...m }; delete n[id]; return n; });
      alert('Não consegui reenviar o aviso: ' + e.message);
      return;
    }
    setTimeout(() => setReoferta((m) => { const n = { ...m }; delete n[id]; return n; }), 5000);
  }, []);

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

        {(atrasos.estourou > 0 || atrasos.atencao > 0) && (
          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-[13px] font-semibold ${atrasos.estourou > 0 ? 'border-[#e0a3a0] bg-[#fdf3f2] text-[#b23b3b]' : 'border-[#e6cf94] bg-[#fdf8ec] text-[#9a6a1f]'}`}>
            <span>⏱</span>
            {atrasos.estourou > 0
              ? `${atrasos.estourou} entrega(s) passaram dos 15 min aguardando retirada — verifique com o entregador.`
              : `${atrasos.atencao} entrega(s) há mais de 10 min aguardando retirada.`}
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
                    <Card key={p.id} p={p} col={col.key} entregadores={entregadores} onDirecionar={direcionar} onSaiuLoja={(id) => mudarStatus(id, 'EM_ROTA')} onReofertar={reofertar} reoferta={reoferta[String(p.id)] || reoferta[p.id]} onDragStart={() => setDrag(String(p.id))} onClick={() => abrirDetalhe(p)} />
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
          entregadores={entregadores}
          onClose={() => setDetalhe(null)}
          onAvancar={() => { const n = proximo(detalhe.status); if (n) mudarStatus(detalhe.id, n); }}
          onStatus={(s) => mudarStatus(detalhe.id, s)}
          onEntregador={(eid) => atribuirEntregador(detalhe.id, eid)}
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

function Card({ p, onDragStart, onClick, muted, col, entregadores = [], onDirecionar, onSaiuLoja, onReofertar, reoferta }) {
  const nItens = Array.isArray(p.itens) ? p.itens.length : null;
  const ent = p.entrega || null;
  const nome = ent && ent.entregador ? ent.entregador.nome : null;
  const aceito = !!(ent && ent.aceitoEm);
  const direcionadoPendente = !!(ent && ent.atribuidaEm && !ent.aceitoEm);
  const noSeparado = col === 'SEPARADO';
  const sla = noSeparado && aceito ? slaInfo(ent.aceitoEm) : null;
  const tier = sla ? sla.tier : null;
  const baseCls = muted ? 'border-[#e9ddda] bg-white opacity-80' : 'border-[#e3ddcf] bg-white';
  const cartaoCls = tier === 'estourou' ? 'border-[#e0a3a0] bg-[#fdf3f2]' : tier === 'atencao' ? 'border-[#e6cf94] bg-[#fdf8ec]' : baseCls;
  const badgeCls = tier === 'estourou' ? 'bg-[#fbe3e0] text-[#b23b3b]' : tier === 'atencao' ? 'bg-[#fbf0d6] text-[#9a6a1f]' : 'bg-[#eef4ef] text-[#5b6b5f]';
  const stop = (e) => e.stopPropagation();
  const selCls = 'mt-2 w-full rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-2 py-1.5 text-[11.5px] text-[#1F3A2E] outline-none';
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-3 transition hover:border-[#B8935A] ${cartaoCls}`}
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

      {p.avaliacaoNPS && p.avaliacaoNPS.notaGeral != null && (
        <div
          className="mt-1.5 text-[11px] font-semibold"
          style={{ color: p.avaliacaoNPS.notaGeral <= 6 ? '#b23b3b' : p.avaliacaoNPS.notaGeral <= 8 ? '#9a6a1f' : '#2f6b48' }}
        >
          ★ Avaliação do cliente: {p.avaliacaoNPS.notaGeral}/10
        </div>
      )}

      {!noSeparado && nome && (
        <div className="mt-1.5 flex items-center gap-1 border-t border-[#f0ece0] pt-1.5 text-[11px] text-[#3f7d5b]">
          <span className="h-[6px] w-[6px] rounded-full bg-[#3f7d5b]" />
          {nome}
        </div>
      )}

      {col === 'EM_ROTA' && linkWhatsCliente(p) && (
        <a
          href={linkWhatsCliente(p)}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[11.5px] font-bold text-[#07351c] hover:brightness-95"
        >
          {ICONE_WA} Avisar cliente: saiu para entrega
        </a>
      )}

      {noSeparado && (
        <div className="mt-2 border-t border-[#f0ece0] pt-2" onClick={stop} onMouseDown={stop}>
          {aceito ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-[#3f7d5b]">
                  <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#3f7d5b]" />
                  <span className="truncate">{nome} · indo retirar</span>
                </span>
                {sla && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>⏱ {sla.min} min</span>
                )}
              </div>
              {tier === 'estourou' && <div className="mt-1 text-[10.5px] font-semibold text-[#b23b3b]">Passou dos 15 min para retirar</div>}
              {tier === 'atencao' && <div className="mt-1 text-[10.5px] font-semibold text-[#9a6a1f]">Aguardando retirada há {sla.min} min</div>}
              <button
                onClick={() => onSaiuLoja(p.id)}
                className="mt-2 w-full rounded-lg bg-[#1F3A2E] px-3 py-1.5 text-[12px] font-semibold text-[#F4F1EA] hover:bg-[#16291f]"
              >
                Saiu da loja
              </button>
            </>
          ) : direcionadoPendente ? (
            <>
              <div className="text-[11px] font-medium text-[#9a5b1f]">Direcionado a {nome} · aguardando aceite</div>
              <select value="" onChange={(e) => { if (e.target.value) onDirecionar(p.id, e.target.value); }} className={selCls}>
                <option value="">Trocar entregador…</option>
                {entregadores.map((en) => <option key={en.id} value={en.id}>{en.nome}</option>)}
              </select>
            </>
          ) : (
            <>
              <div className="text-[11px] text-[#8a8678]">Ofertado a todos · aguardando aceite</div>
              <select value="" onChange={(e) => { if (e.target.value) onDirecionar(p.id, e.target.value); }} className={selCls}>
                <option value="">Direcionar a um entregador…</option>
                {entregadores.map((en) => <option key={en.id} value={en.id}>{en.nome}</option>)}
              </select>
              {onReofertar && (
                <button
                  onClick={() => onReofertar(p.id)}
                  disabled={reoferta === 'enviando'}
                  className="mt-2 w-full rounded-lg border border-[#e3ddcf] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A] disabled:opacity-50"
                >
                  {reoferta === 'enviando' ? 'Enviando aviso…' : '🔔 Reenviar aviso aos entregadores'}
                </button>
              )}
              {reoferta && reoferta !== 'enviando' && (
                <div className={`mt-1.5 rounded-md px-2 py-1 text-center text-[10.5px] font-semibold ${reoferta.enviados > 0 ? 'bg-[#e6f0e9] text-[#2f6b48]' : 'bg-[#fdf8ec] text-[#9a6a1f]'}`}>
                  {reoferta.enviados > 0
                    ? `Aviso enviado a ${reoferta.enviados} aparelho(s) ✓`
                    : reoferta.entregadores > 0
                    ? 'Nenhum aparelho com notificações ativas ainda.'
                    : 'Nenhum entregador ativo para esta loja.'}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function construirTimeline(p) {
  const ev = [];
  const ent = p.entrega || null;
  const entNome = ent && ent.entregador ? ent.entregador.nome : null;
  if (p.pedidoEm) ev.push({ t: p.pedidoEm, titulo: 'Pedido recebido', sub: p.canalOrigem ? `via ${p.canalOrigem}` : '' });
  if (ent && ent.atribuidaEm) ev.push({ t: ent.atribuidaEm, titulo: entNome ? `Direcionado a ${entNome}` : 'Direcionado a um entregador' });
  if (ent && ent.aceitoEm) ev.push({ t: ent.aceitoEm, titulo: entNome ? `Aceito por ${entNome}` : 'Aceito pelo entregador' });
  const hist = Array.isArray(p.historicoStatus) ? p.historicoStatus : [];
  if (hist.length) {
    for (const h of hist) {
      ev.push({ t: h.criadoEm, titulo: STATUS_LABEL[h.statusNovo] || h.statusNovo, sub: h.usuario && h.usuario.nome ? `por ${h.usuario.nome}` : '', motivo: h.motivo });
    }
  } else {
    if (ent && ent.saidaEm) ev.push({ t: ent.saidaEm, titulo: 'Saiu para entrega' });
    if (ent && ent.entregueEm) ev.push({ t: ent.entregueEm, titulo: 'Entregue' });
  }
  return ev.sort((a, b) => new Date(a.t) - new Date(b.t));
}

function Timeline({ p }) {
  const eventos = construirTimeline(p);
  if (!eventos.length) return null;
  return (
    <div className="mt-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Linha do tempo</div>
      <div>
        {eventos.map((e, i) => (
          <div key={i} className="flex gap-3 pb-3 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-[8px] w-[8px] shrink-0 rounded-full bg-[#3f7d5b]" />
              {i < eventos.length - 1 && <span className="w-px flex-1 bg-[#e3ddcf]" />}
            </div>
            <div className="-mt-0.5">
              <div className="text-[13px] font-medium text-[#1F3A2E]">{e.titulo}</div>
              <div className="text-[11.5px] text-[#9a9483]">{quando(e.t)}{e.sub ? ` · ${e.sub}` : ''}</div>
              {e.motivo && <div className="text-[11.5px] text-[#a85a52]">{e.motivo}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Drawer({ p, salvando, entregadores = [], onClose, onAvancar, onStatus, onEntregador }) {
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

          {linkWhatsCliente(p) && (
            <a
              href={linkWhatsCliente(p)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-[13px] font-bold text-[#07351c] hover:brightness-95"
            >
              {ICONE_WA} Avisar cliente no WhatsApp
            </a>
          )}
          {linkWhatsCliente(p) && (
            <p className="mt-1.5 text-center text-[10.5px] text-[#9a9483]">Abre a conversa com a mensagem pronta para “{STATUS_LABEL[p.status] || p.status}” — revise e envie.</p>
          )}

          {/* Entregador */}
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Entregador</label>
            <select
              value={p.entrega?.entregador?.id ? String(p.entrega.entregador.id) : ''}
              onChange={(e) => onEntregador && onEntregador(e.target.value)}
              disabled={salvando}
              className="w-full rounded-lg border border-[#e3ddcf] px-3 py-2 text-[13.5px] outline-none focus:border-[#B8935A] disabled:opacity-60"
            >
              <option value="">— Não atribuído —</option>
              {entregadores.map((en) => (
                <option key={en.id} value={en.id}>{en.nome}{en.telefone ? ` · ${en.telefone}` : ''}</option>
              ))}
            </select>
          </div>

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

          <Timeline p={p} />

          {p.avaliacaoNPS && (
            <div className="mt-4 rounded-lg border border-[#e3ddcf] bg-[#FBF9F4] px-3.5 py-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Avaliação do cliente</div>
              <div
                className="text-[16px] font-bold"
                style={{ color: p.avaliacaoNPS.notaGeral <= 6 ? '#b23b3b' : p.avaliacaoNPS.notaGeral <= 8 ? '#9a6a1f' : '#2f6b48' }}
              >
                ★ {p.avaliacaoNPS.notaGeral}/10
              </div>
              {p.avaliacaoNPS.comentario && (
                <p className="mt-1 text-[13px] italic text-[#5a5750]">“{p.avaliacaoNPS.comentario}”</p>
              )}
              <div className="mt-1 text-[10.5px] text-[#9a9483]">Respondido em {hora(p.avaliacaoNPS.respondidoEm)}</div>
            </div>
          )}
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
              <button
                onClick={() => { if (confirm(`Cancelar o pedido #${p.numero || p.id}?\n\nEle sai do fluxo, mas não é apagado — você pode reabri-lo depois.`)) onStatus('CANCELADO_LOJA'); }}
                disabled={salvando}
                className="flex-1 rounded-lg border border-[#e9ddda] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#a85a52] hover:border-[#d8a59c] disabled:opacity-50"
              >
                Cancelar pedido
              </button>
              {p.status === 'ENTREGUE' && (
                <button
                  onClick={() => { if (confirm(`Marcar o pedido #${p.numero || p.id} como devolvido?`)) onStatus('DEVOLVIDO'); }}
                  disabled={salvando}
                  className="flex-1 rounded-lg border border-[#e9ddda] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#a85a52] hover:border-[#d8a59c] disabled:opacity-50"
                >
                  Devolvido
                </button>
              )}
            </div>
          )}
          {cancelado && (
            <button
              onClick={() => { if (confirm(`Reabrir o pedido #${p.numero || p.id}?\n\nEle volta para a coluna "Recebido" e segue o fluxo normalmente.`)) onStatus('RECEBIDO'); }}
              disabled={salvando}
              className="w-full rounded-lg border border-[#d6c8a6] bg-[#faf6ec] px-4 py-2.5 text-[13.5px] font-semibold text-[#8a6a1f] hover:border-[#B8935A] disabled:opacity-50"
            >
              Reabrir pedido
            </button>
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

const PET_OPTS = [
  { v: '', t: 'Todos os pets' },
  { v: 'CAO', t: 'Cão' },
  { v: 'GATO', t: 'Gato' },
  { v: 'AVE', t: 'Ave' },
  { v: 'PEIXE', t: 'Peixe' },
  { v: 'ROEDOR', t: 'Roedor' },
  { v: 'REPTIL', t: 'Réptil' },
  { v: 'OUTRO', t: 'Outro' },
  { v: 'MULTI', t: 'Multi' },
];

const soDig = (s) => String(s || '').replace(/\D/g, '');

function NovoPedido({ lojas, onClose, onCreated }) {
  // Cliente (identificação por CPF)
  const [cpf, setCpf] = useState('');
  const [cliente, setCliente] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [porNome, setPorNome] = useState(false);
  const [nomeBusca, setNomeBusca] = useState('');
  const [nomeRes, setNomeRes] = useState([]);
  // cadastro novo
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  // endereço
  const [end, setEnd] = useState({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'PR' });
  const [enderecos, setEnderecos] = useState([]);
  const [endSel, setEndSel] = useState('novo');
  const [cepBuscando, setCepBuscando] = useState(false);
  // pedido
  const [lojaId, setLojaId] = useState('');
  const [canal, setCanal] = useState('WHATSAPP');
  const [itens, setItens] = useState([]);
  // filtros + busca de produto
  const [categorias, setCategorias] = useState([]);
  const [fCat, setFCat] = useState('');
  const [fPet, setFPet] = useState('');
  const [pBusca, setPBusca] = useState('');
  const [pRes, setPRes] = useState([]);
  const [frete, setFrete] = useState('');
  const [desconto, setDesconto] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState(null);
  const tp = useState(() => ({ t: null }))[0];
  const tn = useState(() => ({ t: null }))[0];
  const tc = useState(() => ({ t: null }))[0];
  const [cotacao, setCotacao] = useState(null);
  const [freteManual, setFreteManual] = useState(false);

  useEffect(() => { if (lojas.length === 1) setLojaId(String(lojas[0].id)); }, [lojas]);
  useEffect(() => {
    api.get('/api/produtos', { perPage: 1 }).then((r) => setCategorias(r?.facets?.categorias || [])).catch(() => {});
  }, []);

  const buscarCpf = async () => {
    const d = soDig(cpf);
    if (d.length < 11) { setErro('Informe um CPF válido (11 dígitos).'); return; }
    setErro(null); setBuscando(true);
    try {
      const r = await api.get('/api/clientes', { q: d, perPage: 10 });
      const lista = Array.isArray(r?.data) ? r.data : [];
      const achado = lista.find((c) => soDig(c.cpf) === d);
      if (achado) await selecionarCliente(achado);
      else { setCliente(null); setBuscou(true); }
    } catch (e) { setErro(e.message); }
    finally { setBuscando(false); }
  };

  const selecionarCliente = async (c) => {
    setCliente(c); setBuscou(true); setPorNome(false); setNomeRes([]); setErro(null);
    if (c.cpf) setCpf(c.cpf);
    setEnderecos([]); setEndSel('novo');
    try {
      const det = await api.get(`/api/clientes/${c.id}`);
      const eds = Array.isArray(det?.enderecos) ? det.enderecos : [];
      setEnderecos(eds);
      if (eds.length) { const p = eds.find((e) => e.principal) || eds[0]; setEndSel(String(p.id)); }
    } catch (_) { /* segue sem endereço salvo */ }
  };

  const trocarCliente = () => {
    setCliente(null); setBuscou(false); setCpf(''); setNome(''); setWhatsapp('');
    setEnderecos([]); setEndSel('novo'); setPorNome(false); setNomeBusca(''); setNomeRes([]);
    setEnd({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'PR' });
    setFreteManual(false); setCotacao(null);
  };

  const buscarNome = (txt) => {
    setNomeBusca(txt); clearTimeout(tn.t);
    if (txt.trim().length < 2) { setNomeRes([]); return; }
    tn.t = setTimeout(async () => {
      try { const r = await api.get('/api/clientes', { q: txt, perPage: 8 }); setNomeRes(Array.isArray(r?.data) ? r.data : []); }
      catch (_) { setNomeRes([]); }
    }, 250);
  };

  const buscarCep = async (cepRaw) => {
    setEnd((e) => ({ ...e, cep: cepRaw }));
    setFreteManual(false);
    const d = soDig(cepRaw);
    if (d.length !== 8) return;
    setCepBuscando(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await resp.json();
      if (!j.erro) setEnd((e) => ({ ...e, cep: d, logradouro: j.logradouro || e.logradouro, bairro: j.bairro || e.bairro, cidade: j.localidade || e.cidade, uf: j.uf || e.uf }));
    } catch (_) { /* mantém o que foi digitado */ }
    finally { setCepBuscando(false); }
  };

  const buscarProdutos = (txt) => {
    setPBusca(txt); clearTimeout(tp.t);
    if (txt.trim().length < 2 && !fCat && !fPet) { setPRes([]); return; }
    tp.t = setTimeout(async () => {
      try {
        const r = await api.get('/api/produtos', { q: txt, categoriaId: fCat || undefined, pet: fPet || undefined, perPage: 10, sort: 'giro', order: 'desc' });
        setPRes(Array.isArray(r?.data) ? r.data : []);
      } catch (_) { setPRes([]); }
    }, 200);
  };
  useEffect(() => {
    if (pBusca.trim().length >= 2 || fCat || fPet) buscarProdutos(pBusca);
    else setPRes([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fCat, fPet]);

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
  const usaEndNovo = !cliente || endSel === 'novo' || !enderecos.length;

  // Endereço efetivo (novo ou salvo) usado pra cotar o frete
  const endEfetivo = usaEndNovo ? end : (enderecos.find((e) => String(e.id) === String(endSel)) || end);

  // Cotação automática do frete pela zona (precedência CEP -> cidade -> bairro)
  useEffect(() => {
    const cepD = soDig(endEfetivo.cep);
    if (!lojaId || cepD.length !== 8) { setCotacao(null); return; }
    clearTimeout(tc.t);
    tc.t = setTimeout(async () => {
      try {
        const r = await api.post('/api/frete/cotar', {
          cep: cepD,
          bairro: endEfetivo.bairro || '',
          cidade: endEfetivo.cidade || '',
          valorPedido: subtotal,
          lojaId,
        });
        setCotacao(r || null);
        if (r && r.atendido && !freteManual) setFrete(String(r.taxa ?? 0));
      } catch (_) { setCotacao(null); }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId, endEfetivo.cep, endEfetivo.bairro, endEfetivo.cidade, subtotal, freteManual]);

  const criar = async () => {
    setErro(null);
    let clienteId = cliente?.id;
    if (!clienteId) {
      if (!nome.trim()) return setErro('Informe o nome do cliente.');
      if (soDig(cpf).length < 11) return setErro('Informe o CPF (11 dígitos).');
      if (soDig(whatsapp).length < 10) return setErro('Informe o WhatsApp do cliente.');
    }
    if (!lojaId) return setErro('Selecione a loja.');
    if (!itens.length) return setErro('Adicione ao menos um item.');
    if (usaEndNovo && !end.logradouro && !end.bairro && !end.cidade) return setErro('Informe o endereço de entrega (digite o CEP).');
    setCriando(true);
    try {
      if (!clienteId) {
        const novo = await api.post('/api/clientes', { nome, cpf: soDig(cpf), whatsapp: soDig(whatsapp) });
        clienteId = novo.id;
        if (!clienteId) throw new Error('Falha ao cadastrar o cliente.');
      }
      await api.post('/api/pedidos', {
        clienteId,
        lojaId,
        canalOrigem: canal,
        enderecoEntregaId: usaEndNovo ? undefined : endSel,
        endereco: usaEndNovo ? end : undefined,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        valorFrete: Number(frete) || 0,
        valorDesconto: Number(desconto) || 0,
      });
      onCreated();
    } catch (e) { setErro(e.message); setCriando(false); }
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
          {/* CLIENTE por CPF */}
          <label className={lab}>Cliente (CPF)</label>
          {cliente ? (
            <div className="mb-3 rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-medium text-[#1F3A2E]">{cliente.nome}</span>
                <button onClick={trocarCliente} className="text-[12px] font-semibold text-[#B8935A]">trocar</button>
              </div>
              <div className="text-[12px] text-[#8a8678]">{cliente.whatsapp ? `WhatsApp ${cliente.whatsapp}` : ''}{cliente.cpf ? ` · CPF ${cliente.cpf}` : ''}</div>
            </div>
          ) : (
            <div className="mb-3">
              <div className="flex gap-2">
                <input className={inp} value={cpf} onChange={(e) => setCpf(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscarCpf(); }} placeholder="Digite o CPF e busque" inputMode="numeric" />
                <button onClick={buscarCpf} disabled={buscando} className="whitespace-nowrap rounded-lg border border-[#e3ddcf] bg-white px-3 py-2 text-[13px] font-semibold text-[#1F3A2E] hover:border-[#B8935A] disabled:opacity-60">{buscando ? '…' : 'Buscar'}</button>
              </div>
              <button onClick={() => setPorNome((v) => !v)} className="mt-1 text-[11.5px] font-semibold text-[#B8935A]">{porNome ? 'usar CPF' : 'não tem o CPF? buscar por nome'}</button>

              {porNome && (
                <div className="relative mt-1">
                  <input className={inp} value={nomeBusca} onChange={(e) => buscarNome(e.target.value)} placeholder="Buscar cliente por nome…" />
                  {nomeRes.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#e3ddcf] bg-white shadow">
                      {nomeRes.map((c) => (
                        <button key={c.id} onClick={() => selecionarCliente(c)} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#F4F1EA]">{c.nome} <span className="text-[#8a8678]">· {c.whatsapp || '—'}</span></button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {buscou && !porNome && (
                <div className="mt-2 rounded-lg border border-[#e3ddcf] bg-[#faf8f2] p-3">
                  <div className="mb-2 text-[12px] font-semibold text-[#8a6a1f]">Cliente novo — cadastro rápido</div>
                  <div className="mb-2"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" /></div>
                  <input className={inp} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (com DDD)" inputMode="numeric" />
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
          {cliente && enderecos.length > 0 && (
            <select className={`${inp} mb-2`} value={endSel} onChange={(e) => setEndSel(e.target.value)}>
              {enderecos.map((e) => <option key={e.id} value={e.id}>{[e.logradouro, e.numero, e.bairro].filter(Boolean).join(', ')}</option>)}
              <option value="novo">+ Outro endereço</option>
            </select>
          )}
          {usaEndNovo && (
            <div className="mb-3 grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <input className={inp} value={end.cep} onChange={(e) => buscarCep(e.target.value)} onBlur={(e) => buscarCep(e.target.value)} placeholder={cepBuscando ? 'Buscando CEP…' : 'CEP'} inputMode="numeric" />
              </div>
              <input className={`${inp} col-span-3`} value={end.numero} onChange={(e) => setEnd({ ...end, numero: e.target.value })} placeholder="Número" />
              <input className={`${inp} col-span-6`} value={end.logradouro} onChange={(e) => setEnd({ ...end, logradouro: e.target.value })} placeholder="Rua / logradouro" />
              <input className={`${inp} col-span-3`} value={end.bairro} onChange={(e) => setEnd({ ...end, bairro: e.target.value })} placeholder="Bairro" />
              <input className={`${inp} col-span-2`} value={end.cidade} onChange={(e) => setEnd({ ...end, cidade: e.target.value })} placeholder="Cidade" />
              <input className={`${inp} col-span-1`} value={end.uf} onChange={(e) => setEnd({ ...end, uf: e.target.value })} placeholder="UF" maxLength={2} />
              <input className={`${inp} col-span-6`} value={end.complemento} onChange={(e) => setEnd({ ...end, complemento: e.target.value })} placeholder="Complemento (opcional)" />
            </div>
          )}

          {/* Itens com filtros */}
          <label className={lab}>Itens</label>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <select className={inp} value={fCat} onChange={(e) => setFCat(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select className={inp} value={fPet} onChange={(e) => setFPet(e.target.value)}>
              {PET_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select>
          </div>
          <div className="relative mb-2">
            <input className={inp} value={pBusca} onChange={(e) => buscarProdutos(e.target.value)} placeholder="Buscar produto por nome ou SKU…" />
            {pRes.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#e3ddcf] bg-white shadow">
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
              <input type="number" min="0" step="0.01" className={inp} value={frete} onChange={(e) => { setFreteManual(true); setFrete(e.target.value); }} placeholder="0,00" />
              {cotacao && (cotacao.atendido
                ? <div className="mt-1 text-[11.5px] text-[#3f7d5b]">Zona: {BRL(cotacao.taxa)}{cotacao.prazoMinHoras ? ` · ${cotacao.prazoMinHoras}–${cotacao.prazoMaxHoras}h` : ''}{freteManual ? ' · ajustado manual' : ''}</div>
                : <div className="mt-1 text-[11.5px] text-[#a85a52]">Fora das zonas cadastradas — informe o frete manual.</div>)}
            </div>
            <div><label className={lab}>Desconto (R$)</label><input type="number" min="0" step="0.01" className={inp} value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" /></div>
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
