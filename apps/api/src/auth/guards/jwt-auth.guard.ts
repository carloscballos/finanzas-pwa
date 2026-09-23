import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiKeysService: ApiKeysService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      throw new UnauthorizedException('Esquema de autorización inválido');
    }

    // Primero intenta validar como JWT (el guard padre lo hace)
    try {
      const result = await super.canActivate(context);
      // Convierte Observable a boolean si es necesario
      return Boolean(result);
    } catch {
      // Si JWT falla, intenta como API key
      const userId = await this.apiKeysService.validateToken(token);
      if (!userId) {
        throw new UnauthorizedException('Token inválido o revocado');
      }

      // Inyecta el usuario en el request para que los decoradores lo encuentren
      request.user = { id: userId };
      return true;
    }
  }
}
