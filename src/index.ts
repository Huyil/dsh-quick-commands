/**
 * @dsh-external/dsh-quick-commands — host half.
 *
 * Owns the quick-command definitions the agent writes through the
 * `quick_commands` tool and serves them to the browser half at
 * `GET /quick-commands/api`. The Session panel section renders one button per
 * definition: a named shell command line, shown when the row expands and
 * copied on demand.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-shell'
import type {} from '@deepseek-ai/dsh-working-directory'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const name = '@dsh-external/dsh-quick-commands'
export const inject = ['tools', 'webServer', 'shell', 'workingDirectory', 'sessions']

/** Plugin configuration. */
export interface Config {
  /** Store path; empty uses `$DSH_HOME/quick-commands.json`. */
  storeFile: string
  /**
   * Sandbox mode for one-click runs. The Session panel runs a command without
   * an Agent turn, so no permission preset applies; this deployment choice
   * decides the confinement. `danger-full-access` matches a profile whose
   * default preset is unconfined.
   */
  sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access'
}

/** Schemastery configuration for the store location and run confinement. */
export const Config: z<Config> = z.object({
  storeFile: z.string().default(''),
  sandboxMode: z.union(['read-only', 'workspace-write', 'danger-full-access'] as const).default('danger-full-access'),
})

/** One agent-defined quick command: a shell command line. */
interface QuickCommand {
  /** Stable slug addressed by update/remove. */
  id: string
  /** Button name shown in the Session panel. */
  label: string
  /** The command line itself, shown when the row expands and copied on demand. */
  command: string
  /** Optional tooltip. */
  description?: string
}

/** Persisted store document: one command list per Session. */
interface Store {
  version: 2
  /** Commands keyed by Session id; a Session without an entry has none. */
  sessions: Record<string, QuickCommand[]>
  /** Commands carried over from the pre-session-scoped store; never served. */
  defaults?: QuickCommand[]
}

const API_PREFIX = '/quick-commands/api'
const RUN_PATH = '/quick-commands/run'
const UPDATE_PATH = '/quick-commands/update'
/** Foreground budget for one quick command; a longer command is killed. */
const RUN_TIMEOUT_MS = 120_000
/** Largest accepted run body; the payload is two short ids. */
const MAX_BODY_BYTES = 4096

/** Resolve the store path: config override, else the DSH home default. */
function storePath(config: Config): string {
  if (config.storeFile !== '') return config.storeFile
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'quick-commands.json')
}

/** Read the store; a missing or malformed file reads as empty. */
function loadStore(file: string): Store {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    const sessions: Record<string, QuickCommand[]> = {}
    const rawSessions = parsed.sessions
    if (typeof rawSessions === 'object' && rawSessions !== null) {
      for (const [sessionId, rows] of Object.entries(rawSessions as Record<string, unknown>)) {
        if (Array.isArray(rows)) sessions[sessionId] = rows.filter(isCommand)
      }
    }
    // Pre-session-scoped documents carried one global list; keep it aside so the
    // migration loses nothing, but never serve it to a Session.
    const legacy = Array.isArray(parsed.commands) ? parsed.commands.filter(isCommand) : []
    return legacy.length > 0 ? { version: 2, sessions, defaults: legacy } : { version: 2, sessions }
  } catch {
    // Swallows a missing or unreadable store: an empty store is the same outcome.
    return { version: 2, sessions: {} }
  }
}

/** The command list of one Session (empty when it has none). */
function commandsOf(store: Store, sessionId: string): QuickCommand[] {
  return store.sessions[sessionId] ?? []
}

/** Whether one stored row is a complete command; a legacy `prompt` field reads as the command. */
function isCommand(value: unknown): value is QuickCommand {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || row.id === '') return false
  if (typeof row.label !== 'string' || row.label === '') return false
  if (typeof row.command !== 'string' || row.command === '') {
    if (typeof row.prompt !== 'string' || row.prompt === '') return false
    row.command = row.prompt
  }
  return row.description === undefined || typeof row.description === 'string'
}

/** Persist the store, creating its directory. */
function saveStore(file: string, store: Store): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

/** Derive a stable slug from a label, keeping ASCII letters, digits, and dashes. */
function slugify(label: string): string {
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ascii !== '' ? ascii : `cmd-${Date.now().toString(36)}`
}

