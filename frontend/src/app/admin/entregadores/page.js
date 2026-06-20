// frontend/src/app/admin/entregadores/page.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export default function EntregadoresPage() {
  const [lista, setLista] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [edit, setEdit] = useState(undefined); // undefined fechado | null novo | obj editar

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const r = await api.get('/api/entregadores');
      setLista(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { setErro(e.message); setLista([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    api.get('/api/lojas').then((r) => setLojas(Array.isArray(r) ? r : r?.data || [])).catch(() => {});
  }, []);

  const ativos = lista.filter((e) => e.ativo).length;

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3ddcf] bg-white px-7 py-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Operação</div>
          <h1 className="font-serif text-[22px] font-bold text-[#1F3A2E]">Entregadores</h1>
        </div>
        <button onClick={() => setEdit(null)} className="rounded-lg bg-[#B8935A] px-4 py-2 text-[13px] font-semibold text-[#16291f] hover:bg-[#a8824a]">
          + Novo entregador
        </button>
      </div>

      <div className="flex-1 px-7 pb-10 pt-6">
        <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-3">
          <Kpi lab="Entregadores" val={lista.length} note="cadastrados" />
          <Kpi lab="Ativos" val={ativos} note="disponíveis para rota" />
          <Kpi lab="Inativos" val={lista.length - ativos} note="desativados" />
        </div>

        {erro && <div className="mb-4 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-4 py-3 text-[13px] text-[#b23b3b]">Erro ao carregar: {erro}</div>}

        <div className="overflow-hidden rounded-xl border border-[#e3ddcf] bg-white">
          <div className="grid grid-cols-12 gap-2 border-b border-[#e3ddcf] bg-[#faf8f2] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]">
            <span className="col-span-4">Nome</span>
            <span className="col-span-3">Telefone</span>
            <span className="col-span-3">Loja</span>
            <span className="col-span-1 text-center">Entregas</span>
            <span className="col-span-1 text-right">Status</span>
          </div>
          {loading && <div className="px-4 py-10 text-center text-[13px] text-[#9a9483]">Carregando…</div>}
          {!loading && lista.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-[#9a9483]">Nenhum entregador cadastrado. Clique em “+ Novo entregador”.</div>
          )}
          {lista.map((e) => (
            <button key={e.id} onClick={() => setEdit(e)} className="grid w-full grid-cols-12 items-center gap-2 border-b border-[#f0ece0] px-4 py-3 text-left last:border-b-0 hover:bg-[#faf8f2]">
              <span className="col-span-4 truncate text-[13.5px] font-medium text-[#1F3A2E]">{e.nome}</span>
              <span className="col-span-3 text-[13px] text-[#5e5a4e]">{e.telefone || '—'}</span>
              <span className="col-span-3 truncate text-[13px] text-[#5e5a4e]">{e.loja?.nome || '—'}</span>
              <span className="col-span-1 text-center text-[13px] text-[#5e5a4e]">{e._count?.entregas ?? 0}</span>
              <span className="col-span-1 text-right">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.ativo ? 'bg-[#e9f0ea] text-[#3f7d5b]' : 'bg-[#f1eee6] text-[#9a9483]'}`}>
                  {e.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {edit !== undefined && (
        <FormDrawer
          entregador={edit}
          lojas={lojas}
          onClose={() => setEdit(undefined)}
          onSaved={() => { setEdit(undefined); carregar(); }}
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

function FormDrawer({ entregador, lojas, onClose, onSaved }) {
  const editando = !!entregador;
  const [nome, setNome] = useState(entregador?.nome || '');
  const [email, setEmail] = useState(entregador?.email || '');
  const [telefone, setTelefone] = useState(entregador?.telefone || '');
  const [senha, setSenha] = useState('');
  const [lojaId, setLojaId] = useState(entregador?.lojaId ? String(entregador.lojaId) : '');
  const [ativo, setAtivo] = useState(entregador ? !!entregador.ativo : true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const salvar = async () => {
    setErro(null);
    if (!nome.trim()) return setErro('Informe o nome.');
    if (!email.trim()) return setErro('Informe o e-mail.');
    setSalvando(true);
    try {
      const payload = { nome, email, telefone, lojaId: lojaId || null, ativo };
      if (senha) payload.senha = senha;
      if (editando) await api.patch(`/api/entregadores/${entregador.id}`, payload);
      else await api.post('/api/entregadores', payload);
      onSaved();
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  const inp = 'w-full rounded-lg border border-[#e3ddcf] px-3 py-2 text-[13.5px] outline-none focus:border-[#B8935A]';
  const lab = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8678]';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#e3ddcf] px-6 py-4">
          <h3 className="font-serif text-[20px] font-bold text-[#1F3A2E]">{editando ? 'Editar entregador' : 'Novo entregador'}</h3>
          <button onClick={onClose} className="text-[20px] leading-none text-[#8a8678] hover:text-[#1F3A2E]">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3"><label className={lab}>Nome</label><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do entregador" /></div>
          <div className="mb-3"><label className={lab}>E-mail (login do app)</label><input className={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
          <div className="mb-3"><label className={lab}>Telefone</label><input className={inp} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" /></div>
          <div className="mb-3">
            <label className={lab}>Loja</label>
            <select className={inp} value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
              <option value="">Sem loja fixa</option>
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className={lab}>{editando ? 'Nova senha (opcional)' : 'Senha do app (opcional)'}</label>
            <input type="password" className={inp} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={editando ? 'Deixe em branco para não alterar' : 'Defina depois, se quiser'} />
            <p className="mt-1 text-[11.5px] text-[#9a9483]">Usada para o entregador entrar no app. Pode definir depois.</p>
          </div>
          {editando && (
            <label className="flex items-center gap-2 text-[13.5px] text-[#3a3730]">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              Entregador ativo (aparece para atribuição)
            </label>
          )}
          {erro && <div className="mt-3 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}
        </div>

        <div className="border-t border-[#e3ddcf] px-6 py-4">
          <button onClick={salvar} disabled={salvando} className="w-full rounded-lg bg-[#B8935A] px-4 py-2.5 text-[14px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50">
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar entregador'}
          </button>
        </div>
      </div>
    </div>
  );
}
