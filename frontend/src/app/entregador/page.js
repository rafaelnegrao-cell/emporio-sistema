// frontend/src/app/entregador/page.js
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Phone, Package, CheckCircle2, Navigation, RefreshCw, LogOut, Hand } from 'lucide-react';

// Cliente próprio do app do entregador — chave de login SEPARADA do admin
const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const TKEY = 'emporio_entregador_token';
async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = typeof window !== 'undefined' ? window.localStorage.getItem(TKEY) : null;
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (!res.ok) { let m = `Erro ${res.status}`; try { const j = await res.json(); m = j.erro || j.message || m; } catch (_) {} throw new Error(m); }
  return res.status === 204 ? null : res.json();
}
const api = { get: (p) => req(p), post: (p, b) => req(p, { method: 'POST', body: b }), patch: (p, b) => req(p, { method: 'PATCH', body: b }) };

const BRL = (n) => (n == null ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }));
const hora = (d) => (d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const soDig = (s) => String(s || '').replace(/\D/g, '');
const PENDENTES = ['ACEITO', 'EM_SEPARACAO', 'SEPARADO', 'EM_ROTA'];

export default function EntregadorPage() {
  const [logado, setLogado] = useState(false);
  const [nome, setNome] = useState('');
  const [disponiveis, setDisponiveis] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [acao, setAcao] = useState(null);
  const timer = useRef(null);

  useEffect(() => { setLogado(!!(typeof window !== 'undefined' && window.localStorage.getItem(TKEY))); }, []);

  const carregar = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const [d, e] = await Promise.all([api.get('/api/entregadores/me/disponiveis'), api.get('/api/entregadores/me/entregas')]);
      setDisponiveis(Array.isArray(d?.data) ? d.data : []);
      setEntregas(Array.isArray(e?.data) ? e.data : []);
      setErro(null);
    } catch (err) { if (!silent) setErro(err.message); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!logado) return;
    carregar();
    timer.current = setInterval(() => carregar(true), 25000); // verifica novas entregas sozinho
    return () => clearInterval(timer.current);
  }, [logado, carregar]);

  const sair = () => { window.localStorage.removeItem(TKEY); setLogado(false); setDisponiveis([]); setEntregas([]); };

  const aceitar = async (pedidoId) => {
    setAcao(pedidoId); setErro(null);
    try { await api.post(`/api/entregadores/me/entregas/${pedidoId}/aceitar`); await carregar(true); }
    catch (e) { setErro(e.message); await carregar(true); }
    finally { setAcao(null); }
  };
  const mudarStatus = async (pedidoId, status) => {
    setAcao(pedidoId); setErro(null);
    try { await api.patch(`/api/entregadores/me/entregas/${pedidoId}/status`, { status }); await carregar(true); }
    catch (e) { setErro(e.message); }
    finally { setAcao(null); }
  };

  if (!logado) return <Login onLogin={(info) => { if (info?.nome) setNome(info.nome); setLogado(true); }} />;

  const pendentes = entregas.filter((e) => PENDENTES.includes(e.status));
  const entregues = entregas.filter((e) => e.status === 'ENTREGUE');

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#2B2B2B]">
      <header className="sticky top-0 z-10 bg-[#16291f] px-4 py-3 text-[#F4F1EA] shadow">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#A8B5A0]">Empório · Entregas</div>
            <div className="text-[15px] font-semibold">{nome || 'Entregador'}</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => carregar()} className="rounded-full p-2 hover:bg-white/10" title="Atualizar"><RefreshCw size={18} /></button>
            <button onClick={sair} className="rounded-full p-2 hover:bg-white/10" title="Sair"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat n={disponiveis.length} label="Disponíveis" destaque />
          <Stat n={pendentes.length} label="Minhas" />
          <Stat n={entregues.length} label="Entregues" />
        </div>

        {erro && <div className="mb-3 rounded-lg border border-[#e7c9c4] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#8a8678]">Carregando…</div>
        ) : (
          <>
            {disponiveis.length > 0 && (
              <Secao titulo={`Disponíveis para retirada (${disponiveis.length})`}>
                {disponiveis.map((e) => <Card key={e.id} e={e} modo="disponivel" acao={acao} onAceitar={aceitar} />)}
              </Secao>
            )}
            {pendentes.length > 0 && (
              <Secao titulo="Minhas entregas">
                {pendentes.map((e) => <Card key={e.id} e={e} modo="minha" acao={acao} onStatus={mudarStatus} />)}
              </Secao>
            )}
            {entregues.length > 0 && (
              <Secao titulo="Entregues">
                {entregues.map((e) => <Card key={e.id} e={e} modo="minha" acao={acao} onStatus={mudarStatus} />)}
              </Secao>
            )}
            {disponiveis.length === 0 && entregas.length === 0 && (
              <div className="py-12 text-center text-[14px] text-[#8a8678]">Nenhuma entrega disponível no momento.</div>
            )}
          </>
        )}
        <div className="mt-6 text-center text-[11px] text-[#a9a596]">Atualizando automaticamente a cada 25s</div>
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const entrar = async () => {
    if (!email || !senha) return setErro('Informe e-mail e senha.');
    setErro(null); setEntrando(true);
    try {
      const r = await api.post('/api/auth/operador/login', { email: email.trim().toLowerCase(), senha });
      if (!r?.token) throw new Error('Resposta inválida do servidor.');
      window.localStorage.setItem(TKEY, r.token);
      onLogin(r.usuario || {});
    } catch (e) { setErro(e.message); setEntrando(false); }
  };
  const inp = 'w-full rounded-lg border border-[#cfd8cb] bg-white px-3 py-3 text-[15px] outline-none focus:border-[#B8935A]';
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#16291f] px-5">
      <div className="w-full max-w-sm rounded-2xl bg-[#F4F1EA] p-6 shadow-xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1F3A2E] font-serif text-[16px] font-bold text-[#B8935A]">RN</div>
        <h1 className="mt-3 font-serif text-[22px] font-bold text-[#1F3A2E]">Empório · Entregas</h1>
        <p className="mb-4 text-[13px] text-[#6b685e]">Entre com seu e-mail e senha de entregador.</p>
        <div className="space-y-3">
          <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" inputMode="email" autoCapitalize="none" />
          <input className={inp} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }} placeholder="Senha" />
          {erro && <div className="rounded-lg border border-[#e7c9c4] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}
          <button onClick={entrar} disabled={entrando} className="w-full rounded-lg bg-[#B8935A] px-4 py-3 text-[15px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50">{entrando ? 'Entrando…' : 'Entrar'}</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label, destaque }) {
  return (
    <div className={`rounded-xl border px-2 py-3 text-center ${destaque && n > 0 ? 'border-[#B8935A] bg-[#fbf3e6]' : 'border-[#e3ddcf] bg-white'}`}>
      <div className="font-serif text-[22px] font-bold text-[#1F3A2E]">{n}</div>
      <div className="text-[11px] text-[#8a8678]">{label}</div>
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <section className="mb-5">
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#8a8678]">{titulo}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Card({ e, modo, acao, onAceitar, onStatus }) {
  const end = e.enderecoEntrega || {};
  const endLinha = [end.logradouro, end.numero].filter(Boolean).join(', ') + (end.complemento ? ` · ${end.complemento}` : '');
  const endLinha2 = [end.bairro, end.cidade].filter(Boolean).join(' · ');
  const mapsQuery = encodeURIComponent([end.logradouro, end.numero, end.bairro, end.cidade, end.cep].filter(Boolean).join(', '));
  const ocupado = acao === e.id;
  const disponivel = modo === 'disponivel';
  const entregue = e.status === 'ENTREGUE';
  const emRota = e.status === 'EM_ROTA';
  const tag = disponivel ? 'Disponível' : entregue ? 'Entregue' : emRota ? 'Em rota' : 'Indo retirar';
  const tagCls = disponivel ? 'bg-[#fbf1dd] text-[#8a6a1f]' : entregue ? 'bg-[#e6f0e9] text-[#2f6b48]' : emRota ? 'bg-[#e7eef9] text-[#365b9a]' : 'bg-[#eef1ec] text-[#5b6b5f]';

  return (
    <div className={`rounded-xl border bg-white p-4 ${entregue ? 'border-[#cfe0d4] opacity-80' : 'border-[#e3ddcf]'}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-[#1F3A2E]">{e.cliente?.nome || 'Cliente'}</div>
          <div className="text-[12px] text-[#8a8678]">Pedido {e.numero} · {e.loja?.nome || ''}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${tagCls}`}>{tag}</span>
      </div>

      <div className="mt-3 flex items-start gap-2 text-[13.5px] text-[#3a3730]">
        <MapPin size={16} className="mt-0.5 shrink-0 text-[#B8935A]" />
        <div>
          <div>{endLinha}</div>
          {endLinha2 && <div className="text-[12.5px] text-[#8a8678]">{endLinha2}</div>}
        </div>
      </div>

      {e.itens?.length > 0 && (
        <div className="mt-2 flex items-start gap-2 text-[13px] text-[#6b685e]">
          <Package size={16} className="mt-0.5 shrink-0 text-[#A8B5A0]" />
          <div>{e.itens.map((i) => `${i.quantidade}× ${i.produto?.nome || 'item'}`).join(' · ')}</div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-[#f0ece0] pt-3">
        <span className="text-[14px] font-semibold text-[#1F3A2E]">{BRL(e.valorTotal)}</span>
        <div className="flex items-center gap-2">
          {soDig(e.cliente?.whatsapp) && (
            <a href={`https://wa.me/55${soDig(e.cliente.whatsapp)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#e3ddcf] p-2 text-[#1F3A2E]" title="WhatsApp"><Phone size={16} /></a>
          )}
          <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#e3ddcf] p-2 text-[#1F3A2E]" title="Abrir no mapa"><Navigation size={16} /></a>
        </div>
      </div>

      {disponivel ? (
        <div className="mt-3">
          <button onClick={() => onAceitar(e.id)} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1F3A2E] px-4 py-2.5 text-[14px] font-semibold text-[#F4F1EA] hover:bg-[#16291f] disabled:opacity-50">
            <Hand size={17} /> {ocupado ? 'Aceitando…' : 'Aceitar e ir retirar'}
          </button>
        </div>
      ) : !entregue ? (
        <div className="mt-3">
          {emRota ? (
            <button onClick={() => onStatus(e.id, 'ENTREGUE')} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2f6b48] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285c3e] disabled:opacity-50">
              <CheckCircle2 size={17} /> {ocupado ? 'Salvando…' : 'Confirmar entrega'}
            </button>
          ) : (
            <button onClick={() => onStatus(e.id, 'EM_ROTA')} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#B8935A] px-4 py-2.5 text-[14px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50">
              <Navigation size={17} /> {ocupado ? 'Salvando…' : 'Retirei — sair para entrega'}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[#2f6b48]">
          <CheckCircle2 size={16} /> Entregue {e.entrega?.entregueEm ? `às ${hora(e.entrega.entregueEm)}` : ''}
        </div>
      )}
    </div>
  );
}
