// Cliente HTTP para chamar o backend
// Lê NEXT_PUBLIC_API_URL do ambiente

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const { token, ...fetchOpts } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...fetchOpts.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOpts,
    headers
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(
      body?.erro || response.statusText,
      response.status,
      body
    );
  }

  return body;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, data, options) => request(path, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (path, data, options) => request(path, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  patch: (path, data, options) => request(path, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' })
};

export { ApiError };
