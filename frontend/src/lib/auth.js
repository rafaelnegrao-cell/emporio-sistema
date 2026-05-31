'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      router.replace('/admin');
    } catch (err) {
      setErro(err?.message || 'Não foi possível entrar. Verifique e-mail e senha.');
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-negrao-off-white-claro flex flex-col">
      {/* Header institucional */}
      <header className="bg-negrao-verde-escuro border-b-2 border-negrao-dourado">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-negrao-verde-claro flex items-center justify-center">
            <span className="text-negrao-off-white font-serif text-lg leading-none">RN</span>
          </div>
          <div className="flex flex-col text-negrao-off-white">
            <span className="text-[10px] tracking-[2px] text-negrao-verde-claro font-medium uppercase">
              Diagnóstico Empresarial
            </span>
            <span className="font-serif text-lg leading-tight">NEGRÃO</span>
          </div>
        </div>
      </header>

      {/* Card de login */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-[3px] text-negrao-dourado font-bold uppercase mb-2">
              Backoffice
            </p>
            <h1 className="font-serif text-3xl text-negrao-verde-escuro">
              Empório dos Animais
            </h1>
            <p className="text-negrao-grafite-claro text-sm mt-2 font-serif italic">
              Acesso restrito à equipe
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white border border-negrao-borda rounded-xl p-8 space-y-5"
          >
            {erro && (
              <div className="bg-negrao-off-white border border-emporio-coral rounded-lg px-4 py-3 text-sm text-emporio-coral">
                {erro}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-negrao-grafite-claro mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 border border-negrao-borda rounded-lg text-sm text-negrao-grafite placeholder:text-negrao-grafite-claro/60 focus:outline-none focus:border-negrao-dourado focus:ring-1 focus:ring-negrao-dourado transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-negrao-grafite-claro mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-negrao-borda rounded-lg text-sm text-negrao-grafite placeholder:text-negrao-grafite-claro/60 focus:outline-none focus:border-negrao-dourado focus:ring-1 focus:ring-negrao-dourado transition"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-negrao-verde-escuro text-negrao-off-white font-medium py-2.5 rounded-lg hover:bg-negrao-verde-medio transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {enviando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-negrao-grafite-claro mt-6">
            <a href="/" className="hover:text-negrao-dourado transition">
              ← Voltar ao início
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
