// frontend/src/app/entregador/page.js
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Phone, Package, CheckCircle2, RefreshCw, LogOut, Hand, Bell, BellRing, Share } from 'lucide-react';

// Cliente próprio do app do entregador — chave de login SEPARADA do admin
const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const TKEY = 'emporio_entregador_token';
async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = typeof window !== 'undefined' ? window.localStorage.getItem(TKEY) : null;
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  // Sessão expirada (401 com token salvo): limpa o token, marca o aviso e
  // recarrega — a página volta na tela de login com a explicação, em vez de
  // ficar mostrando "Erro 401" nas listas.
  if (res.status === 401 && t && typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(TKEY);
      window.sessionStorage.setItem('emporio_entregador_expirado', '1');
    } catch (_) {}
    window.location.replace('/entregador');
    throw new Error('Sessão expirada. Entre novamente.');
  }
  if (!res.ok) { let m = `Erro ${res.status}`; try { const j = await res.json(); m = j.erro || j.message || m; } catch (_) {} throw new Error(m); }
  return res.status === 204 ? null : res.json();
}
const api = { get: (p) => req(p), post: (p, b) => req(p, { method: 'POST', body: b }), patch: (p, b) => req(p, { method: 'PATCH', body: b }) };

const BRL = (n) => (n == null ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }));
const hora = (d) => (d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const soDig = (s) => String(s || '').replace(/\D/g, '');
const PENDENTES = ['ACEITO', 'EM_SEPARACAO', 'SEPARADO', 'EM_ROTA'];
function slaInfo(aceitoEm) {
  if (!aceitoEm) return null;
  const min = Math.max(0, Math.floor((Date.now() - new Date(aceitoEm).getTime()) / 60000));
  const tier = min >= 15 ? 'estourou' : min >= 10 ? 'atencao' : 'ok';
  return { min, tier };
}

// ────────────────────────────────────────────────────────────
// Notificações push (Web Push/VAPID)
// ────────────────────────────────────────────────────────────

// Converte a chave pública VAPID (base64url) pro formato que o navegador exige.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function ehIOS() {
  try { return /iphone|ipad|ipod/i.test(window.navigator.userAgent); } catch (_) { return false; }
}
function ehPWAInstalada() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (_) { return false; }
}

// Bipe curto de alerta (SLA estourada) via WebAudio — sem arquivo de som.
let _audioCtx = null;
function tocarAlerta() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
    const agora = _audioCtx.currentTime;
    [0, 0.35, 0.7].forEach((t) => {
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, agora + t);
      gain.gain.exponentialRampToValueAtTime(0.35, agora + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, agora + t + 0.25);
      osc.connect(gain); gain.connect(_audioCtx.destination);
      osc.start(agora + t); osc.stop(agora + t + 0.3);
    });
  } catch (_) {}
  try { if (navigator.vibrate) navigator.vibrate([300, 120, 300]); } catch (_) {}
}

