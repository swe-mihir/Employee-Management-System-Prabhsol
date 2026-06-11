"use client";

// All token I/O goes through here. One place to change storage strategy later.
//
// Why the cookie?
//   Next.js middleware runs on the Edge (server-side) and can't read localStorage.
//   We mirror the access token to a plain (non-httpOnly) cookie named "ems_at"
//   solely so the middleware can check whether the user is authenticated and
//   redirect to /login if not. The actual token used in API calls is always
//   read from localStorage — the cookie is just a "logged-in" signal.

import type { UserInfo } from "@/services/api/auth";

const ACCESS_KEY = "ems_access_token";
const REFRESH_KEY = "ems_refresh_token";
const USER_KEY = "ems_user";
const COOKIE_NAME = "ems_at";

// ── Cookie helpers ─────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days = 7): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// ── Access token ───────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
  setCookie(COOKIE_NAME, token); // mirror for middleware
}

// ── Refresh token ──────────────────────────────────────────────────────────

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token);
}

// ── User info (cached from last /me or login) ──────────────────────────────

export function getStoredUser(): UserInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserInfo): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ── Session helpers ────────────────────────────────────────────────────────

export function saveSession(
  accessToken: string,
  refreshToken: string,
  user?: UserInfo,
): void {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
  if (user) setStoredUser(user);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  deleteCookie(COOKIE_NAME);
}

export function isLoggedIn(): boolean {
  return Boolean(getAccessToken());
}