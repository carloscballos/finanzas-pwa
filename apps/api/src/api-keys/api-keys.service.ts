import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async generateToken(userId: string): Promise<{ token: string; createdAt: Date }> {
    const token = randomBytes(32).toString('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        token,
        label: 'Shortcut',
      },
    });

    return {
      token: apiKey.token,
      createdAt: apiKey.createdAt,
    };
  }

  async validateToken(token: string): Promise<string | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { token },
      select: { userId: true, revokedAt: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      return null;
    }

    return apiKey.userId;
  }

  async revokeToken(userId: string, token: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async getCurrentToken(userId: string): Promise<{ token: string; createdAt: Date } | null> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        token: true,
        createdAt: true,
      },
    });

    return apiKey;
  }
}
