// frontend/src/app/admin/zonas/page.js
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

const BRL = (n) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const splitBairros = (txt) =>
  String(txt || '')
    .split(/[;,\n]/)
    .map((b) => b.trim())
    .filter(Boolean);
const numOrU = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && String(v).trim() !== '' ? n : undefined; };

// cabeçalhos tolerantes na importação
const HMAP = {
  loja: ['loja', 'unidade'],
  nome: ['zona', 'nome', 'regiao', 'região', 'faixa'],
  taxaFrete: ['taxa frete', 'frete', 'taxa', 'valor', 'valor frete', 'frete (r$)'],
  valorFreteGratis: ['frete gratis acima de', 'frete grátis acima de', 'gratis acima', 'frete gratis', 'frete grátis'],
  prazoMinHoras: ['prazo min', 'prazo mín', 'prazo minimo', 'prazo mínimo', 'prazo min (h)'],
  prazoMaxHoras: ['prazo max', 'prazo máx', 'prazo maximo', 'prazo máximo', 'prazo max (h)'],
  prioridade: ['prioridade'],
  bairros: ['bairros', 'bairro'],
  cepInicio: ['cep inicio', 'cep início', 'cep de', 'cep inicial'],
  cepFim: ['cep fim', 'cep ate', 'cep até', 'cep final'],
};
function mapHeaders(keys) {
  const out = {};
  for (const [campo, alias] of Object.entries(HMAP)) {
    const hit = keys.find((k) => alias.includes(norm(k)));
    if (hit) out[campo] = hit;
  }
  return out;
}

const FORM0 = { nome: '', taxaFrete: '', valorFreteGratis: '', taxaFreteAcimaDe: '', prazoMinHoras: '1', prazoMaxHoras: '24', prioridade: '0', bairros: '', cepInicio: '', cepFim: '' };

