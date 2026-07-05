# SETUP — Monitor de agentes (Claude Code + Codex) + Deploy GitHub

Guía para el monitor unificado del semáforo. El **área principal** la controlan los
hooks locales de **Claude Code** y **Codex**; el **deploy de GitHub** quedó como
indicador secundario compacto a la derecha (banda inferior en pantallas angostas).

---

## 1. Arquitectura final

```
Claude Code / Codex (hooks locales)
  → scripts/agent-hook-forwarder.mjs   (lee stdin, arma payload mínimo, POST HTTPS)
  → Cloud Function HTTPS  agentHook     (valida secreto, valida source/event,
                                         idempotencia, transacción sobre agents/)
  → Realtime Database  agents/{claude|codex}
  → listener onValue en la PWA          → Steam Deck (área principal)

GitHub workflow_run → githubWebhook (SIN CAMBIOS) → displays/deck → indicador secundario
```

Dos fuentes independientes. GitHub nunca decide si Claude/Codex trabajan. El estado
de los agentes tiene prioridad visual.

Estados por agente y colores:

| Estado | Color | Cuándo |
|---|---|---|
| `idle` | gris oscuro | sin tareas ni resultado reciente |
| `working` | azul intenso | ≥1 tarea activa |
| `completed` | verde intenso | terminó; se mantiene 120 s y vuelve a idle |
| `error` | rojo intenso | una tarea falló (independiente del otro agente) |

Layout: **sin tareas** → pantalla gris única "Sin tareas" con logos tenues · **un
agente** → ocupa todo · **ambos** → split vertical (Codex izquierda, Claude derecha),
estados independientes.

---

## 2. Archivos creados / modificados

**Backend (`functions/`)**
- `src/agents.ts` *(nuevo)* — lógica pura: normaliza evento, arma taskKey, reduce estado.
- `src/agentHook.ts` *(nuevo)* — Cloud Function HTTPS `agentHook`.
- `src/config.ts` *(mod)* — `AGENT_HOOK_SECRET_NAME`, `AGENTS`.
- `src/index.ts` *(mod)* — exporta `agentHook` (deja `githubWebhook` intacto).
- `src/__tests__/agents.test.ts` *(nuevo)* — 13 tests.
- `database.rules.json` *(mod)* — nodo `agents/` (lectura pública mínima, escritura solo backend).

**Forwarder + hooks (`scripts/`)**
- `agent-hook-forwarder.mjs`, `simulate-agent-events.mjs`, `.env.example`,
  `hooks/claude-settings.hooks.json`, `hooks/codex-plugin/hooks/hooks.json`.

**Frontend (`web/`)**
- `src/agents/{types,state,state.test}.ts` *(nuevo)*.
- `src/hooks/useAgentsData.ts` *(nuevo)*.
- `src/components/{AgentStage,AgentPanel,GithubIndicator,AgentLogo}.tsx` *(nuevo)*.
- `public/{claude,codex}-logo.svg` *(nuevo, placeholders)*.
- `src/App.tsx`, `src/firebase.ts`, `src/prefs.ts`, `src/styles.css`,
  `src/components/ConfigPanel.tsx` *(mod)*.

> El `Beacon.tsx` original (semáforo GitHub a pantalla completa) queda **retirado**
> del área principal pero **no se elimina**; su mapeo de estados (`status.ts` /
> `computeVisual`) se **reutiliza** en el indicador secundario `GithubIndicator`.

---

## 3. Configuración de Firebase

Mismo proyecto existente: **`steamdeck-semaforo`** (no se creó otro). Se reutiliza la
**Realtime Database** existente (no se agregó Firestore).

- RTDB: `https://steamdeck-semaforo-default-rtdb.firebaseio.com`
- Hosting: `https://steamdeck-semaforo.web.app`
- Los valores de `web/.env` (apiKey, databaseURL, …) son **públicos** por diseño de
  Firebase; la protección real la dan las reglas de RTDB.

## 4. Cloud Function

`agentHook` (gen2, us-central1):
`https://us-central1-steamdeck-semaforo.cloudfunctions.net/agentHook`

