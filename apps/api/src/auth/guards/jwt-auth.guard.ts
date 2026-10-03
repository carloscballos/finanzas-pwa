import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { API_KEY_SCOPE_METADATA } from '../../common/decorators/api-key-scope.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly apiKeysService: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    // Tolerante con espacios de más: al pegar el token en un Shortcut es fácil que
    // se cuele un espacio o salto de línea al final, o uno doble tras "Bearer".
    const [scheme, token] = authHeader.trim().split(/\s+/);

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Esquema de autorización inválido');
    }

    // Un JWT siempre tiene puntos (header.payload.firma); un token de API no.
    // Así un JWT vencido se rechaza sin consultar la base.
    if (token.includes('.')) {
      try {
        const payload = this.jwtService.verify(token);
        request.user = { id: payload.sub };
        return true;
      } catch {
        throw new UnauthorizedException('Sesión inválida o vencida');
      }
    }

    const apiKey = await this.apiKeysService.validateToken(token);
    if (!apiKey) {
      throw new UnauthorizedException('Token inválido o revocado');
    }

    // Un token de API (Shortcut) solo entra a los endpoints que declaran su alcance.
    const requiredScope = this.reflector.get<string | undefined>(API_KEY_SCOPE_METADATA, context.getHandler());
    if (requiredScope !== apiKey.scope) {
      throw new ForbiddenException('Este token solo permite registrar pagos pendientes desde el Shortcut');
    }

    request.user = { id: apiKey.userId };
    request.viaApiKey = true;
    return true;
  }
}
