'use client';

import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email || !password) {
      setErro('Informe seu e-mail e sua senha.');
      return;
    }

    setIsLoading(true);
    setErro('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          senha: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.mensagem || 'Email ou senha inválidos.');
      }

      const params = new URLSearchParams(window.location.search);
      const requestedRedirect = params.get('redirect');
      const redirectTo =
        requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
          ? requestedRedirect
          : '/';
      router.replace(redirectTo);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível realizar o login.';
      setErro(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAF9F7] text-[#1A1A1A]">
      <div className="hidden lg:flex lg:w-1/2 bg-[#C2410C] p-12 text-white flex-col justify-between relative">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white ring-1 ring-white/20">
              D
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-[0.12em]">DEPPI</h2>
              <p className="text-sm opacity-80">IFCE · Extensão</p>
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold mb-4 leading-tight">
            Cursos de extensão do IFCE.
          </h1>
          <p className="text-lg opacity-80">
            Inscreva-se, envie seus documentos e acompanhe a análise da sua inscrição.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-[#E4E1DB] bg-white p-8 shadow-[0_12px_34px_rgba(26,26,26,0.06)]">
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-1">Entrar</h2>
          <p className="text-sm text-[#5C5C5C] mb-6">Use seu e-mail institucional.</p>

          {erro && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#B42318]/30 bg-[#B42318]/10 p-3 text-sm text-[#B42318]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">E-mail institucional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@example.com"
                className="w-full rounded-lg border border-[#D3D0C9] bg-white px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] outline-none transition focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#1A1A1A]">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#D3D0C9] bg-white px-3 py-2.5 pr-10 text-[#1A1A1A] outline-none transition focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5C5C] transition hover:text-[#1A1A1A]"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#C2410C] px-3 py-2.5 font-medium text-white transition hover:bg-[#A9370B] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#5C5C5C]">
            Ainda não tem conta?{' '}
            <a href="/cadastro" className="font-semibold text-[#C2410C] hover:underline">
              Crie sua conta
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}