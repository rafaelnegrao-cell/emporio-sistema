// frontend/src/lib/api.js
// Cliente HTTP do backend. Lê a URL pública do Railway de NEXT_PUBLIC_API_URL
// (sem barra final) e injeta o JWT salvo no login.
//
// Sessão expirada: se uma chamada volta 401 e havia token salvo, o token
// venceu (validade de 7 dias). Antes, o painel ficava num estado confuso
// ("logado" na aparência, mas nada carregava). Agora: limpa o token, marca
// um aviso e redireciona para /login automaticamente.

const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function token() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('emporio_token');
}

// Encerra a sessão vencida e leva para a tela de login (com aviso).
function sessaoExpirou() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('emporio_token');
    window.sessionStorage.setItem('emporio_sessao_expirada', '1');
  } catch (_) {}
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const headers = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  // 401 com token presente = token vencido/ inválido → encerra a sessão.
  // (Sem token presente, deixa seguir o fluxo normal de erro — ex.: login errado.)
  if (res.status === 401 && t) {
    sessaoExpirou();
    throw new Error('Sessão expirada. Entre novamente.');
  }

  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const j = await res.json();
      msg = j.erro || j.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// Helpers de domínio
export const produtosApi = {
  list: (params) => api.get('/api/produtos', params),
  get: (id) => api.get(`/api/produtos/${id}`),
  create: (data) => api.post('/api/produtos', data),
  update: (id, data) => api.patch(`/api/produtos/${id}`, data),
};

export const clientesApi = {
  list: (params) => api.get('/api/clientes', params),
  get: (id) => api.get(`/api/clientes/${id}`),
  create: (data) => api.post('/api/clientes', data),
  update: (id, data) => api.patch(`/api/clientes/${id}`, data),
};