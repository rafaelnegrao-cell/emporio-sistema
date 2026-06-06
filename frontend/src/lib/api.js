// frontend/src/lib/api.js
// Cliente HTTP do backend. Lê a URL pública do Railway de NEXT_PUBLIC_API_URL
// (sem barra final) e injeta o JWT salvo no login.

const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function token() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('emporio_token');
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
