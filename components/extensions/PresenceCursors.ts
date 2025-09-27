// components/extensions/PresenceCursors.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export type Peer = { userId: string; name: string; color: string; from: number; to: number };
export const presenceCursorsKey = new PluginKey("presenceCursors");

export const PresenceCursors = Extension.create({
  name: "presenceCursors",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: presenceCursorsKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const peers = tr.getMeta(presenceCursorsKey) as Peer[] | undefined;

            if (!peers) return old.map(tr.mapping, tr.doc);

            const decos: Decoration[] = [];
            const size = tr.doc.content.size;

            for (const p of peers) {
              const from = Math.max(0, Math.min(p.from, size));
              const to = Math.max(0, Math.min(p.to, size));
              const head = to;

              // Selection highlight per peer (use an opaque base + alpha)
              if (from !== to) {
                decos.push(
                  Decoration.inline(
                    from,
                    to,
                    {
                      class: "pm-peer-selection",
                      style: `--peer-color:${p.color}33`, // CSS var used by class
                    },
                    { inclusive: false }
                  )
                );
              }

              // Caret + label widget
              const caretPos = Math.max(0, Math.min(head, size));
              decos.push(
                Decoration.widget(
                  caretPos,
                  () => {
                    const container = document.createElement("span");
                    container.style.position = "relative";
                    container.style.pointerEvents = "none";

                    const bar = document.createElement("span");
                    bar.style.borderLeft = `2px solid ${p.color}`;
                    bar.style.display = "inline-block";
                    bar.style.height = "1em";
                    bar.style.verticalAlign = "text-bottom";
                    bar.style.marginLeft = "-1px";

                    const label = document.createElement("span");
                    label.textContent = ` ${p.name}`;
                    label.style.background = p.color;
                    label.style.color = "#fff";
                    label.style.fontSize = "10px";
                    label.style.padding = "0 4px";
                    label.style.borderRadius = "3px";
                    label.style.marginLeft = "2px";
                    label.style.filter = "drop-shadow(0 1px 1px rgba(0,0,0,.25))";

                    container.appendChild(bar);
                    container.appendChild(label);
                    return container;
                  },
                  { side: -1, key: `cursor:${p.userId}`, ignoreSelection: true }
                )
              );
            }

            return DecorationSet.create(tr.doc, decos);
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
