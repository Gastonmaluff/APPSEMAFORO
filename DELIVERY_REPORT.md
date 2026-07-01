# DELIVERY REPORT — STEAM DECK SEMÁFORO

_Entrega completa y verificada end-to-end en producción._

## Estado general

| Componente | Estado |
|---|---|
| Frontend (PWA) | ✅ Desplegado |
| Firebase Hosting | ✅ Desplegado |
| Realtime Database + reglas | ✅ Creada y reglas publicadas |
| Backend (Cloud Function webhook gen2) | ✅ Desplegado |
| Secreto del webhook | ✅ En Secret Manager (versión 1) |
| Webhooks en repos monitoreados | ✅ 4 creados, `ping` respondido con 200 |
| Prueba real end-to-end | ✅ azul → verde con deploy real; rojo por fallo firmado |
| Código en GitHub | ✅ Push a `APPSEMAFORO` (main) |

## Datos del despliegue

- **URL final (Steam Deck):** https://steamdeck-semaforo.web.app
- **Repositorio del proyecto:** https://github.com/Gastonmaluff/APPSEMAFORO
- **Rama:** `main`
- **Proyecto Firebase:** `steamdeck-semaforo`
- **Realtime Database:** `https://steamdeck-semaforo-default-rtdb.firebaseio.com` (us-central1)
- **Endpoint del webhook (público, sin secreto):**
  `https://us-central1-steamdeck-semaforo.cloudfunctions.net/githubWebhook`
- **Secreto del webhook:** en Google Secret Manager como `GH_WEBHOOK_SECRET`.
  No se incluye aquí ni en ningún archivo versionado.

## Repositorios monitoreados

| Repo | Workflow de deploy monitoreado | Rama | Webhook |
|---|---|---|---|
| `Gastonmaluff/NEXT-CONTROL` | `Deploy to GitHub Pages` | `main` | ✅ id 648139955 |
| `Gastonmaluff/CRMGAMIGOMITAS` | `pages build and deployment` | `main` | ✅ id 648139959 |
| `Gastonmaluff/LUCCAPARK-APP` | `pages build and deployment` | `gh-pages` | ✅ id 648139961 |
| `Gastonmaluff/Panel-de-Quintas-` | `Deploy GitHub Pages` | `main` | ✅ id 648139964 |

## Resultado de las pruebas

### Automatizadas (vitest)
- **Backend:** 19/19 ✅ — firma válida/inválida, header ausente, cuerpo
  alterado, secreto vacío; filtro por repo/workflow/rama; mapeo de estados
  (running/success/failed/attention/skipped); registro sin datos privados.
- **Frontend:** 8/8 ✅ — offline, sin datos, running, estancado, success,
  failed, attention con motivo, recuperación de conexión.

### En producción (contra el endpoint real)
- `GET` → `405` ✅ · `POST` sin firma → `401` ✅
- `ping` de GitHub en los 4 repos → `200` ✅
- **Deploy real** de NEXT-CONTROL (rerun no destructivo): `running` (azul) →
  `success` (verde) con SHA real `e96bdab` ✅
- **Fallo firmado** → `failed` (rojo) ✅
- **Idempotencia**: delivery repetido → `duplicate:true`, sin reescritura ✅
- **Repo no autorizado** → `202 ignored repo_not_allowed` ✅
- Estado final del display: **verde/success real** (estado verdadero del repo).

## Bloqueos pendientes

Ninguno. El plan Blaze fue activado por el usuario y desbloqueó todo el backend.

## Recomendaciones para la próxima versión

- Autenticación anónima de Firebase para restringir la lectura de RTDB por
  dominio si en el futuro se agregan repos privados.
- Métrica de "tiempo desde último deploy exitoso" y racha de fallos por repo.
- Notificación push (FCM) opcional al pasar a rojo.
- Panel de configuración protegido por PIN local.
- Presupuesto de Cloud con alerta integrado al panel.
