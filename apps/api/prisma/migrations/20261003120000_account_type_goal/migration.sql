-- Nuevo tipo de cuenta para las cuentas ocultas que respaldan las metas.
-- Va en su propia migración: Postgres no deja usar un valor de enum recién
-- agregado dentro de la misma transacción que lo crea.
ALTER TYPE "AccountType" ADD VALUE 'GOAL';
