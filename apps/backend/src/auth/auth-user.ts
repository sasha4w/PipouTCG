/** Contenu du JWT signé par AuthService.login. */
export interface JwtPayload {
  sub: number;
  username: string;
  is_admin: boolean;
}

/** Utilisateur injecté dans req.user par JwtStrategy.validate. */
export interface AuthUser {
  userId: number;
  isAdmin: boolean;
}

/** Requête d'une route protégée par JwtAuthGuard. */
export interface AuthenticatedRequest {
  user: AuthUser;
}
