import Editor from "@monaco-editor/react";
import { Loader2, Play, Terminal } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type OutLine = { level: "log" | "error" | "warn"; text: string };

/** Languages we can execute right in the browser (§9 — free-tier decision:
 *  JS runs in a Web Worker sandbox; every other language is editor-only). */
export const RUNNABLE = new Set(["javascript"]);
const RUN_TIMEOUT_MS = 4000;

/** Whether a language's code can be run client-side in the sandbox. */
export function isRunnable(language: string): boolean {
	return RUNNABLE.has(language);
}

/**
 * Runs learner JS in a throwaway Web Worker — no DOM, killed after a timeout so
 * an infinite loop can't hang the tab. It's a sandbox for the learner's OWN code
 * in their OWN browser (a learning aid / self-check, NOT a security boundary and
 * NOT a grader). Returns the captured console output + any thrown error.
 */
export function runJavaScript(
	source: string,
): Promise<{ logs: OutLine[]; error?: string }> {
	return new Promise((resolve) => {
		const workerSrc = `
			self.onmessage = (e) => {
				const logs = [];
				const fmt = (v) => {
					if (typeof v === "string") return v;
					try { return JSON.stringify(v); } catch { return String(v); }
				};
				const emit = (level) => (...a) => logs.push({ level, text: a.map(fmt).join(" ") });
				const console = { log: emit("log"), info: emit("log"), warn: emit("warn"), error: emit("error") };
				try {
					const result = new Function("console", e.data)(console);
					if (result !== undefined) logs.push({ level: "log", text: fmt(result) });
					self.postMessage({ logs });
				} catch (err) {
					self.postMessage({ logs, error: (err && err.message) ? err.message : String(err) });
				}
			};`;
		const url = URL.createObjectURL(
			new Blob([workerSrc], { type: "text/javascript" }),
		);
		const worker = new Worker(url);
		const done = (out: { logs: OutLine[]; error?: string }) => {
			worker.terminate();
			URL.revokeObjectURL(url);
			resolve(out);
		};
		const timer = setTimeout(
			() => done({ logs: [], error: "Timed out — is there an infinite loop?" }),
			RUN_TIMEOUT_MS,
		);
		worker.onmessage = (e) => {
			clearTimeout(timer);
			done(e.data as { logs: OutLine[]; error?: string });
		};
		worker.onerror = (e) => {
			clearTimeout(timer);
			done({ logs: [], error: e.message });
		};
		worker.postMessage(source);
	});
}

/**
 * Shared Monaco editor + (for JS) a sandboxed self-check Run with live output.
 * Used by code lessons, code assessment questions and code project submissions —
 * one editor, one runner, one output panel. Monaco loads from the CDN, so this
 * component is meant to be imported through `lazy()` at each call site to keep it
 * out of the main bundle.
 *
 * The Run button is a learner self-check only — it never sets a grade. Grading
 * is always server-side (manual/AI), so a read-only workspace (the grader's view)
 * simply omits Run.
 */
export function CodeWorkspace({
	language,
	value,
	onChange,
	readOnly = false,
	runnable,
	onRun,
	height = "360px",
}: {
	language: string;
	value: string;
	onChange?: (value: string) => void;
	readOnly?: boolean;
	/** Override the auto-detected runnability (defaults to `isRunnable`). */
	runnable?: boolean;
	/** Fired after a self-check run completes (e.g. to unlock a control). */
	onRun?: () => void;
	height?: string;
}) {
	const { t } = useTranslation("academy");
	const { isDark } = useTheme();
	const [output, setOutput] = useState<(OutLine & { id: string })[] | null>(
		null,
	);
	const [running, setRunning] = useState(false);
	const canRun = (runnable ?? isRunnable(language)) && !readOnly;

	const run = useCallback(async () => {
		setRunning(true);
		const res = await runJavaScript(value);
		const lines: OutLine[] = res.error
			? [...res.logs, { level: "error", text: res.error }]
			: res.logs.length > 0
				? res.logs
				: [{ level: "log", text: t("code.no_output") }];
		// Stable per-run keys (biome dislikes bare array indexes as keys).
		const stamp = Date.now();
		setOutput(lines.map((l, i) => ({ ...l, id: `${stamp}-${i}` })));
		setRunning(false);
		onRun?.();
	}, [value, t, onRun]);

	return (
		<div className="space-y-4">
			<div className="overflow-hidden rounded-card border border-border shadow-card">
				<div className="flex items-center justify-between gap-2 border-border border-b bg-muted px-3 py-2">
					<span className="font-stats text-muted-foreground text-xs uppercase tracking-wide">
						{language}
					</span>
					{canRun ? (
						<Button size="sm" onClick={run} disabled={running}>
							{running ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Play className="size-4" />
							)}
							{t("code.run")}
						</Button>
					) : !readOnly && !isRunnable(language) ? (
						<span className="text-muted-foreground text-xs">
							{t("code.editor_only")}
						</span>
					) : null}
				</div>
				<Editor
					height={height}
					language={language}
					value={value}
					onChange={readOnly ? undefined : (v) => onChange?.(v ?? "")}
					theme={isDark ? "vs-dark" : "light"}
					loading={
						<div
							className="flex items-center justify-center bg-card"
							style={{ height }}
						>
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					}
					options={{
						minimap: { enabled: false },
						fontSize: 14,
						scrollBeyondLastLine: false,
						automaticLayout: true,
						tabSize: 2,
						padding: { top: 12, bottom: 12 },
						readOnly,
						domReadOnly: readOnly,
					}}
				/>
			</div>

			{output ? (
				<section
					aria-live="polite"
					aria-label={t("code.output")}
					className="rounded-card border border-border bg-hero-bg p-4 font-mono text-sm"
				>
					<div className="mb-2 flex items-center gap-1.5 text-slate-400 text-xs uppercase tracking-wide">
						<Terminal className="size-3.5" /> {t("code.output")}
					</div>
					{output.map((line) => (
						<pre
							key={line.id}
							className={cn(
								"whitespace-pre-wrap break-words",
								line.level === "error"
									? "text-red-400"
									: line.level === "warn"
										? "text-amber-300"
										: "text-slate-100",
							)}
						>
							{line.text}
						</pre>
					))}
				</section>
			) : null}
		</div>
	);
}
