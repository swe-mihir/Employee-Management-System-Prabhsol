"use client";
import { getStoredUser } from "@/lib/tokenStorage";
import type { UserInfo } from "@/services/api/auth";

export function useUser(): UserInfo | null {
  if (typeof window === "undefined") return null;
  return getStoredUser();
}

export function useIsAdmin(): boolean {
  const u = useUser();
  return u?.roles?.includes("admin") ?? false;
}

export function useIsManager(): boolean {
  const u = useUser();
  return u?.roles?.includes("manager") ?? false;
}

export function useIsEmployee(): boolean {
  const u = useUser();
  if (!u) return false;
  return u.roles.includes("employee") && !u.roles.includes("admin") && !u.roles.includes("manager");
}

export function useHasRole(...roles: string[]): boolean {
  const u = useUser();
  return roles.some(r => u?.roles?.includes(r)) ?? false;
}

export function useHasPermission(perm: string): boolean {
  const u = useUser();
  return u?.permissions?.includes(perm) ?? false;
}