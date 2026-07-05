// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { AvatarEditor } from "./avatar-editor";

const { uploadAvatarMock, deleteAvatarMock } = vi.hoisted(() => ({
	uploadAvatarMock: vi.fn(),
	deleteAvatarMock: vi.fn(),
}));

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		uploadAvatar: uploadAvatarMock,
		deleteAvatar: deleteAvatarMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

describe("AvatarEditor", () => {
	beforeEach(() => {
		uploadAvatarMock.mockReset();
		deleteAvatarMock.mockReset();
	});

	it("renders initials when there's no image", () => {
		const { container } = renderWithProviders(
			<AvatarEditor image={null} name="Ada Lovelace" onChange={vi.fn()} />,
		);
		expect(screen.getByText("AL")).toBeInTheDocument();
		expect(container.querySelector("img")).not.toBeInTheDocument();
	});

	it("renders the image when one is set", () => {
		const { container } = renderWithProviders(
			<AvatarEditor
				image="https://cdn.example.com/a.png"
				name="Ada Lovelace"
				onChange={vi.fn()}
			/>,
		);
		expect(container.querySelector("img")).toHaveAttribute(
			"src",
			"https://cdn.example.com/a.png",
		);
	});

	it("opens the menu with 'Change photo' only when there's no image", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<AvatarEditor image={null} name="Ada Lovelace" onChange={vi.fn()} />,
		);
		await user.click(screen.getByRole("button", { name: "Edit photo" }));
		expect(screen.getByText("Change photo")).toBeInTheDocument();
		expect(screen.queryByText("Remove photo")).not.toBeInTheDocument();
	});

	it("shows 'Remove photo' when an image is set", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<AvatarEditor
				image="https://cdn.example.com/a.png"
				name="Ada Lovelace"
				onChange={vi.fn()}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Edit photo" }));
		expect(screen.getByText("Remove photo")).toBeInTheDocument();
	});

	it("uploads a new photo and reports the new image via onChange", async () => {
		const { toast } = await import("sonner");
		uploadAvatarMock.mockResolvedValue({
			image: "https://cdn.example.com/new.png",
		});
		const onChange = vi.fn();
		const user = userEvent.setup();
		const { container } = renderWithProviders(
			<AvatarEditor image={null} name="Ada Lovelace" onChange={onChange} />,
		);

		const input = container.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;
		const file = new File(["bytes"], "avatar.png", { type: "image/png" });
		await user.upload(input, file);

		await waitFor(() => {
			expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/new.png");
		});
		expect(toast.success).toHaveBeenCalledWith("Photo updated.");
	});

	it("removes the photo and reports null via onChange", async () => {
		const { toast } = await import("sonner");
		deleteAvatarMock.mockResolvedValue({ image: null });
		const onChange = vi.fn();
		const user = userEvent.setup();
		renderWithProviders(
			<AvatarEditor
				image="https://cdn.example.com/a.png"
				name="Ada Lovelace"
				onChange={onChange}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Edit photo" }));
		await user.click(screen.getByText("Remove photo"));

		await waitFor(() => {
			expect(onChange).toHaveBeenCalledWith(null);
		});
		expect(toast.success).toHaveBeenCalledWith("Photo removed.");
	});
});
