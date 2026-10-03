-- Los tokens del Shortcut dejan de guardarse en texto plano: solo su hash SHA-256
-- (el token completo se muestra una sola vez al generarlo) + las últimas 4 letras
-- para reconocerlo en pantalla, y un alcance (scope) que limita qué puede hacer.
-- Los tokens existentes siguen funcionando: su hash se calcula aquí.
ALTER TABLE "api_keys" ADD COLUMN "tokenHash" CHAR(64);
ALTER TABLE "api_keys" ADD COLUMN "hint" TEXT NOT NULL DEFAULT '';
ALTER TABLE "api_keys" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'transactions:create';

UPDATE "api_keys"
SET "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex'),
    "hint" = right("token", 4);

ALTER TABLE "api_keys" ALTER COLUMN "tokenHash" SET NOT NULL;
CREATE UNIQUE INDEX "api_keys_tokenHash_key" ON "api_keys"("tokenHash");

DROP INDEX "api_keys_token_key";
ALTER TABLE "api_keys" DROP COLUMN "token";
