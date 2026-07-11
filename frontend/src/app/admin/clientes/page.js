// frontend/src/app/admin/clientes/page.js
// Aba Clientes do backoffice — porta do protótipo, consumindo a API.
// Inclui: busca/filtros/ordenação/paginação no servidor, painel lateral de
// detalhe, importação de base via Excel/CSV (SheetJS) e export CSV.
//
// Dependência: SheetJS no frontend.  No diretório frontend, rode:  npm install xlsx
// (o import é dinâmico para não pesar no bundle nem quebrar o SSR.)
//
// Requer em frontend/src/lib/api.js (já existe clientesApi); este arquivo usa
// também o helper genérico `api` para o endpoint de importação.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, clientesApi } from '../../../lib/api';

const ESP_ICON = { CAO: '🐶', GATO: '🐱', AVE: '🐦', PEIXE: '🐟', ROEDOR: '🐹', OUTRO: '🐾' };
const BRL = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }));
const initials = (n) => (n || '?').split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const ultLbl = (d) => (d == null ? '—' : d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

const STATUS_OPTS = [
  { v: '', t: 'Todos status' },
  { v: 'ativo', t: 'Ativos (≤60d)' },
  { v: 'inativo', t: 'Inativos' },
  { v: 'recompra', t: 'Recompra próxima' },
];

// ─── cabeçalhos aceitos na importação (tolerante a acento/maiúscula/sinônimos)
const HMAP = {
  nome: ['nome', 'cliente', 'nome completo', 'razao social'],
  whatsapp: ['whatsapp', 'whats', 'zap', 'telefone', 'celular', 'contato', 'fone'],
  cpf: ['cpf', 'documento'],
  email: ['email', 'e-mail'],
  cep: ['cep'],
  logradouro: ['logradouro', 'endereco', 'rua', 'rua/logradouro', 'rua logradouro'],
  numero: ['numero', 'no', 'num', 'nº'],
  complemento: ['complemento', 'compl'],
  cidade: ['cidade', 'municipio'],
  bairro: ['bairro'],
  uf: ['uf', 'estado'],
  loja: ['loja', 'unidade', 'loja preferida'],
  optIn: ['marketing', 'optin', 'opt-in', 'aceita marketing', 'lgpd', 'aceita'],
  petNome: ['pet', 'pet nome', 'nome do pet', 'animal'],
  petEspecie: ['especie', 'pet especie', 'tipo pet'],
  petRaca: ['raca', 'pet raca'],
};
const norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const digits = (s) => (s == null ? '' : String(s)).replace(/\D/g, '');
function mapHeaders(keys) {
  const m = {};
  keys.forEach((k) => {
    const n = norm(k);
    for (const f in HMAP) if (!m[f] && HMAP[f].some((a) => norm(a) === n)) { m[f] = k; break; }
  });
  return m;
}

export default function ClientesPage() {
  const [q, setQ] = useState('');
  const [filtros, setFiltros] = useState({ status: '', lojaId: '', especie: '' });
  const [sort, setSort] = useState({ key: 'totalGasto', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [resp, setResp] = useState({ data: [], total: 0, totalPages: 1, facets: { lojas: [] }, kpis: {} });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null);     // cliente carregado (drawer)
  const [preview, setPreview] = useState(null);      // { validos, nDup, nIgn, map }
  const [novo, setNovo] = useState(false);
  const debounce = useRef();
  const fileRef = useRef();

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const r = await clientesApi.list({
        q, status: filtros.status, lojaId: filtros.lojaId, especie: filtros.especie,
        sort: sort.key, order: sort.dir, page, perPage: 12,
      });
      setResp({
        data: Array.isArray(r?.data) ? r.data : [],
        page: r?.page || 1,
        perPage: r?.perPage || 12,
        total: r?.total || 0,
        totalPages: r?.totalPages || 1,
        facets: { lojas: r?.facets?.lojas || [] },
        kpis: r?.kpis || {},
      });
    } catch (e) { setErro(e.message); } finally { setLoading(false); }
  }, [q, filtros, sort, page]);

  useEffect(() => { carregar(); }, [carregar]);

  const onBusca = (e) => {
    const v = e.target.value;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); setQ(v); }, 200);
  };
  const setF = (k, v) => { setPage(1); setFiltros((f) => ({ ...f, [k]: v })); };
  const ordenar = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'nome' ? 'asc' : 'desc' }));

  const abrirDetalhe = async (id) => {
    setDetalhe({ loading: true });
    try { setDetalhe(await clientesApi.get(id)); }
    catch (e) { setDetalhe({ erro: e.message }); }
  };

  // ─── Importação Excel/CSV
  const onArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) return alert('A planilha está vazia.');
      const map = mapHeaders(Object.keys(rows[0]));
      if (!map.nome || !map.whatsapp) return alert('Não encontrei as colunas obrigatórias "Nome" e "WhatsApp". Baixe o Modelo para conferir o formato.');
      const existentes = new Set(resp.data.map((c) => digits(c.whatsapp))); // dedup local da página; servidor faz upsert definitivo
      const vistos = new Set();
      const validos = []; let nDup = 0; let nIgn = 0;
      rows.forEach((r) => {
        const nome = String(r[map.nome] || '').trim();
        const wa = String(r[map.whatsapp] || '').trim();
        const d = digits(wa);
        if (!nome || !d) { nIgn++; return; }
        if (vistos.has(d)) { nDup++; return; }
        vistos.add(d);
        const optIn = ['sim', 's', 'true', '1', 'yes', 'x', 'verdadeiro'].includes(map.optIn ? norm(r[map.optIn]) : '');
        const pet = map.petNome && String(r[map.petNome] || '').trim()
          ? { nome: String(r[map.petNome]).trim(), especie: norm(r[map.petEspecie]).startsWith('gat') ? 'GATO' : 'CAO', raca: (map.petRaca && String(r[map.petRaca] || '').trim()) || null }
          : null;
        validos.push({
          nome, whatsapp: wa, cpf: map.cpf ? String(r[map.cpf] || '').trim() : '',
          email: map.email ? String(r[map.email] || '').trim() : '',
          cep: map.cep ? String(r[map.cep] || '').trim() : '',
          logradouro: map.logradouro ? String(r[map.logradouro] || '').trim() : '',
          numero: map.numero ? String(r[map.numero] || '').trim() : '',
          complemento: map.complemento ? String(r[map.complemento] || '').trim() : '',
          cidade: map.cidade ? String(r[map.cidade] || '').trim() : '',
          bairro: map.bairro ? String(r[map.bairro] || '').trim() : '',
          uf: map.uf ? String(r[map.uf] || '').trim() : '',
          loja: map.loja ? String(r[map.loja] || '').trim() : '', optIn, pet,
        });
      });
      setPreview({ validos, nDup, nIgn, map });
    } catch (err) { alert('Não consegui ler o arquivo: ' + err.message); }
  };

  const confirmarImport = async () => {
    try {
      const r = await api.post('/api/clientes/importar', { clientes: preview.validos });
      setPreview(null);
      alert(`Importação concluída: ${r.criados} criados, ${r.atualizados} atualizados, ${r.ignorados} ignorados.`);
      setPage(1); carregar();
    } catch (e) { alert('Erro ao importar: ' + e.message); }
  };

  // Recalcula os campos-resumo (pedidos, total gasto, última compra) de todos os
  // clientes a partir dos pedidos entregues — corrige dados antigos e pós-importação.
  const recalcularEstatisticas = async () => {
    if (!confirm('Recalcular pedidos, total gasto e última compra de todos os clientes a partir dos pedidos entregues?')) return;
    try {
      const r = await api.post('/api/clientes/recalcular-estatisticas');
      alert(`Pronto: ${r.atualizados} cliente(s) com compras atualizados.`);
      carregar();
    } catch (e) {
      alert('Não consegui recalcular: ' + e.message);
    }
  };

  const baixarModelo = async () => {
    const XLSX = await import('xlsx');
    const headers = ['Nome', 'WhatsApp', 'CPF', 'CEP', 'Logradouro', 'Número', 'Bairro', 'Cidade', 'UF', 'Complemento', 'Email', 'Loja', 'Aceita Marketing', 'Pet', 'Espécie', 'Raça'];
    const ex = ['Maria Silva', '43 99999-1234', '123.456.789-00', '86050-670', 'Rua Belém', '120', 'Centro', 'Londrina', 'PR', 'Apto 12', 'maria@email.com', 'Av. Maringá', 'Sim', 'Thor', 'Cão', 'Golden Retriever'];
    const ws = XLSX.utils.aoa_to_sheet([headers, ex]);
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, h.length + 3) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'modelo-importacao-clientes.xlsx');
  };

  const exportarCSV = () => {
    const head = ['Nome', 'WhatsApp', 'Cidade', 'Bairro', 'Pedidos', 'TotalGasto', 'UltimaCompra', 'Status'];
    const linhas = resp.data.map((c) =>
      [`"${c.nome}"`, c.whatsapp, c.cidade || '', c.bairro || '', c.qtdPedidos,
       (Number(c.totalGasto) || 0).toFixed(2).replace('.', ','), fmtDate(c.ultimaCompraEm), c.ativo ? 'Ativo' : 'Inativo'].join(';'));
    const blob = new Blob(['\uFEFF' + [head.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clientes.csv'; a.click();
  };

  const k = resp.kpis || {};
  const pages = resp.totalPages || 1;

  const Th = ({ k: key, children, align = 'left' }) => (
    <th onClick={() => ordenar(key)}
      className={`cursor-pointer select-none whitespace-nowrap border-b-2 border-[#e3ddcf] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678] text-${align}`}>
      {children}{sort.key === key && <span className="ml-1 text-[9px] text-[#B8935A]">{sort.dir === 'desc' ? '▼' : '▲'}</span>}
    </th>
  );

  const recBadge = (c) => {
    if (c.recompra == null) return <span className="text-[#8a8678]">—</span>;
    if (c.recompra <= 0) return <Badge cls="bg-[#f9e9e7] text-[#b23b3b]">atrasada {-c.recompra}d</Badge>;
    if (c.recompra <= 7) return <Badge cls="bg-[#f9e9e7] text-[#b23b3b]">em {c.recompra}d</Badge>;
    return <Badge cls="bg-[#f6efde] text-[#8a6a1f]">em {c.recompra}d</Badge>;
  };

  return (
    <>
      {/* Topbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3ddcf] bg-white px-7 py-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Base</div>
          <h1 className="font-serif text-[22px] font-bold text-[#1F3A2E]">Clientes</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-3 py-1.5 text-[13px] font-semibold text-[#1F3A2E]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#3f7d5b]" />Todas as lojas
        </div>
      </div>

      <div className="flex-1 px-7 pb-16 pt-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
          <Kpi lab="Clientes na base" val={(k.total || 0).toLocaleString('pt-BR')} note="cadastrados" />
          <Kpi lab="Ativos (≤60 dias)" val={(k.ativos || 0).toLocaleString('pt-BR')} note={k.total ? Math.round((k.ativos / k.total) * 100) + '% da base' : '—'} />
          <Kpi lab="Com pet cadastrado" val={(k.comPet || 0).toLocaleString('pt-BR')} note="diferencial do app" />
          <Kpi lab="Recompra ≤ 7 dias" val={(k.recompra7 || 0).toLocaleString('pt-BR')} note="clique para filtrar" warn onClick={() => setF('status', 'recompra')} />
          <Kpi lab="LTV médio" val={BRL(k.ltvMedio)} note="gasto médio acumulado" />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-[#e3ddcf] bg-white p-3.5">
          <div className="relative min-w-[220px] flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8678]">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
            </svg>
            <input defaultValue={q} onChange={onBusca} placeholder="Buscar por nome, WhatsApp ou CPF…"
              className="w-full rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-[#B8935A] focus:bg-white" />
          </div>
          <Sel value={filtros.status} onChange={(v) => setF('status', v)} opts={STATUS_OPTS} />
          <Sel value={filtros.lojaId} onChange={(v) => setF('lojaId', v)} opts={[{ v: '', t: 'Todas lojas' }, ...resp.facets.lojas.map((l) => ({ v: l.id, t: l.nome }))]} />
          <Sel value={filtros.especie} onChange={(v) => setF('especie', v)} opts={[{ v: '', t: 'Qualquer pet' }, { v: 'CAO', t: 'Tem cão' }, { v: 'GATO', t: 'Tem gato' }]} />
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onArquivo} />
          <button onClick={baixarModelo} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]" title="Baixar planilha modelo">Modelo</button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M12 15V3m0 0L8 7m4-4l4 4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" /></svg>
            Importar Excel
          </button>
          <button onClick={exportarCSV} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]">Exportar</button>
          <button onClick={recalcularEstatisticas} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]" title="Recalcula pedidos, total gasto e última compra de todos os clientes a partir dos pedidos entregues">Recalcular</button>
          <button onClick={() => setNovo(true)} className="rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] hover:bg-[#a8824a]">+ Novo cliente</button>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-[#e3ddcf] bg-white">
          <div className="flex items-center justify-between border-b border-[#e3ddcf] px-5 py-3 text-[12.5px] text-[#8a8678]">
            <span>{(resp.total || 0).toLocaleString('pt-BR')} cliente(s)</span>
            <span className="text-[#b8862a]">↻ {(k.recompra7 || 0)} com recompra de ração prevista nos próximos 7 dias</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th k="nome">Cliente</Th>
                  <th className="border-b-2 border-[#e3ddcf] px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Pets</th>
                  <th className="border-b-2 border-[#e3ddcf] px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Cidade / Bairro</th>
                  <Th k="qtdPedidos" align="center">Pedidos</Th>
                  <Th k="totalGasto" align="right">Total gasto</Th>
                  <Th k="ultima" align="right">Última compra</Th>
                  <th className="border-b-2 border-[#e3ddcf] px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Recompra</th>
                  <th className="border-b-2 border-[#e3ddcf] px-4 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="py-12 text-center text-[#8a8678]">Carregando…</td></tr>}
                {erro && !loading && <tr><td colSpan={8} className="py-12 text-center text-[#b23b3b]">Erro: {erro}</td></tr>}
                {!loading && !erro && resp.data.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-[#8a8678]">Nenhum cliente encontrado.</td></tr>}
                {!loading && resp.data.map((c) => (
                  <tr key={c.id} onClick={() => abrirDetalhe(c.id)} className="cursor-pointer border-b border-[#f3efe5] hover:bg-[#faf8f2]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#1F3A2E] text-[13px] font-semibold text-white">{initials(c.nome)}</div>
                        <div><div className="font-semibold">{c.nome}</div><div className="text-[11.5px] text-[#8a8678]">{c.whatsapp}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-[14px]">{(c.pets || []).slice(0, 3).map((p, i) => <span key={i} title={p.nome}>{ESP_ICON[p.especie] || '🐾'}</span>)}</span>
                      {(c.pets || []).length > 3 && <span className="ml-1 text-[11px] text-[#8a8678]">+{c.pets.length - 3}</span>}
                      {(c.pets || []).length === 0 && <span className="text-[#8a8678]">—</span>}
                    </td>
                    <td className="px-4 py-2.5"><div>{c.cidade || '—'}</div><div className="text-[11.5px] text-[#8a8678]">{c.bairro || ''}</div></td>
                    <td className="px-4 py-2.5 text-center">{c.qtdPedidos || 0}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{BRL(c.totalGasto)}</td>
                    <td className="px-4 py-2.5 text-right text-[#6b6657]">{ultLbl(c.diasUlt)}</td>
                    <td className="px-4 py-2.5 text-center">{recBadge(c)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge cls={c.ativo ? 'bg-[#eaf2ec] text-[#3f7d5b]' : 'bg-[#f1efe9] text-[#8a8678]'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#e3ddcf] px-5 py-3.5">
            <span className="text-[11.5px] text-[#8a8678]">Página {page} de {pages}</span>
            <div className="flex gap-1.5">
              <PgBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</PgBtn>
              {Array.from({ length: pages }).slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5).map((_, i) => {
                const n = Math.max(1, page - 2) + i; if (n > pages) return null;
                return <PgBtn key={n} on={n === page} onClick={() => setPage(n)}>{n}</PgBtn>;
              })}
              <PgBtn disabled={page >= pages} onClick={() => setPage(page + 1)}>›</PgBtn>
            </div>
          </div>
        </div>
      </div>

      {detalhe && <Drawer cliente={detalhe} onClose={() => setDetalhe(null)} onAnonimizado={() => { setDetalhe(null); carregar(); }} />}
      {preview && <ImportModal preview={preview} onClose={() => setPreview(null)} onConfirm={confirmarImport} />}
      {novo && <NovoModal lojas={resp.facets.lojas} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); carregar(); }} />}
    </>
  );
}

function Kpi({ lab, val, note, warn, onClick }) {
  return (
    <div onClick={onClick} className={`relative overflow-hidden rounded-xl border border-[#e3ddcf] bg-white p-4 ${onClick ? 'cursor-pointer hover:-translate-y-px hover:border-[#B8935A]' : ''}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${warn ? 'bg-[#b8862a]' : 'bg-[#B8935A]'}`} />
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">{lab}</div>
      <div className={`mt-1 font-serif text-[24px] font-bold leading-none ${warn ? 'text-[#b8862a]' : 'text-[#1F3A2E]'}`}>{val}</div>
      <div className="mt-1 text-[10.5px] text-[#9a9588]">{note}</div>
    </div>
  );
}
function Sel({ value, onChange, opts }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[175px] cursor-pointer rounded-lg border border-[#e3ddcf] bg-white px-2.5 py-2.5 text-[13px] outline-none focus:border-[#B8935A]">
      {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );
}
function PgBtn({ children, on, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`h-8 min-w-[32px] rounded-md border px-2 text-[13px] ${on ? 'border-[#1F3A2E] bg-[#1F3A2E] text-white' : 'border-[#e3ddcf] bg-white hover:border-[#B8935A]'} disabled:opacity-40`}>{children}</button>
  );
}
function Badge({ children, cls }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}

// ─── LGPD: relatório imprimível com todos os dados do titular ───
const escHtml = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function htmlDadosLgpd(r) {
  const c = (r && r.cliente) || {};
  const fmtD = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');
  const brl = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const linha = (l, v) => (v ? `<tr><td class="l">${escHtml(l)}</td><td>${escHtml(v)}</td></tr>` : '');
  const pets = (c.pets || []).map((p) => `<li>${escHtml(p.nome)} (${escHtml(p.especie)}${p.raca ? ' · ' + escHtml(p.raca) : ''})${p.observacoes ? ' — ' + escHtml(p.observacoes) : ''}</li>`).join('');
  const ends = (c.enderecos || []).map((e) => `<li>${escHtml([e.apelido, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.cep].filter(Boolean).join(', '))}</li>`).join('');
  const peds = (c.pedidos || []).map((p) => {
    const itens = (p.itens || []).map((i) => `${i.quantidade}× ${escHtml(i.produto && i.produto.nome ? i.produto.nome : 'item')}`).join(', ');
    return `<tr><td>${escHtml(p.numero)}</td><td>${fmtD(p.pedidoEm)}</td><td>${escHtml(p.status)}</td><td>${escHtml(itens)}</td><td class="r">${brl(p.valorTotal)}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dados do titular — ${escHtml(c.nome || '')}</title>
<style>
  body{font-family:Georgia,serif;color:#2B2B2B;margin:36px auto;max-width:760px;padding:0 20px}
  h1{font-size:21px;color:#1F3A2E;margin:0}
  .sub{color:#A4673F;font-style:italic;font-size:12.5px;margin:2px 0 4px}
  .meta{color:#5A5A56;font-size:11.5px;font-family:Helvetica,Arial,sans-serif}
  h2{font-size:14px;color:#1F3A2E;border-bottom:1px solid #E4DBCD;padding-bottom:4px;margin:22px 0 8px}
  table{width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:12px}
  td,th{padding:5px 8px;border-bottom:1px solid #EDE6D9;text-align:left;vertical-align:top}
  td.l{color:#5A5A56;width:170px}td.r,th.r{text-align:right}
  th{color:#5A5A56;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em}
  ul{margin:4px 0;padding-left:18px;font-family:Helvetica,Arial,sans-serif;font-size:12.5px}
  .rodape{margin-top:28px;border-top:1px solid #E4DBCD;padding-top:8px;color:#5A5A56;font-size:10.5px;font-family:Helvetica,Arial,sans-serif}
  .btn{position:fixed;top:14px;right:14px;background:#1F3A2E;color:#F4F1EA;border:0;border-radius:9px;padding:10px 16px;font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:13px;cursor:pointer}
  @media print{.btn{display:none}body{margin:0 auto}}
</style></head><body>
<button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button>
<h1>Relatório de dados do titular</h1>
<div class="sub">Lei Geral de Proteção de Dados — art. 18 (acesso aos dados)</div>
<div class="meta">Empório dos Animais · gerado em ${fmtD(r && r.geradoEm)}</div>
<h2>Identificação</h2>
<table>${linha('Nome', c.nome)}${linha('CPF', c.cpf)}${linha('WhatsApp', c.whatsapp)}${linha('E-mail', c.email)}${linha('Nascimento', c.dataNascimento ? new Date(c.dataNascimento).toLocaleDateString('pt-BR') : '')}${linha('Aceita marketing', c.optInMarketing ? 'Sim' : 'Não')}${linha('Loja preferida', c.lojaPreferida && c.lojaPreferida.nome)}${linha('Cadastrado em', fmtD(c.criadoEm))}</table>
<h2>Pets</h2>${pets ? `<ul>${pets}</ul>` : '<div class="meta">Nenhum pet cadastrado.</div>'}
<h2>Endereços</h2>${ends ? `<ul>${ends}</ul>` : '<div class="meta">Nenhum endereço cadastrado.</div>'}
${c.programaFidelidade ? `<h2>Fidelidade</h2><table>${linha('Pontos acumulados', String(c.programaFidelidade.pontosAcumulados))}${linha('Pontos resgatados', String(c.programaFidelidade.pontosResgatados))}${linha('Nível', c.programaFidelidade.nivel)}</table>` : ''}
<h2>Pedidos (${(c.pedidos || []).length})</h2>
${peds ? `<table><tr><th>Nº</th><th>Data</th><th>Status</th><th>Itens</th><th class="r">Total</th></tr>${peds}</table>` : '<div class="meta">Nenhum pedido.</div>'}
<div class="rodape">Documento gerado pelo sistema do Empório dos Animais · preparado por RN Negrão — Diagnóstico &amp; Soluções Empresariais. Contém todos os dados pessoais do titular armazenados no sistema na data de emissão.</div>
</body></html>`;
}

function Drawer({ cliente, onClose, onAnonimizado }) {
  const c = cliente;
  const exportarLgpd = async () => {
    const win = window.open('', '_blank'); // abre no clique, antes do fetch, para não ser bloqueado
    if (win) { win.document.write('<p style="font-family:sans-serif;padding:24px;color:#555">Gerando relatório de dados…</p>'); }
    try {
      const r = await api.get(`/api/clientes/${c.id}/dados-lgpd`);
      if (win) { win.document.open(); win.document.write(htmlDadosLgpd(r)); win.document.close(); }
    } catch (e) {
      if (win) win.close();
      alert('Não consegui exportar os dados: ' + e.message);
    }
  };
  const anonimizar = async () => {
    if (!confirm(`Anonimizar os dados de ${c.nome}?\n\nRemove nome, CPF, WhatsApp, e-mail, nascimento, pets e o endereço (rua/número/CEP). Os pedidos permanecem, sem identificação, para relatórios e obrigações fiscais.\n\nESTA AÇÃO NÃO PODE SER DESFEITA.`)) return;
    const conf = prompt('Para confirmar, digite APAGAR (em maiúsculas):');
    if (conf == null) return;
    if (conf !== 'APAGAR') { alert('Confirmação incorreta — nada foi alterado.'); return; }
    try {
      await api.post(`/api/clientes/${c.id}/anonimizar`, { confirmacao: 'APAGAR' });
      alert('Dados anonimizados. O cliente sai da lista; os pedidos permanecem sem identificação.');
      if (onAnonimizado) onAnonimizado(); else onClose();
    } catch (e) {
      alert('Não foi possível anonimizar: ' + e.message);
    }
  };
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-20 flex justify-end bg-[#16291f]/50 backdrop-blur-sm">
      <div className="h-screen w-[460px] max-w-[94vw] overflow-auto bg-[#F4F1EA] shadow-2xl">
        <div className="sticky top-0 z-[2] bg-gradient-to-br from-[#1F3A2E] to-[#16291f] px-6 pb-5 pt-6 text-white">
          <button onClick={onClose} className="absolute right-[18px] top-[18px] h-8 w-8 rounded-lg bg-white/10 text-lg text-white">×</button>
          {c.loading ? <div className="py-6 text-[#A8B5A0]">Carregando…</div> : c.erro ? <div className="py-6 text-[#f3b8b0]">Erro: {c.erro}</div> : (
            <>
              <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#B8935A] text-[18px] font-semibold text-[#16291f]">{initials(c.nome)}</div>
              <div className="mt-3 font-serif text-[20px] font-bold">{c.nome}</div>
              <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-[#A8B5A0]">
                <span>📱 {c.whatsapp}</span>{c.cpf && <span>🆔 {c.cpf}</span>}{c.email && <span>✉ {c.email}</span>}
              </div>
              <div className="mt-2.5">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.optInMarketing ? 'bg-[#eaf2ec] text-[#3f7d5b]' : 'bg-[#f1efe9] text-[#8a8678]'}`}>
                  {c.optInMarketing ? '✓ Aceita marketing (LGPD)' : '✗ Sem opt-in'}
                </span>
              </div>
            </>
          )}
        </div>
        {!c.loading && !c.erro && (
          <div className="px-6 pb-10 pt-5">
            <div className="mb-3 grid grid-cols-3 gap-2.5">
              <Stat v={c.qtdPedidos || 0} l="Pedidos" />
              <Stat v={BRL(c.totalGasto)} l="Total gasto" small />
              <Stat v={BRL(c.qtdPedidos ? c.totalGasto / c.qtdPedidos : 0)} l="Ticket médio" small />
            </div>
            <Sec>Pets ({(c.pets || []).length})</Sec>
            {(c.pets || []).map((p, i) => (
              <div key={i} className="mb-2.5 flex items-center gap-3 rounded-xl border border-[#e3ddcf] bg-white px-3.5 py-3">
                <div className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-[#F4F1EA] text-[18px]">{ESP_ICON[p.especie] || '🐾'}</div>
                <div><div className="font-semibold">{p.nome}</div><div className="text-[12px] text-[#8a8678]">{p.raca || 'SRD'}{p.pesoKg ? ` · ${p.pesoKg} kg` : ''}</div></div>
              </div>
            ))}
            {(c.pets || []).length === 0 && <div className="text-[13px] text-[#8a8678]">Nenhum pet cadastrado.</div>}
            <Sec>Endereços</Sec>
            {(c.enderecos || []).map((e, i) => (
              <div key={i} className="mb-2 rounded-[10px] border border-[#e3ddcf] bg-white px-3.5 py-2.5 text-[13px] text-[#5a5750]">
                <b>{e.apelido}</b> · {[e.logradouro, e.numero].filter(Boolean).join(', ')} {e.bairro}, {e.cidade}{e.principal ? ' · Principal' : ''}
              </div>
            ))}
            <Sec>Histórico de pedidos</Sec>
            {(c.pedidos || []).map((p) => (
              <div key={p.id} className="mb-1.5 flex items-center justify-between rounded-[10px] border border-[#e3ddcf] bg-white px-3.5 py-2.5 text-[13px]">
                <div><div className="font-mono text-[11.5px] text-[#8a8678]">{p.numero}</div><div className="text-[11.5px] text-[#8a8678]">{fmtDate(p.pedidoEm)}</div></div>
                <div className="flex items-center gap-3"><span className="font-semibold">{BRL(p.valorTotal)}</span><span className="text-[10.5px] text-[#8a8678]">{p.status}</span></div>
              </div>
            ))}
            {(c.pedidos || []).length === 0 && <div className="text-[13px] text-[#8a8678]">Sem pedidos.</div>}
            <Sec>Privacidade (LGPD)</Sec>
            <div className="rounded-xl border border-[#e3ddcf] bg-white p-3.5">
              <p className="mb-2.5 text-[12px] leading-snug text-[#8a8678]">
                Direitos do titular: exporte todos os dados deste cliente (pedido de acesso) ou remova a
                identificação pessoal mantendo os pedidos para relatórios (pedido de eliminação).
              </p>
              <button onClick={exportarLgpd} className="mb-2 w-full rounded-lg border border-[#e3ddcf] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]">
                📄 Exportar dados do cliente
              </button>
              <button onClick={anonimizar} className="w-full rounded-lg border border-[#e9c7c2] bg-[#fdf6f5] px-3 py-2 text-[12.5px] font-semibold text-[#a85a52] hover:border-[#d8a59c]">
                Anonimizar dados (irreversível)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function Stat({ v, l, small }) {
  return (
    <div className="rounded-[11px] border border-[#e3ddcf] bg-white p-3">
      <div className={`font-serif font-bold text-[#1F3A2E] ${small ? 'text-[15px]' : 'text-[19px]'}`}>{v}</div>
      <div className="mt-0.5 text-[10.5px] uppercase tracking-wide text-[#8a8678]">{l}</div>
    </div>
  );
}
function Sec({ children }) {
  return <div className="mb-2.5 mt-[18px] text-[11px] font-bold uppercase tracking-wider text-[#A89068]">{children}</div>;
}

function ImportModal({ preview, onClose, onConfirm }) {
  const { validos, nDup, nIgn, map } = preview;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-30 flex items-start justify-center overflow-auto bg-[#16291f]/55 p-12 backdrop-blur-sm">
      <div className="w-full max-w-[600px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e3ddcf] px-6 py-5">
          <h3 className="font-serif text-[19px] font-bold text-[#1F3A2E]">Importar base de clientes</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-[#F4F1EA] text-lg text-[#8a8678]">×</button>
        </div>
        <div className="px-6 py-5">
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <Stat v={validos.length} l="Válidos" />
            <Stat v={nDup} l="Duplicados" />
            <Stat v={nIgn} l="Ignorados" />
          </div>
          <div className="mb-1.5 text-[12px] text-[#8a8678]">Colunas reconhecidas:</div>
          <div className="mb-4 flex flex-wrap gap-1">
            {Object.keys(map).map((f) => <span key={f} className="rounded-md bg-[#eef2ef] px-2 py-0.5 text-[11px] font-semibold text-[#2d5443]">{f} ← {map[f]}</span>)}
          </div>
          {validos.length > 0 ? (
            <>
              <div className="mb-1.5 text-[12px] text-[#8a8678]">Prévia ({Math.min(validos.length, 6)} de {validos.length}):</div>
              {validos.slice(0, 6).map((c, i) => (
                <div key={i} className="mb-1.5 flex items-center justify-between rounded-[10px] border border-[#e3ddcf] bg-white px-3.5 py-2.5 text-[13px]">
                  <div><b>{c.nome}</b><div className="text-[11.5px] text-[#8a8678]">{c.whatsapp} · {c.cidade || '—'}</div></div>
                  <div className="text-[12px] text-[#8a8678]">{c.pet ? '1 pet' : '—'}</div>
                </div>
              ))}
            </>
          ) : <div className="text-[13px] text-[#b23b3b]">Nenhum cliente válido para importar.</div>}
        </div>
        <div className="flex items-center justify-between border-t border-[#e3ddcf] px-6 py-4">
          <span className="text-[11.5px] text-[#8a8678]">O servidor faz upsert pelo WhatsApp (não duplica).</span>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E]">Cancelar</button>
            <button onClick={onConfirm} disabled={!validos.length} className="rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] disabled:opacity-50">Importar {validos.length} cliente(s)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NovoModal({ lojas, onClose, onSaved }) {
  const [f, setF] = useState({ nome: '', whatsapp: '', cpf: '', email: '', lojaPreferidaId: '', optInMarketing: false, petNome: '', petEspecie: 'CAO' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const salvar = async () => {
    if (!f.nome || !f.whatsapp) return setErro('Nome e WhatsApp são obrigatórios.');
    setSalvando(true); setErro(null);
    try {
      await clientesApi.create({
        nome: f.nome, whatsapp: f.whatsapp, cpf: f.cpf || null, email: f.email || null,
        lojaPreferidaId: f.lojaPreferidaId || null, optInMarketing: f.optInMarketing,
        pet: f.petNome ? { nome: f.petNome, especie: f.petEspecie } : undefined,
      });
      onSaved();
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  const Inp = ({ label, k, full, type = 'text' }) => (
    <div className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">{label}</label>
      <input type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} className="rounded-lg border border-[#e3ddcf] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#B8935A]" />
    </div>
  );
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-30 flex items-start justify-center overflow-auto bg-[#16291f]/55 p-12 backdrop-blur-sm">
      <div className="w-full max-w-[560px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e3ddcf] px-6 py-5">
          <h3 className="font-serif text-[19px] font-bold text-[#1F3A2E]">Novo cliente</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-[#F4F1EA] text-lg text-[#8a8678]">×</button>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-6 py-5 sm:grid-cols-2">
          <Inp label="Nome" k="nome" full />
          <Inp label="WhatsApp" k="whatsapp" />
          <Inp label="CPF" k="cpf" />
          <Inp label="E-mail" k="email" full />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Loja preferida</label>
            <select value={f.lojaPreferidaId} onChange={(e) => set('lojaPreferidaId', e.target.value)} className="rounded-lg border border-[#e3ddcf] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#B8935A]">
              <option value="">—</option>{lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pt-6 text-[13px]"><input type="checkbox" checked={f.optInMarketing} onChange={(e) => set('optInMarketing', e.target.checked)} />Aceita marketing</label>
          <div className="col-span-full border-t border-[#f0ece1] pt-3.5 text-[11px] font-bold uppercase tracking-wider text-[#A89068]">Primeiro pet (opcional)</div>
          <Inp label="Nome do pet" k="petNome" />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Espécie</label>
            <select value={f.petEspecie} onChange={(e) => set('petEspecie', e.target.value)} className="rounded-lg border border-[#e3ddcf] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#B8935A]">
              <option value="CAO">Cão</option><option value="GATO">Gato</option><option value="AVE">Ave</option><option value="OUTRO">Outro</option>
            </select>
          </div>
          {erro && <div className="col-span-full text-[13px] text-[#b23b3b]">{erro}</div>}
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-[#e3ddcf] px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E]">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] disabled:opacity-60">{salvando ? 'Salvando…' : 'Salvar cliente'}</button>
        </div>
      </div>
    </div>
  );
}
