// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableProfile } from "@/lib/content-api";
import { renderWithRouter } from "@/test/render";
import { ProfileEditor } from "./profile-editor";

const {
	useSessionMock,
	getMyProfileMock,
	updateMyProfileMock,
	getFeatureRequestsMock,
} = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getMyProfileMock: vi.fn(),
	updateMyProfileMock: vi.fn(),
	getFeatureRequestsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getMyProfile: getMyProfileMock,
		updateMyProfile: updateMyProfileMock,
		getFeatureRequests: getFeatureRequestsMock,
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
		headline: "Senior Engineer",
		bio: "I teach React.",
		expertiseAreas: ["technology"],
		image: null,
		whatsappOptIn: false,
		studySchedule: null,
		studyAnchor: null,
		weeklyHours: null,
		timezone: null,
		...overrides,
	};
}

function session(role = "instructor") {
	return {
		data: { user: { id: "u1", name: "Ada Lovelace", role } },
		isPending: false,
	};
}

describe("ProfileEditor", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getMyProfileMock.mockReset();
		updateMyProfileMock.mockReset();
		getFeatureRequestsMock.mockReset();
		useSessionMock.mockReturnValue(session());
		getMyProfileMock.mockResolvedValue(profile());
	});

	it("renders the read-only email and prefilled fields once loaded", async () => {
		renderWithRouter(<ProfileEditor area="instructor" />);
		expect(await screen.findByDisplayValue("Ada")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Lovelace")).toBeInTheDocument();
		expect(screen.getByDisplayValue("ada@example.com")).toBeDisabled();
		expect(screen.getByDisplayValue("Senior Engineer")).toBeInTheDocument();
	});

	it("disables Save when the first or last name is cleared", async () => {
		const user = userEvent.setup();
		renderWithRouter(<ProfileEditor area="instructor" />);
		const firstNameInput = await screen.findByDisplayValue("Ada");

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toBeEnabled();

		await user.clear(firstNameInput);
		expect(saveButton).toBeDisabled();
	});

	it("saves the profile with trimmed values and shows a success toast", async () => {
		const { toast } = await import("sonner");
		updateMyProfileMock.mockResolvedValue({ ok: true });
		const user = userEvent.setup();
		renderWithRouter(<ProfileEditor area="instructor" />);
		await screen.findByDisplayValue("Ada");

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(updateMyProfileMock).toHaveBeenCalledWith(
				expect.objectContaining({
					firstName: "Ada",
					lastName: "Lovelace",
					expertiseAreas: ["technology"],
				}),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Profile saved.");
	});

	it("shows the instructors-only gate for a learner", async () => {
		useSessionMock.mockReturnValue(session("learner"));
		renderWithRouter(<ProfileEditor area="instructor" />);
		expect(await screen.findByText("Instructors only")).toBeInTheDocument();
	});
});
