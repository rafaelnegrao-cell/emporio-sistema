// frontend/src/app/admin/relatorios/page.js
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

const BRL = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtMin = (m) => {
  if (m == null) return '—';
  const t = Math.round(m);
  if (t < 60) return `${t} min`;
  const h = Math.floor(t / 60), r = t % 60;
  return `${h}h${String(r).padStart(2, '0')}`;
};
const pct = (n) => (n == null ? '—' : `${Math.round(n)}%`);
const ymd = (d) => d.toISOString().slice(0, 10);
const ddmm = (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; };

export default function RelatoriosPage() {
  const hoje = new Date();
  const [inicio, setInicio] = useState(ymd(new Date(hoje.getTime() - 29 * 86400000)));
  const [fim, setFim] = useState(ymd(hoje));
  const [lojaId, setLojaId] = useState('');
  const [lojas, setLojas] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api.get('/api/lojas')
      .then((r) => setLojas(Array.isArray(r) ? r : (r && r.data) || []))
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const params = { inicio, fim };
      if (lojaId) params.lojaId = lojaId;
      const r = await api.get('/api/pedidos/relatorio', params);
      setData(r);
    } catch (e) { setErro(e.message); setData(null); }
    finally { setLoading(false); }
  }, [inicio, fim, lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const atalho = (dias) => {
    const h = new Date();
    setFim(ymd(h));
    setInicio(ymd(new Date(h.getTime() - (dias - 1) * 86400000)));
  };

  const r = data;
  const maxDia = useMemo(() => {
    if (!r || !r.porDia || !r.porDia.length) return 0;
    return Math.max(...r.porDia.map((d) => d.faturamento));
  }, [r]);

  const inp = 'rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-3 py-2 text-[13px] font-semibold text-[#1F3A2E] outline-none focus:border-[#B8935A]';
  const retiradaAlta = r && r.tempos.retiradaMedMin != null && r.tempos.retiradaMedMin > 15;

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#e3ddcf] bg-white px-7 py-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Gestão</div>
          <h1 className="font-serif text-[22px] font-bold text-[#1F3A2E]">Relatórios</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className={inp} />
          <span className="text-[12px] text-[#8a8678]">até</span>
          <input type="date" value={fim} min={inicio} max={ymd(hoje)} onChange={(e) => setFim(e.target.value)} className={inp} />
          <select value={lojaId} onChange={(e) => setLojaId(e.target.value)} className={inp}>
            <option value="">Todas as lojas</option>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <button onClick={carregar} className="rounded-lg bg-[#B8935A] px-4 py-2 text-[13px] font-semibold text-[#16291f] hover:bg-[#a8824a]">
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-7 pb-10 pt-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {[['Hoje', 1], ['7 dias', 7], ['30 dias', 30], ['90 dias', 90]].map(([lab, d]) => (
            <button key={lab} onClick={() => atalho(d)} className="rounded-full border border-[#e3ddcf] bg-white px-3 py-1 text-[12px] font-semibold text-[#5e5a4e] hover:border-[#B8935A]">{lab}</button>
          ))}
        </div>

        {erro && <div className="mb-4 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-4 py-3 text-[13px] text-[#b23b3b]">Erro ao carregar: {erro}</div>}

        {loading && !r ? (
          <div className="py-16 text-center text-[14px] text-[#8a8678]">Carregando relatório…</div>
        ) : !r ? null : (
          <>
            {/* KPIs principais */}
            <div className="mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              <Kpi lab="Faturamento" val={BRL(r.resumo.faturamento)} note={`${r.resumo.pedidos} pedido(s) válidos`} forte />
              <Kpi lab="Ticket médio" val={BRL(r.resumo.ticketMedio)} note="por pedido" />
              <Kpi lab="Frete arrecadado" val={BRL(r.resumo.frete)} note={`desconto: ${BRL(r.resumo.desconto)}`} />
              <Kpi lab="Entregues" val={r.resumo.entregues} note={`${r.resumo.cancelados} cancelado(s)`} />
            </div>

            {/* Tempos / SLA */}
            <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
              <div className={`rounded-xl border px-4 py-3.5 ${retiradaAlta ? 'border-[#e0a3a0] bg-[#fdf3f2]' : 'border-[#e3ddcf] bg-white'}`}>
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Tempo médio de retirada</div>
                <div className={`mt-1 font-serif text-[24px] font-bold ${retiradaAlta ? 'text-[#b23b3b]' : 'text-[#1F3A2E]'}`}>{fmtMin(r.tempos.retiradaMedMin)}</div>
                <div className="text-[11.5px] text-[#9a9483]">aceite → saída · meta 15 min · {r.tempos.amostraRetirada} amostra(s)</div>
              </div>
              <div className="rounded-xl border border-[#e3ddcf] bg-white px-4 py-3.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Dentro da SLA (15 min)</div>
                <div className="mt-1 font-serif text-[24px] font-bold text-[#1F3A2E]">{pct(r.tempos.dentroSlaPct)}</div>
                <div className="text-[11.5px] text-[#9a9483]">retiradas no prazo</div>
              </div>
              <div className="rounded-xl border border-[#e3ddcf] bg-white px-4 py-3.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Tempo médio de rota</div>
                <div className="mt-1 font-serif text-[24px] font-bold text-[#1F3A2E]">{fmtMin(r.tempos.rotaMedMin)}</div>
                <div className="text-[11.5px] text-[#9a9483]">saída → entrega · {r.tempos.amostraRota} amostra(s)</div>
              </div>
            </div>

            {/* Faturamento por dia */}
            <Painel titulo="Faturamento por dia">
              {r.porDia.length === 0 ? (
                <Vazio>Sem pedidos no período.</Vazio>
              ) : (
                <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 140 }}>
                  {r.porDia.map((d) => {
                    const h = maxDia ? Math.max(4, Math.round((d.faturamento / maxDia) * 110)) : 4;
                    return (
                      <div key={d.dia} className="flex w-[34px] flex-none flex-col items-center gap-1" title={`${ddmm(d.dia)} · ${BRL(d.faturamento)} · ${d.pedidos} pedido(s)`}>
                        <span className="text-[9px] text-[#9a9483]">{d.pedidos}</span>
                        <div className="w-[20px] rounded-t bg-[#3f7d5b]" style={{ height: h }} />
                        <span className="text-[9px] text-[#9a9483]">{ddmm(d.dia)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Painel>

            {/* Entregadores */}
            <Painel titulo="Entregas por entregador">
              {r.entregadores.length === 0 ? (
                <Vazio>Nenhuma entrega concluída no período.</Vazio>
              ) : (
                <Tabela cabecalho={['Entregador', 'Entregas', 'Retirada média', 'Rota média']}>
                  {r.entregadores.map((e) => (
                    <tr key={e.id} className="border-t border-[#f0ece0]">
                      <td className="px-3 py-2 text-[13px] text-[#3a3730]">{e.nome}</td>
                      <td className="px-3 py-2 text-[13px] font-semibold text-[#1F3A2E]">{e.entregas}</td>
                      <td className={`px-3 py-2 text-[13px] ${e.retiradaMedMin != null && e.retiradaMedMin > 15 ? 'font-semibold text-[#b23b3b]' : 'text-[#3a3730]'}`}>{fmtMin(e.retiradaMedMin)}</td>
                      <td className="px-3 py-2 text-[13px] text-[#3a3730]">{fmtMin(e.rotaMedMin)}</td>
                    </tr>
                  ))}
                </Tabela>
              )}
            </Painel>

            {/* Curva ABC */}
            <Painel titulo={`Curva ABC de produtos${r.abc.length > 25 ? ` (25 de ${r.abc.length})` : ''}`}>
              {r.abc.length === 0 ? (
                <Vazio>Sem itens vendidos no período.</Vazio>
              ) : (
                <Tabela cabecalho={['Classe', 'Produto', 'Qtd', 'Receita', '% total', 'Acumulado']}>
                  {r.abc.slice(0, 25).map((p) => (
                    <tr key={p.id} className="border-t border-[#f0ece0]">
                      <td className="px-3 py-2"><ClasseTag c={p.classe} /></td>
                      <td className="px-3 py-2 text-[13px] text-[#3a3730]">{p.nome}</td>
                      <td className="px-3 py-2 text-[13px] text-[#3a3730]">{p.qtd}</td>
                      <td className="px-3 py-2 text-[13px] font-semibold text-[#1F3A2E]">{BRL(p.receita)}</td>
                      <td className="px-3 py-2 text-[13px] text-[#6b685e]">{p.pct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-[13px] text-[#6b685e]">{p.acumPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </Tabela>
              )}
              {r.abc.length > 0 && (
                <div className="mt-2 px-1 text-[11.5px] text-[#9a9483]">
                  Classe A = até 80% da receita · B = 80–95% · C = cauda. Foque o estoque e a negociação nos itens A.
                </div>
              )}
            </Painel>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ lab, val, note, forte }) {
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${forte ? 'border-[#cdbb97] bg-[#fbf6ec]' : 'border-[#e3ddcf] bg-white'}`}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">{lab}</div>
      <div className="mt-1 font-serif text-[24px] font-bold text-[#1F3A2E]">{val}</div>
      <div className="text-[11.5px] text-[#9a9483]">{note}</div>
    </div>
  );
}

function Painel({ titulo, children }) {
  return (
    <section className="mb-4 rounded-xl border border-[#e3ddcf] bg-white p-4">
      <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-[#5e5a4e]">{titulo}</div>
      {children}
    </section>
  );
}

function Tabela({ cabecalho, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9483]">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function ClasseTag({ c }) {
  const cls = c === 'A' ? 'bg-[#e6f0e9] text-[#2f6b48]' : c === 'B' ? 'bg-[#fbf0d6] text-[#9a6a1f]' : 'bg-[#eef1ec] text-[#6b685e]';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{c}</span>;
}

function Vazio({ children }) {
  return <div className="py-6 text-center text-[12.5px] text-[#b9b3a3]">{children}</div>;
}
