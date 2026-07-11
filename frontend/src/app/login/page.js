'use client';

// Tela de login do backoffice — versão autossuficiente.
// Não depende de AuthProvider/useAuth nem de imports do lib/, então:
//  - não estoura na pré-renderização do build;
//  - funciona em qualquer pasta (inclusive dentro de um grupo como (auth)).
// Faz POST no backend, guarda o JWT em localStorage('emporio_token') e vai pro /admin.
// (O api.js lê esse mesmo token automaticamente nas chamadas seguintes.)
//
// Sessão expirada: quando o api.js detecta token vencido, ele grava a flag
// 'emporio_sessao_expirada' e redireciona pra cá — mostramos um aviso âmbar
// explicando o motivo, em vez de a pessoa cair no login sem entender por quê.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [carregando, setCarregando] = useState(false);

  // Se chegamos aqui por sessão vencida, mostra o aviso (uma vez) e limpa a flag.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('emporio_sessao_expirada') === '1') {
        window.sessionStorage.removeItem('emporio_sessao_expirada');
        setAviso('Sua sessão expirou. Entre novamente para continuar.');
      }
    } catch (_) {}
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setCarregando(true);
    try {
      const res = await fetch(`${API}/api/auth/operador/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!res.ok) {
        let msg = 'E-mail ou senha inválidos.';
        try {
          const j = await res.json();
          msg = j.erro || j.message || msg;
        } catch (_) {}
        throw new Error(msg);
      }
      const data = await res.json();
      const token = data.token || data.accessToken || (data.dados && data.dados.token);
      if (token && typeof window !== 'undefined') {
        window.localStorage.setItem('emporio_token', token);
      }
      router.push('/admin');
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-negrao-off-white-claro flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        {/* Cabeçalho da marca */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 border-2 border-negrao-verde-escuro items-center justify-center mb-4">
            <span className="font-serif text-2xl text-negrao-verde-escuro leading-none">RN</span>
          </div>
          <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase">
            Backoffice · Empório dos Animais
          </p>
          <h1 className="font-serif text-2xl text-negrao-verde-escuro mt-1">Acesso restrito</h1>
        </div>

        {/* Aviso de sessão expirada (chega aqui via api.js) */}
        {aviso && (
          <p className="mb-4 text-sm text-[#9a6a1f] bg-[#fdf8ec] border border-[#e6cf94] rounded-lg px-3 py-2">
            {aviso}
          </p>
        )}

        {/* Formulário */}
        <form
          onSubmit={entrar}
          className="bg-white border border-negrao-borda rounded-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-negrao-grafite-claro mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="w-full border border-negrao-borda rounded-lg px-3 py-2.5 text-sm text-negrao-grafite outline-none focus:border-negrao-verde-escuro"
              placeholder="voce@emporio.com"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-negrao-grafite-claro mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-negrao-borda rounded-lg px-3 py-2.5 text-sm text-negrao-grafite outline-none focus:border-negrao-verde-escuro"
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-negrao-verde-escuro text-negrao-off-white rounded-lg py-3 text-sm font-bold uppercase tracking-wider hover:bg-negrao-verde-medio transition disabled:opacity-60"
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase mt-6">
          Negrão · Diagnóstico &amp; Soluções Empresariais
        </p>
      </div>
    </main>
  );
}

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setCarregando(true);
    try {
      const res = await fetch(`${API}/api/auth/operador/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!res.ok) {
        let msg = 'E-mail ou senha inválidos.';
        try {
          const j = await res.json();
          msg = j.erro || j.message || msg;
        } catch (_) {}
        throw new Error(msg);
      }
      const data = await res.json();
      const token = data.token || data.accessToken || (data.dados && data.dados.token);
      if (token && typeof window !== 'undefined') {
        window.localStorage.setItem('emporio_token', token);
      }
      router.push('/admin');
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-negrao-off-white-claro flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        {/* Cabeçalho da marca */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 border-2 border-negrao-verde-escuro items-center justify-center mb-4">
            <span className="font-serif text-2xl text-negrao-verde-escuro leading-none">RN</span>
          </div>
          <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase">
            Backoffice · Empório dos Animais
          </p>
          <h1 className="font-serif text-2xl text-negrao-verde-escuro mt-1">Acesso restrito</h1>
        </div>

        {/* Aviso de sessão expirada (chega aqui via api.js) */}
        {aviso && (
          <p className="mb-4 text-sm text-[#9a6a1f] bg-[#fdf8ec] border border-[#e6cf94] rounded-lg px-3 py-2">
            {aviso}
          </p>
        )}

        {/* Formulário */}
        <form
          onSubmit={entrar}
          className="bg-white border border-negrao-borda rounded-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-negrao-grafite-claro mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="w-full border border-negrao-borda rounded-lg px-3 py-2.5 text-sm text-negrao-grafite outline-none focus:border-negrao-verde-escuro"
              placeholder="voce@emporio.com"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-negrao-grafite-claro mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-negrao-borda rounded-lg px-3 py-2.5 text-sm text-negrao-grafite outline-none focus:border-negrao-verde-escuro"
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-negrao-verde-escuro text-negrao-off-white rounded-lg py-3 text-sm font-bold uppercase tracking-wider hover:bg-negrao-verde-medio transition disabled:opacity-60"
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase mt-6">
          Negrão · Diagnóstico &amp; Soluções Empresariais
        </p>
      </div>
    </main>
  );
}