/** Read one bounded JSON body; null when it is not a JSON object with string session and id. */
async function readJsonBody(req: { on?: (event: string, listener: (chunk?: unknown) => void) => void }): Promise<{ session: string; id: string; label?: string; command?: string; description?: string } | null> {
  const chunks: Buffer[] = []
  let size = 0
  const text = await new Promise<string | null>((resolve) => {
    req.on?.('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      size += buffer.length
      if (size > MAX_BODY_BYTES) {
        resolve(null)
        return
      }
      chunks.push(buffer)
    })
    req.on?.('end', () => { resolve(Buffer.concat(chunks).toString('utf8')) })
    req.on?.('error', () => { resolve(null) })
  })
  if (text === null) return null
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (typeof parsed.session !== 'string' || parsed.session === '') return null
    if (typeof parsed.id !== 'string' || parsed.id === '') return null
    const out: { session: string; id: string; label?: string; command?: string; description?: string } = { session: parsed.session, id: parsed.id }
    if (typeof parsed.label === 'string') out.label = parsed.label
    if (typeof parsed.command === 'string') out.command = parsed.command
    if (typeof parsed.description === 'string') out.description = parsed.description
    return out
  } catch {
    // Swallows a non-JSON body: the null case is the same rejection.
    return null
  }
}

