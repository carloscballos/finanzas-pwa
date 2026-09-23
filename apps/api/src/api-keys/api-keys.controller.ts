import { Controller, Post, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

class ApiKeyResponseDto {
  token: string;
  createdAt: string;
}

@ApiTags('API Keys')
@Auth()
@Controller({ path: 'api-keys', version: '1' })
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generar nuevo token para Shortcut' })
  @ApiResponse({ status: 201, type: ApiKeyResponseDto })
  async generate(@CurrentUser() user: AuthenticatedUser): Promise<ApiKeyResponseDto> {
    const result = await this.apiKeysService.generateToken(user.id);
    return {
      token: result.token,
      createdAt: result.createdAt.toISOString(),
    };
  }

  @Get('current')
  @ApiOperation({ summary: 'Obtener el token actual (si existe)' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  async getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<ApiKeyResponseDto | null> {
    const result = await this.apiKeysService.getCurrentToken(user.id);
    if (!result) return null;
    return {
      token: result.token,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
