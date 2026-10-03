import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTIONS_CREATE_SCOPE } from '../common/decorators/api-key-scope.decorator';

export const API_KEY_PREFIX = 'fin_';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un token nuevo y revoca los anteriores (un usuario tiene uno solo).
   * El token en claro solo existe en esta respuesta: en la base se guarda su hash.
   */
  async generateToken(userId: string): Promise<{ token: string; hint: string; createdAt: Date }> {
    const token = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;

    const [, apiKey] = await this.prisma.$transaction([
      this.prisma.apiKey.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.apiKey.create({
        data: {
          userId,
          tokenHash: hashToken(token),
          hint: token.slice(-4),
          scope: TRANSACTIONS_CREATE_SCOPE,
          label: 'Shortcut',
        },
      }),
    ]);

    return { token, hint: apiKey.hint, createdAt: apiKey.createdAt };
  }

  async validateToken(token: string): Promise<{ userId: string; scope: string } | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { userId: true, scope: true, revokedAt: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      return null;
    }

    return { userId: apiKey.userId, scope: apiKey.scope };
  }

  /** Revoca el token activo del usuario. Devuelve false si no tenía ninguno. */
  async revokeCurrent(userId: string): Promise<boolean> {
    const { count } = await this.prisma.apiKey.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  /** Datos para mostrar el token activo; nunca el token en sí. */
  async getCurrentToken(userId: string): Promise<{ hint: string; createdAt: Date } | null> {
    return this.prisma.apiKey.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { hint: true, createdAt: true },
    });
  }
}
