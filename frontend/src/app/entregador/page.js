// frontend/src/app/entregador/page.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Phone, Package, CheckCircle2, Navigation, RefreshCw, LogOut } from 'lucide-react';
import { api } from '../../lib/api';

const BRL = (n) =>
  n == null ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const hora = (d) => (d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const soDig = (s) => String(s || '').replace(/\D/g, '');

const PENDENTES = ['ACEITO', 'EM_SEPARACAO', 'SEPARADO', 'EM_ROTA'];

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('emporio_token');
}

export default function EntregadorPage() {
  const [logado, setLogado] = useState(false);
  const [nome, setNome] = useState('');
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [acao, setAcao] = useState(null); // pedidoId em processamento

  useEffect(() => { setLogado(!!getToken()); }, []);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const r = await api.get('/api/entregadores/me/entregas');
      setEntregas(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (logado) carregar(); }, [logado, carregar]);

  const onLogin = (info) => { if (info?.nome) setNome(info.nome); setLogado(true); };
  const sair = () => { window.localStorage.removeItem('emporio_token'); setLogado(false); setEntregas([]); };

  const mudarStatus = async (pedidoId, status) => {
    setAcao(pedidoId); setErro(null);
    try {
      await api.patch(`/api/entregadores/me/entregas/${pedidoId}/status`, { status });
      await carregar();
    } catch (e) { setErro(e.message); }
    finally { setAcao(null); }
  };

  if (!logado) return <Login onLogin={onLogin} />;

  const pendentes = entregas.filter((e) => PENDENTES.includes(e.status));
  const entregues = entregas.filter((e) => e.status === 'ENTREGUE');
  const emRota = pendentes.filter((e) => e.status === 'EM_ROTA').length;

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#2B2B2B]">
      <header className="sticky top-0 z-10 bg-[#16291f] px-4 py-3 text-[#F4F1EA] shadow">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#A8B5A0]">Empório · Entregas</div>
            <div className="text-[15px] font-semibold">{nome || 'Entregador'}</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={carregar} className="rounded-full p-2 hover:bg-white/10" title="Atualizar"><RefreshCw size={18} /></button>
            <button onClick={sair} className="rounded-full p-2 hover:bg-white/10" title="Sair"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat n={pendentes.length} label="A entregar" />
          <Stat n={emRota} label="Em rota" />
          <Stat n={entregues.length} label="Entregues" />
        </div>

        {erro && <div className="mb-3 rounded-lg border border-[#e7c9c4] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#8a8678]">Carregando suas entregas…</div>
        ) : entregas.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#8a8678]">Nenhuma entrega atribuída a você no momento.</div>
        ) : (
          <>
            {pendentes.length > 0 && (
              <Secao titulo="A entregar">
                {pendentes.map((e) => <Card key={e.id} e={e} acao={acao} onStatus={mudarStatus} />)}
              </Secao>
            )}
            {entregues.length > 0 && (
              <Secao titulo="Entregues">
                {entregues.map((e) => <Card key={e.id} e={e} acao={acao} onStatus={mudarStatus} />)}
              </Secao>
            )}
          </>
        )}
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
      window.localStorage.setItem('emporio_token', r.token);
      onLogin(r.usuario || {});
    } catch (e) { setErro(e.message); setEntrando(false); }
  };

  const inp = 'w-full rounded-lg border border-[#cfd8cb] bg-white px-3 py-3 text-[15px] outline-none focus:border-[#B8935A]';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#16291f] px-5">
      <div className="w-full max-w-sm rounded-2xl bg-[#F4F1EA] p-6 shadow-xl">
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-lg bg-[#1F3A2E] font-serif text-[16px] font-bold text-[#B8935A]">RN</div>
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

function Stat({ n, label }) {
  return (
    <div className="rounded-xl border border-[#e3ddcf] bg-white px-2 py-3 text-center">
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

function Card({ e, acao, onStatus }) {
  const end = e.enderecoEntrega || {};
  const endLinha = [end.logradouro, end.numero].filter(Boolean).join(', ') + (end.complemento ? ` · ${end.complemento}` : '');
  const endLinha2 = [end.bairro, end.cidade].filter(Boolean).join(' · ');
  const mapsQuery = encodeURIComponent([end.logradouro, end.numero, end.bairro, end.cidade, end.cep].filter(Boolean).join(', '));
  const ocupado = acao === e.id;
  const entregue = e.status === 'ENTREGUE';
  const emRota = e.status === 'EM_ROTA';

  return (
    <div className={`rounded-xl border bg-white p-4 ${entregue ? 'border-[#cfe0d4] opacity-80' : 'border-[#e3ddcf]'}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-[#1F3A2E]">{e.cliente?.nome || 'Cliente'}</div>
          <div className="text-[12px] text-[#8a8678]">Pedido {e.numero} · {e.loja?.nome || ''}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${entregue ? 'bg-[#e6f0e9] text-[#2f6b48]' : emRota ? 'bg-[#fbf1dd] text-[#8a6a1f]' : 'bg-[#eef1ec] text-[#5b6b5f]'}`}>
          {entregue ? 'Entregue' : emRota ? 'Em rota' : 'A sair'}
        </span>
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

      {!entregue && (
        <div className="mt-3">
          {emRota ? (
            <button onClick={() => onStatus(e.id, 'ENTREGUE')} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2f6b48] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285c3e] disabled:opacity-50">
              <CheckCircle2 size={17} /> {ocupado ? 'Salvando…' : 'Confirmar entrega'}
            </button>
          ) : (
            <button onClick={() => onStatus(e.id, 'EM_ROTA')} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#B8935A] px-4 py-2.5 text-[14px] font-semibold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-50">
              <Navigation size={17} /> {ocupado ? 'Salvando…' : 'Sair para entrega'}
            </button>
          )}
        </div>
      )}
      {entregue && (
        <div className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[#2f6b48]">
          <CheckCircle2 size={16} /> Entregue {e.entrega?.entregueEm ? `às ${hora(e.entrega.entregueEm)}` : ''}
        </div>
      )}
    </div>
  );
}
