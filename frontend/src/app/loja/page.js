'use client';

import Link from 'next/link';
import { ShoppingBag, PawPrint, Truck, Bell } from 'lucide-react';

export default function LojaPage() {
  return (
    <main className="min-h-screen bg-negrao-off-white-claro pb-24">
      {/* Header verde */}
      <header className="bg-negrao-verde-escuro safe-top">
        <div className="max-w-md mx-auto px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase">
                App do Cliente · v0.1
              </p>
              <h1 className="font-serif text-2xl text-negrao-off-white mt-1">
                Empório dos Animais
              </h1>
            </div>
            <Link
              href="/"
              className="text-xs text-negrao-verde-claro hover:text-negrao-off-white transition"
            >
              ← voltar
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="max-w-md mx-auto px-5 pt-8">
        {/* Saudação */}
        <section className="mb-8">
          <p className="text-xs tracking-[2px] text-negrao-dourado font-bold uppercase mb-2">
            Bem-vindo
          </p>
          <h2 className="font-serif text-3xl text-negrao-verde-escuro leading-tight">
            Tudo que seu pet precisa, na sua porta.
          </h2>
          <p className="text-sm text-negrao-grafite-claro mt-3 font-serif italic">
            Catálogo completo, frete calculado pelo seu CEP e acompanhamento da entrega em tempo real.
          </p>
        </section>

        {/* Cards de entrada */}
        <section className="space-y-3">
          <Link
            href="/loja/catalogo"
            className="block bg-white border border-negrao-borda rounded-xl p-5 hover:border-negrao-verde-escuro transition"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-negrao-dourado-suave rounded-lg flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6 text-negrao-dourado" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-negrao-verde-escuro">Catálogo</h3>
                <p className="text-xs text-negrao-grafite-claro">
                  Rações, medicamentos, brinquedos e mais
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/loja/pets"
            className="block bg-white border border-negrao-borda rounded-xl p-5 hover:border-negrao-verde-escuro transition"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-negrao-dourado-suave rounded-lg flex items-center justify-center shrink-0">
                <PawPrint className="w-6 h-6 text-negrao-dourado" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-negrao-verde-escuro">Meus pets</h3>
                <p className="text-xs text-negrao-grafite-claro">
                  Cadastre seus animais para recomendações certeiras
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/loja/pedidos"
            className="block bg-white border border-negrao-borda rounded-xl p-5 hover:border-negrao-verde-escuro transition"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-negrao-dourado-suave rounded-lg flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6 text-negrao-dourado" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-negrao-verde-escuro">Meus pedidos</h3>
                <p className="text-xs text-negrao-grafite-claro">
                  Acompanhe o status de cada entrega
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/loja/login"
            className="block bg-white border border-negrao-borda rounded-xl p-5 hover:border-negrao-verde-escuro transition"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-negrao-dourado-suave rounded-lg flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6 text-negrao-dourado" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-negrao-verde-escuro">Entrar / Cadastrar</h3>
                <p className="text-xs text-negrao-grafite-claro">
                  Use seu WhatsApp para começar
                </p>
              </div>
            </div>
          </Link>
        </section>

        {/* Aviso esqueleto */}
        <div className="mt-10 bg-negrao-dourado-suave border border-negrao-dourado rounded-xl p-4">
          <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase mb-1">
            Versão 0.1 (esqueleto)
          </p>
          <p className="text-xs text-negrao-verde-escuro font-serif">
            As telas internas serão implementadas conforme decisões da reunião. Catálogo, carrinho, checkout e pagamento online integram a Fase 2 do projeto.
          </p>
        </div>
      </div>
    </main>
  );
}
