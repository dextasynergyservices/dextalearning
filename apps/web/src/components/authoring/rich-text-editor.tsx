import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, List, ListOrdered, Quote } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
	value: string;
	onChange: (html: string) => void;
}

/** Tiptap rich-text editor for `text` lessons (§4.2 — content IS the transcript). */
export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
	const editor = useEditor({
		extensions: [StarterKit],
		content: value,
		onUpdate: ({ editor }) => onChange(editor.getHTML()),
		editorProps: {
			attributes: {
				class:
					"prose prose-slate max-w-none min-h-[220px] px-4 py-3 focus:outline-none",
			},
		},
	});

	if (!editor) return null;

	const tools: {
		icon: ComponentType<{ className?: string }>;
		label: string;
		isActive: boolean;
		run: () => void;
	}[] = [
		{
			icon: Bold,
			label: "Bold",
			isActive: editor.isActive("bold"),
			run: () => editor.chain().focus().toggleBold().run(),
		},
		{
			icon: Italic,
			label: "Italic",
			isActive: editor.isActive("italic"),
			run: () => editor.chain().focus().toggleItalic().run(),
		},
		{
			icon: Heading2,
			label: "Heading",
			isActive: editor.isActive("heading", { level: 2 }),
			run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
		},
		{
			icon: List,
			label: "Bullet list",
			isActive: editor.isActive("bulletList"),
			run: () => editor.chain().focus().toggleBulletList().run(),
		},
		{
			icon: ListOrdered,
			label: "Numbered list",
			isActive: editor.isActive("orderedList"),
			run: () => editor.chain().focus().toggleOrderedList().run(),
		},
		{
			icon: Quote,
			label: "Quote",
			isActive: editor.isActive("blockquote"),
			run: () => editor.chain().focus().toggleBlockquote().run(),
		},
	];

	return (
		<div className="overflow-hidden rounded-card border border-slate-200 bg-white">
			<div className="flex flex-wrap gap-1 border-slate-100 border-b bg-slate-50 p-1.5">
				{tools.map(({ icon: Icon, label, isActive, run }) => (
					<button
						key={label}
						type="button"
						aria-label={label}
						aria-pressed={isActive}
						onClick={run}
						className={cn(
							"flex size-8 items-center justify-center rounded-btn transition-colors",
							isActive
								? "bg-brand-primary text-white"
								: "text-slate-600 hover:bg-slate-200",
						)}
					>
						<Icon className="size-4" />
					</button>
				))}
			</div>
			<EditorContent editor={editor} />
		</div>
	);
}
