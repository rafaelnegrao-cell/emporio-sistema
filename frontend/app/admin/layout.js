// frontend/src/app/admin/layout.js
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    </div>
  );
}
