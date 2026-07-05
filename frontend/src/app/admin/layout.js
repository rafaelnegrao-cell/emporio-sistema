// frontend/src/app/admin/layout.js
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { NOVIDADES, NOVIDADES_LS_KEY, formatarData, contarNaoVistas } from '../../lib/novidades';

const NAV = [
  { grp: 'Operação' },
  { href: '/admin', label: 'Dashboard', icon: 'grid' },
  { href: '/admin/pedidos', label: 'Pedidos', icon: 'list' },
  { href: '/admin/produtos', label: 'Produtos', icon: 'box' },
  { href: '/admin/clientes', label: 'Clientes', icon: 'users' },
  { href: '/admin/entregadores', label: 'Entregadores', icon: 'truck' },
  { href: '/admin/zonas', label: 'Zonas de entrega', icon: 'pin' },
  { grp: 'Gestão' },
  { href: '/admin/relatorios', label: 'Relatórios', icon: 'chart' },
  { href: '/admin/config', label: 'Configurações', icon: 'gear' },
];

const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M3 7h18M3 12h18M3 17h12',
  box: 'M20 7l-8-4-8 4 8 4 8-4zM4 7v10l8 4 8-4V7M12 11v10',
  users: 'M12 8a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  truck: 'M1 6h14v11H1zM15 9h4l3 3v5h-7zM5.5 20a2 2 0 100-4 2 2 0 000 4zM18.5 20a2 2 0 100-4 2 2 0 000 4z',
  pin: 'M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  chart: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-7',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a7 7 0 000-2l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1L13 3h-2l-.3 3a7 7 0 00-1.7 1l-2.4-1-2 3.5L6.6 11a7 7 0 000 2l-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1L11 21h2l.3-3a7 7 0 001.7-1l2.4 1 2-3.5z',
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px] shrink-0">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function AdminLayout({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [liberado, setLiberado] = useState(false);

  // Guard de sessão: sem token salvo no login, manda pro /login.
  useEffect(() => {
    const t = typeof window !== 'undefined' && window.localStorage.getItem('emporio_token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setLiberado(true);
  }, [router]);

  function sair() {
    if (typeof window !== 'undefined') window.localStorage.removeItem('emporio_token');
    router.replace('/login');
  }

  if (!liberado) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F1EA] text-[#1F3A2E]">
        <div className="text-sm">Verificando acesso…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F4F1EA] text-[#2B2B2B]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col bg-gradient-to-b from-[#1F3A2E] to-[#16291f] text-[#A8B5A0] md:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          {/* troque por <img src="/logo-branco.png" .../> quando subir o asset */}
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#B8935A] font-serif text-sm font-bold text-[#16291f]">RN</div>
          <div className="leading-tight">
            <div className="font-serif text-[15px] font-bold text-white">Empório</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#B8935A]">Backoffice</div>
          </div>
        </div>
        <nav className="flex-1 overflow-auto p-3">
          {NAV.map((it, i) =>
            it.grp ? (
              <div key={i} className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-[#A8B5A0]/50">
                {it.grp}
              </div>
            ) : (
              <Link
                key={it.href}
                href={it.href}
                className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
                  path === it.href
                    ? 'bg-[#B8935A] font-semibold text-[#16291f]'
                    : 'text-[#A8B5A0] hover:bg-white/[.06] hover:text-white'
                }`}
              >
                <Icon name={it.icon} />
                {it.label}
              </Link>
            )
          )}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-[12px]">
          <b className="block text-[13px] text-white">Rafael Negrão</b>
          <span className="text-[#A8B5A0]">Administrador</span>
          <button
            onClick={sair}
            className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-[#B8935A] hover:text-white"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>

      {/* Central de Novidades — sino fixo no topo direito da viewport */}
      <SinoNovidades />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Central de Novidades
// - Sino fixo no canto superior direito (fora do fluxo, não empurra layout).
// - Badge vermelho com quantidade de releases ainda não vistos.
// - Painel renderizado via createPortal(document.body) para não herdar
//   CSS de contêineres pais (mesma solução que usamos no Paula Negrão).
// ─────────────────────────────────────────────────────────────

const TIPO_ESTILO = {
  NOVIDADE: { fundo: '#fbf3e6', texto: '#8a6a1f', borda: '#e8d9b3', label: 'Novidade' },
  MELHORIA: { fundo: '#e6f0e9', texto: '#2f6b48', borda: '#c9decf', label: 'Melhoria' },
  CORRECAO: { fundo: '#fdf3f2', texto: '#b23b3b', borda: '#e7c9c4', label: 'Correção' },
};

function SinoNovidades() {
  const [aberto, setAberto] = useState(false);
  const [naoVistas, setNaoVistas] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const dataVista = localStorage.getItem(NOVIDADES_LS_KEY);
      setNaoVistas(contarNaoVistas(dataVista));
    } catch (_) {
      setNaoVistas(0);
    }
  }, []);

  // Fechar com ESC quando o painel está aberto.
  useEffect(() => {
    if (!aberto) return;
    function onKey(e) { if (e.key === 'Escape') setAberto(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  function abrir() {
    setAberto(true);
    setNaoVistas(0);
    try {
      if (NOVIDADES.length > 0) localStorage.setItem(NOVIDADES_LS_KEY, NOVIDADES[0].data);
    } catch (_) {}
  }

  const totalRecursos = NOVIDADES.reduce((soma, v) => soma + (v.itens ? v.itens.length : 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Central de novidades${naoVistas > 0 ? ` (${naoVistas} sem ler)` : ''}`}
        className="fixed right-4 top-4 z-40 grid h-10 w-10 place-items-center rounded-full border border-[#e3ddcf] bg-[#FBF9F4] text-[#8a6a1f] shadow-sm transition hover:border-[#B8935A] hover:text-[#B8935A]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[19px] w-[19px]">
          <path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10.3 21a1.94 1.94 0 003.4 0" />
        </svg>
        {naoVistas > 0 && (
          <span
            className="absolute -right-1 -top-1 grid min-w-[18px] h-[18px] px-[5px] place-items-center rounded-full bg-[#b23b3b] text-[10px] font-bold text-white leading-none"
            aria-hidden="true"
          >
            {naoVistas}
          </span>
        )}
      </button>

      {mounted && aberto && createPortal(
        <PainelNovidades onFechar={() => setAberto(false)} totalRecursos={totalRecursos} />,
        document.body
      )}
    </>
  );
}

function PainelNovidades({ onFechar, totalRecursos }) {
  return (
    <div
      className="fixed inset-0 z-50"
      style={{ textTransform: 'none' }}
      onClick={onFechar}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* painel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-4 top-16 w-[min(400px,calc(100vw-32px))] max-h-[min(560px,calc(100vh-96px))] overflow-hidden rounded-2xl border border-[#e3ddcf] bg-white shadow-2xl"
        style={{ textTransform: 'none' }}
      >
        {/* cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-[#f0ece0] px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#B8935A]">Empório · Backoffice</div>
            <h2 className="mt-1 font-serif text-[19px] font-bold text-[#1F3A2E]">Central de novidades</h2>
            <p className="mt-0.5 text-[12px] text-[#8a8678]">
              Atualizações e correções do sistema{totalRecursos > 0 ? ` · ${totalRecursos} ${totalRecursos === 1 ? 'item registrado' : 'itens registrados'}` : ''}.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#6b685e] hover:bg-[#f4f1ea] hover:text-[#1F3A2E]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* corpo */}
        <div className="max-h-[calc(min(560px,100vh-96px)-96px)] overflow-y-auto px-5 py-3">
          {NOVIDADES.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[#8a8678]">
              Nenhuma novidade registrada ainda.
            </div>
          ) : (
            NOVIDADES.map((v, i) => <GrupoVersao key={v.versao + v.data} versao={v} primeiro={i === 0} />)
          )}
        </div>
      </div>
    </div>
  );
}

function GrupoVersao({ versao, primeiro }) {
  return (
    <section className={`${primeiro ? 'pt-1' : 'pt-4 mt-4 border-t border-[#f0ece0]'} pb-1`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="font-serif text-[14px] font-bold text-[#1F3A2E]">
          {formatarData(versao.data)}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B8935A]">
          {versao.versao}
        </span>
      </div>
      <ul className="space-y-2">
        {versao.itens.map((it, idx) => <Item key={idx} item={it} />)}
      </ul>
    </section>
  );
}

function Item({ item }) {
  const est = TIPO_ESTILO[item.tipo] || TIPO_ESTILO.MELHORIA;
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-[#f0ece0] bg-[#fbf9f4] px-3 py-2.5">
      <span
        className="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: est.fundo, color: est.texto, borderColor: est.borda }}
      >
        {est.label}
      </span>
      <p className="text-[13px] leading-snug text-[#2B2B2B]">{item.texto}</p>
    </li>
  );
}
