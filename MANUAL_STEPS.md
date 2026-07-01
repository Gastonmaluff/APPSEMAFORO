# Pasos manuales pendientes

Solo queda **una** acción que no puedo automatizar porque requiere tu
autorización de facturación:

## ✅ Activar el plan Blaze en el proyecto Firebase

Firebase Cloud Functions (2ª gen) y Secret Manager exigen el plan
**Blaze (pago por uso)**. Tiene una cuota gratuita generosa; para este semáforo
el costo esperado es prácticamente nulo, pero Google pide una tarjeta.

1. Entrá a:
   **https://console.firebase.google.com/project/steamdeck-semaforo/usage/details**
2. Clic en **Modify plan / Upgrade** → elegí **Blaze**.
3. Asociá (o creá) una cuenta de facturación y confirmá.

> Opcional recomendado: en la consola de Google Cloud podés fijar un
> **presupuesto con alerta** (por ejemplo 1 USD) para enterarte si algo se
> dispara.

Cuando esté activo, avisame y continúo automáticamente con:

- registrar el secreto del webhook en Secret Manager (ya está generado),
- desplegar la Cloud Function `githubWebhook`,
- crear los webhooks `workflow_run` en los repos monitoreados,
- verificar el `ping` y correr una prueba real de deploy,
- finalizar `DELIVERY_REPORT.md`.

Ningún otro paso queda a tu cargo.
