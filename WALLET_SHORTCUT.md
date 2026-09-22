# Apple Wallet → Finanzas PWA Shortcut

Automáticamente registra pagos de Apple Wallet en tu app de finanzas.

## Setup (una sola vez)

### 1. Crear el Shortcut en iOS/macOS

1. Abre la app **Shortcuts** (viene preinstalada)
2. Crea un nuevo shortcut → "Crear shortcut vacío"
3. Agrega estos pasos en orden:

```
Paso 1: Pedir número de teléfono
  - Título: "Email"
  - Entrada: Texto
  
Paso 2: Pedir contraseña
  - Título: "Contraseña"
  - Entrada: Contraseña segura
  
Paso 3: Pedir número
  - Título: "Monto"
  - Entrada: Número

Paso 4: Pedir número  
  - Título: "Cuenta UUID"
  - Entrada: Texto
  - Pista: "ID de la cuenta de gastos (ej. 3fa85f64-5717...)"

Paso 5: Enviar petición HTTP (Login)
  - URL: https://api.koystudio.dev/api/v1/auth/login
  - Método: POST
  - Headers: Content-Type = application/json
  - Body:
    {
      "email": resultado_paso_1,
      "password": resultado_paso_2
    }
  - Guarda el resultado en una variable TOKEN
  
Paso 6: Extraer token del JSON
  - Obtén la clave "accessToken" del resultado anterior
  - Guarda en variable TOKEN

Paso 7: Enviar petición HTTP (Crear transacción)
  - URL: https://api.koystudio.dev/api/v1/transactions
  - Método: POST
  - Headers:
    - Content-Type = application/json
    - Authorization = Bearer TOKEN
  - Body:
    {
      "accountId": resultado_paso_4,
      "type": "EXPENSE",
      "amount": resultado_paso_3,
      "occurredAt": Hora actual,
      "status": "PENDING"
    }

Paso 8: Mostrar resultado
  - Notificación: "Pago registrado — revísalo en Finanzas"
```

### 2. Automatizar después de pagar con Wallet

**En iOS 18+:**
1. Abre Configuración → Aplicaciones → Wallet y Apple Pay
2. Busca Finanzas PWA (o usa Automations de Shortcuts)
3. Crea una automatización: "Cuando se completa un pago con Wallet" → ejecuta tu Shortcut

**Alternativa manual (funciona siempre):**
- Agrega el Shortcut a tu pantalla de inicio (pin en Shortcuts → "Agregar a pantalla de inicio")
- Después de pagar, abre el Shortcut, llena los datos, listo

## Obtener los UUIDs de tus cuentas

En la app, en la sección "Cuentas", cada una tiene un UUID en el URL o al editar. Para gastos, usa la que corresponda (ej. "Cuenta USD", "Efectivo").

## Primero uso

1. Ejecuta el Shortcut (manualmente desde Shortcuts o la pantalla)
2. Ingresa:
   - **Email**: tu email registrado (ej. carla@example.com)
   - **Contraseña**: tu contraseña
   - **Monto**: lo que pagaste (ej. 45.50)
   - **Cuenta UUID**: el ID de la cuenta donde cargar (ej. 3fa85f64-5717-4c2a-b5cc-...), puedes copiar desde la app
3. El pago se registra como **PENDIENTE** (sin categoría aún)
4. Abre Finanzas PWA → verás un badge "1 pago pendiente"
5. Toca el botón → edita/confirma la categoría → **Confirmar**

## Securidad

- **Email y contraseña**: se guardan en el Keychain de iOS (encriptado)
- **Token JWT**: solo vive en memoria durante el shortcut, no se guarda
- **HTTPS**: todas las conexiones van cifradas a tu app

## Troubleshooting

**"Error 401 - Credenciales inválidas"**
- Verifica email y contraseña
- Si usas email con espacios o mayúsculas, asegúrate de copiar igual

**"Error 404 - Cuenta no encontrada"**
- El UUID de la cuenta es incorrecto
- Copia el ID exact desde la sección de Cuentas en la app

**"Pago no aparece en la app"**
- Recarga Finanzas PWA (cierra y abre)
- Verifica que el token sea válido (puede expirar si usas el mismo token varias veces al día)

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
