// components/extensions/CommentsHighlights.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const commentsHighlightsKey = new PluginKey("commentsHighlights");

export const CommentsHighlights = Extension.create({
  name: "commentsHighlights",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: commentsHighlightsKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const items = tr.getMeta(commentsHighlightsKey) as
              | { rangeFrom: number; rangeTo: number }[]
              | undefined;

            if (items) {
              const decos = items
                .filter(i => i.rangeFrom < i.rangeTo)
                .map(i =>
                  Decoration.inline(i.rangeFrom, i.rangeTo, {
                    class: "pm-comment-highlight",
                    "data-cmt": "1",
                  })
                );
              return DecorationSet.create(tr.doc, decos);
            }

            return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },
});
