import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushRepository } from './push.repository';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { PushConfigResponseDto } from './dto/push-config-response.dto';

export interface PushPayload {
  title: string;
  body?: string;
  /** Ruta del frontend que se abre al tocar el aviso. */
  url?: string;
  /** Avisos con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
}

// Un push que el dispositivo no recibe en este tiempo se descarta: un aviso de
// "te enviaron una solicitud" ya no sirve de un día para otro.
const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly pushRepository: PushRepository,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) {
      this.logger.warn('Claves VAPID no configuradas: el envío de push está desactivado');
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
  }

  getPublicConfig(): PushConfigResponseDto {
    return this.publicKey ? { enabled: true, publicKey: this.publicKey } : { enabled: false };
  }

  async subscribe(userId: string, dto: SubscribePushDto, userAgent?: string): Promise<void> {
    await this.pushRepository.upsert({
      userId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: userAgent?.slice(0, 255),
    });
  }

  // Filtra por userId: nadie puede dar de baja el dispositivo de otro.
  unsubscribe(userId: string, endpoint: string): Promise<void> {
    return this.pushRepository.removeByEndpoint(endpoint, userId);
  }

  // Nunca lanza: lo llama NotificationsService como efecto lateral y un fallo
  // de entrega no debe afectar a quien originó el aviso.
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.publicKey) return;
    try {
      const subscriptions = await this.pushRepository.findByUser(userId);
      const body = JSON.stringify(payload);
      await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              body,
              { TTL: TTL_SECONDS },
            );
            await this.pushRepository.touch(subscription.id);
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              // El dispositivo ya no existe (app desinstalada, permiso revocado).
              await this.pushRepository.removeByEndpoint(subscription.endpoint);
            } else {
              this.logger.warn(`Push falló (${status ?? 'sin código'}) para la suscripción ${subscription.id}`);
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error(`No se pudo enviar push al usuario ${userId}`, error);
    }
  }
}
