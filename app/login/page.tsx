'use client';

import { useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [erro, setErro] = useState('Email ou senha inválidos.');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Implementar aqui dados vindos do backend
        console.log({ email, password });
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Lado Esquerdo */}
            <div className="hidden lg:flex lg:w-1/2 bg-orange-700 text-white p-12 flex-col justify-between relative">
                <div>
                    <h2 className="text-2xl font-bold">DEPPI</h2>
                    <p className="text-sm opacity-80">IFCE · Extensão</p>
                </div>
                <div>
                    <h1 className="text-4xl font-extrabold mb-4 leading-tight">
                        Cursos de extensão do IFCE.
                    </h1>
                    <p className="text-lg opacity-80">
                        Inscreva-se, envie seus documentos e acompanha a análise da sua inscrição.
                    </p>
                </div>
            </div>

            {/* Lado Direito */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Entrar</h2>
                    <p className="text-sm text-gray-500 mb-6">Use seu e-mail institucional.</p>

                    {/* Card erro */}

                    {erro && (
                        <div className="flex items-center gap-2 p-3 mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                            <span>{erro}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail institucional</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="usuario@example.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Entrar
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        Ainda não tem conta?{' '}
                        <a href="/cadastro" className="text-orange-600 font-semibold hover:underline">
                            Crie sua conta
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}