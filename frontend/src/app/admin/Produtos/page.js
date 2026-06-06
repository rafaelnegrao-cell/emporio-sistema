// frontend/src/app/admin/produtos/page.js
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { produtosApi } from '../../../lib/api';

const PET_LABEL = { CAO: 'Cão', GATO: 'Gato', AVE: 'Ave', PEIXE: 'Peixe', ROEDOR: 'Roedor', MULTI: 'Multi', OUTRO: '—' };
const FLAG = {
  ok: { t: 'OK', c: 'bg-[#eaf2ec] text-[#3f7d5b]' },
  prejuizo: { t: 'Prejuízo', c: 'bg-[#f9e9e7] text-[#b23b3b]' },
  custo_suspeito: { t: 'Custo suspeito', c: 'bg-[#f9e9e7] text-[#b23b3b]' },
  sem_custo: { t: 'Sem custo', c: 'bg-[#f6efde] text-[#8a6a1f]' },
  venda_zero: { t: 'Venda zero', c: 'bg-[#f6efde] text-[#8a6a1f]' },
  revisar: { t: 'Revisar', c: 'bg-[#f6efde] text-[#8a6a1f]' },
};
const BRL = (n) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const PCT = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%');
const mgClass = (m) => (m == null ? '' : m < 15 ? 'text-[#b23b3b]' : m < 32 ? 'text-[#b8862a]' : 'text-[#3f7d5b]');

const ALERTA_OPTS = [
  { v: '', t: 'Todos status' },
  { v: 'alerta', t: '⚠ Com alerta de cadastro' },
  { v: 'ok', t: 'Somente OK' },
];

