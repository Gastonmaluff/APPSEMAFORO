# STEAM DECK SEMÁFORO 🚦

Pantalla ambiental tipo **semáforo** para dejar abierta en una Steam Deck al
costado del escritorio. De un vistazo —incluso a ~10 metros— muestra el estado
real del **deploy** de uno o varios repositorios de GitHub.

El color ocupa toda la pantalla:

| Color | Estado | Palabra | Significado |
|-------|--------|---------|-------------|
| 🔵 Azul | `running` | **EJECUTANDO** | El workflow de deploy está encolado / en progreso. |
| 🟢 Verde | `success` | **LISTO** | El deploy de producción terminó **con éxito**. |
| 🔴 Rojo | `failed` | **FALLÓ** | El workflow falló o expiró (`failure` / `timed_out`). |
| 🟡 Ámbar | `attention` | **ATENCIÓN** | Cancelado, requiere acción o quedó obsoleto. |
| ⚫ Gris | `unknown` / `offline` | **SIN DATOS / SIN CONEXIÓN** | Sin información o sin conexión a Firebase. |

> El **verde solo aparece cuando el workflow de deploy real terminó en
> `success`**. Un simple `push` o `commit` nunca marca verde por sí mismo.

Si un run queda "ejecutando" sin novedades por más de 15 minutos, la pantalla
pasa a ámbar con el aviso **POSIBLEMENTE ESTANCADO** (se calcula en el cliente,
no se pisa el estado real guardado).

---

## Arquitectura (orientada a eventos, sin polling)

```
   GitHub                    Firebase Cloud Function (gen2)         Firebase RTDB           Web App (PWA)
 ┌────────┐   workflow_run   ┌───────────────────────────┐  write  ┌─────────────┐  onValue ┌────────────┐
 │ deploy │ ───────────────► │ 1. valida X-Hub-Signature │ ──────► │ displays/   │ ───────► │ Steam Deck │
 │ repo   │   (webhook POST) │ 2. filtra repo/workflow   │         │  deck/repos │  (WS)    │  cambia de │
 └────────┘                  │ 3. idempotencia (delivery)│         └─────────────┘          │   color    │
                             │ 4. mapea estado → color   │                                  └────────────┘
                             └───────────────────────────┘
```

- **No** hay polling contra la API de GitHub.
- **No** hay token de GitHub en el frontend.
- El frontend solo **lee** RTDB en tiempo real por WebSocket.
- El backend es el **único** que escribe, y solo tras validar la firma HMAC.

### Stack

React · TypeScript · Vite · PWA · Firebase Hosting · Firebase Realtime
Database · Firebase Cloud Functions (2ª gen) · GitHub Webhooks (`workflow_run`).

---

## Estructura

```
.
├── firebase.json            # Hosting + Functions + Database
├── database.rules.json      # Reglas RTDB (lectura pública mínima, escritura solo backend)
├── functions/               # Backend: webhook receiver (TypeScript)
│   └── src/
│       ├── index.ts         # Función HTTP: firma, filtro, idempotencia, escritura
│       ├── verify.ts        # Validación HMAC de X-Hub-Signature-256
│       ├── state.ts         # Mapeo evento → estado y registro (puro, testeable)
│       └── config.ts        # Allowlist de repos / workflows / ramas
└── web/                     # Frontend: PWA del semáforo
    └── src/
        ├── App.tsx          # Orquestador (datos, rotación, kiosco, sonido)
        ├── components/      # Beacon, Controls, ConfigPanel
        ├── firebase.ts      # Suscripción en tiempo real a RTDB
        └── status.ts        # Estado visual efectivo (incluye estancado / offline)
```

---

## Desarrollo local

Requisitos: Node 20+, Firebase CLI, cuenta de Firebase.

```bash
# Backend
cd functions
npm install
npm test          # tests de firma, filtro y mapeo de estados
npm run build

# Frontend
cd ../web
cp .env.example .env          # completá con tu proyecto (firebase apps:sdkconfig web)
npm install
npm run dev                   # http://localhost:5173
npm test                      # tests de estado visual / estancado / offline
```

Los valores de `web/.env` (apiKey, databaseURL, etc.) son **públicos** por
diseño de Firebase; no son secretos. El secreto del webhook vive **solo** en
Secret Manager y en la config del webhook de GitHub.

---

## Despliegue

```bash
# 1. Frontend
cd web && npm run build && cd ..

# 2. Reglas RTDB + Hosting
firebase deploy --only database,hosting

# 3. Secreto del webhook (una vez; queda en Secret Manager)
firebase functions:secrets:set GH_WEBHOOK_SECRET

# 4. Backend (Function gen2). Requiere plan Blaze.
firebase deploy --only functions
```

La URL pública del endpoint se obtiene tras el paso 4 y se usa para crear el
webhook en cada repo monitoreado (ver más abajo).

---

## Cómo agregar otro repositorio

1. Editá `functions/src/config.ts` y agregá una entrada en `MONITORED` con el
   nombre **exacto** del workflow de deploy (`workflow_run.name`) y la rama.
2. `firebase deploy --only functions`.
3. Creá el webhook en el nuevo repo apuntando al mismo endpoint, con el mismo
   secreto, evento **Workflow runs**, `Content-Type: application/json`:

   ```bash
   gh api repos/<owner>/<repo>/hooks -X POST \
     -f name=web -F active=true \
     -f 'events[]=workflow_run' \
     -f config.url=<ENDPOINT> \
     -f config.content_type=json \
     -f config.secret=<SECRETO>
   ```

El alias visible del proyecto también puede ajustarse localmente desde el panel
de configuración de la app (engranaje ⚙, guardado por dispositivo).

---

## Uso en la Steam Deck

1. Abrí la URL de Hosting en el navegador.
2. Tocá **ACTIVAR MODO SEMÁFORO**: entra en pantalla completa, pide *Wake Lock*
   (mantiene la pantalla encendida) y oculta los controles.
3. Tocá la pantalla para ver controles discretos unos segundos (config, abrir
   run, cambiar de repo, salir de pantalla completa).
4. Instalable como PWA para lanzarla como app dedicada.

Consultá `SECURITY.md` para el modelo de seguridad y la rotación del secreto.
