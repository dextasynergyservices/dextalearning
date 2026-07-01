import { useTranslation } from "react-i18next";

export function AuthDivider() {
	const { t } = useTranslation("auth");
	return (
		<div className="my-5 flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-wide">
			<span className="h-px flex-1 bg-muted" />
			{t("divider")}
			<span className="h-px flex-1 bg-muted" />
		</div>
	);
}