export default function ProdutosPage() {
  const [q, setQ] = useState('');
  const [filtros, setFiltros] = useState({ marca: '', categoriaId: '', pet: '', status: '' });
  const [sort, setSort] = useState({ key: 'giro', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [resp, setResp] = useState({ data: [], total: 0, totalPages: 1, facets: { marcas: [], categorias: [] }, kpis: {} });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [editando, setEditando] = useState(undefined); // undefined fechado | null novo | obj editar
  const debounce = useRef();

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const r = await produtosApi.list({
        q,
        marca: filtros.marca,
        categoriaId: filtros.categoriaId,
        pet: filtros.pet,
        status: filtros.status,
        sort: sort.key,
        order: sort.dir,
        page,
        perPage: 25,
      });
      setResp(r);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, filtros, sort, page]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const onBusca = (e) => {
    const v = e.target.value;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      setQ(v);
    }, 200);
  };
  const setF = (k, v) => {
    setPage(1);
    setFiltros((f) => ({ ...f, [k]: v }));
  };
  const ordenar = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'nome' || key === 'marca' ? 'asc' : 'desc' }));

  const k = resp.kpis || {};
  const pages = resp.totalPages || 1;

  const exportarCSV = () => {
    const head = ['SKU', 'Produto', 'Marca', 'Categoria', 'Pet', 'Custo', 'Preco', 'Margem%', 'Giro', 'Status'];
    const linhas = resp.data.map((p) =>
      [p.sku, `"${(p.nome || '').replace(/"/g, '')}"`, p.marca, p.categoria || '', PET_LABEL[p.pet] || '',
       (Number(p.custo) || 0).toFixed(2).replace('.', ','), (Number(p.preco) || 0).toFixed(2).replace('.', ','),
       p.margem == null ? '' : Number(p.margem).toFixed(1).replace('.', ','), p.giro, FLAG[p.flag]?.t || ''].join(';')
    );
    const blob = new Blob(['\uFEFF' + [head.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'produtos.csv';
    a.click();
  };

  const Th = ({ k: key, children, align = 'left' }) => (
    <th
      onClick={() => ordenar(key)}
      className={`cursor-pointer select-none whitespace-nowrap border-b-2 border-[#e3ddcf] px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678] text-${align}`}
    >
      {children}
      {sort.key === key && <span className="ml-1 text-[9px] text-[#B8935A]">{sort.dir === 'desc' ? '▼' : '▲'}</span>}
    </th>
  );

  return (
    <>
      {/* Topbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3ddcf] bg-white px-7 py-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Catálogo</div>
          <h1 className="font-serif text-[22px] font-bold text-[#1F3A2E]">Produtos</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-3 py-1.5 text-[13px] font-semibold text-[#1F3A2E]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#3f7d5b]" />
          Av. Maringá
        </div>
      </div>

      <div className="flex-1 px-7 pb-16 pt-6">
        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Kpi lab="SKUs no catálogo" val={(k.skus || 0).toLocaleString('pt-BR')} note="produtos cadastrados" />
          <Kpi
            lab="Com alerta de cadastro"
            val={(k.comAlerta || 0).toLocaleString('pt-BR')}
            note="clique para filtrar"
            warn
            onClick={() => setF('status', 'alerta')}
          />
          <Kpi lab="Giro total (un)" val={(k.giroTotal || 0).toLocaleString('pt-BR')} note="unidades no período" />
          <Kpi lab="Resultados" val={(resp.total || 0).toLocaleString('pt-BR')} note="com os filtros atuais" />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-[#e3ddcf] bg-white p-3.5">
          <div className="relative min-w-[220px] flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8678]">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
            </svg>
            <input
              defaultValue={q}
              onChange={onBusca}
              placeholder="Buscar por nome, SKU ou marca…"
              className="w-full rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-[#B8935A] focus:bg-white"
            />
          </div>
          <Sel value={filtros.categoriaId} onChange={(v) => setF('categoriaId', v)}
               opts={[{ v: '', t: 'Todas categorias' }, ...resp.facets.categorias.map((c) => ({ v: c.id, t: c.nome }))]} />
          <Sel value={filtros.marca} onChange={(v) => setF('marca', v)}
               opts={[{ v: '', t: 'Todas marcas' }, ...resp.facets.marcas.map((m) => ({ v: m, t: m }))]} />
          <Sel value={filtros.pet} onChange={(v) => setF('pet', v)}
               opts={[{ v: '', t: 'Todos pets' }, ...Object.entries(PET_LABEL).map(([v, t]) => ({ v, t }))]} />
          <Sel value={filtros.status} onChange={(v) => setF('status', v)} opts={ALERTA_OPTS} />
          <button onClick={exportarCSV} className="flex items-center gap-2 rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]">
            Exportar
          </button>
          <button onClick={() => setEditando(null)} className="flex items-center gap-2 rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] hover:bg-[#a8824a]">
            + Novo produto
          </button>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-[#e3ddcf] bg-white">
          <div className="flex items-center justify-between border-b border-[#e3ddcf] px-4.5 px-5 py-3 text-[12.5px] text-[#8a8678]">
            <span>{(resp.total || 0).toLocaleString('pt-BR')} produto(s)</span>
            <span className="text-[#b23b3b]">⚠ {(k.comAlerta || 0)} com provável erro de cadastro</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th k="sku">SKU</Th><Th k="nome">Produto</Th><Th k="marca">Marca</Th>
                  <th className="border-b-2 border-[#e3ddcf] px-3.5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Categoria</th>
                  <Th k="pet" align="center">Pet</Th><Th k="custo" align="right">Custo</Th>
                  <Th k="preco" align="right">Preço</Th><Th k="margem" align="right">Margem</Th>
                  <Th k="giro" align="right">Giro</Th>
                  <th className="border-b-2 border-[#e3ddcf] px-3.5 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Estoque</th>
                  <th className="border-b-2 border-[#e3ddcf] px-3.5 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={11} className="py-12 text-center text-[#8a8678]">Carregando…</td></tr>
                )}
                {erro && !loading && (
                  <tr><td colSpan={11} className="py-12 text-center text-[#b23b3b]">Erro ao carregar: {erro}</td></tr>
                )}
                {!loading && !erro && resp.data.length === 0 && (
                  <tr><td colSpan={11} className="py-12 text-center text-[#8a8678]">Nenhum produto encontrado.</td></tr>
                )}
                {!loading && resp.data.map((p) => {
                  const fi = FLAG[p.flag] || FLAG.ok;
                  return (
                    <tr key={p.id} onClick={() => setEditando(p)} className="cursor-pointer border-b border-[#f3efe5] hover:bg-[#faf8f2]">
                      <td className="px-3.5 py-2.5 font-mono text-[12px] text-[#8a8678]">{p.sku}</td>
                      <td className="px-3.5 py-2.5"><div className="max-w-[340px] truncate font-medium" title={p.nome}>{p.nome}</div></td>
                      <td className="px-3.5 py-2.5"><span className="rounded-full border border-[#e3ddcf] bg-[#F4F1EA] px-2.5 py-0.5 text-[11px] text-[#6b6657]">{p.marca}</span></td>
                      <td className="px-3.5 py-2.5 text-[#6b6657]">{p.categoria || '—'}</td>
                      <td className="px-3.5 py-2.5 text-center text-[11px] font-semibold text-[#2d5443]">{PET_LABEL[p.pet] || '—'}</td>
                      <td className="px-3.5 py-2.5 text-right">{BRL(p.custo)}</td>
                      <td className="px-3.5 py-2.5 text-right font-semibold">{BRL(p.preco)}</td>
                      <td className={`px-3.5 py-2.5 text-right font-semibold ${mgClass(p.margem)}`}>{PCT(p.margem)}</td>
                      <td className="px-3.5 py-2.5 text-right">{(p.giro || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-3.5 py-2.5 text-right text-[12px] text-[#8a8678]">{p.estoque == null ? <span title="A integrar com HD TEC">n/d</span> : p.estoque}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${fi.c}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />{fi.t}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pager */}
          <div className="flex items-center justify-between border-t border-[#e3ddcf] px-5 py-3.5">
            <span className="text-[11.5px] text-[#8a8678]">Página {page} de {pages}</span>
            <div className="flex gap-1.5">
              <PgBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</PgBtn>
              {Array.from({ length: pages }).slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5).map((_, i) => {
                const n = Math.max(1, page - 2) + i;
                if (n > pages) return null;
                return <PgBtn key={n} on={n === page} onClick={() => setPage(n)}>{n}</PgBtn>;
              })}
              <PgBtn disabled={page >= pages} onClick={() => setPage(page + 1)}>›</PgBtn>
            </div>
          </div>
        </div>
      </div>

      {editando !== undefined && (
        <ProdutoModal
          produto={editando}
          categorias={resp.facets.categorias}
          onClose={() => setEditando(undefined)}
          onSaved={() => { setEditando(undefined); carregar(); }}
        />
      )}
    </>
  );
}

function Kpi({ lab, val, note, warn, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-[#e3ddcf] bg-white p-4 ${onClick ? 'cursor-pointer hover:-translate-y-px hover:border-[#B8935A]' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${warn ? 'bg-[#b23b3b]' : 'bg-[#B8935A]'}`} />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">{lab}</div>
      <div className={`mt-1 font-serif text-[25px] font-bold leading-none ${warn ? 'text-[#b23b3b]' : 'text-[#1F3A2E]'}`}>{val}</div>
      <div className="mt-1 text-[11px] text-[#9a9588]">{note}</div>
    </div>
  );
}
function Sel({ value, onChange, opts }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="max-w-[170px] cursor-pointer rounded-lg border border-[#e3ddcf] bg-white px-2.5 py-2.5 text-[13px] outline-none focus:border-[#B8935A]">
      {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );
}
function PgBtn({ children, on, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`h-8 min-w-[32px] rounded-md border px-2 text-[13px] ${on ? 'border-[#1F3A2E] bg-[#1F3A2E] text-white' : 'border-[#e3ddcf] bg-white hover:border-[#B8935A]'} disabled:opacity-40`}>
      {children}
    </button>
  );
}

function ProdutoModal({ produto, categorias, onClose, onSaved }) {
  const novo = produto == null;
  const [form, setForm] = useState({
    sku: produto?.sku || '', codigoBarras: produto?.codigoBarras || '', nome: produto?.nome || '',
    descricao: produto?.descricao || '', marca: produto?.marca || '', categoriaId: produto?.categoriaId || '',
    custoMedio: produto?.custo ?? '', precoBase: produto?.preco ?? '', pesoKg: produto?.pesoKg ?? '',
    categoriaPet: produto?.pet || 'OUTRO', idadePet: produto?.idadePet || 'TODAS', portePet: produto?.portePet || 'TODOS',
    ativo: produto?.ativo ?? true, controlado: !!produto?.controlado, precisaReceita: !!produto?.precisaReceita,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const flag = produto?.flag && produto.flag !== 'ok' ? FLAG[produto.flag] : null;
  const alertaTxt = {
    prejuizo: 'Venda abaixo do custo — provável custo lançado errado. Corrija custo ou preço.',
    custo_suspeito: 'Markup absurdo — custo subdimensionado (ex.: unidade lançada como caixa). Revise o custo.',
    sem_custo: 'Custo zero — serviço/taxa sem CMV. Confirme se é produto ou serviço.',
    venda_zero: 'Venda zerada — provável erro de operação.',
    revisar: 'Margem fora do padrão — confirmar custo/preço.',
  }[produto?.flag];

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        ...form,
        categoriaId: form.categoriaId || null,
        precoBase: parseFloat(form.precoBase) || 0,
        custoMedio: form.custoMedio === '' ? null : parseFloat(form.custoMedio),
        pesoKg: form.pesoKg === '' ? null : parseFloat(form.pesoKg),
      };
      if (novo) await produtosApi.create(payload);
      else await produtosApi.update(produto.id, payload);
      onSaved();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  const PETS = [['CAO', 'Cão'], ['GATO', 'Gato'], ['AVE', 'Ave'], ['PEIXE', 'Peixe'], ['ROEDOR', 'Roedor'], ['MULTI', 'Multi-espécie'], ['OUTRO', 'Não se aplica']];
  const IDADE = [['TODAS', 'Todas'], ['FILHOTE', 'Filhote'], ['ADULTO', 'Adulto'], ['SENIOR', 'Sênior']];
  const PORTE = [['TODOS', 'Todos'], ['MINI', 'Mini'], ['PEQUENO', 'Pequeno'], ['MEDIO', 'Médio'], ['GRANDE', 'Grande'], ['GIGANTE', 'Gigante']];

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-20 flex items-start justify-center overflow-auto bg-[#16291f]/55 p-10 backdrop-blur-sm">
      <div className="w-full max-w-[660px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#e3ddcf] px-6 py-5">
          <div>
            <h3 className="font-serif text-[19px] font-bold text-[#1F3A2E]">{novo ? 'Novo produto' : 'Editar produto'}</h3>
            <div className="mt-0.5 text-[12px] text-[#8a8678]">{novo ? 'Cadastro manual — campos do modelo Produto' : `SKU ${produto.sku} · giro de ${produto.giro || 0} un`}</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-[#F4F1EA] text-lg text-[#8a8678]">×</button>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-6 py-5 sm:grid-cols-2">
          {flag && <div className="col-span-full rounded-lg border border-[#e8cdc7] bg-[#f9e9e7] px-3.5 py-2.5 text-[12.5px] text-[#7a3a36]"><b className="text-[#b23b3b]">⚠ {flag.t}.</b> {alertaTxt}</div>}
          <Fld label="SKU / Código interno" v={form.sku} on={(v) => set('sku', v)} />
          <Fld label="Código de barras (EAN)" v={form.codigoBarras} on={(v) => set('codigoBarras', v)} />
          <Fld full label="Nome do produto" v={form.nome} on={(v) => set('nome', v)} />
          <Fld full ta label="Descrição" v={form.descricao} on={(v) => set('descricao', v)} />
          <Fld label="Marca" v={form.marca} on={(v) => set('marca', v)} />
          <FldSel label="Categoria" v={form.categoriaId} on={(v) => set('categoriaId', v)} opts={[['', '—'], ...categorias.map((c) => [c.id, c.nome])]} />
          <Sec>Precificação</Sec>
          <Fld type="number" step="0.01" label="Custo unitário (R$)" v={form.custoMedio} on={(v) => set('custoMedio', v)} />
          <Fld type="number" step="0.01" label="Preço base (R$)" v={form.precoBase} on={(v) => set('precoBase', v)} />
          <Sec>Classificação pet</Sec>
          <FldSel label="Espécie" v={form.categoriaPet} on={(v) => set('categoriaPet', v)} opts={PETS} />
          <Fld type="number" step="0.001" label="Peso (kg)" v={form.pesoKg} on={(v) => set('pesoKg', v)} />
          <FldSel label="Faixa etária" v={form.idadePet} on={(v) => set('idadePet', v)} opts={IDADE} />
          <FldSel label="Porte" v={form.portePet} on={(v) => set('portePet', v)} opts={PORTE} />
          <div className="col-span-full flex flex-wrap gap-6 pt-1">
            <Tog label="Produto ativo" v={form.ativo} on={(v) => set('ativo', v)} />
            <Tog label="Medicamento controlado" v={form.controlado} on={(v) => set('controlado', v)} />
            <Tog label="Exige receita" v={form.precisaReceita} on={(v) => set('precisaReceita', v)} />
          </div>
          {erro && <div className="col-span-full text-[13px] text-[#b23b3b]">Erro: {erro}</div>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#e3ddcf] px-6 py-4">
          <span className="text-[11.5px] text-[#8a8678]">Estoque por loja é editado na aba de estoque do produto.</span>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E]">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] disabled:opacity-60">
              {salvando ? 'Salvando…' : 'Salvar produto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fld({ label, v, on, full, ta, type = 'text', step }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">{label}</label>
      {ta ? (
        <textarea value={v} onChange={(e) => on(e.target.value)} className="min-h-[54px] resize-y rounded-lg border border-[#e3ddcf] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#B8935A]" />
      ) : (
        <input type={type} step={step} value={v} onChange={(e) => on(e.target.value)} className="rounded-lg border border-[#e3ddcf] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#B8935A]" />
      )}
    </div>
  );
}
function FldSel({ label, v, on, opts }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">{label}</label>
      <select value={v} onChange={(e) => on(e.target.value)} className="rounded-lg border border-[#e3ddcf] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#B8935A]">
        {opts.map(([val, t]) => <option key={val} value={val}>{t}</option>)}
      </select>
    </div>
  );
}
function Sec({ children }) {
  return <div className="col-span-full border-t border-[#f0ece1] pt-3.5 text-[11px] font-bold uppercase tracking-wider text-[#A89068]">{children}</div>;
}
function Tog({ label, v, on }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} />
      {label}
    </label>
  );
}
