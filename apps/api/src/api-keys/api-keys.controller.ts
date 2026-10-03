import { Controller, Delete, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

class GeneratedApiKeyResponseDto {
  @ApiProperty({ description: 'Token completo. Solo se muestra esta vez; después no se puede recuperar.' })
  token: string;
  @ApiProperty({ description: 'Últimas 4 letras, para reconocerlo' })
  hint: string;
  @ApiProperty()
  createdAt: string;
}

class CurrentApiKeyResponseDto {
  @ApiProperty({ description: 'Últimas 4 letras del token activo' })
  hint: string;
  @ApiProperty()
  createdAt: string;
}

@ApiTags('API Keys')
@Auth()
@Controller({ path: 'api-keys', version: '1' })
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generar un token nuevo para el Shortcut (revoca el anterior)',
    description: 'El token solo puede registrar pagos pendientes. Se devuelve completo una única vez.',
  })
  @ApiResponse({ status: 201, type: GeneratedApiKeyResponseDto })
  async generate(@CurrentUser() user: AuthenticatedUser): Promise<GeneratedApiKeyResponseDto> {
    const result = await this.apiKeysService.generateToken(user.id);
    return { token: result.token, hint: result.hint, createdAt: result.createdAt.toISOString() };
  }

  @Get('current')
  @ApiOperation({ summary: 'Ver el token activo (solo sus últimas 4 letras y la fecha), si existe' })
  @ApiResponse({ status: 200, type: CurrentApiKeyResponseDto })
  async getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<CurrentApiKeyResponseDto | null> {
    const result = await this.apiKeysService.getCurrentToken(user.id);
    if (!result) return null;
    return { hint: result.hint, createdAt: result.createdAt.toISOString() };
  }

  @Delete('current')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revocar el token activo' })
  @ApiResponse({ status: 204, description: 'Token revocado' })
  @ApiResponse({ status: 404, description: 'No hay un token activo' })
  async revoke(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    const revoked = await this.apiKeysService.revokeCurrent(user.id);
    if (!revoked) throw new NotFoundException('No tienes un token activo');
  }
}
