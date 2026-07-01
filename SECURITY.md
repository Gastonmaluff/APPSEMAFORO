# Seguridad — STEAM DECK SEMÁFORO

## Protección del webhook

Cada webhook de GitHub se envía por HTTPS a la Cloud Function y se valida antes
de procesar cualquier dato:

1. **Firma HMAC `X-Hub-Signature-256`.** La función recalcula
   `HMAC-SHA256(rawBody, secreto)` y compara con comparación de **tiempo
   constante** (`crypto.timingSafeEqual`). Cualquier firma ausente, con longitud
   distinta o que no coincida se rechaza con `401` y no se procesa.
2. **Cabecera `X-GitHub-Event`.** Solo se procesan eventos `workflow_run`. El
   evento `ping` responde `200` sin efectos. El resto se ignora con `202`.
3. **Cabecera `X-GitHub-Delivery` (idempotencia).** El `deliveryId` se guarda en
   `displays/deck/_deliveries/{id}`. Si un delivery ya fue procesado, se
   responde `200 duplicate` sin reescribir el estado. Los registros se purgan
   pasados 7 días.
4. **Allowlist.** Solo los `owner/repo`, los nombres de workflow y las ramas
   declarados en `functions/src/config.ts` pueden modificar la pantalla. Un
   repo, workflow o rama no autorizados se descartan con `202` (aunque la firma
   fuera válida).

## Gestión de secretos

- El secreto del webhook se genera con `crypto.randomBytes(32)` (256 bits).
- Se almacena **únicamente** en **Google Secret Manager** (via
  `firebase functions:secrets:set GH_WEBHOOK_SECRET`) y en la configuración del
  webhook de cada repo en GitHub.
- **Nunca** aparece en el código, en archivos versionados, en el frontend, en
  logs, en el README ni en la salida de consola.
- `.gitignore` bloquea `*.secret`, `webhook.secret`, `.env`, `service-account*`
  y variantes. La copia local usada durante la instalación
  (`functions/webhook.secret`) está ignorada por git y puede borrarse tras
  configurar los webhooks.
- Los valores de `web/.env` (`apiKey`, `databaseURL`, `appId`, …) **no son
  secretos**: Firebase los expone por diseño en el cliente. La protección real
  la dan las **reglas de RTDB**, no el ocultamiento de esas claves.

## Qué información se almacena

En RTDB solo se guarda información **mínima y no confidencial** por repo
(`displays/deck/repos/{repoId}`):

`displayName`, `repository`, `workflowName`, `branch`, `status`, `conclusion`,
`startedAt`, `updatedAt`, `completedAt`, `durationSeconds`, `runNumber`,
`runUrl`, `shortSha`, `deliveryId`.

**No** se almacenan: mensajes de commit, nombres de autores, contenidos del
repo, tokens ni ningún secreto. `runUrl` es un enlace a la página del run.

### Reglas de RTDB

- Raíz: lectura y escritura denegadas por defecto.
- `displays/`: **lectura pública** (solo los datos mínimos de arriba),
  **escritura denegada** para todos los clientes.
- Solo el Admin SDK del backend (que omite las reglas) escribe estados. Ningún
  cliente puede falsificar la pantalla.

## Cómo rotar el secreto

1. Generar y guardar un nuevo secreto en Secret Manager:
   ```bash
   firebase functions:secrets:set GH_WEBHOOK_SECRET
   firebase deploy --only functions        # la función toma la nueva versión
   ```
2. Actualizar el secreto en **cada** webhook de GitHub:
   ```bash
   gh api repos/<owner>/<repo>/hooks/<hookId> -X PATCH \
     -f config.secret=<NUEVO_SECRETO> -f config.url=<ENDPOINT> -f config.content_type=json
   ```
3. Verificar con un redeploy o el botón *Redeliver* del ping en GitHub.
4. Opcional: destruir versiones viejas del secreto en Secret Manager.

## Cómo eliminar accesos

- **Dejar de monitorear un repo:** borrá su webhook
  (`gh api repos/<owner>/<repo>/hooks/<id> -X DELETE`) y quitá la entrada de
  `MONITORED` en `functions/src/config.ts` + redeploy.
- **Cortar todo:** borrá los webhooks de todos los repos y/o eliminá la Cloud
  Function (`firebase functions:delete githubWebhook`). Sin la función, nada
  puede escribir en RTDB.
- **Revocar el secreto:** rotarlo (arriba) invalida cualquier firma vieja.

## Reporte de vulnerabilidades

Este es un proyecto personal. Si detectás un problema de seguridad, abrí un
issue **sin** incluir secretos ni payloads con datos privados.
