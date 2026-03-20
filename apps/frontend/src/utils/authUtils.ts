import { cookies } from "../api/api";

interface JwtPayload {
  sub: number;
  is_admin: boolean;
  exp: number;
}

function decodeToken(): JwtPayload | null {
  const token = cookies.get("token");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])) as JwtPayload;
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  const payload = decodeToken();
  if (!payload) return false;
  if (payload.exp * 1000 < Date.now()) return false;
  return payload.is_admin === true;
}

export function getUserId(): number | null {
  return decodeToken()?.sub ?? null;
}
