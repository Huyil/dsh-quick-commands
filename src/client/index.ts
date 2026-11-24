/**
 * @dsh-external/dsh-quick-commands — client half.
 *
 * Contributes the Session panel's quick-commands section: one row per shell
 * command line defined for THIS Session. The row's left area runs the command;
 * the chevron on the right expands the row, which shows the command itself
 * (with a copy button) and the latest run result.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session-panel/client'
import { createElement, useEffect, useState } from 'react'

export const inject = ['slots']

/** One command as served by `GET /quick-commands/api?session=…`. */
interface QuickCommand {
  id: string
  label: string
  command: string
  description?: string
}

/** One run result as served by `POST /quick-commands/run`. */
interface RunResult {
  ok: boolean
  exitCode?: number | null
  timedOut?: boolean
  aborted?: boolean
  stdout?: string
  stderr?: string
  truncated?: boolean
  workdir?: string
  message?: string
}

/** The standard session props this section reads. */
interface SectionProps {
  sessionId: string
}

const API = '/quick-commands/api'

/** Last list per Session, so reopening the panel renders before the refetch lands. */
const listCache = new Map<string, QuickCommand[]>()
const RUN_PATH = '/quick-commands/run'
const UPDATE_PATH = '/quick-commands/update'

const CSS = `
.qc-list{display:flex;flex-direction:column;gap:4px}
.qc-row{border:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,.14));border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-l1,transparent);transition:border-color 120ms ease}
.qc-row:hover{border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.24))}
.qc-row.qc-open{border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.24))}
.qc-head{display:flex;align-items:stretch;width:100%}
.qc-run{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding:7px 9px;border:none;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:0}
.qc-run:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.qc-run:active{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09))}
.qc-run:disabled{cursor:default;opacity:.6}
.qc-label{font-size:12px;line-height:1.4;color:var(--dsw-alias-label-primary,inherit);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qc-desc{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary,#9aa0aa);white-space:pre-wrap;word-break:break-word}
.qc-input{width:100%;box-sizing:border-box;padding:1px 4px;border:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);border-radius:4px;background:var(--dsw-alias-bg-l2,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:12px;line-height:1.4;outline:none}
.qc-rename{flex:none;width:26px;border:none;border-left:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,.10));background:transparent;color:var(--dsw-alias-label-secondary,#9aa0aa);font:inherit;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 120ms ease,color 120ms ease}
.qc-rename:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,inherit)}
.qc-chev{flex:none;width:28px;border:none;border-left:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,.10));background:transparent;color:var(--dsw-alias-label-secondary,#9aa0aa);font:inherit;font-size:9px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 120ms ease}
.qc-chev:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,inherit)}
.qc-box{position:relative;display:inline-block;width:12px;height:12px;border:1px solid currentColor;border-radius:2px;box-sizing:border-box}
.qc-box::before{content:'';position:absolute;left:2px;right:2px;top:50%;height:1px;margin-top:-0.5px;background:currentColor}
.qc-box.qc-plus::after{content:'';position:absolute;top:2px;bottom:2px;left:50%;width:1px;margin-left:-0.5px;background:currentColor}
.qc-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:6px}
.qc-code-wrap{position:relative}
.qc-code{margin:0;padding:7px 30px 7px 9px;border-radius:6px;background:var(--dsw-alias-bg-l2,rgba(255,255,255,.05));color:var(--dsw-alias-label-primary,#d7dbe2);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}
.qc-copy{position:absolute;top:4px;right:4px;width:22px;height:22px;padding:0;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa0aa);font:inherit;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 120ms ease,color 120ms ease}
.qc-copy:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.10));color:var(--dsw-alias-label-primary,inherit)}
.qc-copy.qc-copied{color:var(--dsw-alias-state-success-primary,#2ecc71)}
.qc-result{display:flex;flex-direction:column;gap:4px}
.qc-meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--dsw-alias-label-secondary,#9aa0aa)}
.qc-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-label-secondary,#9aa0aa)}
.qc-dot.ok{background:var(--dsw-alias-state-success-primary,#2ecc71)}
.qc-dot.bad{background:var(--dsw-alias-state-error-primary,#e5534b)}
.qc-dot.run{background:var(--dsw-alias-state-business-primary,#4d6bfe);animation:qc-pulse 1s ease-in-out infinite}
@keyframes qc-pulse{0%,100%{opacity:.35}50%{opacity:1}}
.qc-out{margin:0;padding:7px 9px;border-radius:6px;background:var(--dsw-alias-bg-l2,rgba(255,255,255,.05));color:var(--dsw-alias-label-secondary,#c7ccd4);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto}
.qc-out.qc-err{color:var(--dsw-alias-state-error-primary,#ff9b9b)}
.qc-hint{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa0aa);padding:2px 0}
`

