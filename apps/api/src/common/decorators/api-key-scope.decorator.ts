import { SetMetadata } from '@nestjs/common';

export const API_KEY_SCOPE_METADATA = 'apiKeyScope';

/** Único alcance que existe hoy: registrar pagos pendientes (el Shortcut de Apple Wallet). */
export const TRANSACTIONS_CREATE_SCOPE = 'transactions:create';

/**
 * Marca un endpoint como accesible con un token de API (Shortcut) de ese alcance.
 * Sin esta marca, un token de API recibe 403: solo los JWT de sesión llegan a todo lo demás.
 */
export const ApiKeyScope = (scope: string) => SetMetadata(API_KEY_SCOPE_METADATA, scope);
