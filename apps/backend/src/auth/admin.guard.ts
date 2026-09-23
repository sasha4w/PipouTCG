// auth/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth-user';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();
    const user = request.user; // injecté par JwtAuthGuard via validate()
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admins only');
    }
    return true;
  }
}