- Solo `POST`. Header obligatorio `X-Agent-Secret` (comparación de tiempo constante).
- Valida `source ∈ {claude,codex}` y `event ∈ {start,stop,failure,session_end,heartbeat}`.
- Idempotencia por `eventId` (`agents/_events`, TTL 24 h).
- Escribe con **transacción** sobre `agents/{source}`. Registra solo metadatos.

## 5. Firestore / Realtime Database (estructura)

```
agents/
  claude/  { status, activeCount, tasks:{ <key>:{startedAt,lastActivityAt,sessionId,cwd} },
             lastCompletedAt, lastError, lastCwd, updatedAt }
  codex/   { …igual… }
  _events/ { <eventId>: { at } }     # idempotencia
  meta/    { updatedAt, lastSource }
```

`cwd` se guarda **solo como basename** (nombre de carpeta). Nunca se guardan prompts,
archivos, tokens ni secretos.

## 6. Reglas de seguridad

`agents/`: `.read = true` (solo datos mínimos), `.write = false` (solo el Admin SDK del
backend escribe). El frontend es **de solo lectura**: no puede falsificar estados.
`displays/` (GitHub) queda igual que antes.

## 7. Variables de entorno / secretos

| Secreto | Dónde vive | Para qué |
|---|---|---|
| `GH_WEBHOOK_SECRET` | Secret Manager | firma de los webhooks de GitHub (sin cambios) |
| `AGENT_HOOK_SECRET` | Secret Manager **+** `%USERPROFILE%\.agent-hook\config.json` | autentica el forwarder |

`%USERPROFILE%\.agent-hook\config.json` (gitignored, **fuera del repo**):

```json
{
  "url": "https://us-central1-steamdeck-semaforo.cloudfunctions.net/agentHook",
  "secret": "<AGENT_HOOK_SECRET>"
}
```

Regenerar/rotar el secreto:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > secret.txt
firebase functions:secrets:set AGENT_HOOK_SECRET --data-file secret.txt --project steamdeck-semaforo
firebase deploy --only functions --project steamdeck-semaforo
# actualizar también %USERPROFILE%\.agent-hook\config.json con el nuevo valor
del secret.txt
```

## 8. Instalación del forwarder

1. Node 18+ en el PATH (`node -v`).
2. Crear `%USERPROFILE%\.agent-hook\config.json` (arriba) con la URL y el secreto.
3. Probar en seco (no hace red):
   ```bash
   echo {} | node "scripts/agent-hook-forwarder.mjs" --source claude --event start --test
   ```
4. El forwarder **nunca bloquea** al agente: timeout corto, 1 reintento, falla en
   silencio y registra en `%USERPROFILE%\.agent-hook\forwarder.log`.

## 9. Instalación de hooks de Claude Code

Ya aplicado en `%USERPROFILE%\.claude\settings.json` (backup previo:
`settings.json.bak.<timestamp>`). Se **fusionaron** (no se pisó nada):

| Evento Claude | → | event |
|---|---|---|
| `UserPromptSubmit` | → | `start` (working) |
| `Stop` | → | `stop` (completed) |
| `StopFailure` | → | `failure` (error) |
| `SessionEnd` | → | `session_end` |

La plantilla está en `scripts/hooks/claude-settings.hooks.json`. Si movés el repo,
actualizá la ruta absoluta del forwarder en los comandos.

## 10. Instalación de hooks de Codex

**Método que funciona (Codex CLI 0.142.x): config global `%USERPROFILE%\.codex\hooks.json`.**
Plantilla versionada en `scripts/hooks/codex-hooks.json` (`UserPromptSubmit→start`,
`Stop→stop`, con `--emit-continue` que devuelve `{"continue":true}` para no bloquear el
turno). Copiala a `%USERPROFILE%\.codex\hooks.json` y ajustá la ruta absoluta del
forwarder. El campo `notify` de Codex **no se toca** (lo usa computer-use). Como respaldo,
si Codex no emitiera `Stop`, las tareas huérfanas expiran solas (ver §16).

> El intento previo con **plugin local + marketplace** (`scripts/hooks/codex-plugin/`)
> quedó **descartado**: Codex 0.142.x no carga un plugin agregado a mano fuera de su
> flujo de instalación (verificado con `/hooks`). Se usa `hooks.json` de usuario.

## 11. Cómo revisar hooks con `/hooks`

En Codex, tras colocar el `hooks.json`, ejecutá **`/hooks`** dentro de Codex para
revisarlos y **confiar** en ellos (Codex registra un `trusted_hash` sha256 en
`config.toml`). Este es un **paso manual interactivo** que no puede automatizarse.
En Claude Code podés verificar los hooks activos con `/hooks` también.

## 12. Cómo simular eventos

```bash
# Sin red (imprime lo que enviaría):
node scripts/simulate-agent-events.mjs both --dry

