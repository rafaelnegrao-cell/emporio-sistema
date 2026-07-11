// frontend/src/app/avaliar/page.js
// Página PÚBLICA de avaliação pós-entrega (NPS) — o cliente chega aqui pelo
// link enviado no WhatsApp: https://<site>/avaliar?t=TOKEN
// Sem login. O token identifica o pedido; um pedido só pode ser avaliado uma vez.
'use client';

import { useEffect, useState } from 'react';

const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) { let m = `Erro ${res.status}`; try { const j = await res.json(); m = j.erro || m; } catch (_) {} const e = new Error(m); e.status = res.status; throw e; }
  return res.json();
}

export default function AvaliarPage() {
  const [token, setToken] = useState(null);
  const [info, setInfo] = useState(null);       // dados do pedido
  const [erro, setErro] = useState(null);
  const [nota, setNota] = useState(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Lê o token da URL no cliente (evita depender de useSearchParams/Suspense).
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('t');
      if (!t) { setErro('Link inválido — o endereço está incompleto.'); return; }
      setToken(t);
    } catch (_) { setErro('Link inválido.'); }
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await req(`/api/avaliacoes/${token}`);
        setInfo(r);
        if (r.jaAvaliado) setEnviado(true);
      } catch (e) { setErro(e.message); }
    })();
  }, [token]);

  const enviar = async () => {
    if (nota == null) return;
    setEnviando(true); setErro(null);
    try {
      await req(`/api/avaliacoes/${token}`, { method: 'POST', body: { notaGeral: nota, comentario } });
      setEnviado(true);
    } catch (e) {
      if (e.status === 409) setEnviado(true);
      else setErro(e.message);
    } finally { setEnviando(false); }
  };

  const corNota = (n) => (n <= 6 ? '#b23b3b' : n <= 8 ? '#9a6a1f' : '#2f6b48');

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#F4F1EA] px-5 py-10 text-[#2B2B2B]">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1F3A2E] font-serif text-[17px] font-bold text-[#B8935A]">RN</div>
          <div className="mt-2 text-[10.5px] font-bold uppercase tracking-[2px] text-[#B8935A]">Empório dos Animais</div>
          <h1 className="mt-1 font-serif text-[24px] font-bold leading-tight text-[#1F3A2E]">Como foi a sua entrega?</h1>
        </div>

        <div className="mt-5 rounded-2xl border border-[#e3ddcf] bg-white p-5 shadow-sm">
          {erro && !info ? (
            <p className="text-center text-[14px] text-[#b23b3b]">{erro}</p>
          ) : !info ? (
            <p className="text-center text-[14px] text-[#8a8678]">Carregando…</p>
          ) : enviado ? (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e6f0e9] text-[26px]">🐾</div>
              <h2 className="mt-3 font-serif text-[19px] font-bold text-[#1F3A2E]">Obrigado{info.cliente ? `, ${info.cliente}` : ''}!</h2>
              <p className="mt-1 text-[13.5px] text-[#6b685e]">
                {info.jaAvaliado && nota == null
                  ? 'Este pedido já foi avaliado. Sua opinião está registrada com a gente.'
                  : 'Sua avaliação foi registrada e ajuda a gente a cuidar cada vez melhor de você e do seu pet.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13.5px] text-[#6b685e]">
                {info.cliente ? `${info.cliente}, seu` : 'Seu'} pedido <b>#{info.numero}</b>{info.loja ? ` (${info.loja})` : ''} foi entregue.
                De <b>0 a 10</b>, o quanto você recomendaria o Empório dos Animais?
              </p>
              <div className="mt-4 grid grid-cols-6 gap-1.5">
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    onClick={() => setNota(n)}
                    className="rounded-lg border py-2.5 text-[14px] font-bold transition"
                    style={nota === n
                      ? { background: corNota(n), borderColor: corNota(n), color: '#fff' }
                      : { background: '#FBF9F4', borderColor: '#e3ddcf', color: '#5a5750' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10.5px] text-[#9a9483]">
                <span>Não recomendaria</span><span>Recomendaria com certeza</span>
              </div>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Quer contar como foi? (opcional)"
                className="mt-4 w-full resize-y rounded-lg border border-[#e3ddcf] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#B8935A]"
              />
              {erro && <p className="mt-2 rounded-lg border border-[#e7c9c4] bg-[#fbeeec] px-3 py-2 text-[13px] text-[#b23b3b]">{erro}</p>}
              <button
                onClick={enviar}
                disabled={nota == null || enviando}
                className="mt-3 w-full rounded-lg bg-[#B8935A] px-4 py-3 text-[15px] font-bold text-[#16291f] hover:bg-[#a8824a] disabled:opacity-40"
              >
                {enviando ? 'Enviando…' : nota == null ? 'Escolha uma nota de 0 a 10' : 'Enviar avaliação'}
              </button>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[10.5px] text-[#a9a596]">Empório dos Animais · sistema por RN Negrão</p>
      </div>
    </div>
  );
}
