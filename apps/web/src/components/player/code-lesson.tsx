import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeWorkspace, isRunnable } from "@/components/player/code-workspace";
import { Button } from "@/components/ui/button";
import type { CodeLessonConfig } from "@/lib/content-api";

/**
 * Monaco code-lesson player (§9 Tech Academy). Instructions + the shared code
 * workspace (editor + sandboxed self-check Run) + a deliberate completion action;
 * for runnable lessons "Mark complete" unlocks once the learner has run the code
 * at least once. The workspace is code-split, so Monaco never weighs on other
 * lessons.
 */
export function CodeLesson({
	code,
	done = false,
	onProgress,
}: {
	code: CodeLessonConfig;
	done?: boolean;
	onProgress?: (pct: number) => void;
}) {
	const { t } = useTranslation("academy");
	const [source, setSource] = useState(code.starterCode);
	const [hasRun, setHasRun] = useState(false);
	const runnable = isRunnable(code.language);

	// Runnable lessons ask the learner to try the code first; editor-only ones
	// (languages we can't execute) can be completed once reviewed.
	const canComplete = !done && (!runnable || hasRun);

	return (
		<div className="space-y-4">
			{code.instructions ? (
				<div className="rounded-card border border-border bg-card p-4 shadow-card">
					<p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
						{code.instructions}
					</p>
				</div>
			) : null}

			<CodeWorkspace
				language={code.language}
				value={source}
				onChange={setSource}
				onRun={() => setHasRun(true)}
			/>

			<div className="flex items-center gap-3">
				<Button
					variant="primary"
					disabled={!canComplete}
					onClick={() => onProgress?.(100)}
				>
					<CheckCircle2 className="size-4" />
					{done ? t("code.completed") : t("code.mark_complete")}
				</Button>
				{runnable && !hasRun && !done ? (
					<span className="text-muted-foreground text-xs">
						{t("code.run_first")}
					</span>
				) : null}
			</div>
		</div>
	);
}
