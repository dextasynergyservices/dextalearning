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
