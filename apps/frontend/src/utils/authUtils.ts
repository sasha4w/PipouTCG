export function isAdmin(user: any): boolean {
  return user?.is_admin === true;
}

export function getUserId(user: any): number | null {
  return user?.id ?? null;
}
