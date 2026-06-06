// frontend/src/app/admin/page.js
// Dashboard do backoffice (placeholder enxuto, só para a rota /admin compilar).
// A sidebar e o topo vêm do admin/layout.js. Desenvolvemos esta tela de verdade depois.

import Link from 'next/link';

const ATALHOS = [
  { href: '/admin/produtos', titulo: 'Produtos', desc: 'Catálogo, preços, margens e estoque' },
  { href: '/admin/clientes', titulo: 'Clientes', desc: 'Base, pets, histórico e importação' },
  { href: '/admin/pedidos', titulo: 'Pedidos', desc: 'Fila de pedidos do delivery (Kanban)' },
];

export default function AdminDashboard() {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3ddcf] bg-white px-7 py-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8a8678]">Visão geral</div>
          <h1 className="font-serif text-[22px] font-bold text-[#1F3A2E]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#e3ddcf] bg-[#F4F1EA] px-3 py-1.5 text-[13px] font-semibold text-[#1F3A2E]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#3f7d5b]" />Av. Maringá
        </div>
      </div>

      <div className="flex-1 px-7 pb-16 pt-6">
        <p className="mb-6 max-w-2xl text-[14.5px] text-[#5a5750]">
          Painel de operação do delivery do Empório dos Animais. Acesse as áreas pelos atalhos abaixo
          ou pelo menu lateral.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ATALHOS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-xl border border-[#e3ddcf] bg-white p-5 transition hover:-translate-y-px hover:border-[#B8935A]"
            >
              <div className="font-serif text-[18px] font-bold text-[#1F3A2E]">{a.titulo}</div>
              <div className="mt-1 text-[13px] text-[#6b6657]">{a.desc}</div>
              <div className="mt-3 text-[13px] font-semibold text-[#B8935A]">Abrir →</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
