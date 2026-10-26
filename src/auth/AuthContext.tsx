"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, api } from "../api";
import { isRole, type Role } from "../roles";

type Usuario = {
  nome?: string;
  cargos: Role[];
};

type Session = {
  token: string;
  usuario: Usuario;
};

type LoginResponse = {
  token: string;
  usuario: Usuario;
};

type AuthContextValue = {
  token: string | null;
  usuario: Usuario | null;
  cargos: Role[];
  isAuth: boolean;
  ready: boolean;
  login: (email: string, senha: string) => Promise<Session>;
  logout: () => void;
};

const KEY = "deppi:session";
const AuthContext = createContext<AuthContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSession(value: unknown): Session | null {
  if (!isRecord(value) || typeof value.token !== "string" || !value.token) {
    return null;
  }
  if (!isRecord(value.usuario) || !Array.isArray(value.usuario.cargos)) {
    return null;
  }

  const cargos = value.usuario.cargos;
  if (!cargos.every(isRole)) return null;

  return {
    token: value.token,
    usuario: {
      ...(typeof value.usuario.nome === "string" ? { nome: value.usuario.nome } : {}),
      cargos,
    },
  };
}

function loadSession(): Session | null {
  const saved = localStorage.getItem(KEY);
  if (!saved) return null;

  try {
    const session = parseSession(JSON.parse(saved));
    if (session) return session;
  } catch {
    // An unreadable persisted session is discarded so login can proceed.
  }

  localStorage.removeItem(KEY);
  return null;
}

function parseLoginResponse(value: unknown): LoginResponse {
  const session = parseSession(value);
  if (!session) {
    throw new ApiError("A resposta de login não contém uma sessão válida.", 502);
  }
  return session;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSession(loadSession());
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setSession(null);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const response = await api<unknown>("/auth/login", {
      method: "POST",
      body: { email, senha },
      auth: false,
    });
    const newSession = parseLoginResponse(response);
    localStorage.setItem(KEY, JSON.stringify(newSession));
    setSession(newSession);
    return newSession;
  }, []);

  useEffect(() => {
    window.addEventListener("deppi:unauthorized", logout);
    return () => window.removeEventListener("deppi:unauthorized", logout);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: session?.token ?? null,
      usuario: session?.usuario ?? null,
      cargos: session?.usuario.cargos ?? [],
      isAuth: Boolean(session?.token),
      ready,
      login,
      logout,
    }),
    [session, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return value;
}
