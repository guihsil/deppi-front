import React from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-gray-100">
            <aside className="w-64 bg-white border-r border-gray-200 p-4">
                <div className="font-bold text-xl text-red-700 mb-6">DEPPI Admin</div>
                <nav className="flex flex-col gap-2">
                    <a href="/admin" className="p-2 rounded bg-orange-100 text-orange-800 font-medium">Início</a>
                    <a href="/admin/cursos" className="p-2 rounded hover:bg-gray-100 text-gray-700">Cursos</a>
                    <a href="/admin/instituicoes" className="p-2 rounded hover:bg-gray-100 text-gray-700">Instituições</a>
                    <a href="/admin/usuarios" className="p-2 rounded hover:bg-gray-100 text-gray-700">Usuários</a>
                </nav>
            </aside>

            <main className="flex-1 p-8">
                {children}
            </main>
        </div>
    );
}