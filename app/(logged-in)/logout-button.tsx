'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const isSubmitting = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    if (isSubmitting.current) return;

    isSubmitting.current = true;
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Não foi possível encerrar a sessão.');
      }
      router.replace('/login');
      router.refresh();
    } catch (error) {
      console.error(error);
      setError('Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      isSubmitting.current = false;
      setIsLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" aria-live="assertive" className="mb-2 text-sm text-[#B42318]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        className="flex w-full items-center gap-2 rounded-xl border border-[#E4E1DB] bg-white px-3 py-2 text-left text-sm font-medium text-[#1A1A1A] transition hover:border-[#D3D0C9] hover:bg-[#F1EFEB] disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut className="h-4 w-4 text-[#5C5C5C]" />
        {isLoading ? 'Saindo...' : 'Sair'}
      </button>
    </div>
  );
}
