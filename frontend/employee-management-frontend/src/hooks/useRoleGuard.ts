"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./useUser";

export function useRoleGuard(allowedRoles: string[], redirectTo = "/attendance") {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const allowed = allowedRoles.some(r => user.roles?.includes(r));
    if (!allowed) router.push(redirectTo);
  }, [user, allowedRoles, redirectTo, router]);
}