# Contra la function real (necesita config.json o env):
node scripts/simulate-agent-events.mjs claude       # start→azul, stop→verde
node scripts/simulate-agent-events.mjs both         # split; Codex verde, Claude azul
node scripts/simulate-agent-events.mjs multi        # 2 tareas: sigue azul hasta vaciar
node scripts/simulate-agent-events.mjs fail-claude  # Claude rojo, Codex intacto
node scripts/simulate-agent-events.mjs duplicate    # idempotencia (duplicate:true)
```

## 13. Cómo probar desde la Steam Deck

1. Abrí `https://steamdeck-semaforo.web.app`.
2. Tocá **ACTIVAR MODO SEMÁFORO** (fullscreen + Wake Lock, oculta el cursor por inactividad).
3. Lanzá el simulador desde la PC y mirá el cambio en tiempo real en la Deck.

## 14. Cómo restaurar backups

- Claude: copiar `%USERPROFILE%\.claude\settings.json.bak.<timestamp>` sobre `settings.json`.
- Código: `git reset --hard backup/pre-agents-monitor` (tag de respaldo previo a los cambios).

## 15. Cómo deshabilitar temporalmente los hooks

- Claude: en `%USERPROFILE%\.claude\settings.json`, borrá (o comentá vía backup) la clave
  `hooks`, o vaciá el `command`. También podés renombrar el `config.json` del forwarder:
  sin config, el forwarder no envía nada (no rompe nada).
- Codex: quitá el `hooks.json` del plugin o revocá la confianza en `/hooks`.

## 16. Cómo diagnosticar problemas

- `%USERPROFILE%\.agent-hook\forwarder.log` — errores del forwarder (red/config).
- Panel ⚙ de la app → sección **Agentes**: conexión, estado por agente, último ok/error,
  botón **Limpiar estado local** (borra el cache local, no el servidor).
- Tareas fantasma: expiran solas tras `agentOrphanMin` (**45 min** por defecto, ajustable en ⚙).
- **Tareas largas**: los hooks `PostToolUse` envían un `heartbeat` (throttle ~90 s por sesión)
  que refresca `lastActivityAt`, así una tarea activa se mantiene en azul sin importar cuánto
  dure. La ventana de 45 min es solo la red de seguridad ante un agente que crashea sin `Stop`.
- Logs de la function: `firebase functions:log --only agentHook --project steamdeck-semaforo`.

## 17. Cómo conservar el monitor actual de GitHub

Intacto: el webhook `workflow_run` → `githubWebhook` → `displays/deck` sigue igual. Solo
cambió su **ubicación visual**: ahora es el indicador compacto de la derecha
(`GithubIndicator`), con spinner en "Publicando", check en "Listo" y rojo en "Deploy
fallido" — **solo el indicador se anima**, nunca el color principal de los agentes.

## 18. Pasos manuales pendientes

1. **Crear `%USERPROFILE%\.agent-hook\config.json`** con la URL de `agentHook` y el
   `AGENT_HOOK_SECRET` (si no se creó automáticamente). Sin esto, el forwarder no envía.
2. **Codex `/hooks`**: colocar `scripts/hooks/codex-plugin/hooks/hooks.json` donde Codex
   lo tome y **confiar** en él vía `/hooks` (paso interactivo).
3. **Reiniciar** las sesiones de Claude/Codex para que tomen los hooks nuevos.
