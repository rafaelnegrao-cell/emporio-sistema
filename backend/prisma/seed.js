// Seed do banco — dados de teste do Empório dos Animais
// Rodar: npm run db:seed
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do Empório dos Animais...');

  // ============================================================
  // LOJAS — 3 do escopo + 2 fora
  // ============================================================
  console.log('📍 Criando lojas...');
  await prisma.loja.deleteMany({});

  const maringa = await prisma.loja.create({
    data: {
      codigo: 'MARINGA',
      nome: 'Av. Maringá',
      endereco: 'Av. Maringá, Londrina/PR',
      telefone: '(43) 3000-0001',
      noEscopoDelivery: true,
      latitude: -23.3045,
      longitude: -51.1696
    }
  });

  const higienopolis = await prisma.loja.create({
    data: {
      codigo: 'HIGIENOPOLIS',
      nome: 'Av. Higienópolis',
      endereco: 'Av. Higienópolis, Londrina/PR',
      telefone: '(43) 3000-0002',
      noEscopoDelivery: true,
      latitude: -23.3133,
      longitude: -51.1545
    }
  });

  const cambe = await prisma.loja.create({
    data: {
      codigo: 'CAMBE',
      nome: 'Cambé',
      endereco: 'Rua Principal, Cambé/PR',
      telefone: '(43) 3000-0003',
      noEscopoDelivery: true,
      latitude: -23.2769,
      longitude: -51.2783
    }
  });

  // Fora do escopo
  await prisma.loja.createMany({
    data: [
      {
        codigo: 'GARCIA_CID',
        nome: 'Av. Celso Garcia Cid',
        endereco: 'Av. Celso Garcia Cid, Londrina/PR',
        noEscopoDelivery: false
      },
      {
        codigo: 'CHURCHILL',
        nome: 'Av. Winston Churchill',
        endereco: 'Av. Winston Churchill, Londrina/PR',
        noEscopoDelivery: false
      }
    ]
  });

  // ============================================================
  // USUÁRIOS — admin, operadores, entregadores
  // ============================================================
  console.log('👤 Criando usuários...');
  await prisma.usuario.deleteMany({});

  const senhaHash = await bcrypt.hash('emporio123', 10);

  await prisma.usuario.create({
    data: {
      nome: 'Rafael Negrão',
      email: 'rafael@negraoconsultoria.com.br',
      senhaHash,
      papel: 'ADMIN'
    }
  });

  await prisma.usuario.create({
    data: {
      nome: 'Bruno Durante',
      email: 'bruno@emporiodosanimais.com.br',
      senhaHash,
      papel: 'ADMIN'
    }
  });

  await prisma.usuario.createMany({
    data: [
      { nome: 'Operador Maringá', email: 'op.maringa@emporio.com.br', senhaHash, papel: 'OPERADOR', lojaId: maringa.id },
      { nome: 'Operador Higienópolis', email: 'op.higienopolis@emporio.com.br', senhaHash, papel: 'OPERADOR', lojaId: higienopolis.id },
      { nome: 'Operador Cambé', email: 'op.cambe@emporio.com.br', senhaHash, papel: 'OPERADOR', lojaId: cambe.id },
      { nome: 'Entregador João', email: 'joao@emporio.com.br', senhaHash, papel: 'ENTREGADOR', lojaId: maringa.id, telefone: '(43) 99999-0001' },
      { nome: 'Entregador Pedro', email: 'pedro@emporio.com.br', senhaHash, papel: 'ENTREGADOR', lojaId: maringa.id, telefone: '(43) 99999-0002' }
    ]
  });

  // ============================================================
  // CATEGORIAS
  // ============================================================
  console.log('📂 Criando categorias...');
  await prisma.categoria.deleteMany({});

  const racao = await prisma.categoria.create({
    data: { nome: 'Ração', slug: 'racao', ordem: 1 }
  });
  const racaoCao = await prisma.categoria.create({
    data: { nome: 'Ração para Cães', slug: 'racao-caes', ordem: 1, categoriaPaiId: racao.id }
  });
  const racaoGato = await prisma.categoria.create({
    data: { nome: 'Ração para Gatos', slug: 'racao-gatos', ordem: 2, categoriaPaiId: racao.id }
  });
  const medicamentos = await prisma.categoria.create({
    data: { nome: 'Medicamentos', slug: 'medicamentos', ordem: 2 }
  });
  const acessorios = await prisma.categoria.create({
    data: { nome: 'Acessórios', slug: 'acessorios', ordem: 3 }
  });
  const higiene = await prisma.categoria.create({
    data: { nome: 'Higiene', slug: 'higiene', ordem: 4 }
  });
  const areia = await prisma.categoria.create({
    data: { nome: 'Areia Higiênica', slug: 'areia', ordem: 5 }
  });

  // ============================================================
  // PRODUTOS — 15 produtos representativos
  // ============================================================
  console.log('📦 Criando produtos...');
  await prisma.produto.deleteMany({});

  const produtosCriados = [];

  const produtos = [
    { sku: 'PR-CAO-001', nome: 'Ração Premier Cão Adulto Frango 15kg', marca: 'Premier', categoriaId: racaoCao.id, precoBase: 289.90, pesoKg: 15, categoriaPet: 'CAO', idadePet: 'ADULTO' },
    { sku: 'PR-CAO-002', nome: 'Ração Premier Cão Filhote 10kg', marca: 'Premier', categoriaId: racaoCao.id, precoBase: 219.90, pesoKg: 10, categoriaPet: 'CAO', idadePet: 'FILHOTE' },
    { sku: 'GO-CAO-001', nome: 'Ração Golden Cão Sênior 15kg', marca: 'Golden', categoriaId: racaoCao.id, precoBase: 249.90, pesoKg: 15, categoriaPet: 'CAO', idadePet: 'SENIOR' },
    { sku: 'WH-CAO-001', nome: 'Ração Whiskas Adulto Carne 10kg', marca: 'Whiskas', categoriaId: racaoCao.id, precoBase: 179.90, pesoKg: 10, categoriaPet: 'CAO', idadePet: 'ADULTO' },
    { sku: 'PR-GAT-001', nome: 'Ração Premier Gato Adulto Salmão 7,5kg', marca: 'Premier', categoriaId: racaoGato.id, precoBase: 189.90, pesoKg: 7.5, categoriaPet: 'GATO', idadePet: 'ADULTO' },
    { sku: 'PR-GAT-002', nome: 'Ração Premier Gato Filhote 3kg', marca: 'Premier', categoriaId: racaoGato.id, precoBase: 119.90, pesoKg: 3, categoriaPet: 'GATO', idadePet: 'FILHOTE' },
    { sku: 'MED-001', nome: 'Bravecto Cães 10-20kg', marca: 'MSD', categoriaId: medicamentos.id, precoBase: 159.90, pesoKg: 0.05, controlado: false, categoriaPet: 'CAO' },
    { sku: 'MED-002', nome: 'NexGard Cães 4-10kg', marca: 'Boehringer', categoriaId: medicamentos.id, precoBase: 119.90, pesoKg: 0.03, categoriaPet: 'CAO' },
    { sku: 'MED-003', nome: 'Amoxicilina 500mg 10 comprimidos', marca: 'Genérico', categoriaId: medicamentos.id, precoBase: 35.90, pesoKg: 0.05, controlado: true, precisaReceita: true, categoriaPet: 'MULTI' },
    { sku: 'AC-001', nome: 'Coleira Antifuga Pet Game G', marca: 'Pet Game', categoriaId: acessorios.id, precoBase: 49.90, pesoKg: 0.2, categoriaPet: 'CAO', portePet: 'GRANDE' },
    { sku: 'AC-002', nome: 'Comedouro Inox Duplo M', marca: 'Furacão Pet', categoriaId: acessorios.id, precoBase: 39.90, pesoKg: 0.5, categoriaPet: 'MULTI' },
    { sku: 'AC-003', nome: 'Brinquedo Mordedor Kong M', marca: 'Kong', categoriaId: acessorios.id, precoBase: 89.90, pesoKg: 0.15, categoriaPet: 'CAO' },
    { sku: 'HI-001', nome: 'Shampoo Pet Society 500ml', marca: 'Pet Society', categoriaId: higiene.id, precoBase: 32.90, pesoKg: 0.55, categoriaPet: 'MULTI' },
    { sku: 'AR-001', nome: 'Areia Higiênica Pipicat 12kg', marca: 'Pipicat', categoriaId: areia.id, precoBase: 32.90, pesoKg: 12, categoriaPet: 'GATO' },
    { sku: 'AR-002', nome: 'Areia Higiênica Granulado 4kg', marca: 'Tidy Cats', categoriaId: areia.id, precoBase: 18.90, pesoKg: 4, categoriaPet: 'GATO' }
  ];

  for (const p of produtos) {
    const criado = await prisma.produto.create({ data: p });
    produtosCriados.push(criado);
  }

  // ============================================================
  // ESTOQUE — cada produto em cada loja com quantidades aleatórias
  // ============================================================
  console.log('📊 Criando estoque...');
  const lojasEscopo = [maringa, higienopolis, cambe];
  for (const produto of produtosCriados) {
    for (const loja of lojasEscopo) {
      await prisma.estoqueLoja.create({
        data: {
          produtoId: produto.id,
          lojaId: loja.id,
          quantidade: Math.floor(Math.random() * 50) + 5,
          quantidadeMinima: 5
        }
      });
    }
  }

  // ============================================================
  // ZONAS DE ENTREGA
  // ============================================================
  console.log('🗺️  Criando zonas de entrega...');
  await prisma.zonaEntrega.deleteMany({});

  // Maringá — atende centro de Londrina e bairros próximos
  await prisma.zonaEntrega.create({
    data: {
      lojaId: maringa.id,
      nome: 'Centro Londrina',
      bairros: ['Centro', 'Centro Histórico', 'Vila Nova', 'Jardim Higienópolis'],
      taxaFrete: 8.00,
      valorFreteGratis: 150.00,
      prazoMinHoras: 2,
      prazoMaxHoras: 4,
      prioridade: 10
    }
  });
  await prisma.zonaEntrega.create({
    data: {
      lojaId: maringa.id,
      nome: 'Zona Norte Londrina',
      bairros: ['Maringá', 'Aurora', 'Gleba Palhano', 'Higienópolis'],
      taxaFrete: 12.00,
      valorFreteGratis: 200.00,
      prazoMinHoras: 3,
      prazoMaxHoras: 6,
      prioridade: 5
    }
  });

  // Higienópolis — atende Gleba Palhano com prioridade maior
  await prisma.zonaEntrega.create({
    data: {
      lojaId: higienopolis.id,
      nome: 'Gleba Palhano e arredores',
      bairros: ['Gleba Palhano', 'Higienópolis', 'Bandeirantes', 'Antares'],
      taxaFrete: 10.00,
      valorFreteGratis: 180.00,
      prazoMinHoras: 2,
      prazoMaxHoras: 4,
      prioridade: 10
    }
  });

  // Cambé
  await prisma.zonaEntrega.create({
    data: {
      lojaId: cambe.id,
      nome: 'Cambé Centro',
      bairros: ['Centro', 'Jardim Brasil', 'Vila Brasil', 'Jardim Tókio'],
      taxaFrete: 8.00,
      valorFreteGratis: 150.00,
      prazoMinHoras: 2,
      prazoMaxHoras: 5,
      prioridade: 10
    }
  });
  await prisma.zonaEntrega.create({
    data: {
      lojaId: cambe.id,
      nome: 'Ibiporã',
      bairros: ['Centro', 'Jardim Pacaembu'],
      taxaFrete: 18.00,
      prazoMinHoras: 4,
      prazoMaxHoras: 12,
      prioridade: 5
    }
  });

  // ============================================================
  // CLIENTES E PETS — alguns clientes fictícios
  // ============================================================
  console.log('🐶 Criando clientes e pets...');

  const cliente1 = await prisma.cliente.create({
    data: {
      nome: 'Mariana Costa',
      whatsapp: '43999991111',
      cpf: '12345678901',
      email: 'mariana@example.com',
      senhaHash: await bcrypt.hash('cliente123', 10),
      optInMarketing: true,
      lojaPreferidaId: maringa.id,
      enderecos: {
        create: {
          apelido: 'Casa',
          cep: '86010000',
          logradouro: 'Rua das Flores',
          numero: '100',
          bairro: 'Centro',
          cidade: 'Londrina',
          uf: 'PR',
          principal: true
        }
      },
      pets: {
        create: [
          { nome: 'Thor', especie: 'CAO', raca: 'Golden Retriever', porte: 'GRANDE', pesoKg: 28.5 },
          { nome: 'Mel', especie: 'GATO', raca: 'SRD', porte: 'PEQUENO', pesoKg: 4.2, castrado: true }
        ]
      }
    }
  });

  await prisma.cliente.create({
    data: {
      nome: 'Carlos Eduardo Silva',
      whatsapp: '43999992222',
      cpf: '23456789012',
      email: 'carlos@example.com',
      senhaHash: await bcrypt.hash('cliente123', 10),
      lojaPreferidaId: higienopolis.id,
      enderecos: {
        create: {
          apelido: 'Casa',
          cep: '86050000',
          logradouro: 'Av. Higienópolis',
          numero: '500',
          bairro: 'Gleba Palhano',
          cidade: 'Londrina',
          uf: 'PR',
          principal: true
        }
      },
      pets: {
        create: { nome: 'Rex', especie: 'CAO', raca: 'Pastor Alemão', porte: 'GRANDE', pesoKg: 35 }
      }
    }
  });

  await prisma.cliente.create({
    data: {
      nome: 'Patrícia Mendes',
      whatsapp: '43999993333',
      cpf: '34567890123',
      email: 'patricia@example.com',
      senhaHash: await bcrypt.hash('cliente123', 10),
      lojaPreferidaId: cambe.id,
      enderecos: {
        create: {
          apelido: 'Casa',
          cep: '86180000',
          logradouro: 'Rua das Acácias',
          numero: '250',
          bairro: 'Jardim Brasil',
          cidade: 'Cambé',
          uf: 'PR',
          principal: true
        }
      },
      pets: {
        create: [
          { nome: 'Bidu', especie: 'CAO', raca: 'Poodle Toy', porte: 'MINI', pesoKg: 3.5 },
          { nome: 'Mingau', especie: 'GATO', raca: 'Persa', porte: 'PEQUENO', pesoKg: 5 }
        ]
      }
    }
  });

  // ============================================================
  // PEDIDO de exemplo
  // ============================================================
  console.log('🛒 Criando pedido de exemplo...');

  const enderecoMariana = await prisma.endereco.findFirst({ where: { clienteId: cliente1.id } });
  const produto1 = produtosCriados[0]; // ração premier
  const produto2 = produtosCriados[6]; // bravecto

  const pedidoExemplo = await prisma.pedido.create({
    data: {
      numero: `PED-${new Date().getFullYear()}-00001`,
      clienteId: cliente1.id,
      lojaId: maringa.id,
      enderecoEntregaId: enderecoMariana.id,
      status: 'EM_SEPARACAO',
      canalOrigem: 'APP',
      subtotal: Number(produto1.precoBase) + Number(produto2.precoBase),
      valorFrete: 8.00,
      valorDesconto: 0,
      valorTotal: Number(produto1.precoBase) + Number(produto2.precoBase) + 8.00,
      observacoesCliente: 'Tocar a campainha do interfone 102',
      itens: {
        create: [
          { produtoId: produto1.id, quantidade: 1, precoUnitario: produto1.precoBase, precoTotal: produto1.precoBase },
          { produtoId: produto2.id, quantidade: 1, precoUnitario: produto2.precoBase, precoTotal: produto2.precoBase }
        ]
      },
      historicoStatus: {
        create: [
          { statusNovo: 'RECEBIDO', motivo: 'Pedido criado pelo app' },
          { statusAnterior: 'RECEBIDO', statusNovo: 'ACEITO', motivo: 'Loja aceitou' },
          { statusAnterior: 'ACEITO', statusNovo: 'EM_SEPARACAO', motivo: 'Iniciando separação' }
        ]
      }
    }
  });

  console.log('\n✅ Seed concluído!\n');
  console.log('📊 Resumo:');
  console.log(`   - 5 lojas (3 no escopo de delivery)`);
  console.log(`   - 7 usuários (1 admin, 3 operadores, 2 entregadores + Bruno admin)`);
  console.log(`   - 7 categorias`);
  console.log(`   - 15 produtos (com estoque nas 3 lojas)`);
  console.log(`   - 5 zonas de entrega`);
  console.log(`   - 3 clientes (com pets e endereços)`);
  console.log(`   - 1 pedido de exemplo em separação`);
  console.log('\n🔐 Credenciais:');
  console.log('   - Admin/Operador/Entregador: senha "emporio123"');
  console.log('   - Cliente: senha "cliente123"');
  console.log('\n🚀 Pronto para testar!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
