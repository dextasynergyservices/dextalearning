// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableProfile } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getMyProfileMock, updateMyProfileMock, signOutMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getMyProfileMock: vi.fn(),
		updateMyProfileMock: vi.fn(),
		signOutMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock, signOut: signOutMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getMyProfile: getMyProfileMock,
		updateMyProfile: updateMyProfileMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function profile(overrides: Partial<EditableProfile> = {}): EditableProfile {
	return {
		firstName: "Ada",
		lastName: "Lovelace",
		otherNames: null,
		name: "Ada Lovelace",
		email: "ada@example.com",
		phone: null,
		phoneVerified: false,
		language: "en",
		headline: null,
		bio: null,
		expertiseAreas: [],
		image: null,
		whatsappOptIn: false,
		studySchedule: null,
		studyAnchor: null,
		weeklyHours: null,
		timezone: null,
		...overrides,
	};
}

function session() {
	return {
		data: { user: { id: "u1", name: "Ada Lovelace", role: "learner" } },
		isPending: false,
	};
}

describe("ProfilePage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getMyProfileMock.mockReset();
		updateMyProfileMock.mockReset();
		signOutMock.mockReset();
		useSessionMock.mockReturnValue(session());
		getMyProfileMock.mockResolvedValue(profile());
	});

	it("renders the prefilled identity card and read-only email", async () => {
		renderRoute("/profile");
		expect(await screen.findByDisplayValue("Ada")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Lovelace")).toBeInTheDocument();
		expect(screen.getByDisplayValue("ada@example.com")).toHaveAttribute(
			"readonly",
		);
		expect(screen.getByText("learner")).toBeInTheDocument();
	});

	it("saves the profile with the resolved language and shows a success toast", async () => {
		const { toast } = await import("sonner");
		updateMyProfileMock.mockResolvedValue({ ok: true });
		const user = userEvent.setup();
		renderRoute("/profile");
		await screen.findByDisplayValue("Ada");

		await user.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(updateMyProfileMock).toHaveBeenCalledWith(
				expect.objectContaining({
					firstName: "Ada",
					lastName: "Lovelace",
					language: "en",
				}),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Profile saved.");
	});

	it("disables the WhatsApp toggle until a phone number exists (Phase 4, §3.2)", async () => {
		renderRoute("/profile");
		await screen.findByDisplayValue("Ada");

		const toggle = screen.getByRole("switch", { name: "WhatsApp reminders" });
		expect(toggle).toBeDisabled();
		expect(
			screen.getByText(
				"Add a phone number above to enable WhatsApp reminders.",
			),
		).toBeInTheDocument();
	});

	it("saves reminder settings (opt-in, schedule, hours, timezone) with the profile", async () => {
		getMyProfileMock.mockResolvedValue(
			profile({ phone: "+2348001234567", studySchedule: "evening" }),
		);
		updateMyProfileMock.mockResolvedValue({ ok: true });
		const user = userEvent.setup();
		renderRoute("/profile");
		await screen.findByDisplayValue("Ada");

		const toggle = screen.getByRole("switch", { name: "WhatsApp reminders" });
		expect(toggle).toBeEnabled();
		await user.click(toggle);
		await user.selectOptions(
			screen.getByLabelText("Weekly learning time"),
			"medium",
		);
		// §3.1 habit stacking — anchor the session to a daily habit.
		await user.selectOptions(
			screen.getByLabelText("Tie it to a daily habit (optional)"),
			"after_work",
		);
		await user.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(updateMyProfileMock).toHaveBeenCalledWith(
				expect.objectContaining({
					whatsappOptIn: true,
					studySchedule: "evening",
					studyAnchor: "after_work",
					weeklyHours: "medium",
					timezone: expect.any(String),
				}),
			);
		});
	});

	it("shows the 'Not verified' badge when a phone number is entered but unverified", async () => {
		const user = userEvent.setup();
		renderRoute("/profile");
		const phoneInput = await screen.findByPlaceholderText("+234 800 000 0000");

		await user.type(phoneInput, "+2348001234567");

		expect(screen.getByText("Not verified")).toBeInTheDocument();
	});

	it("signs out and navigates home", async () => {
		signOutMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/profile");
		await screen.findByDisplayValue("Ada");

		await user.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(signOutMock).toHaveBeenCalled();
		});
	});
});
