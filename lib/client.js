window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-quick-commands",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/index.ts
		const inject = ["slots"];
		const API = "/quick-commands/api";
		/** Last list per Session, so reopening the panel renders before the refetch lands. */
		const listCache = /* @__PURE__ */ new Map();
		const RUN_PATH = "/quick-commands/run";
		const UPDATE_PATH = "/quick-commands/update";
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
`;
		/** One-line summary of a run result. */
		function resultLabel(result) {
			if (result.message !== void 0) return `运行失败：${result.message}`;
			if (result.timedOut === true) return "超时终止";
			if (result.aborted === true) return "已中止";
			return `退出码 ${result.exitCode ?? "—"}${result.truncated === true ? " · 输出已截断" : ""}`;
		}
		/** The output text of a run result. */
		function resultText(result) {
			if (result.message !== void 0) return result.message;
			const parts = [];
			if (result.stdout !== void 0 && result.stdout !== "") parts.push(result.stdout);
			if (result.stderr !== void 0 && result.stderr !== "") parts.push(`[stderr]\n${result.stderr}`);
			return parts.length > 0 ? parts.join("\n") : "（无输出）";
		}
		/** Copy one command line, reporting whether the clipboard accepted it. */
		async function copyText(text) {
			try {
				await navigator.clipboard.writeText(text);
				return true;
			} catch {
				return false;
			}
		}
		/** Render the command rows; nothing to show renders nothing (hides the section). */
		function QuickCommandsSection(props) {
			const [commands, setCommands] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [copied, setCopied] = (0, react.useState)(null);
			const [running, setRunning] = (0, react.useState)(null);
			const [results, setResults] = (0, react.useState)({});
			const [renaming, setRenaming] = (0, react.useState)(null);
			const [draftLabel, setDraftLabel] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let alive = true;
				const cached = listCache.get(props.sessionId);
				setCommands(cached ?? null);
				setError(null);
				setExpanded(/* @__PURE__ */ new Set());
				setResults({});
				fetch(`${API}?session=${encodeURIComponent(props.sessionId)}`, { cache: "no-store" }).then((response) => response.json()).then((body) => {
					if (!alive) return;
					const next = body.commands ?? [];
					listCache.set(props.sessionId, next);
					setCommands(next);
				}).catch((cause) => {
					if (alive && cached === void 0) setError(String(cause));
				});
				return () => {
					alive = false;
				};
			}, [props.sessionId]);
			if (error !== null) return (0, react.createElement)("div", { className: "qc-hint" }, `快捷指令读取失败：${error}`);
			if (commands === null) return null;
			if (commands.length === 0) return null;
			const toggle = (id) => {
				setExpanded((current) => {
					const next = new Set(current);
					if (next.has(id)) next.delete(id);
					else next.add(id);
					return next;
				});
			};
			const run = (command) => {
				if (running !== null) return;
				setRunning(command.id);
				setExpanded((current) => {
					if (current.has(command.id)) return current;
					const next = new Set(current);
					next.add(command.id);
					return next;
				});
				setResults((current) => {
					const next = { ...current };
					delete next[command.id];
					return next;
				});
				fetch(RUN_PATH, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						session: props.sessionId,
						id: command.id
					})
				}).then((response) => response.json()).then((body) => {
					setResults((current) => ({
						...current,
						[command.id]: body
					}));
				}).catch((cause) => {
					setResults((current) => ({
						...current,
						[command.id]: {
							ok: false,
							message: String(cause)
						}
					}));
				}).finally(() => {
					setRunning((current) => current === command.id ? null : current);
				});
			};
			const startRename = (command) => {
				setRenaming(command.id);
				setDraftLabel(command.label);
			};
			const cancelRename = () => {
				setRenaming(null);
				setDraftLabel("");
			};
			const commitRename = (command) => {
				const label = draftLabel.trim();
				if (label === "" || label === command.label) {
					cancelRename();
					return;
				}
				fetch(UPDATE_PATH, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						session: props.sessionId,
						id: command.id,
						label
					})
				}).then((response) => response.json()).then((body) => {
					if (body.ok === true && Array.isArray(body.commands)) setCommands(body.commands);
				}).catch(() => {}).finally(() => {
					cancelRename();
				});
			};
			const copy = (command) => {
				copyText(command.command).then((ok) => {
					setCopied(ok ? command.id : null);
					if (ok) setTimeout(() => {
						setCopied((current) => current === command.id ? null : current);
					}, 1200);
				});
			};
			return (0, react.createElement)("div", null, [(0, react.createElement)("style", { key: "css" }, CSS), (0, react.createElement)("div", {
				key: "list",
				className: "qc-list"
			}, commands.map((command) => {
				const open = expanded.has(command.id);
				const result = results[command.id];
				const isRunning = running === command.id;
				return (0, react.createElement)("div", {
					key: command.id,
					className: open ? "qc-row qc-open" : "qc-row"
				}, [(0, react.createElement)("div", {
					key: "head",
					className: "qc-head"
				}, [
					(0, react.createElement)("button", {
						key: "run",
						type: "button",
						className: "qc-run",
						title: command.description ?? `运行：${command.command}`,
						disabled: running !== null,
						onClick: () => {
							run(command);
						}
					}, renaming === command.id ? (0, react.createElement)("input", {
						key: "input",
						className: "qc-input",
						value: draftLabel,
						autoFocus: true,
						onClick: (event) => {
							event.stopPropagation();
						},
						onChange: (event) => {
							setDraftLabel(event.target.value);
						},
						onKeyDown: (event) => {
							event.stopPropagation();
							if (event.key === "Enter") commitRename(command);
							else if (event.key === "Escape") cancelRename();
						},
						onBlur: () => {
							commitRename(command);
						}
					}) : (0, react.createElement)("span", {
						key: "label",
						className: "qc-label"
					}, command.label)),
					(0, react.createElement)("button", {
						key: "rename",
						type: "button",
						className: "qc-rename",
						title: "重命名",
						"aria-label": "重命名",
						onClick: () => {
							startRename(command);
						}
					}, "✎"),
					(0, react.createElement)("button", {
						key: "chev",
						type: "button",
						className: open ? "qc-chev qc-open" : "qc-chev",
						title: open ? "收起" : "展开",
						"aria-expanded": open,
						"aria-label": open ? "收起" : "展开",
						onClick: () => {
							toggle(command.id);
						}
					}, (0, react.createElement)("span", { className: open ? "qc-box" : "qc-box qc-plus" }))
				]), open ? (0, react.createElement)("div", {
					key: "body",
					className: "qc-body"
				}, [
					command.description !== void 0 && command.description !== "" ? (0, react.createElement)("div", {
						key: "desc",
						className: "qc-desc"
					}, command.description) : null,
					(0, react.createElement)("div", {
						key: "code-wrap",
						className: "qc-code-wrap"
					}, [(0, react.createElement)("pre", {
						key: "code",
						className: "qc-code"
					}, command.command), (0, react.createElement)("button", {
						key: "copy",
						type: "button",
						className: copied === command.id ? "qc-copy qc-copied" : "qc-copy",
						title: copied === command.id ? "已复制" : "复制指令",
						"aria-label": copied === command.id ? "已复制" : "复制指令",
						onClick: () => {
							copy(command);
						}
					}, copied === command.id ? "✓" : "⧉")]),
					isRunning || result !== void 0 ? (0, react.createElement)("div", {
						key: "result",
						className: "qc-result"
					}, [(0, react.createElement)("div", {
						key: "meta",
						className: "qc-meta"
					}, [(0, react.createElement)("span", {
						key: "dot",
						className: isRunning ? "qc-dot run" : result !== void 0 && result.ok ? "qc-dot ok" : "qc-dot bad"
					}), (0, react.createElement)("span", { key: "text" }, isRunning ? "运行中…" : resultLabel(result))]), isRunning ? null : (0, react.createElement)("pre", {
						key: "out",
						className: result !== void 0 && result.ok ? "qc-out" : "qc-out qc-err"
					}, resultText(result))]) : null
				]) : null]);
			}))]);
		}
		/**
		* Register the Session panel section.
		* @param ctx - client root context carrying the slot registry.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("conversation.session.panel.section", () => ctx.slots.register({
				name: "conversation.session.panel.section",
				id: "quick-commands",
				order: 150,
				label: () => "快捷指令"
			}, QuickCommandsSection)), "dsh-quick-commands: panel section");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map