# Deploy no Railway — passo a passo

Esse guia te leva do zero ao sistema rodando em produção. Tempo estimado: **40 minutos** na primeira vez.

## Pré-requisitos

- Conta no Railway (https://railway.app)
- Conta no GitHub
- Git instalado localmente

---

## Passo 1 — Subir o código para o GitHub

```bash
cd emporio-sistema/
git init
git add .
git commit -m "Esqueleto v0.1 — Empório dos Animais"
```

Crie um repositório novo no GitHub (recomendo privado por enquanto) e:

```bash
git remote add origin https://github.com/SEU_USUARIO/emporio-sistema.git
git branch -M main
git push -u origin main
```

---

## Passo 2 — Criar o projeto no Railway

1. Acesse https://railway.app/new
2. Clique em **Deploy from GitHub repo**
3. Autorize o Railway a acessar o repositório `emporio-sistema`
4. Selecione o repositório

O Railway criará o projeto vazio (ainda sem serviços).

---

## Passo 3 — Adicionar o banco PostgreSQL

Dentro do projeto Railway:

1. Clique em **+ New** → **Database** → **Add PostgreSQL**
2. Aguarde uns 30 segundos para provisionar
3. O Railway gera automaticamente a variável `DATABASE_URL` no ambiente

---

## Passo 4 — Deploy do backend

1. No projeto Railway, clique em **+ New** → **GitHub Repo** → selecione o mesmo repo
2. Em **Settings** → **Source**:
   - **Root Directory**: `backend`
3. Em **Settings** → **Variables**, adicione:

```
JWT_SECRET=GERE_UM_VALOR_ALEATORIO_DE_32_CHARS
CORS_ORIGIN=*
NODE_ENV=production
LOG_LEVEL=info
```

Para gerar o JWT_SECRET, rode localmente:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> A variável `DATABASE_URL` já é injetada automaticamente pelo plugin Postgres.

4. Em **Settings** → **Networking** → **Generate Domain** — anote a URL (algo como `emporio-backend-production.up.railway.app`)
5. Aguarde o build (uns 3 minutos na primeira vez)

### Verificar se o backend está vivo
Acesse `https://SEU_BACKEND.up.railway.app/health` — deve retornar:
```json
{"status":"ok","timestamp":"...","versao":"0.1.0"}
```

---

## Passo 5 — Popular o banco com dados de teste

No Railway, abra o serviço do backend:

1. Vá em **Settings** → **Deploy** → **Deploy Logs**
2. Em outra aba, abra o **Shell** (botão no topo do serviço)
3. Rode:
```bash
npm run db:seed
```

Aguarde a mensagem `✅ Seed concluído!`. Agora o banco tem:
- 5 lojas
- 7 usuários
- 15 produtos com estoque nas 3 lojas
- 5 zonas de entrega
- 3 clientes com pets
- 1 pedido de exemplo

---

## Passo 6 — Deploy do frontend

1. No mesmo projeto Railway, clique em **+ New** → **GitHub Repo** → selecione o mesmo repo
2. Em **Settings** → **Source**:
   - **Root Directory**: `frontend`
3. Em **Settings** → **Variables**, adicione:

```
NEXT_PUBLIC_API_URL=https://SEU_BACKEND.up.railway.app
```

(Sem barra no final!)

4. Em **Settings** → **Networking** → **Generate Domain**
5. Aguarde o build (uns 4 minutos)

### Verificar se o frontend está vivo
Acesse a URL gerada. Deve aparecer a landing institucional com 3 cards.

---

## Passo 7 — Apertar o CORS (recomendado)

Depois que tudo estiver funcionando, volte no backend Railway e atualize:

```
CORS_ORIGIN=https://SEU_FRONTEND.up.railway.app
```

Isso impede que outras aplicações chamem sua API.

---

## Passo 8 — Testar fluxo completo

1. Acesse o frontend
2. Clique em **Backoffice**
3. (Quando login estiver implementado) entre com `bruno@emporiodosanimais.com.br` / `emporio123`
4. Veja o Kanban com o pedido de exemplo

---

## Custos esperados no Railway

Plano Hobby ($5/mês) cobre tranquilamente:
- 1 backend Node
- 1 frontend Next.js
- 1 PostgreSQL pequeno

Em produção real (centenas de pedidos/dia), considere upgrade para Pro ($20/mês) — mais memória e CPU.

---

## Resolução de problemas

**Backend não conecta no banco**
- Verifique que `DATABASE_URL` está no ambiente do serviço backend
- Reinicie o serviço (botão Deploy)

**Frontend mostra erro de CORS**
- Confirme que `CORS_ORIGIN` no backend contém a URL exata do frontend
- Sem barra no final, sem espaços

**Build do frontend falha em "Module not found '@/lib/api'"**
- Confirme que `jsconfig.json` foi commitado

**Prisma falha com "DATABASE_URL not defined"**
- O plugin Postgres precisa estar no mesmo projeto que o backend
- Confirme a variável em Settings → Variables

**Migrations não rodam automaticamente**
- O `railway.json` do backend já inclui `prisma migrate deploy` no build
- Se mesmo assim falhar, rode manualmente no Shell: `npx prisma migrate deploy`

---

## Próximas etapas após o deploy

1. Mandar a URL do sistema para o Bruno em uma demo controlada
2. Anotar feedbacks dele em uma planilha
3. Priorizar próxima sprint com base no feedback + matriz de funcionalidades do material da reunião
4. Configurar backups automáticos do Postgres (Railway tem snapshot diário no plano Pro)
