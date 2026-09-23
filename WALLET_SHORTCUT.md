# Apple Wallet → Finanzas PWA Shortcut

Automáticamente registra pagos de Apple Wallet en tu app de finanzas.

## Setup (una sola vez)

### 1. Guardar credenciales en Keychain (setup inicial)

1. Abre **Shortcuts**
2. Crea nuevo shortcut → "Crear shortcut vacío"
3. Nombre: "Finanzas Setup"
4. Agrega:

```
Paso 1: Pedir texto
  - Título: "Email"
  - Guarda en variable EMAIL

Paso 2: Pedir contraseña
  - Título: "Contraseña"
  - Guarda en variable PASSWORD

Paso 3: Pedir texto
  - Título: "Cuenta UUID (para gastos)"
  - Pista: "ID desde Cuentas en la app"
  - Guarda en variable ACCOUNT_ID

Paso 4: Guardar en Keychain
  - Guardar en Keychain
  - Contraseña: EMAIL
  - Cuenta: "finanzas_email"

Paso 5: Guardar en Keychain
  - Guardar en Keychain
  - Contraseña: PASSWORD
  - Cuenta: "finanzas_password"

Paso 6: Guardar en Keychain
  - Guardar en Keychain
  - Contraseña: ACCOUNT_ID
  - Cuenta: "finanzas_account_id"

Paso 7: Notificación
  - "✅ Credenciales guardadas. Ahora crea el Shortcut de Pagos."
```

5. Ejecuta este shortcut **UNA SOLA VEZ** al inicio

### 2. Crear el Shortcut de Pagos (automático)

1. Nuevo shortcut → "Crear shortcut vacío"
2. Nombre: "Finanzas - Registrar Pago"
3. Agrega:

```
Paso 1: Pedir número
  - Título: "Monto del pago"
  - Guarda en variable AMOUNT

Paso 2: Obtener de Keychain
  - Cuenta: "finanzas_email"
  - Guarda en variable EMAIL

Paso 3: Obtener de Keychain
  - Cuenta: "finanzas_password"
  - Guarda en variable PASSWORD

Paso 4: Obtener de Keychain
  - Cuenta: "finanzas_account_id"
  - Guarda en variable ACCOUNT_ID

Paso 5: Enviar petición HTTP (Login)
  - URL: https://api.koystudio.dev/api/v1/auth/login
  - Método: POST
  - Headers: Content-Type = application/json
  - Body: {"email": EMAIL, "password": PASSWORD}
  - Guarda el resultado en variable RESPONSE

Paso 6: Extraer token
  - Obtén el valor de RESPONSE.accessToken
  - Guarda en variable TOKEN

Paso 7: Enviar petición HTTP (Crear transacción)
  - URL: https://api.koystudio.dev/api/v1/transactions
  - Método: POST
  - Headers:
    - Content-Type = application/json
    - Authorization = Bearer TOKEN
  - Body:
    {
      "accountId": ACCOUNT_ID,
      "type": "EXPENSE",
      "amount": AMOUNT,
      "occurredAt": Hora actual,
      "status": "PENDING"
    }

Paso 8: Notificación
  - "✅ Pago de $AMOUNT registrado en Finanzas"
```

### 3. Automatizar después de Wallet (opcional)

**En iOS 18+:**
1. Abre Automations de Shortcuts (pestaña "Automations" abajo)
2. Presiona "+" → "Crear automatización personal"
3. Selecciona "Wallet" → "Se completa un pago con Wallet"
4. Elige tu Shortcut "Finanzas - Registrar Pago"
5. Desactiva "Preguntar antes de ejecutar"
6. **Listo**: cada pago con Wallet corre el Shortcut automáticamente

**Manual (funciona siempre):**
- Agrega a pantalla de inicio: Shortcuts → tu shortcut → "Agregar a pantalla de inicio"
- Después de pagar, toca el ícono, ingresa el monto, listo

## Dónde obtener el UUID de tu cuenta

En la app, en **Cuentas**:
- Toca la cuenta donde quieres cargar gastos (ej. "Efectivo", "Cuenta USD")
- El UUID está en la URL o al presionar compartir
- Ejemplo: `3fa85f64-5717-4c2a-b5cc-a51ef8547b2a`
- Cópialo y úsalo en el Setup

## Primer uso

1. **Corre "Finanzas Setup"** una única vez
   - Email, contraseña, UUID de cuenta
   - Se guarda en Keychain (encriptado)
   
2. **En Automation** (o manual):
   - Paga con Wallet
   - Shortcut pide solo el monto → registra → notificación

3. **En la app**:
   - Home muestra "1 pago pendiente"
   - Abre drawer → edita categoría → confirma

## 🔒 Seguridad

- **Email y contraseña**: guardadas en Keychain iOS (encriptado a nivel del OS)
- **Token JWT**: generado y desechado en cada pago, no se persiste
- **HTTPS**: todas las conexiones cifradas
- **Keychain**: solo tú puedes acceder (requiere Face ID/Touch ID si lo activas)

## ⚠️ Troubleshooting

**"Error 401 - Credenciales inválidas"**
- Verifica que email/contraseña sean correctas (prueba en la app)
- Revisa el Keychain: Configuración → Contraseñas → busca "finanzas_"
- Si está mal, borra la entrada y corre Setup de nuevo

**"Error 404 - Cuenta no encontrada"**
- El UUID de la cuenta es incorrecto
- Copia exacto desde Cuentas en la app
- Asegúrate de no incluir espacios

**"El Shortcut no aparece en Automation"**
- Cierra Shortcuts completamente y reabre
- El Shortcut debe tener un nombre simple sin caracteres especiales
- En Automations, busca por "Finanzas - Registrar Pago"

**"Pago no aparece en la app"**
- Recarga Finanzas (cierra y abre)
- Revisa que el pago esté en "1 pago pendiente" en el Home
- Si no aparece, verifica en la consola del navegador (F12) si hubo error

## Alternativa: CLI (para developers)

```bash
# Login
curl -X POST https://api.koystudio.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"carla@example.com","password":"clave12345"}'

# Registrar pago pendiente
curl -X POST https://api.koystudio.dev/api/v1/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "accountId": "<UUID>",
    "type": "EXPENSE",
    "amount": 45.50,
    "occurredAt": "2026-09-22T19:30:00Z",
    "status": "PENDING"
  }'
```
