// auth/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // injecté par JwtAuthGuard via validate()
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admins only');
    }
    return true;
  }
}
