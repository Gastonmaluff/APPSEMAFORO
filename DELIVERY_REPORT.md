# DELIVERY REPORT — STEAM DECK SEMÁFORO

_Última actualización: fase 1 (todo lo que no depende de facturación)._

## Estado general

| Componente | Estado |
|---|---|
| Frontend (PWA) | ✅ Desplegado |
| Firebase Hosting | ✅ Desplegado |
| Realtime Database + reglas | ✅ Creada y reglas publicadas |
| Backend (Cloud Function webhook) | ⏳ Pendiente de plan Blaze |
| Secreto del webhook | ✅ Generado · ⏳ pendiente subir a Secret Manager (Blaze) |
| Webhooks en repos monitoreados | ⏳ Pendiente (tras deploy del backend) |
| Prueba real end-to-end | ⏳ Pendiente (tras webhook) |
| Código en GitHub | ✅ Push a `APPSEMAFORO` |

## Datos del despliegue

- **URL final (Steam Deck):** https://steamdeck-semaforo.web.app
- **Repositorio del proyecto:** https://github.com/Gastonmaluff/APPSEMAFORO
- **Rama:** `main`
- **Proyecto Firebase:** `steamdeck-semaforo`
- **Realtime Database:** `https://steamdeck-semaforo-default-rtdb.firebaseio.com` (us-central1)
- **Endpoint del webhook:** _(se completa tras desplegar la función; el secreto NO se incluye aquí)_

## Repositorios monitoreados

| Repo | Workflow de deploy monitoreado | Rama |
|---|---|---|
| `Gastonmaluff/NEXT-CONTROL` | `Deploy to GitHub Pages` | `main` |
| `Gastonmaluff/CRMGAMIGOMITAS` | `pages build and deployment` | `main` |
| `Gastonmaluff/LUCCAPARK-APP` | `pages build and deployment` | `gh-pages` |
| `Gastonmaluff/Panel-de-Quintas-` | `Deploy GitHub Pages` | `main` |

## Resultado de las pruebas

- **Backend (vitest):** 19/19 ✅ — firma válida/ inválida, header ausente, body
  alterado, secreto vacío; filtro por repo/workflow/rama; mapeo de estados
  (running/success/failed/attention/skipped); construcción de registro sin datos
  privados.
- **Frontend (vitest):** 8/8 ✅ — offline, sin datos, running, estancado,
  success, failed, attention con motivo, recuperación de conexión.
- **Prueba real end-to-end:** ⏳ pendiente (requiere webhook activo).

## Bloqueos pendientes

1. **Plan Blaze** en `steamdeck-semaforo` (acción del usuario). Ver
   `MANUAL_STEPS.md`. Es el único bloqueo; desbloquea backend + webhook + prueba
   real.

## Recomendaciones para la próxima versión

- Autenticación anónima de Firebase para restringir aún más la lectura de RTDB
  por dominio, si en el futuro se agregan repos privados.
- Métrica de "tiempo desde último deploy exitoso" y racha de fallos por repo.
- Notificación push (FCM) opcional al pasar a rojo.
- Panel de configuración protegido por PIN local.
- Alertas de presupuesto de Cloud Functions integradas al panel.
