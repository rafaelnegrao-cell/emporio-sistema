'use client';

// Contexto de autenticação do operador (backoffice / entregador).
// Guarda o token JWT e os dados do usuário, persistindo no localStorage
// para a sessão sobreviver a recarregamentos de página.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

const STORAGE_KEY = 'emporio_auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Restaura a sessão salva quando o app carrega (roda só no navegador).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const dados = JSON.parse(raw);
        if (dados?.token) {
          setToken(dados.token);
          setUsuario(dados.usuario || null);
        }
      }
    } catch (e) {
      // Ignora storage corrompido / indisponível
    } finally {
      setCarregando(false);
    }
  }, []);

  // Faz login no backend e guarda a sessão.
  const login = useCallback(async (email, senha) => {
    const resposta = await api.post('/api/auth/operador/login', { email, senha });
    setToken(resposta.token);
    setUsuario(resposta.usuario);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: resposta.token, usuario: resposta.usuario })
      );
    } catch (e) {
      // Ignora se o storage não estiver disponível
    }
    return resposta.usuario;
  }, []);

  // Encerra a sessão.
  const logout = useCallback(() => {
    setToken(null);
    setUsuario(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }, []);

  return (
    <AuthContext.Provider value={{ token, usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }
  return ctx;
}
