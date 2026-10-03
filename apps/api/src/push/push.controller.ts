import { Body, Controller, Delete, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { PushConfigResponseDto } from './dto/push-config-response.dto';

@ApiTags('Push')
@Auth()
@Controller({ path: 'push', version: '1' })
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('config')
  @ApiOperation({ summary: 'Si el servidor envía push y la clave pública VAPID para suscribirse' })
  @ApiResponse({ status: 200, type: PushConfigResponseDto })
  getConfig(): PushConfigResponseDto {
    return this.pushService.getPublicConfig();
  }

  @Post('subscriptions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Registrar (o refrescar) este dispositivo para recibir push' })
  @ApiResponse({ status: 204, description: 'Registrado' })
  @ApiResponse({ status: 400, description: 'Suscripción inválida' })
  subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscribePushDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    return this.pushService.subscribe(user.id, dto, userAgent);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Dar de baja este dispositivo' })
  @ApiQuery({ name: 'endpoint', description: 'endpoint de la suscripción del navegador' })
  @ApiResponse({ status: 204, description: 'Dado de baja (también si ya no existía)' })
  unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Query('endpoint') endpoint: string,
  ): Promise<void> {
    return this.pushService.unsubscribe(user.id, endpoint);
  }
}
