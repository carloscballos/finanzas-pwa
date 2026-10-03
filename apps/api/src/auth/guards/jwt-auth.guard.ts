import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

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

    // Primero intenta validar como JWT
    try {
      const payload = this.jwtService.verify(token);
      request.user = { id: payload.sub };
      return true;
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
