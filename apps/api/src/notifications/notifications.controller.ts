import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationsListResponseDto } from './dto/notification-response.dto';

@ApiTags('Notifications')
@Auth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Mis últimas notificaciones (50) y cuántas están sin leer' })
  @ApiResponse({ status: 200, type: NotificationsListResponseDto })
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<NotificationsListResponseDto> {
    return this.notificationsService.findMine(user.id);
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  @ApiResponse({ status: 204, description: 'Hecho' })
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Hecho' })
  @ApiResponse({ status: 404, description: 'No existe o no es tuya' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notificationsService.markRead(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una notificación' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminada' })
  @ApiResponse({ status: 404, description: 'No existe o no es tuya' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notificationsService.remove(user.id, id);
  }
}
