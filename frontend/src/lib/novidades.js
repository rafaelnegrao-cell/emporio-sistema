// frontend/src/lib/novidades.js
// Registro de novidades do sistema — mostrado na Central de Novidades (sino no admin).
//
// COMO ADICIONAR UM RELEASE:
// 1. Coloque o item mais recente no TOPO do array (ordem descendente por data).
// 2. Data no formato "YYYY-MM-DD" (é convertida para "05 de julho de 2026" na tela).
// 3. Tipo de cada item:
//      'NOVIDADE'  → funcionalidade nova (badge dourado)
//      'MELHORIA'  → algo já existente ficou melhor (badge verde)
//      'CORRECAO'  → bug corrigido (badge âmbar/vermelho suave)
// 4. Quando um release novo entra no ar, o sino mostra um badge vermelho com a
//    contagem de releases ainda não vistos. O badge zera assim que o usuário
//    abre a Central (a data da versão mais recente é gravada em localStorage).

export const NOVIDADES = [
  {
    versao: 'v0.12.0',
    data: '2026-07-11',
    itens: [
      { tipo: 'NOVIDADE', texto: 'Notificações no celular do entregador: ao separar um pedido (oferta aberta) ou direcionar a alguém, o aparelho avisa na hora — mesmo com o app fechado. Cada entregador ativa no próprio app pelo botão "Ativar notificações".' },
      { tipo: 'NOVIDADE', texto: 'Alerta sonoro e vibração no app do entregador quando uma retirada passa dos 15 minutos (SLA), com o app aberto.' },
      { tipo: 'NOVIDADE', texto: 'Botão "Reenviar aviso aos entregadores" no cartão do pedido em Separado (oferta aberta): reenvia a notificação quando ninguém aceitou, e mostra a quantos aparelhos o aviso chegou.' },
      { tipo: 'NOVIDADE', texto: 'Aviso ao cliente pelo WhatsApp: no painel do pedido (e no cartão Em rota), um botão abre a conversa com a mensagem pronta para o status atual — "saiu para entrega", "pedido recebido", "entregue" — é só revisar e enviar.' },
      { tipo: 'MELHORIA', texto: 'No iPhone, o app orienta a adicionar o atalho à Tela de Início quando necessário para receber os avisos.' },
    ],
  },
  {
    versao: 'v0.11.0',
    data: '2026-07-05',
    itens: [
      { tipo: 'NOVIDADE', texto: 'Central de Novidades: este sino agora avisa a cada atualização do sistema, organizada por data e tipo.' },
      { tipo: 'NOVIDADE', texto: 'Ícones do sistema no celular passaram a usar a identidade visual do Empório dos Animais (o catavento oficial).' },
      { tipo: 'MELHORIA', texto: 'Oferta aberta de entregas: cada entregador agora vê apenas os pedidos da loja em que trabalha. Direcionamento manual pelo Kanban continua livre entre lojas.' },
      { tipo: 'MELHORIA', texto: 'Sessão expirada: em vez de uma tela travada com o erro "Token inválido", você é levado ao login com um aviso claro. Vale para o admin e para o app do entregador.' },
      { tipo: 'CORRECAO', texto: 'Corrigido o loop de "Token inválido ou expirado" nas listas quando o login vencia depois de 7 dias sem acesso.' },
    ],
  },
];

// Chave do localStorage que guarda a data da versão mais recente já vista pelo usuário.
export const NOVIDADES_LS_KEY = 'emporio_novidades_visto';

// Formata uma data ISO ("2026-07-05") como "05 de julho de 2026".
export function formatarData(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (e) {
    return iso;
  }
}

// Quantas versões o usuário ainda não viu.
// Sem histórico salvo → considera todas como novas (primeira visita).
export function contarNaoVistas(dataVista) {
  if (!dataVista) return NOVIDADES.length;
  return NOVIDADES.filter((v) => v.data > dataVista).length;
}
