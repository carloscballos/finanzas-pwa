import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  // Opcional a propósito por ahora: todavía no hay ningún módulo que la use
  // (prevista para conciliación de extractos bancarios). Cuando se construya
  // esa feature y pase a ser requerida, no olvidar agregarla también en
  // Railway (ver "Despliegue" en este archivo) — si no, el próximo deploy
  // crashea al arrancar por esta misma validación.
  ANTHROPIC_API_KEY: Joi.string().optional(),
});
