"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { PresenceCursors, presenceCursorsKey, Peer } from "@/components/extensions/PresenceCursors";
import { CommentsHighlights, commentsHighlightsKey } from "@/components/extensions/CommentsHighlights";
import EditorToolbar from "@/components/EditorToolbar";
import "@/app/editor.css";

type EditorProps = {
  initialHTML: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  peers?: Peer[];
};

export default function RichEditor({ initialHTML, onChange, readOnly, peers = [] }: EditorProps) {
  const applyingRemote = useRef(false);
  const emitTimer = useRef<number | null>(null);
  const lastPeersJSON = useRef<string>("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
      PresenceCursors,
      CommentsHighlights,
    ],
    content: initialHTML,
    editable: !readOnly,
    autofocus: true,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (applyingRemote.current) return;
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const sel = editor.state.selection;
      (window as any).__onEditorSelection?.({ from: sel.from, to: sel.to });

      if (emitTimer.current) return;
      emitTimer.current = window.setTimeout(() => {
        emitTimer.current = null;
        (window as any).__emitCursor?.(sel.from, sel.to);
      }, 50);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = JSON.stringify(peers);
    if (next === lastPeersJSON.current) return;
    lastPeersJSON.current = next;

    const view = (editor as any).view;
    view.dispatch(view.state.tr.setMeta(presenceCursorsKey, peers));
  }, [peers, editor]);

  const applyRemoteHTML = useCallback(
    (html: string) => {
      if (!editor) return;
      applyingRemote.current = true;
      try {
        (editor as any).commands.setContent(html, { emitUpdate: false });
      } catch {
        (editor as any).commands.setContent(html, false);
      }
      applyingRemote.current = false;
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    try {
      const current = editor.getHTML();
      if (typeof initialHTML === "string" && initialHTML !== current) {
        applyingRemote.current = true;
        try {
          (editor as any).commands.setContent(initialHTML, { emitUpdate: false });
        } catch {
          (editor as any).commands.setContent(initialHTML, false);
        }
        applyingRemote.current = false;
      }
    } catch {}
  }, [initialHTML, editor]);

  useEffect(() => {
    (window as any).__activeTiptapEditor = {
      applyRemoteHTML,
      getSelection: () => {
        if (!editor) return { from: 0, to: 0 };
        const sel = editor.state.selection;
        return { from: sel.from, to: sel.to };
      },
      getTextBetween: (from: number, to: number) => {
        if (!editor) return "";
        return editor.state.doc.textBetween(from, to, " ");
      },
      revealRange: (from: number, to: number) => {
        if (!editor) return;
        editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();
      },
      isFocused: () => !!editor?.isFocused,
      setCommentHighlights: (items: {
        rangeFrom: number; rangeTo: number; anchorText?: string; contextBefore?: string; contextAfter?: string;
      }[]) => {
        if (!editor) return;

        const { state } = editor;
        const doc = state.doc;

        type Seg = { fromPos: number; toPos: number; startIdx: number; endIdx: number; text: string };
        const segs: Seg[] = [];
        let idx = 0;
        doc.descendants((node: any, pos: number) => {
          if (node.isText && typeof node.text === "string") {
            const text = node.text as string;
            segs.push({ fromPos: pos, toPos: pos + text.length, startIdx: idx, endIdx: idx + text.length, text });
            idx += text.length;
          }
          return true;
        });
        const fullText = segs.map(s => s.text).join("");

        const clampPos = (p: number) => Math.max(1, Math.min(p, doc.content.size));
        const charToPos = (charIdx: number) => {
          if (segs.length === 0) return 1;
          if (charIdx <= 0) return segs[0].fromPos;
          if (charIdx >= segs[segs.length - 1].endIdx) return segs[segs.length - 1].toPos;
          for (const s of segs) {
            if (charIdx >= s.startIdx && charIdx <= s.endIdx) {
              const offset = charIdx - s.startIdx;
              return s.fromPos + offset;
            }
          }
          return segs[segs.length - 1].toPos;
        };
        const posToApproxCharIdx = (pmPos: number) => {
          for (const s of segs) {
            if (pmPos >= s.fromPos && pmPos <= s.toPos) return s.startIdx + (pmPos - s.fromPos);
          }
          return segs.length ? segs[segs.length - 1].endIdx : 0;
        };

        const findBestWindow = (anchor: string, before?: string, after?: string, approxIdx?: number) => {
          const candidates: { fromIdx: number; toIdx: number }[] = [];
          if (before && after) {
            const sandwich = before + anchor + after;
            let p = fullText.indexOf(sandwich);
            while (p !== -1) {
              const start = p + (before?.length ?? 0);
              candidates.push({ fromIdx: start, toIdx: start + anchor.length });
              p = fullText.indexOf(sandwich, p + 1);
            }
          }
          if (candidates.length === 0) {
            let p = fullText.indexOf(anchor);
            while (p !== -1) {
              candidates.push({ fromIdx: p, toIdx: p + anchor.length });
              p = fullText.indexOf(anchor, p + 1);
            }
          }
          if (candidates.length === 0) return null;
          if (approxIdx == null) return candidates[0];

          let best = candidates[0];
          let bestDist = Math.abs(candidates[0].fromIdx - approxIdx);
          for (let i = 1; i < candidates.length; i++) {
            const dist = Math.abs(candidates[i].fromIdx - approxIdx);
            if (dist < bestDist) { best = candidates[i]; bestDist = dist; }
          }
          return best;
        };

        const resolved = items.map(it => {
          const anchor = (it.anchorText ?? "").trim();
          const before = (it.contextBefore ?? "");
          const after = (it.contextAfter ?? "");
          const approx = posToApproxCharIdx(it.rangeFrom);

          if (anchor.length > 0 && fullText.length > 0) {
            const win = findBestWindow(anchor, before, after, approx);
            if (win) {
              const rf = clampPos(charToPos(win.fromIdx));
              const rt = clampPos(charToPos(win.toIdx));
              if (rf < rt) return { rangeFrom: rf, rangeTo: rt };
            }
          }
          return { rangeFrom: clampPos(it.rangeFrom), rangeTo: clampPos(it.rangeTo) };
        }).filter(r => r.rangeFrom < r.rangeTo);

        const view = (editor as any).view;
        view.dispatch(view.state.tr.setMeta(commentsHighlightsKey, resolved));
      },
    };

    (window as any).__onEditorReady?.();
    return () => { delete (window as any).__activeTiptapEditor; };
  }, [editor, applyRemoteHTML]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <EditorToolbar editor={editor} />
      <div className="p-3 min-h-[420px]">
        <EditorContent
          editor={editor}
          className="
            outline-none w-full min-h-[420px] overflow-x-hidden leading-relaxed
            !whitespace-pre-wrap break-words [overflow-wrap:anywhere]
            [&_*]:!whitespace-pre-wrap [&_*]:break-words [&_*]:[overflow-wrap:anywhere]
            [&_pre]:whitespace-pre [&_code]:whitespace-pre
          "
        />
      </div>
    </div>
  );
}
