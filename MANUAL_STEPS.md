# Pasos manuales pendientes

**No queda ningún paso manual pendiente.** ✅

El único bloqueo (activar el plan **Blaze** en `steamdeck-semaforo`) ya fue
resuelto por el usuario, y a partir de ahí todo se completó automáticamente:
secreto en Secret Manager, deploy de la Cloud Function, webhooks en los 4 repos,
verificación de `ping` y prueba real de deploy (azul → verde) más simulación
firmada de fallo (rojo), idempotencia y rechazo de repos no autorizados.

## Operación normal (referencia, no requiere acción)

- **Abrir en la Steam Deck:** https://steamdeck-semaforo.web.app → botón
  **ACTIVAR MODO SEMÁFORO** (pantalla completa + wake lock).
- **Agregar otro repo:** ver la sección correspondiente del `README.md`.
- **Rotar el secreto / eliminar accesos:** ver `SECURITY.md`.

> Recomendación opcional: fijá un presupuesto con alerta en Google Cloud Billing
> para el proyecto (el uso esperado entra en la cuota gratuita, pero es buena
> práctica). Consola: Billing → Budgets & alerts.
