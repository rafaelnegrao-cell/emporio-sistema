'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Users, Store, Map, BarChart3, Settings, LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';

const COLUNAS_KANBAN = [
  { status: 'RECEBIDO', titulo: 'Recebidos', cor: 'border-l-negrao-grafite-claro' },
  { status: 'ACEITO', titulo: 'Aceitos', cor: 'border-l-emporio-azul' },
  { status: 'EM_SEPARACAO', titulo: 'Em separação', cor: 'border-l-negrao-dourado' },
  { status: 'SEPARADO', titulo: 'Prontos para sair', cor: 'border-l-negrao-verde-medio' },
  { status: 'EM_ROTA', titulo: 'Em rota', cor: 'border-l-negrao-verde-escuro' }
];

export default function AdminPage() {
  const router = useRouter();
  const { token, usuario, logout } = useAuth();
  const [kanban, setKanban] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    api.get('/api/pedidos/kanban', { token })
      .then(setKanban)
      .catch(err => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token]);

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-negrao-off-white-claro flex">
      {/* Sidebar */}
      <aside className="w-64 bg-negrao-verde-escuro text-negrao-off-white flex flex-col">
        <div className="px-5 py-5 border-b border-negrao-verde-medio">
          <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase">
            Backoffice
          </p>
          <h1 className="font-serif text-xl mt-1">Empório dos Animais</h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <NavItem href="/admin" icon={Package} label="Pedidos" ativo />
          <NavItem href="/admin/produtos" icon={Store} label="Produtos" />
          <NavItem href="/admin/clientes" icon={Users} label="Clientes" />
          <NavItem href="/admin/zonas" icon={Map} label="Zonas de entrega" />
          <NavItem href="/admin/relatorios" icon={BarChart3} label="Relatórios" />
          <NavItem href="/admin/config" icon={Settings} label="Configurações" />
        </nav>

        <div className="px-3 py-4 border-t border-negrao-verde-medio">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-negrao-verde-claro hover:text-negrao-off-white transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-x-auto">
        <header className="px-8 py-6 border-b border-negrao-borda bg-white flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase">
              Operação · v0.1
            </p>
            <h2 className="font-serif text-2xl text-negrao-verde-escuro mt-1">
              Pedidos do dia
            </h2>
          </div>
          <div className="text-right text-xs text-negrao-grafite-claro">
            {usuario && (
              <p className="text-negrao-verde-escuro font-medium">{usuario.nome}</p>
            )}
            <p>
              {usuario?.papel}
              {usuario?.loja?.nome ? ` · ${usuario.loja.nome}` : ''}
            </p>
          </div>
        </header>

        {/* Kanban */}
        <div className="px-8 py-6">
          {carregando && (
            <p className="text-sm text-negrao-grafite-claro italic">Carregando...</p>
          )}

          {erro && (
            <div className="bg-negrao-dourado-suave border border-negrao-dourado rounded-lg p-4 mb-6 text-sm">
              <strong className="text-negrao-verde-escuro">Não foi possível carregar os pedidos.</strong>
              <span className="text-negrao-grafite ml-2">{erro}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 min-w-fit">
            {COLUNAS_KANBAN.map(col => (
              <ColunaKanban
                key={col.status}
                titulo={col.titulo}
                cor={col.cor}
                pedidos={kanban?.[col.status] || []}
              />
            ))}
          </div>

          <div className="mt-8 bg-white border border-negrao-borda rounded-xl p-5">
            <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase mb-2">
              Esqueleto v0.1
            </p>
            <p className="text-sm text-negrao-grafite font-serif">
              O Kanban acima é a base. Próximas evoluções: drag-and-drop entre colunas, detalhe do pedido em modal, filtros por loja e canal, alertas de SLA, e atalhos para imprimir romaneio.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon: Icon, label, ativo }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition',
        ativo
          ? 'bg-negrao-verde-medio text-negrao-off-white'
          : 'text-negrao-verde-claro hover:bg-negrao-verde-medio/40 hover:text-negrao-off-white'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

function ColunaKanban({ titulo, cor, pedidos }) {
  return (
    <div className="bg-white border border-negrao-borda rounded-xl overflow-hidden">
      <div className={cn('px-4 py-3 border-l-4 bg-negrao-off-white', cor)}>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-sm text-negrao-verde-escuro">{titulo}</h3>
          <span className="text-xs text-negrao-grafite-claro bg-white px-2 py-0.5 rounded-full">
            {pedidos.length}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-2 min-h-[300px]">
        {pedidos.length === 0 && (
          <p className="text-xs text-negrao-grafite-claro italic text-center py-6">
            Nenhum pedido
          </p>
        )}
        {pedidos.map(p => (
          <div
            key={p.id}
            className="bg-negrao-off-white border border-negrao-borda rounded-lg p-3 text-xs hover:border-negrao-dourado transition cursor-pointer"
          >
            <p className="font-bold text-negrao-verde-escuro">{p.numero}</p>
            <p className="text-negrao-grafite mt-1">{p.cliente?.nome}</p>
            <p className="text-negrao-grafite-claro mt-1 text-[10px]">
              {p.enderecoEntrega?.bairro} · {p.itens?.length || 0} itens
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