/** One-line summary of a run result. */
function resultLabel(result: RunResult): string {
  if (result.message !== undefined) return `运行失败：${result.message}`
  if (result.timedOut === true) return '超时终止'
  if (result.aborted === true) return '已中止'
  return `退出码 ${result.exitCode ?? '—'}${result.truncated === true ? ' · 输出已截断' : ''}`
}

/** The output text of a run result. */
function resultText(result: RunResult): string {
  if (result.message !== undefined) return result.message
  const parts: string[] = []
  if (result.stdout !== undefined && result.stdout !== '') parts.push(result.stdout)
  if (result.stderr !== undefined && result.stderr !== '') parts.push(`[stderr]\n${result.stderr}`)
  return parts.length > 0 ? parts.join('\n') : '（无输出）'
}

/** Copy one command line, reporting whether the clipboard accepted it. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Swallows a denied clipboard: the caller shows the failure instead.
    return false
  }
}

/** Render the command rows; nothing to show renders nothing (hides the section). */
function QuickCommandsSection(props: SectionProps): unknown {
  const [commands, setCommands] = useState<QuickCommand[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Readonly<Record<string, RunResult>>>({})
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  useEffect(() => {
    let alive = true
    const cached = listCache.get(props.sessionId)
    setCommands(cached ?? null)
    setError(null)
    setExpanded(new Set())
    setResults({})
    fetch(`${API}?session=${encodeURIComponent(props.sessionId)}`, { cache: 'no-store' })
      .then(response => response.json())
      .then((body: { commands?: QuickCommand[] }) => {
        if (!alive) return
        const next = body.commands ?? []
        listCache.set(props.sessionId, next)
        setCommands(next)
      })
      .catch((cause: unknown) => { if (alive && cached === undefined) setError(String(cause)) })
    return () => { alive = false }
  }, [props.sessionId])
  if (error !== null) return createElement('div', { className: 'qc-hint' }, `快捷指令读取失败：${error}`)
  if (commands === null) return null
  if (commands.length === 0) return null
  const toggle = (id: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const run = (command: QuickCommand): void => {
    if (running !== null) return
    setRunning(command.id)
    // A run reveals its own result: expand the row once so the output is visible.
    setExpanded((current) => {
      if (current.has(command.id)) return current
      const next = new Set(current)
      next.add(command.id)
      return next
    })
    setResults((current) => {
      const next = { ...current }
      delete next[command.id]
      return next
    })
    fetch(RUN_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: props.sessionId, id: command.id }),
    })
      .then(response => response.json())
      .then((body: RunResult) => { setResults(current => ({ ...current, [command.id]: body })) })
      .catch((cause: unknown) => { setResults(current => ({ ...current, [command.id]: { ok: false, message: String(cause) } })) })
      .finally(() => { setRunning(current => (current === command.id ? null : current)) })
  }
  const startRename = (command: QuickCommand): void => {
    setRenaming(command.id)
    setDraftLabel(command.label)
  }
  const cancelRename = (): void => {
    setRenaming(null)
    setDraftLabel('')
  }
  const commitRename = (command: QuickCommand): void => {
    const label = draftLabel.trim()
    if (label === '' || label === command.label) {
      cancelRename()
      return
    }
    fetch(UPDATE_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: props.sessionId, id: command.id, label }),
    })
      .then(response => response.json())
      .then((body: { ok?: boolean; commands?: QuickCommand[] }) => {
        if (body.ok === true && Array.isArray(body.commands)) setCommands(body.commands)
      })
      .catch(() => { /* 重命名失败保留旧名 */ })
      .finally(() => { cancelRename() })
  }
  const copy = (command: QuickCommand): void => {
    void copyText(command.command).then((ok) => {
      setCopied(ok ? command.id : null)
      if (ok) setTimeout(() => { setCopied(current => (current === command.id ? null : current)) }, 1200)
    })
  }
  return createElement('div', null, [
    createElement('style', { key: 'css' }, CSS),
    createElement('div', { key: 'list', className: 'qc-list' }, commands.map((command) => {
      const open = expanded.has(command.id)
      const result = results[command.id]
      const isRunning = running === command.id
      return createElement('div', { key: command.id, className: open ? 'qc-row qc-open' : 'qc-row' }, [
        createElement('div', { key: 'head', className: 'qc-head' }, [
          createElement('button', {
            key: 'run',
            type: 'button',
            className: 'qc-run',
            title: command.description ?? `运行：${command.command}`,
            disabled: running !== null,
            onClick: () => { run(command) },
          }, renaming === command.id
            ? createElement('input', {
              key: 'input',
              className: 'qc-input',
              value: draftLabel,
              autoFocus: true,
              onClick: (event: { stopPropagation(): void }) => { event.stopPropagation() },
              onChange: (event: { target: { value: string } }) => { setDraftLabel(event.target.value) },
              onKeyDown: (event: { key: string; stopPropagation(): void }) => {
                event.stopPropagation()
                if (event.key === 'Enter') commitRename(command)
                else if (event.key === 'Escape') cancelRename()
              },
              onBlur: () => { commitRename(command) },
            })
            : createElement('span', { key: 'label', className: 'qc-label' }, command.label)),
          createElement('button', {
            key: 'rename',
            type: 'button',
            className: 'qc-rename',
            title: '重命名',
            'aria-label': '重命名',
            onClick: () => { startRename(command) },
          }, '✎'),
          createElement('button', {
            key: 'chev',
            type: 'button',
            className: open ? 'qc-chev qc-open' : 'qc-chev',
            title: open ? '收起' : '展开',
            'aria-expanded': open,
            'aria-label': open ? '收起' : '展开',
            onClick: () => { toggle(command.id) },
          }, createElement('span', { className: open ? 'qc-box' : 'qc-box qc-plus' })),
        ]),
        open
          ? createElement('div', { key: 'body', className: 'qc-body' }, [
            command.description !== undefined && command.description !== ''
              ? createElement('div', { key: 'desc', className: 'qc-desc' }, command.description)
              : null,
            createElement('div', { key: 'code-wrap', className: 'qc-code-wrap' }, [
              createElement('pre', { key: 'code', className: 'qc-code' }, command.command),
              createElement('button', {
                key: 'copy',
                type: 'button',
                className: copied === command.id ? 'qc-copy qc-copied' : 'qc-copy',
                title: copied === command.id ? '已复制' : '复制指令',
                'aria-label': copied === command.id ? '已复制' : '复制指令',
                onClick: () => { copy(command) },
              }, copied === command.id ? '✓' : '⧉'),
            ]),
            isRunning || result !== undefined
              ? createElement('div', { key: 'result', className: 'qc-result' }, [
                createElement('div', { key: 'meta', className: 'qc-meta' }, [
                  createElement('span', {
                    key: 'dot',
                    className: isRunning ? 'qc-dot run' : (result !== undefined && result.ok ? 'qc-dot ok' : 'qc-dot bad'),
                  }),
                  createElement('span', { key: 'text' }, isRunning ? '运行中…' : resultLabel(result!)),
                ]),
                isRunning
                  ? null
                  : createElement('pre', {
                    key: 'out',
                    className: result !== undefined && result.ok ? 'qc-out' : 'qc-out qc-err',
                  }, resultText(result!)),
              ])
              : null,
          ])
          : null,
      ])
    })),
  ])
}

/**
 * Register the Session panel section.
 * @param ctx - client root context carrying the slot registry.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.slots.inject('conversation.session.panel.section', () => ctx.slots.register({
    name: 'conversation.session.panel.section',
    id: 'quick-commands',
    // After change requests (100), before subagents (200).
    order: 150,
    label: () => '快捷指令',
  }, QuickCommandsSection as never)), 'dsh-quick-commands: panel section')
}
