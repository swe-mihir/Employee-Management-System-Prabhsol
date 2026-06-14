"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login as apiLogin, getMe, ApiError } from "@/services/api/auth";
import { saveSession, clearSession, setStoredUser } from "@/lib/tokenStorage";

interface UseAuthReturn {
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, password: string): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const tokens = await apiLogin(email, password);
      const me = await getMe(tokens.access_token);
      saveSession(tokens.access_token, tokens.refresh_token);
      setStoredUser(me.user);
      const isEmployee =
        me.user.roles.includes("employee") &&
        !me.user.roles.includes("admin") &&
        !me.user.roles.includes("manager");
      router.push(isEmployee ? "/attendance" : "/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        // 401 → backend returns "Invalid credentials"
        // 403 → "Account is disabled"
        setError(err.message);
      } else {
        setError("Unable to reach the server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function logout(): void {
    clearSession();
    router.push("/login");
  }

  return { loading, error, login, logout };
}