/** Send one JSON response. */
function sendJson(res: { writeHead(code: number, headers: Record<string, string>): void; end(body: string): void }, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/**
 * Register the `quick_commands` tool and the read route.
 * @param ctx - registrant context carrying the tool registry and web server.
 * @param config - store location.
 */
export function apply(ctx: Context, config: Config): void {
  const file = storePath(config)

  ctx.tools.register(defineTool({
    name: 'quick_commands',
    description: 'Define this Session\'s quick commands: named shell command lines shown in the Session panel. Use list to read them, add to create one (label is the button name, command is the command line), update to change one by id, and remove to delete one.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['list', 'add', 'update', 'remove'],
        description: 'list | add | update | remove.',
      },
      id: { type: 'string', description: 'Command id; required for update and remove, optional for add (derived from label).' },
      label: { type: 'string', description: 'Button name shown in the Session panel; required for add.' },
      command: { type: 'string', description: 'The shell command line itself; required for add. Shown when the row expands and copied on demand.' },
      description: { type: 'string', description: 'Optional tooltip text.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true, description: 'Whether the action succeeded.' },
          message: { type: 'string', description: 'Failure reason when ok is false.' },
          commands: {
            type: 'array',
            description: 'The full command list after the action.',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                label: { type: 'string', required: true },
                command: { type: 'string', required: true },
                description: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `Quick commands (${value.commands?.length ?? 0}): ${(value.commands ?? []).map(row => row.label).join(', ') || 'none'}`
          : `quick_commands failed: ${value.message ?? 'unknown error'}`,
      }],
    },
    async execute(args, exec) {
      const sessionId = exec.agent?.session?.id
      if (sessionId === undefined) {
        return { ok: false, message: 'quick_commands requires an owning Session', commands: [] }
      }
      const store = loadStore(file)
      const commands = commandsOf(store, sessionId)
      const action = args.action
      if (action === 'list') return { ok: true, commands }
      if (action === 'add') {
        if (args.label === undefined || args.label === '' || args.command === undefined || args.command === '') {
          return { ok: false, message: 'add requires label and command', commands }
        }
        const id = args.id !== undefined && args.id !== '' ? args.id : slugify(args.label)
        if (commands.some(row => row.id === id)) {
          return { ok: false, message: `command id already exists: ${id}`, commands }
        }
        const row: QuickCommand = { id, label: args.label, command: args.command }
        if (args.description !== undefined && args.description !== '') row.description = args.description
        commands.push(row)
        store.sessions[sessionId] = commands
        saveStore(file, store)
        return { ok: true, commands }
      }
      if (args.id === undefined || args.id === '') {
        return { ok: false, message: `${action} requires id`, commands }
      }
      const index = commands.findIndex(row => row.id === args.id)
      if (index < 0) return { ok: false, message: `unknown command id: ${args.id}`, commands }
      if (action === 'remove') {
        commands.splice(index, 1)
        store.sessions[sessionId] = commands
        saveStore(file, store)
        return { ok: true, commands }
      }
      const current = commands[index]!
      const next: QuickCommand = {
        id: current.id,
        label: args.label !== undefined && args.label !== '' ? args.label : current.label,
        command: args.command !== undefined && args.command !== '' ? args.command : current.command,
      }
      const description = args.description !== undefined ? args.description : current.description
      if (description !== undefined && description !== '') next.description = description
      commands[index] = next
      store.sessions[sessionId] = commands
      saveStore(file, store)
      return { ok: true, commands }
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: (req: { method?: string; url?: string }, res: { writeHead(code: number, headers: Record<string, string>): void; end(body: string): void }) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (req.method !== 'GET' || url.pathname !== API_PREFIX) {
        sendJson(res, 405, { ok: false, message: 'GET only' })
        return
      }
      const sessionId = url.searchParams.get('session') ?? ''
      if (sessionId === '') {
        sendJson(res, 400, { ok: false, message: 'session query parameter is required' })
        return
      }
      sendJson(res, 200, { ok: true, commands: commandsOf(loadStore(file), sessionId) })
    },
  }), 'dsh-quick-commands: read route')

  // Run one defined command in the Session's working directory. The body names
  // the Session and the command id — never a raw command line — so the browser
  // can only run what this Session defined.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: RUN_PATH,
    handler: async (req: { method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; on?: (event: string, listener: () => void) => void }, res: { writeHead(code: number, headers: Record<string, string>): void; end(body: string): void }) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, message: 'POST only' })
        return
      }
      const body = await readJsonBody(req)
      if (body === null) {
        sendJson(res, 400, { ok: false, message: 'request body must be JSON with string "session" and "id"' })
        return
      }
      const session = ctx.sessions.get(body.session as never)
      if (session === undefined) {
        sendJson(res, 404, { ok: false, message: `unknown session: ${body.session}` })
        return
      }
      const command = commandsOf(loadStore(file), body.session).find(row => row.id === body.id)
      if (command === undefined) {
        sendJson(res, 404, { ok: false, message: `unknown command id: ${body.id}` })
        return
      }
      let workdir = process.cwd()
      try {
        workdir = ctx.workingDirectory.get(session)
      } catch {
        // Swallows a Session without a working directory: the process cwd is the fallback.
      }
      try {
        const spec = ctx.shell.resolve({
          command: command.command,
          workdir,
          timeoutMs: RUN_TIMEOUT_MS,
          sandboxPolicy: { mode: config.sandboxMode, workspaceRoot: workdir },
        })
        const execution = await ctx.shell.execute(spec)
        const result = await execution.result()
        sendJson(res, 200, {
          ok: result.exitCode === 0 && !result.timedOut && !result.aborted,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          aborted: result.aborted,
          stdout: result.stdout.text,
          stderr: result.stderr.text,
          truncated: result.stdout.truncated || result.stderr.truncated,
          workdir,
        })
      } catch (error) {
        sendJson(res, 500, { ok: false, message: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-quick-commands: run route')

  // Rename (or otherwise edit) one defined command from the panel. The body
  // names the Session and the command id; only that Session's row changes.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: UPDATE_PATH,
    handler: async (req: { method?: string; url?: string; on?: (event: string, listener: (chunk?: unknown) => void) => void }, res: { writeHead(code: number, headers: Record<string, string>): void; end(body: string): void }) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, message: 'POST only' })
        return
      }
      const body = await readJsonBody(req)
      if (body === null) {
        sendJson(res, 400, { ok: false, message: 'request body must be JSON with string "session" and "id"' })
        return
      }
      const store = loadStore(file)
      const commands = commandsOf(store, body.session)
      const index = commands.findIndex(row => row.id === body.id)
      if (index < 0) {
        sendJson(res, 404, { ok: false, message: `unknown command id: ${body.id}` })
        return
      }
      const current = commands[index]!
      const label = body.label !== undefined && body.label.trim() !== '' ? body.label.trim() : current.label
      const command = body.command !== undefined && body.command.trim() !== '' ? body.command : current.command
      const description = body.description !== undefined ? body.description : current.description
      const next: QuickCommand = { id: current.id, label, command }
      if (description !== undefined && description !== '') next.description = description
      commands[index] = next
      store.sessions[body.session] = commands
      saveStore(file, store)
      sendJson(res, 200, { ok: true, command: next, commands })
    },
  }), 'dsh-quick-commands: update route')
}
