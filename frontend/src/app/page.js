import Link from 'next/link';
import { Store, Truck, ShoppingBag } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-negrao-off-white-claro">
      {/* Header institucional */}
      <header className="bg-negrao-verde-escuro border-b-2 border-negrao-dourado">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          <div className="text-right">
            <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase">
              Preparado para
            </p>
            <p className="font-serif text-negrao-off-white">Empório dos Animais</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <p className="text-xs tracking-[3px] text-negrao-dourado font-bold uppercase mb-3">
          Sistema de Delivery
        </p>
        <h1 className="font-serif text-4xl md:text-5xl text-negrao-verde-escuro mb-4">
          Empório dos Animais
        </h1>
        <p className="text-negrao-grafite-claro max-w-2xl mx-auto font-serif italic">
          Plataforma integrada para gestão do delivery das três lojas da rede, painel do entregador e app do cliente final.
        </p>
      </section>

      {/* Três áreas */}
      <section className="max-w-6xl mx-auto px-6 pb-16 grid md:grid-cols-3 gap-6">
        <Link
          href="/loja"
          className="group bg-white border border-negrao-borda rounded-xl p-8 hover:border-negrao-verde-escuro transition-all hover:shadow-lg"
        >
          <div className="w-12 h-12 bg-negrao-verde-escuro rounded-lg flex items-center justify-center mb-5 group-hover:bg-negrao-verde-medio transition">
            <ShoppingBag className="w-6 h-6 text-negrao-off-white" />
          </div>
          <h2 className="font-serif text-2xl text-negrao-verde-escuro mb-2">App do Cliente</h2>
          <p className="text-sm text-negrao-grafite-claro mb-4">
            Catálogo de produtos, carrinho, acompanhamento de pedido e perfil do pet.
          </p>
          <span className="text-xs uppercase tracking-wider text-negrao-dourado font-bold">
            Acessar →
          </span>
        </Link>

        <Link
          href="/admin"
          className="group bg-white border border-negrao-borda rounded-xl p-8 hover:border-negrao-verde-escuro transition-all hover:shadow-lg"
        >
          <div className="w-12 h-12 bg-negrao-verde-escuro rounded-lg flex items-center justify-center mb-5 group-hover:bg-negrao-verde-medio transition">
            <Store className="w-6 h-6 text-negrao-off-white" />
          </div>
          <h2 className="font-serif text-2xl text-negrao-verde-escuro mb-2">Backoffice</h2>
          <p className="text-sm text-negrao-grafite-claro mb-4">
            Kanban de pedidos, cadastros, estoque por loja, zonas de entrega e indicadores.
          </p>
          <span className="text-xs uppercase tracking-wider text-negrao-dourado font-bold">
            Acessar →
          </span>
        </Link>

        <Link
          href="/entregador"
          className="group bg-white border border-negrao-borda rounded-xl p-8 hover:border-negrao-verde-escuro transition-all hover:shadow-lg"
        >
          <div className="w-12 h-12 bg-negrao-verde-escuro rounded-lg flex items-center justify-center mb-5 group-hover:bg-negrao-verde-medio transition">
            <Truck className="w-6 h-6 text-negrao-off-white" />
          </div>
          <h2 className="font-serif text-2xl text-negrao-verde-escuro mb-2">Painel do Entregador</h2>
          <p className="text-sm text-negrao-grafite-claro mb-4">
            Rota do dia, confirmação de entrega com foto e atualização de status em tempo real.
          </p>
          <span className="text-xs uppercase tracking-wider text-negrao-dourado font-bold">
            Acessar →
          </span>
        </Link>
      </section>

      {/* Status do esqueleto */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-negrao-dourado-suave border border-negrao-dourado rounded-xl p-6">
          <p className="text-xs tracking-[2px] text-negrao-dourado font-bold uppercase mb-2">
            Versão atual: 0.1 (esqueleto)
          </p>
          <p className="text-negrao-verde-escuro font-serif">
            Estrutura básica pronta. Telas funcionais e integrações chegam progressivamente conforme decisões da reunião.
          </p>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-negrao-borda py-6 mt-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-negrao-grafite-claro">
          <p className="font-serif tracking-wider">
            <strong className="text-negrao-verde-escuro">NEGRÃO</strong>
            <span className="text-negrao-dourado mx-3">·</span>
            DIAGNÓSTICO &amp; SOLUÇÕES EMPRESARIAIS
          </p>
          <p className="text-negrao-dourado uppercase tracking-[2px] mt-2 text-[10px] font-bold">
            Preparado exclusivamente para Empório dos Animais
          </p>
        </div>
      </footer>
    </main>
  );
}
