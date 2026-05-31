'use client';

import Link from 'next/link';
import { MapPin, Phone, Package, CheckCircle2, Clock } from 'lucide-react';

// Dados mock — em produção virão de GET /api/pedidos?status=EM_ROTA com entregadorId do JWT
const ENTREGAS_DEMO = [
  {
    id: '1',
    numero: 'PED-2026-00001',
    cliente: 'Mariana Costa',
    telefone: '(43) 99999-1111',
    endereco: 'Rua das Flores, 100 — Centro',
    cidade: 'Londrina/PR',
    itens: 2,
    valor: 449.80,
    janela: 'até 16h',
    status: 'pendente'
  },
  {
    id: '2',
    numero: 'PED-2026-00002',
    cliente: 'Carlos Eduardo Silva',
    telefone: '(43) 99999-2222',
    endereco: 'Av. Higienópolis, 500 — Gleba Palhano',
    cidade: 'Londrina/PR',
    itens: 1,
    valor: 159.90,
    janela: 'até 17h',
    status: 'pendente'
  },
  {
    id: '3',
    numero: 'PED-2025-00098',
    cliente: 'Patrícia Mendes',
    telefone: '(43) 99999-3333',
    endereco: 'Rua das Acácias, 250 — Jd. Brasil',
    cidade: 'Cambé/PR',
    itens: 3,
    valor: 287.70,
    janela: 'entregue 14:32',
    status: 'entregue'
  }
];

export default function EntregadorPage() {
  const pendentes = ENTREGAS_DEMO.filter(e => e.status === 'pendente');
  const concluidas = ENTREGAS_DEMO.filter(e => e.status === 'entregue');

  return (
    <main className="min-h-screen bg-negrao-off-white-claro pb-20">
      {/* Header */}
      <header className="bg-negrao-verde-escuro safe-top">
        <div className="max-w-md mx-auto px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase">
                Painel do Entregador · v0.1
              </p>
              <h1 className="font-serif text-2xl text-negrao-off-white mt-1">
                Olá, João!
              </h1>
              <p className="text-xs text-negrao-verde-claro mt-1">
                Av. Maringá · Turno tarde
              </p>
            </div>
            <Link href="/" className="text-xs text-negrao-verde-claro">
              ← voltar
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 pt-6">
        {/* Resumo do dia */}
        <section className="grid grid-cols-3 gap-3 mb-6">
          <Estatistica numero={pendentes.length} label="Pendentes" />
          <Estatistica numero={concluidas.length} label="Concluídas" />
          <Estatistica numero={ENTREGAS_DEMO.length} label="Total dia" />
        </section>

        {/* Entregas pendentes */}
        {pendentes.length > 0 && (
          <section className="mb-6">
            <h2 className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase mb-3 px-1">
              Próximas entregas
            </h2>
            <div className="space-y-3">
              {pendentes.map(e => (
                <CardEntrega key={e.id} entrega={e} />
              ))}
            </div>
          </section>
        )}

        {/* Concluídas */}
        {concluidas.length > 0 && (
          <section className="mb-6">
            <h2 className="text-[10px] tracking-[2px] text-negrao-grafite-claro font-bold uppercase mb-3 px-1">
              Já entregue hoje
            </h2>
            <div className="space-y-3">
              {concluidas.map(e => (
                <CardEntrega key={e.id} entrega={e} />
              ))}
            </div>
          </section>
        )}

        {/* Aviso esqueleto */}
        <div className="bg-negrao-dourado-suave border border-negrao-dourado rounded-xl p-4">
          <p className="text-[10px] tracking-[2px] text-negrao-dourado font-bold uppercase mb-1">
            Versão 0.1 (esqueleto)
          </p>
          <p className="text-xs text-negrao-verde-escuro font-serif">
            Dados de exemplo. Próximas evoluções: rota otimizada no Google Maps, captura de foto de comprovante, registro de problemas, modo offline.
          </p>
        </div>
      </div>
    </main>
  );
}

function Estatistica({ numero, label }) {
  return (
    <div className="bg-white border border-negrao-borda rounded-xl p-3 text-center">
      <p className="font-serif text-2xl text-negrao-verde-escuro leading-none">{numero}</p>
      <p className="text-[10px] text-negrao-grafite-claro uppercase tracking-wider mt-1">
        {label}
      </p>
    </div>
  );
}

function CardEntrega({ entrega }) {
  const pendente = entrega.status === 'pendente';
  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${pendente ? 'border-negrao-borda' : 'border-negrao-borda opacity-70'}`}>
      <div className={`px-4 py-3 flex items-center justify-between border-b ${pendente ? 'border-negrao-borda bg-negrao-off-white' : 'border-negrao-borda bg-negrao-off-white'}`}>
        <div>
          <p className="text-xs font-bold text-negrao-verde-escuro">{entrega.numero}</p>
          <p className="text-[10px] text-negrao-grafite-claro mt-0.5">{entrega.cliente}</p>
        </div>
        <div className="text-right">
          {pendente ? (
            <div className="flex items-center gap-1 text-xs text-negrao-dourado font-bold">
              <Clock className="w-3 h-3" /> {entrega.janela}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-negrao-verde-medio font-bold">
              <CheckCircle2 className="w-3 h-3" /> {entrega.janela}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-2 text-xs text-negrao-grafite">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-negrao-dourado shrink-0 mt-0.5" />
          <div>
            <p>{entrega.endereco}</p>
            <p className="text-negrao-grafite-claro text-[10px]">{entrega.cidade}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-negrao-dourado shrink-0" />
          <p>{entrega.itens} {entrega.itens === 1 ? 'item' : 'itens'} · R$ {entrega.valor.toFixed(2).replace('.', ',')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-negrao-dourado shrink-0" />
          <a href={`tel:${entrega.telefone}`} className="text-negrao-verde-escuro font-bold">
            {entrega.telefone}
          </a>
        </div>
      </div>

      {pendente && (
        <div className="border-t border-negrao-borda p-3 grid grid-cols-2 gap-2">
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(entrega.endereco + ' ' + entrega.cidade)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 border border-negrao-verde-escuro text-negrao-verde-escuro rounded-lg text-xs font-bold text-center hover:bg-negrao-off-white transition"
          >
            Abrir no Maps
          </a>
          <button
            className="px-3 py-2 bg-negrao-verde-escuro text-negrao-off-white rounded-lg text-xs font-bold hover:bg-negrao-verde-medio transition"
            onClick={() => alert('Confirmar entrega — fluxo a implementar')}
          >
            Confirmar entrega
          </button>
        </div>
      )}
    </div>
  );
}
