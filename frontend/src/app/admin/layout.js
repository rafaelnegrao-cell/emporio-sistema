'use client';
 
// Guarda de rota do backoffice. Protege TODAS as páginas sob /admin:
// se não houver sessão, redireciona para /login. Como /login fica fora
// de /admin, não há risco de loop de redirecionamento.
 
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
 
export default function AdminLayout({ children }) {
  const router = useRouter();
  const { token, carregando } = useAuth();
 
  useEffect(() => {
    if (!carregando && !token) {
      router.replace('/login');
    }
  }, [carregando, token, router]);
 
  // Enquanto restaura a sessão (ou enquanto redireciona), mostra um placeholder.
  if (carregando || !token) {
    return (
      <div className="min-h-screen bg-negrao-off-white-claro flex items-center justify-center">
        <p className="text-sm text-negrao-grafite-claro font-serif italic">Carregando...</p>
      </div>
    );
  }
 
  return children;
}
 