export default function ZonasPage() {
  const [lojas, setLojas] = useState([]);
  const [lojaId, setLojaId] = useState('');
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [editar, setEditar] = useState(null); // {modo:'novo'|'editar', zona?}
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.get('/api/lojas').then((r) => {
      const lista = Array.isArray(r) ? r : r?.data || [];
      setLojas(lista);
      if (lista.length) setLojaId(String(lista[0].id));
    }).catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    if (!lojaId) return;
    setLoading(true); setErro(null);
    try {
      const r = await api.get('/api/zonas-entrega', { lojaId });
      setZonas(Array.isArray(r) ? r : r?.data || []);
    } catch (e) { setErro(e.message); setZonas([]); }
    finally { setLoading(false); }
  }, [lojaId]);
  useEffect(() => { carregar(); }, [carregar]);

  const lojaNome = useMemo(() => (lojas.find((l) => String(l.id) === String(lojaId)) || {}).nome || '', [lojas, lojaId]);
  const freteMedio = useMemo(() => {
    const at = zonas.filter((z) => z.ativa);
    if (!at.length) return null;
    return at.reduce((s, z) => s + Number(z.taxaFrete || 0), 0) / at.length;
  }, [zonas]);

  const salvar = async (form, id) => {
    const payload = {
      lojaId,
      nome: form.nome.trim(),
      taxaFrete: numOrU(form.taxaFrete) ?? 0,
      valorFreteGratis: numOrU(form.valorFreteGratis),
      taxaFreteAcimaDe: numOrU(form.taxaFreteAcimaDe),
      prazoMinHoras: Math.max(1, parseInt(form.prazoMinHoras, 10) || 1),
      prazoMaxHoras: Math.max(1, parseInt(form.prazoMaxHoras, 10) || 24),
      prioridade: parseInt(form.prioridade, 10) || 0,
      bairros: splitBairros(form.bairros),
      cepInicio: form.cepInicio.trim() || undefined,
      cepFim: form.cepFim.trim() || undefined,
    };
    if (id) await api.put(`/api/zonas-entrega/${id}`, payload);
    else await api.post('/api/zonas-entrega', payload);
    setEditar(null); carregar();
  };

  const excluir = async (z) => {
    if (!confirm(`Desativar a zona "${z.nome}"?`)) return;
    await api.del(`/api/zonas-entrega/${z.id}`); carregar();
  };

  const onArquivo = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) return alert('A planilha está vazia.');
      const map = mapHeaders(Object.keys(rows[0]));
      if (!map.nome || !map.taxaFrete) return alert('Não encontrei as colunas obrigatórias "Zona" e "Taxa Frete". Baixe o Modelo para conferir.');
      const lojaPorNome = new Map(lojas.map((l) => [norm(l.nome), String(l.id)]));
      const validos = []; let ign = 0;
      rows.forEach((r) => {
        const nome = String(r[map.nome] || '').trim();
        const taxa = numOrU(r[map.taxaFrete]);
        if (!nome || taxa == null) { ign++; return; }
        const lid = map.loja && lojaPorNome.get(norm(r[map.loja])) ? lojaPorNome.get(norm(r[map.loja])) : lojaId;
        validos.push({
          lojaId: lid,
          nome,
          taxaFrete: taxa,
          valorFreteGratis: map.valorFreteGratis ? numOrU(r[map.valorFreteGratis]) : undefined,
          prazoMinHoras: map.prazoMinHoras ? (parseInt(r[map.prazoMinHoras], 10) || 1) : 1,
          prazoMaxHoras: map.prazoMaxHoras ? (parseInt(r[map.prazoMaxHoras], 10) || 24) : 24,
          prioridade: map.prioridade ? (parseInt(r[map.prioridade], 10) || 0) : 0,
          bairros: map.bairros ? splitBairros(r[map.bairros]) : [],
          cepInicio: map.cepInicio ? String(r[map.cepInicio] || '').replace(/\D/g, '') || undefined : undefined,
          cepFim: map.cepFim ? String(r[map.cepFim] || '').replace(/\D/g, '') || undefined : undefined,
        });
      });
      setPreview({ validos, ign });
    } catch (err) { alert('Não consegui ler o arquivo: ' + err.message); }
  };

  const confirmarImport = async () => {
    let ok = 0; let falhou = 0;
    for (const z of preview.validos) {
      try { await api.post('/api/zonas-entrega', z); ok++; } catch (_) { falhou++; }
    }
    setPreview(null);
    alert(`Importação concluída: ${ok} criada(s)${falhou ? `, ${falhou} com erro` : ''}.`);
    carregar();
  };

  const card = 'rounded-xl border border-[#e3ddcf] bg-white';

  return (
    <div className="px-6 py-6 md:px-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Operação</div>
          <h1 className="font-serif text-[28px] font-bold text-[#1F3A2E]">Zonas de entrega</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={lojaId} onChange={(e) => setLojaId(e.target.value)} className="rounded-lg border border-[#e3ddcf] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[#B8935A]">
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <label className="cursor-pointer rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]" title="Importar planilha de zonas">
            Importar planilha
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onArquivo} />
          </label>
          <button onClick={() => setEditar({ modo: 'novo' })} className="rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] hover:bg-[#a8824a]">+ Nova zona</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`${card} px-5 py-4`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Zonas ativas</div>
          <div className="font-serif text-[26px] font-bold text-[#1F3A2E]">{zonas.filter((z) => z.ativa).length}</div>
          <div className="text-[12px] text-[#8a8678]">em {lojaNome || '—'}</div>
        </div>
        <div className={`${card} px-5 py-4`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Frete médio</div>
          <div className="font-serif text-[26px] font-bold text-[#1F3A2E]">{BRL(freteMedio)}</div>
          <div className="text-[12px] text-[#8a8678]">média das zonas ativas</div>
        </div>
        <div className={`${card} px-5 py-4`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">Bairros cobertos</div>
          <div className="font-serif text-[26px] font-bold text-[#1F3A2E]">{zonas.filter((z) => z.ativa).reduce((s, z) => s + (z.bairros?.length || 0), 0)}</div>
          <div className="text-[12px] text-[#8a8678]">somando as zonas ativas</div>
        </div>
      </div>

      {erro && <div className="mt-4 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-4 py-2.5 text-[13px] text-[#b23b3b]">Erro: {erro}</div>}

      {/* Lista */}
      <div className={`${card} mt-6 overflow-hidden`}>
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_2fr_auto] gap-3 border-b border-[#e3ddcf] bg-[#faf8f2] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#8a8678] md:grid">
          <span>Zona</span><span>Frete</span><span>Frete grátis</span><span>Prazo</span><span>Bairros / CEP</span><span></span>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8a8678]">Carregando…</div>
        ) : zonas.filter((z) => z.ativa).length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8a8678]">Nenhuma zona cadastrada para esta loja. Use “+ Nova zona” ou “Importar planilha”.</div>
        ) : (
          zonas.filter((z) => z.ativa).map((z) => (
            <div key={z.id} className="grid grid-cols-1 gap-1 border-b border-[#f0ece0] px-5 py-3 text-[13.5px] last:border-b-0 md:grid-cols-[2fr_1fr_1fr_1fr_2fr_auto] md:items-center md:gap-3">
              <div className="font-medium text-[#1F3A2E]">{z.nome}{z.prioridade ? <span className="ml-2 text-[11px] text-[#8a8678]">prio {z.prioridade}</span> : null}</div>
              <div><span className="md:hidden text-[#8a8678]">Frete: </span>{BRL(z.taxaFrete)}</div>
              <div className="text-[#3a3730]"><span className="md:hidden text-[#8a8678]">Grátis: </span>{z.valorFreteGratis ? `≥ ${BRL(z.valorFreteGratis)}` : '—'}</div>
              <div className="text-[#3a3730]"><span className="md:hidden text-[#8a8678]">Prazo: </span>{z.prazoMinHoras}–{z.prazoMaxHoras}h</div>
              <div className="text-[12.5px] text-[#6b685e]">
                {z.bairros?.length ? z.bairros.slice(0, 4).join(', ') + (z.bairros.length > 4 ? ` +${z.bairros.length - 4}` : '') : ''}
                {z.cepInicio && z.cepFim ? <span className="block text-[#8a8678]">CEP {z.cepInicio}–{z.cepFim}</span> : null}
              </div>
              <div className="flex gap-2 md:justify-end">
                <button onClick={() => setEditar({ modo: 'editar', zona: z })} className="text-[12.5px] font-semibold text-[#B8935A]">editar</button>
                <button onClick={() => excluir(z)} className="text-[12.5px] font-semibold text-[#a85a52]">excluir</button>
              </div>
            </div>
          ))
        )}
      </div>

      {editar && <ZonaDrawer modo={editar.modo} zona={editar.zona} lojaNome={lojaNome} onClose={() => setEditar(null)} onSave={salvar} />}
      {preview && <ImportPreview preview={preview} onClose={() => setPreview(null)} onConfirm={confirmarImport} />}
    </div>
  );
}

