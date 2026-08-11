import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { FriendsService } from './friends.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { FriendRequestResponseDto } from './dto/friend-request-response.dto';
import { FriendResponseDto } from './dto/friend-response.dto';

@ApiTags('Friends')
@Auth()
@Controller({ path: 'friends', version: '1' })
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis amigos' })
  @ApiResponse({ status: 200, type: [FriendResponseDto] })
  findFriends(@CurrentUser() user: AuthenticatedUser): Promise<FriendResponseDto[]> {
    return this.friendsService.findFriends(user.id);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Dejar de ser amigo de alguien' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No son amigos' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.friendsService.remove(user.id, userId);
  }

  @Get('requests/received')
  @ApiOperation({ summary: 'Solicitudes de amistad que me han enviado, pendientes' })
  @ApiResponse({ status: 200, type: [FriendRequestResponseDto] })
  findReceived(@CurrentUser() user: AuthenticatedUser): Promise<FriendRequestResponseDto[]> {
    return this.friendsService.findReceived(user.id);
  }

  @Get('requests/sent')
  @ApiOperation({ summary: 'Solicitudes de amistad que yo he enviado, pendientes' })
  @ApiResponse({ status: 200, type: [FriendRequestResponseDto] })
  findSent(@CurrentUser() user: AuthenticatedUser): Promise<FriendRequestResponseDto[]> {
    return this.friendsService.findSent(user.id);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Enviar una solicitud de amistad por email' })
  @ApiResponse({ status: 201, type: FriendRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o auto-solicitud' })
  @ApiResponse({ status: 404, description: 'No existe un usuario con ese email' })
  @ApiResponse({ status: 409, description: 'Ya son amigos o ya hay una solicitud pendiente' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFriendRequestDto,
  ): Promise<FriendRequestResponseDto> {
    return this.friendsService.create(user.id, dto);
  }

  @Post('requests/:id/accept')
  @ApiOperation({ summary: 'Aceptar una solicitud de amistad recibida' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: FriendRequestResponseDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 409, description: 'La solicitud ya no está pendiente' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FriendRequestResponseDto> {
    return this.friendsService.accept(user.id, id);
  }

  @Post('requests/:id/decline')
  @ApiOperation({ summary: 'Rechazar una solicitud de amistad recibida' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: FriendRequestResponseDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 409, description: 'La solicitud ya no está pendiente' })
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FriendRequestResponseDto> {
    return this.friendsService.decline(user.id, id);
  }

  @Post('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancelar una solicitud de amistad que yo envié' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: FriendRequestResponseDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 409, description: 'La solicitud ya no está pendiente' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FriendRequestResponseDto> {
    return this.friendsService.cancel(user.id, id);
  }
}