export default function EntregadorPage() {
  const [logado, setLogado] = useState(false);
  const [nome, setNome] = useState('');
  const [direcionadas, setDirecionadas] = useState([]);
  const [disponiveis, setDisponiveis] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [acao, setAcao] = useState(null);
  const timer = useRef(null);

  // Estados do push: verificando | ios-instalar | sem-suporte | desativado | ativando | ativado | negado | erro-servidor
  const [pushEstado, setPushEstado] = useState('verificando');
  const estouradasRef = useRef(null); // ids que já estavam com SLA estourada (pra bipar só na virada)

  useEffect(() => { setLogado(!!(typeof window !== 'undefined' && window.localStorage.getItem(TKEY))); }, []);

  const carregar = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    const safe = (pr) => pr.then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e }));
    try {
      const [dir, d, e] = await Promise.all([
        safe(api.get('/api/entregadores/me/direcionadas')),
        safe(api.get('/api/entregadores/me/disponiveis')),
        safe(api.get('/api/entregadores/me/entregas')),
      ]);
      if (dir.ok) setDirecionadas(Array.isArray(dir.r && dir.r.data) ? dir.r.data : []);
      if (d.ok) setDisponiveis(Array.isArray(d.r && d.r.data) ? d.r.data : []);
      if (e.ok) setEntregas(Array.isArray(e.r && e.r.data) ? e.r.data : []);
      const falhou = [dir, d, e].find((x) => !x.ok);
      if (!silent) setErro(falhou ? falhou.e.message : null);
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!logado) return;
    carregar();
    timer.current = setInterval(() => carregar(true), 25000); // verifica novas entregas sozinho
    return () => clearInterval(timer.current);
  }, [logado, carregar]);

  // Registra o service worker e descobre o estado do push neste aparelho.
  useEffect(() => {
    if (!logado) return;
    (async () => {
      try {
        const suporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
        if (!suporta) {
          setPushEstado(ehIOS() && !ehPWAInstalada() ? 'ios-instalar' : 'sem-suporte');
          return;
        }
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Reafirma a inscrição no servidor (garante o vínculo com o usuário logado agora).
          api.post('/api/push/inscrever', sub.toJSON()).catch(() => {});
          setPushEstado('ativado');
        } else if (Notification.permission === 'denied') {
          setPushEstado('negado');
        } else {
          setPushEstado('desativado');
        }
      } catch (_) {
        setPushEstado('sem-suporte');
      }
    })();
  }, [logado]);

  // Botão "Ativar notificações" — precisa ser chamado por toque (regra do iPhone).
  const ativarNotificacoes = async () => {
    setPushEstado('ativando');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushEstado(perm === 'denied' ? 'negado' : 'desativado'); return; }
      const { chave } = await api.get('/api/push/chave-publica');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(chave),
      });
      await api.post('/api/push/inscrever', sub.toJSON());
      setPushEstado('ativado');
      // Dispara um push de teste pra pessoa VER a notificação chegar na hora.
      api.post('/api/push/teste').catch(() => {});
    } catch (e) {
      setPushEstado(String(e && e.message || '').includes('servidor') ? 'erro-servidor' : 'desativado');
      setErro(e.message || 'Não foi possível ativar as notificações.');
    }
  };

  // Alerta sonoro + vibração quando alguma retirada ESTOURA a SLA de 15 min.
  // Bipa só na virada (não fica repetindo a cada poll).
  useEffect(() => {
    const pendentes = entregas.filter((e) => PENDENTES.includes(e.status) && e.status !== 'EM_ROTA');
    const estouradas = new Set(
      pendentes
        .filter((e) => { const s = slaInfo(e.entrega && e.entrega.aceitoEm); return s && s.tier === 'estourou'; })
        .map((e) => String(e.id))
    );
    if (estouradasRef.current === null) { estouradasRef.current = estouradas; return; } // primeira carga: não bipa
    let novaEstourada = false;
    estouradas.forEach((id) => { if (!estouradasRef.current.has(id)) novaEstourada = true; });
    estouradasRef.current = estouradas;
    if (novaEstourada) tocarAlerta();
  }, [entregas]);

  const sair = () => { window.localStorage.removeItem(TKEY); setLogado(false); setDirecionadas([]); setDisponiveis([]); setEntregas([]); };

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
            {pushEstado === 'ativado' && (
              <span className="rounded-full p-2 text-[#A8B5A0]" title="Notificações ativas neste aparelho"><BellRing size={18} /></span>
            )}
            {pushEstado === 'desativado' && (
              <button onClick={ativarNotificacoes} className="relative rounded-full p-2 hover:bg-white/10" title="Ativar notificações">
                <Bell size={18} />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#B8935A]" />
              </button>
            )}
            <button onClick={() => carregar()} className="rounded-full p-2 hover:bg-white/10" title="Atualizar"><RefreshCw size={18} /></button>
            <button onClick={sair} className="rounded-full p-2 hover:bg-white/10" title="Sair"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {pushEstado === 'desativado' && (
          <div className="mb-4 rounded-xl border border-[#e6cf94] bg-[#fdf8ec] p-3">
            <div className="flex items-start gap-2">
              <Bell size={18} className="mt-0.5 shrink-0 text-[#9a6a1f]" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#9a6a1f]">Ative as notificações</div>
                <div className="text-[12.5px] text-[#6b685e]">Este aparelho vai avisar na hora que sair entrega nova — mesmo com o app fechado.</div>
              </div>
            </div>
            <button onClick={ativarNotificacoes} className="mt-2 w-full rounded-lg bg-[#B8935A] px-4 py-2.5 text-[13.5px] font-semibold text-[#16291f] hover:bg-[#a8824a]">
              Ativar notificações neste aparelho
            </button>
          </div>
        )}
        {pushEstado === 'ativando' && (
          <div className="mb-4 rounded-xl border border-[#e3ddcf] bg-white p-3 text-center text-[13px] text-[#6b685e]">Ativando notificações…</div>
        )}
        {pushEstado === 'ios-instalar' && (
          <div className="mb-4 rounded-xl border border-[#e6cf94] bg-[#fdf8ec] p-3">
            <div className="flex items-start gap-2">
              <Share size={18} className="mt-0.5 shrink-0 text-[#9a6a1f]" />
              <div className="text-[12.5px] text-[#6b685e]">
                <span className="font-semibold text-[#9a6a1f]">Para receber avisos de entrega no iPhone:</span> toque em <b>Compartilhar</b> no Safari e depois em <b>Adicionar à Tela de Início</b>. Abra o app por esse ícone e o botão de ativar notificações aparece aqui.
              </div>
            </div>
          </div>
        )}
        {pushEstado === 'negado' && (
          <div className="mb-4 rounded-xl border border-[#e3ddcf] bg-white p-3 text-[12.5px] text-[#6b685e]">
            As notificações estão <b>bloqueadas</b> para este app. Libere nos ajustes do aparelho (Notificações → Empório) e recarregue.
          </div>
        )}
        {pushEstado === 'erro-servidor' && (
          <div className="mb-4 rounded-xl border border-[#e7c9c4] bg-[#fbeeec] p-3 text-[12.5px] text-[#b23b3b]">
            O servidor ainda não está configurado para enviar notificações. Avise o administrador.
          </div>
        )}

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat n={direcionadas.length} label="Pra você" destaque />
          <Stat n={disponiveis.length} label="Disponíveis" />
          <Stat n={pendentes.length} label="Minhas" />
        </div>

        {erro && <div className="mb-3 rounded-lg border border-[#e7c9c4] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</div>}

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#8a8678]">Carregando…</div>
        ) : (
          <>
            {direcionadas.length > 0 && (
              <Secao titulo={`Direcionadas a você (${direcionadas.length})`}>
                {direcionadas.map((e) => <Card key={e.id} e={e} modo="direcionada" acao={acao} onAceitar={aceitar} />)}
              </Secao>
            )}
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
            {direcionadas.length === 0 && disponiveis.length === 0 && entregas.length === 0 && (
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
  const [aviso, setAviso] = useState(null);
  const [entrando, setEntrando] = useState(false);
  // Se caímos aqui por sessão vencida, mostra o aviso (uma vez) e limpa a flag.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('emporio_entregador_expirado') === '1') {
        window.sessionStorage.removeItem('emporio_entregador_expirado');
        setAviso('Sua sessão expirou. Entre novamente para continuar.');
      }
    } catch (_) {}
  }, []);
  const entrar = async () => {
    if (!email || !senha) return setErro('Informe e-mail e senha.');
    setErro(null); setAviso(null); setEntrando(true);
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
        {aviso && <div className="mb-3 rounded-lg border border-[#e6cf94] bg-[#fdf8ec] px-3 py-2 text-[13px] text-[#9a6a1f]">{aviso}</div>}
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
  const oferta = modo === 'disponivel' || modo === 'direcionada';
  const entregue = e.status === 'ENTREGUE';
  const emRota = e.status === 'EM_ROTA';
  const tag = modo === 'direcionada' ? 'Pra você' : modo === 'disponivel' ? 'Disponível' : entregue ? 'Entregue' : emRota ? 'Em rota' : 'Indo retirar';
  const tagCls = modo === 'direcionada' ? 'bg-[#fbe9d9] text-[#9a5b1f]' : modo === 'disponivel' ? 'bg-[#fbf1dd] text-[#8a6a1f]' : entregue ? 'bg-[#e6f0e9] text-[#2f6b48]' : emRota ? 'bg-[#e7eef9] text-[#365b9a]' : 'bg-[#eef1ec] text-[#5b6b5f]';
  const sla = (!oferta && !entregue && !emRota) ? slaInfo(e.entrega && e.entrega.aceitoEm) : null;
  const tier = sla ? sla.tier : null;
  const cartaoCls = tier === 'estourou' ? 'border-[#e0a3a0] bg-[#fdf3f2]' : tier === 'atencao' ? 'border-[#e6cf94] bg-[#fdf8ec]' : entregue ? 'border-[#cfe0d4] bg-white opacity-80' : 'border-[#e3ddcf] bg-white';
  const badgeCls = tier === 'estourou' ? 'bg-[#fbe3e0] text-[#b23b3b]' : tier === 'atencao' ? 'bg-[#fbf0d6] text-[#9a6a1f]' : 'bg-[#eef4ef] text-[#5b6b5f]';

  return (
    <div className={`rounded-xl border p-4 ${cartaoCls}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-[#1F3A2E]">{e.cliente?.nome || 'Cliente'}</div>
          <div className="text-[12px] text-[#8a8678]">Pedido {e.numero} · {e.loja?.nome || ''}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${tagCls}`}>{tag}</span>
          {sla && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>⏱ {sla.min} min</span>}
        </div>
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
          <a href={`https://www.waze.com/ul?q=${mapsQuery}&navigate=yes`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#e3ddcf] px-2.5 py-2 text-[11.5px] font-semibold text-[#33a7d8]" title="Abrir no Waze">Waze</a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#e3ddcf] px-2.5 py-2 text-[11.5px] font-semibold text-[#1F3A2E]" title="Abrir no Google Maps">Maps</a>
        </div>
      </div>

      {oferta ? (
        <div className="mt-3">
          <button onClick={() => onAceitar(e.id)} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1F3A2E] px-4 py-2.5 text-[14px] font-semibold text-[#F4F1EA] hover:bg-[#16291f] disabled:opacity-50">
            <Hand size={17} /> {ocupado ? 'Aceitando…' : 'Aceitar e ir retirar'}
          </button>
        </div>
      ) : emRota ? (
        <div className="mt-3">
          <button onClick={() => onStatus(e.id, 'ENTREGUE')} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2f6b48] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285c3e] disabled:opacity-50">
            <CheckCircle2 size={17} /> {ocupado ? 'Salvando…' : 'Confirmar entrega'}
          </button>
        </div>
      ) : !entregue ? (
        <div className={`mt-3 rounded-lg px-3 py-2 text-center text-[12.5px] ${tier === 'estourou' ? 'bg-[#fbe3e0] font-semibold text-[#b23b3b]' : tier === 'atencao' ? 'bg-[#fbf0d6] font-semibold text-[#9a6a1f]' : 'bg-[#f4f1ea] text-[#6b685e]'}`}>
          {tier === 'estourou'
            ? `Passou do tempo de retirada (${sla.min} min) — retire o quanto antes.`
            : tier === 'atencao'
            ? `Aceito há ${sla.min} min — vá retirar (limite de 15 min).`
            : 'Vá até a loja retirar — a saída é registrada pela expedição.'}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[#2f6b48]">
          <CheckCircle2 size={16} /> Entregue {e.entrega?.entregueEm ? `às ${hora(e.entrega.entregueEm)}` : ''}
        </div>
      )}
    </div>
  );
}
