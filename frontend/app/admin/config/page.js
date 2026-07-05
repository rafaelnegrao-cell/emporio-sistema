// frontend/src/app/admin/config/page.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';

const PAPEL_LABEL = { ADMIN: 'Administrador', OPERADOR: 'Operador', ENTREGADOR: 'Entregador' };
const PAPEL_TAG = { ADMIN: 'bg-[#fbf0d6] text-[#9a6a1f]', OPERADOR: 'bg-[#e7eef9] text-[#365b9a]', ENTREGADOR: 'bg-[#e6f0e9] text-[#2f6b48]' };

export default function ConfigPage() {
  const [aba, setAba] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [modalUser, setModalUser] = useState(null); // {} novo | objeto editar
  const [modalLoja, setModalLoja] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const [u, l] = await Promise.all([api.get('/api/usuarios'), api.get('/api/lojas')]);
      setUsuarios(Array.isArray(u && u.data) ? u.data : []);
      setLojas(Array.isArray(l) ? l : (l && l.data) || []);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abaCls = (k) => `rounded-lg px-4 py-2 text-[13px] font-semibold ${aba === k ? 'bg-[#1F3A2E] text-[#F4F1EA]' : 'bg-white text-[#5e5a4e] border border-[#e3ddcf] hover:border-[#B8935A]'}`;

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3ddcf] bg-white px-7 py-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Gestão</div>
          <h1 className="font-serif text-[22px] font-bold text-[#1F3A2E]">Configurações</h1>
        </div>
        {aba === 'usuarios' ? (
          <button onClick={() => setModalUser({})} className="rounded-lg bg-[#B8935A] px-4 py-2 text-[13px] font-semibold text-[#16291f] hover:bg-[#a8824a]">+ Novo usuário</button>
        ) : <span />}
      </div>

      <div className="flex-1 px-7 pb-10 pt-6">
        <div className="mb-5 flex gap-2">
          <button onClick={() => setAba('usuarios')} className={abaCls('usuarios')}>Usuários e logins</button>
          <button onClick={() => setAba('lojas')} className={abaCls('lojas')}>Lojas</button>
        </div>

        {erro && <div className="mb-4 rounded-lg border border-[#f0d9d6] bg-[#fbeeec] px-4 py-3 text-[13px] text-[#b23b3b]">Erro: {erro}</div>}

        {loading ? (
          <div className="py-16 text-center text-[14px] text-[#8a8678]">Carregando…</div>
        ) : aba === 'usuarios' ? (
          <section className="rounded-xl border border-[#e3ddcf] bg-white p-4">
            <div className="mb-3 text-[12.5px] text-[#6b685e]">
              Crie logins para a equipe. <b>Operador</b> opera o Kanban e registra "Saiu da loja" na expedição; <b>Entregador</b> usa o app de entregas; <b>Administrador</b> acessa tudo.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>{['Nome', 'E-mail', 'Papel', 'Loja', 'Status', ''].map((c) => (
                    <th key={c} className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9483]">{c}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-[12.5px] text-[#b9b3a3]">Nenhum usuário cadastrado.</td></tr>
                  ) : usuarios.map((u) => (
                    <tr key={u.id} className="border-t border-[#f0ece0]">
                      <td className="px-3 py-2 text-[13px] text-[#3a3730]">{u.nome}</td>
                      <td className="px-3 py-2 text-[13px] text-[#6b685e]">{u.email}</td>
                      <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${PAPEL_TAG[u.papel] || ''}`}>{PAPEL_LABEL[u.papel] || u.papel}</span></td>
                      <td className="px-3 py-2 text-[13px] text-[#6b685e]">{u.loja?.nome || '—'}</td>
                      <td className="px-3 py-2 text-[13px]">{u.ativo ? <span className="text-[#2f6b48]">Ativo</span> : <span className="text-[#b23b3b]">Inativo</span>}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => setModalUser(u)} className="rounded-lg border border-[#e3ddcf] px-3 py-1 text-[12px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]">Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-[#e3ddcf] bg-white p-4">
            <div className="mb-3 text-[12.5px] text-[#6b685e]">Dados das lojas. "No escopo delivery" controla quais lojas participam do fluxo de entregas.</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>{['Loja', 'Código', 'Endereço', 'Telefone', 'Delivery', ''].map((c) => (
                    <th key={c} className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#9a9483]">{c}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {lojas.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-[12.5px] text-[#b9b3a3]">Nenhuma loja.</td></tr>
                  ) : lojas.map((l) => (
                    <tr key={l.id} className="border-t border-[#f0ece0]">
                      <td className="px-3 py-2 text-[13px] text-[#3a3730]">{l.nome}</td>
                      <td className="px-3 py-2 text-[13px] text-[#6b685e]">{l.codigo}</td>
                      <td className="px-3 py-2 text-[13px] text-[#6b685e]">{l.endereco}</td>
                      <td className="px-3 py-2 text-[13px] text-[#6b685e]">{l.telefone || '—'}</td>
                      <td className="px-3 py-2 text-[13px]">{l.noEscopoDelivery ? <span className="text-[#2f6b48]">Sim</span> : <span className="text-[#9a9483]">Não</span>}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => setModalLoja(l)} className="rounded-lg border border-[#e3ddcf] px-3 py-1 text-[12px] font-semibold text-[#1F3A2E] hover:border-[#B8935A]">Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {modalUser && <UsuarioModal user={modalUser} lojas={lojas} onClose={() => setModalUser(null)} onSaved={() => { setModalUser(null); carregar(); }} />}
      {modalLoja && <LojaModal loja={modalLoja} onClose={() => setModalLoja(null)} onSaved={() => { setModalLoja(null); carregar(); }} />}
    </>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-[#5e5a4e]">{label}</span>
      {children}
    </label>
  );
}

const inpCls = 'w-full rounded-lg border border-[#cfd8cb] bg-white px-3 py-2 text-[14px] text-[#2B2B2B] outline-none focus:border-[#B8935A]';

function Modal({ titulo, children, onClose, onSalvar, salvando, erro }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#F4F1EA] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-serif text-[19px] font-bold text-[#1F3A2E]">{titulo}</h2>
        <div className="space-y-3">{children}</div>
        {erro && <div className="mt-3 rounded-lg border border-[#e7c9c4] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#e3ddcf] bg-white px-4 py-2 text-[13px] font-semibold text-[#5e5a4e]">Cancelar</button>
          <button onClick={onSalvar} disabled={salvando} className="rounded-lg bg-[#B8935A] px-4 py-2 text-[13px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

function UsuarioModal({ user, lojas, onClose, onSaved }) {
  const novo = !user.id;
  const [f, setF] = useState({
    nome: user.nome || '', email: user.email || '', telefone: user.telefone || '',
    papel: user.papel || 'OPERADOR', lojaId: user.lojaId ? String(user.lojaId) : '',
    senha: '', ativo: user.ativo !== false,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));

  const salvar = async () => {
    if (!f.nome || !f.email) return setErro('Nome e e-mail são obrigatórios.');
    if (novo && !f.senha) return setErro('Defina uma senha para o novo usuário.');
    setErro(null); setSalvando(true);
    try {
      const body = { nome: f.nome, email: f.email, telefone: f.telefone, papel: f.papel, lojaId: f.lojaId || null, ativo: f.ativo };
      if (f.senha) body.senha = f.senha;
      if (novo) await api.post('/api/usuarios', body);
      else await api.patch(`/api/usuarios/${user.id}`, body);
      onSaved();
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return (
    <Modal titulo={novo ? 'Novo usuário' : 'Editar usuário'} onClose={onClose} onSalvar={salvar} salvando={salvando} erro={erro}>
      <Campo label="Nome"><input className={inpCls} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
      <Campo label="E-mail (login)"><input className={inpCls} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoCapitalize="none" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Papel">
          <select className={inpCls} value={f.papel} onChange={(e) => set('papel', e.target.value)}>
            <option value="ADMIN">Administrador</option>
            <option value="OPERADOR">Operador</option>
            <option value="ENTREGADOR">Entregador</option>
          </select>
        </Campo>
        <Campo label="Loja">
          <select className={inpCls} value={f.lojaId} onChange={(e) => set('lojaId', e.target.value)}>
            <option value="">— sem loja —</option>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Telefone"><input className={inpCls} value={f.telefone} onChange={(e) => set('telefone', e.target.value)} /></Campo>
      <Campo label={novo ? 'Senha' : 'Nova senha (deixe em branco para manter)'}>
        <input className={inpCls} type="password" value={f.senha} onChange={(e) => set('senha', e.target.value)} placeholder={novo ? 'mín. 6 caracteres' : '••••••'} />
      </Campo>
      <label className="flex items-center gap-2 text-[13px] text-[#3a3730]">
        <input type="checkbox" checked={f.ativo} onChange={(e) => set('ativo', e.target.checked)} /> Usuário ativo
      </label>
    </Modal>
  );
}

function LojaModal({ loja, onClose, onSaved }) {
  const [f, setF] = useState({
    nome: loja.nome || '', endereco: loja.endereco || '', telefone: loja.telefone || '',
    noEscopoDelivery: !!loja.noEscopoDelivery,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));

  const salvar = async () => {
    if (!f.nome || f.nome.length < 2) return setErro('Informe o nome da loja.');
    if (!f.endereco || f.endereco.length < 5) return setErro('Informe o endereço completo.');
    setErro(null); setSalvando(true);
    try {
      await api.put(`/api/lojas/${loja.id}`, { nome: f.nome, endereco: f.endereco, telefone: f.telefone || undefined, noEscopoDelivery: f.noEscopoDelivery });
      onSaved();
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return (
    <Modal titulo={`Editar — ${loja.nome}`} onClose={onClose} onSalvar={salvar} salvando={salvando} erro={erro}>
      <Campo label="Nome"><input className={inpCls} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
      <Campo label="Endereço"><input className={inpCls} value={f.endereco} onChange={(e) => set('endereco', e.target.value)} /></Campo>
      <Campo label="Telefone"><input className={inpCls} value={f.telefone} onChange={(e) => set('telefone', e.target.value)} /></Campo>
      <label className="flex items-center gap-2 text-[13px] text-[#3a3730]">
        <input type="checkbox" checked={f.noEscopoDelivery} onChange={(e) => set('noEscopoDelivery', e.target.checked)} /> Participa do delivery
      </label>
    </Modal>
  );
}
