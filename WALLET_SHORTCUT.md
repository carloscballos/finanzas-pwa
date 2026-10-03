# Apple Wallet → Finanzas PWA Shortcut

Registra pagos de Wallet en tu app con un Shortcut ultra-simple.

## Setup (una sola vez)

### 1. Generar token en la app

1. Abre **Finanzas PWA** → tu nombre (abajo a la izquierda) → **Configuración** → **Código de acceso (token)**
2. Toca **Generar token**
3. Cópialo (empieza por `fin_`). **Se muestra una sola vez**: si no lo copias, genera otro
4. Pégalo en el Shortcut (siguiente paso)

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
    * Authorization: Bearer fin_...
      (reemplaza "fin_..." con tu token copiado arriba)
  - Body (cuerpo):
    {
      "type": "EXPENSE",
      "amount": AMOUNT,
      "occurredAt": Hora actual
    }
    (no hace falta cuenta ni categoría: el pago queda pendiente y las eliges
    al confirmarlo en la app; con este token siempre se guarda como pendiente)

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

- **Alcance limitado**: el token solo puede registrar pagos *pendientes*. No lee cuentas ni saldos, y no confirma, edita ni borra nada. Cualquier otra ruta responde 403.
- **Solo se guarda su hash**: la app no puede volver a mostrarte el token (por eso se ve una sola vez).
- **Un token por usuario**: generar uno nuevo revoca el anterior. También puedes **Revocar** sin generar otro.
- **HTTPS** en todas las conexiones, y límite de intentos por IP.
- Los pagos pendientes **no mueven el saldo** hasta que los confirmas.

## ⚠️ Troubleshooting

**"Error de sintaxis en el Shortcut"**
- Verifica que el JSON del Body esté bien formateado
- Asegúrate de reemplazar `fin_...` con tu token real
- Las comillas y comas deben estar exactas

**"Error 403"**
- El token solo sirve para `POST /api/v1/transactions`; revisa la URL y el método

**"Error 401 - Token inválido"**
- Tu token fue revocado (o lo cambiaste por uno nuevo) o está mal copiado
- Genera un token nuevo en la app (Configuración → Código de acceso)
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
