"use client";
import type { Editor as CoreEditor } from "@tiptap/core";

export default function EditorToolbar({ editor }: { editor: CoreEditor | null }) {
  if (!editor) return null;

  const Btn = ({
    onClick,
    active,
    children,
    aria,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    aria?: string;
  }) => (
    <button
      onClick={onClick}
      aria-label={aria}
      className={[
        "h-8 rounded-md px-2 text-sm transition-colors",
        active
          ? "bg-brand-600 text-white"
          : "text-muted hover:bg-brand-50 dark:hover:bg-brand-800/30",
      ].join(" ")}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-1 border-b border-border bg-card/60 px-2 py-2">
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        aria="Bold"
      >
        <span className="font-bold">B</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        aria="Italic"
      >
        <span className="italic">I</span>
      </Btn>

      <span className="mx-1 h-5 w-px bg-border" />

      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} aria="Bullet list">
        • List
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} aria="Ordered list">
        1. List
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        aria="Heading 2"
      >
        H2
      </Btn>

      <span className="mx-1 h-5 w-px bg-border" />

      <Btn onClick={() => editor.chain().focus().undo().run()} aria="Undo">
        Undo
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} aria="Redo">
        Redo
      </Btn>
    </div>
  );
}