function ZonaDrawer({ modo, zona, lojaNome, onClose, onSave }) {
  const [f, setF] = useState(() =>
    zona
      ? {
          nome: zona.nome || '', taxaFrete: String(zona.taxaFrete ?? ''),
          valorFreteGratis: zona.valorFreteGratis != null ? String(zona.valorFreteGratis) : '',
          taxaFreteAcimaDe: zona.taxaFreteAcimaDe != null ? String(zona.taxaFreteAcimaDe) : '',
          prazoMinHoras: String(zona.prazoMinHoras ?? '1'), prazoMaxHoras: String(zona.prazoMaxHoras ?? '24'),
          prioridade: String(zona.prioridade ?? '0'), bairros: (zona.bairros || []).join('; '),
          cepInicio: zona.cepInicio || '', cepFim: zona.cepFim || '',
        }
      : { ...FORM0 }
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));

  const submit = async () => {
    if (!f.nome.trim()) return setErro('Informe o nome da zona.');
    if (numOrU(f.taxaFrete) == null) return setErro('Informe a taxa de frete.');
    setErro(null); setSalvando(true);
    try { await onSave(f, zona?.id); } catch (e) { setErro(e.message); setSalvando(false); }
  };

  const inp = 'w-full rounded-lg border border-[#e3ddcf] px-3 py-2 text-[13.5px] outline-none focus:border-[#B8935A]';
  const lab = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-[460px] flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#e3ddcf] px-6 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">{lojaNome}</div>
            <h3 className="font-serif text-[20px] font-bold text-[#1F3A2E]">{modo === 'editar' ? 'Editar zona' : 'Nova zona'}</h3>
          </div>
          <button onClick={onClose} className="text-[20px] leading-none text-[#8a8678] hover:text-[#1F3A2E]">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3"><label className={lab}>Nome da zona</label><input className={inp} value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Zona 1 — Centro (até 3 km)" /></div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div><label className={lab}>Taxa de frete (R$)</label><input className={inp} value={f.taxaFrete} onChange={(e) => set('taxaFrete', e.target.value)} inputMode="decimal" placeholder="0,00" /></div>
            <div><label className={lab}>Frete grátis acima de (R$)</label><input className={inp} value={f.valorFreteGratis} onChange={(e) => set('valorFreteGratis', e.target.value)} inputMode="decimal" placeholder="opcional" /></div>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div><label className={lab}>Prazo mín (h)</label><input className={inp} value={f.prazoMinHoras} onChange={(e) => set('prazoMinHoras', e.target.value)} inputMode="numeric" /></div>
            <div><label className={lab}>Prazo máx (h)</label><input className={inp} value={f.prazoMaxHoras} onChange={(e) => set('prazoMaxHoras', e.target.value)} inputMode="numeric" /></div>
            <div><label className={lab}>Prioridade</label><input className={inp} value={f.prioridade} onChange={(e) => set('prioridade', e.target.value)} inputMode="numeric" /></div>
          </div>
          <div className="mb-3">
            <label className={lab}>Bairros atendidos</label>
            <textarea className={`${inp} h-24 resize-none`} value={f.bairros} onChange={(e) => set('bairros', e.target.value)} placeholder="Separe por ; ou vírgula. Ex.: Centro; Vila Ipiranga; Jardim Higienópolis" />
            <div className="mt-1 text-[11.5px] text-[#8a8678]">O pedido é casado pelo bairro do endereço (ignora acento/maiúscula).</div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div><label className={lab}>CEP de (opcional)</label><input className={inp} value={f.cepInicio} onChange={(e) => set('cepInicio', e.target.value)} inputMode="numeric" placeholder="86000000" /></div>
            <div><label className={lab}>CEP até (opcional)</label><input className={inp} value={f.cepFim} onChange={(e) => set('cepFim', e.target.value)} inputMode="numeric" placeholder="86099999" /></div>
          </div>
          <div className="mb-1"><label className={lab}>Taxa alternativa acima de (R$)</label><input className={inp} value={f.taxaFreteAcimaDe} onChange={(e) => set('taxaFreteAcimaDe', e.target.value)} inputMode="decimal" placeholder="opcional" /></div>

          {erro && <div className="mt-3 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}
        </div>
        <div className="border-t border-[#e3ddcf] px-6 py-4">
          <button onClick={submit} disabled={salvando} className="w-full rounded-lg bg-[#B8935A] px-4 py-2.5 text-[14px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar zona'}</button>
        </div>
      </div>
    </div>
  );
}

function ImportPreview({ preview, onClose, onConfirm }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-[19px] font-bold text-[#1F3A2E]">Importar zonas</h3>
        <p className="mt-1 text-[13px] text-[#6b685e]">{preview.validos.length} zona(s) válida(s){preview.ign ? ` · ${preview.ign} ignorada(s)` : ''}.</p>
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-[#e3ddcf]">
          {preview.validos.map((z, i) => (
            <div key={i} className="flex items-center justify-between border-b border-[#f0ece0] px-3 py-2 text-[13px] last:border-b-0">
              <span className="truncate pr-2 font-medium text-[#1F3A2E]">{z.nome}</span>
              <span className="text-[#3a3730]">{BRL(z.taxaFrete)} · {z.bairros.length} bairro(s)</span>
            </div>
          ))}
          {!preview.validos.length && <div className="px-3 py-3 text-[13px] text-[#b23b3b]">Nenhuma zona válida.</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1F3A2E]">Cancelar</button>
          <button onClick={async () => { setEnviando(true); await onConfirm(); }} disabled={!preview.validos.length || enviando} className="rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] disabled:opacity-50">{enviando ? 'Importando…' : `Importar ${preview.validos.length}`}</button>
        </div>
      </div>
    </div>
  );
}
