'use client';

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
        <p role="alert" aria-live="assertive" className="mb-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        className="w-full rounded p-2 text-left text-gray-700 hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60"
      >
        {isLoading ? 'Saindo...' : 'Sair'}
      </button>
    </div>
  );
}
