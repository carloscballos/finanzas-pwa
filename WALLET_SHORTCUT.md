# Apple Wallet → Finanzas PWA Shortcut

Registra pagos de Wallet en tu app con un Shortcut ultra-simple.

## Setup (una sola vez)

### 1. Generar token en la app

1. Abre **Finanzas PWA** → Configuración (o Settings)
2. Busca **"Generar token para Shortcut"**
3. Copia el token (algo como: `sk_live_abc123xyz...`)
4. **Guárdalo en un lugar seguro** (lo usarás en el siguiente paso)

### 2. Crear el Shortcut de Pagos

1. Abre **Shortcuts** en iOS
2. Crea nuevo → **"Crear shortcut vacío"**
3. Nombre: **"Finanzas - Pago"**
4. Agrega estos pasos (busca estos nombres exactos):

```
PASO 1: Solicitar número
  Busca en Shortcuts: "Solicitar número"
  - Título: "¿Cuánto pagaste?"
  - Guarda el resultado en una variable (dale nombre: AMOUNT)

PASO 2: Obtener URL
  Busca en Shortcuts: "Obtener URL" o "Get URL contents"
  - URL: https://api.koystudio.dev/api/v1/transactions
  - Método: POST
  - Headers (presiona el engranaje/⚙️):
    * Content-Type: application/json
    * Authorization: Bearer sk_live_abc123xyz...
      (reemplaza "sk_live..." con tu token copiado arriba)
  - Body (cuerpo):
    {
      "type": "EXPENSE",
      "amount": AMOUNT,
      "occurredAt": Hora actual,
      "status": "PENDING"
    }

PASO 3: Mostrar resultado
  Busca en Shortcuts: "Mostrar resultado"
  - Mensaje: "✅ Pago registrado en Finanzas"
```

### 3. Usar el Shortcut

**Manual** (siempre funciona):
- Toca el ícono del Shortcut en pantalla de inicio (o en la app)
- Ingresa el monto
- Listo, aparece en la app como "1 pago pendiente"

**Automático** (iOS 18+, opcional):
1. Abre **Automations** en Shortcuts (pestaña abajo)
2. Presiona **+** → "Crear automatización personal"
3. Selecciona **"Wallet"** → "Se completa un pago con Wallet"
4. Elige tu Shortcut "Finanzas - Pago"
5. Desactiva "Preguntar antes de ejecutar"
6. ✅ Cada pago con Wallet ejecuta el Shortcut automáticamente

## Primer uso

1. Genera el token en la app (paso 1 arriba)
2. Copia el token en el Shortcut (paso 2 → PASO 2 → Authorization header)
3. **Cada pago**:
   - Toca el Shortcut (o automático si configuraste Automation)
   - Ingresa monto
   - Aparece en la app como "1 pago pendiente"
4. **En la app**:
   - Home muestra contador de pagos pendientes
   - Abre el drawer
   - Elige cuenta, categoría, edita lo que quieras
   - Confirma

## 🔒 Seguridad

- **Token**: almacenado en el Shortcut (puedes revocarlo desde la app en cualquier momento)
- **HTTPS**: todas las conexiones cifradas
- **Sin credenciales**: no almacenas email/contraseña en el dispositivo
- **Revocación**: genera un token nuevo desde la app si el anterior se compromete

## ⚠️ Troubleshooting

**"Error de sintaxis en el Shortcut"**
- Verifica que el JSON del Body esté bien formateado
- Asegúrate de reemplazar `sk_live_abc...` con tu token real
- Las comillas y comas deben estar exactas

**"Error 401 - Token inválido"**
- Tu token expiró o es incorrecto
- Genera un token nuevo en la app (Configuración → "Generar token para Shortcut")
- Copia el nuevo token en el Shortcut

**"Error de conexión"**
- Verifica que tengas internet (WiFi o datos)
- Comprueba que la URL sea exacta: `https://api.koystudio.dev/api/v1/transactions`
- Si sigue fallando, la API podría estar caída (revisa el estado en la app)

**"Pago no aparece en la app"**
- Recarga Finanzas (cierra y abre)
- Verifica que no haya error (el Shortcut debería mostrar ✅ al final)
- Si dice "Error", toca para ver el detalle exacto

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
