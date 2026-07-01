import { useQuery } from "@tanstack/react-query";
import { useSession } from "./auth-client";
import { getMyProfile } from "./content-api";

/**
 * The signed-in user's display avatar URL. Prefers the **uploaded** avatar
 * (presigned, served from the shared `["my-profile"]` query that the Studio
 * profile editor invalidates on save/upload, so it stays in sync everywhere)
 * and falls back to the Better Auth `image` (e.g. a Google photo). `null` when
 * there's no picture — callers render initials instead.
 */
export function useAvatar(): string | null {
	const { data: session } = useSession();
	const { data } = useQuery({
		queryKey: ["my-profile"],
		queryFn: getMyProfile,
		enabled: Boolean(session?.user),
		// Presigned URLs live 2h — refetch comfortably before they expire.
		staleTime: 90 * 60 * 1000,
	});
	const sessionImage =
		(session?.user as { image?: string | null } | undefined)?.image ?? null;
	return data?.image ?? sessionImage;
}
