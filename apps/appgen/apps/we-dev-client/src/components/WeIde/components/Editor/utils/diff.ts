import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from "@codemirror/view";
import {
  StateEffect,
  StateField,
  Extension,
  Range,
  Text,
} from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { createDiffButtons } from "../../DiffButtons";


interface DiffRange {
  from: number;
  to: number;
  type: "add" | "delete";
  isEmptyLine?: boolean;
}

interface DiffBlock {
  search: { start: number; end: number };
  replace: { start: number; end: number };
}

// Constants definition
const DIFF_MARKERS = {
  SEARCH: "<<<<<<< SEARCH",
  SEPARATOR: "=======",
  REPLACE: ">>>>>>> REPLACE",
} as const;

const getDeleteRange = (doc: Text, fromLine: number, toLine: number) => {
  const startLine = doc.line(fromLine);
  const endLine = doc.line(toLine);
  if (toLine < doc.lines) {
    return { from: startLine.from, to: doc.line(toLine + 1).from };
  } else if (fromLine > 1) {
    return { from: doc.line(fromLine - 1).to, to: endLine.to };
  } else {
    return { from: startLine.from, to: endLine.to };
  }
};

class DiffSeparatorWidget extends WidgetType {
  eq() {
    return false;
  }

  toDOM(view: EditorView) {
    let container: HTMLElement;
    const onAccept = () => {
      if (!container) return;
      const pos = view.posAtDOM(container);
      const lineNum = view.state.doc.lineAt(pos).number;
      const blocks = parseDiffBlocks(view.state.doc.toString());
      const block = blocks.find((b) => b.search.end === lineNum);
      if (block) {
        const { search, replace } = block;
        view.dispatch({
          changes: [
            getDeleteRange(view.state.doc, search.start, search.end),
            getDeleteRange(view.state.doc, replace.end, replace.end),
          ],
        });
      }
    };

    const onCancel = () => {
      if (!container) return;
      const pos = view.posAtDOM(container);
      const lineNum = view.state.doc.lineAt(pos).number;
      const blocks = parseDiffBlocks(view.state.doc.toString());
      const block = blocks.find((b) => b.search.end === lineNum);
      if (block) {
        const { search, replace } = block;
        view.dispatch({
          changes: [
            getDeleteRange(view.state.doc, search.start, search.start),
            getDeleteRange(view.state.doc, search.end, replace.end),
          ],
        });
      }
    };

    container = createDiffButtons(onAccept, onCancel);
    return container;
  }

  updateDOM() {
    return false;
  }

  get estimatedHeight() {
    return 24;
  }

  ignoreEvent() {
    return false;
  }

  get lineBreaks() {
    return 0;
  }

  coordsAt() {
    return null;
  }

  destroy() {}
}

// Decorator definitions
const decorations = {
  add: {
    line: Decoration.line({ class: "diff-add" }),
  },
  delete: {
    line: Decoration.line({ class: "diff-delete" }),
  },
  marker: {
    search: Decoration.mark({ class: "diff-marker diff-marker-search" }),
    separator: () =>
      Decoration.replace({
        widget: new DiffSeparatorWidget(),
      }),
    replace: Decoration.mark({ class: "diff-marker diff-marker-replace" }),
  },
};

export const addDiffHighlight = StateEffect.define<
  DiffRange & { markerType?: "search" | "separator" | "replace" }
>();

export const diffHighlightPlugin = StateField.define({
  create(): DecorationSet {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = tr.docChanged ? highlights.map(tr.changes) : highlights;

    const newDecorations: Range<Decoration>[] = [];
    for (const effect of tr.effects) {
      if (effect.is(addDiffHighlight)) {
        const { from, to, type, markerType } = effect.value;
        if (from >= 0 && to <= tr.state.doc.length) {
          if (markerType) {
            const dec = decorations.marker[markerType];
            const range =
              typeof dec === "function"
                ? dec().range(from, to)
                : dec.range(from, to);
            newDecorations.push(range);
          } else {
            const line = tr.state.doc.lineAt(from);
            newDecorations.push(
              decorations[type].line.range(line.from, line.from)
            );
          }
        }
      }
    }

    if (newDecorations.length > 0) {
      return Decoration.set(newDecorations, true);
    }

    return highlights;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Check if content contains diff markers
export const hasDiffContent = (content: string) => {
  return (
    content.includes(DIFF_MARKERS.SEARCH) ||
    content.includes(DIFF_MARKERS.REPLACE)
  );
};
const parseDiffBlocks = (doc: string): DiffBlock[] => {
  const lines = doc.split("\n");
  const blocks: DiffBlock[] = [];
  let currentBlock: Partial<DiffBlock> = {};
  let isInSearchBlock = false;
  let lastLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes(DIFF_MARKERS.SEARCH)) {
      if (blocks.length > 0 && i - lastLineIndex <= 2) {
        currentBlock = blocks.pop()!;
      } else {
        currentBlock = {};
      }
      isInSearchBlock = true;
      currentBlock.search = { start: i + 1, end: -1 };
    } else if (line.includes(DIFF_MARKERS.SEPARATOR) && isInSearchBlock) {
      currentBlock.search!.end = i + 1;
    } else if (line.includes(DIFF_MARKERS.REPLACE) && isInSearchBlock) {
      currentBlock.replace = {
        start: currentBlock.search!.end + 1,
        end: i + 1,
      };
      blocks.push(currentBlock as DiffBlock);
      lastLineIndex = i;
      isInSearchBlock = false;
    } else if (isInSearchBlock && line.trim() === "") {
      if (currentBlock.search && currentBlock.search.end === -1) {
        currentBlock.search.end = i + 1;
      }
    }
  }
  return blocks;
};

const createHighlightEffects = (view: EditorView) => {
  const content = view.state.doc.toString();
  const blocks = parseDiffBlocks(content);
  const effects: StateEffect<
    DiffRange & { markerType?: "search" | "separator" | "replace" }
  >[] = [];

  blocks.forEach((block) => {
    // Mark special lines
    const searchLine = view.state.doc.line(block.search.start);
    const separatorLine = view.state.doc.line(block.search.end);
    const replaceLine = view.state.doc.line(block.replace.end);

    effects.push(
      addDiffHighlight.of({
        from: searchLine.from,
        to: searchLine.to,
        type: "delete",
        markerType: "search",
      }),
      addDiffHighlight.of({
        from: separatorLine.from,
        to: separatorLine.to,
        type: "delete",
        markerType: "separator",
      }),
      addDiffHighlight.of({
        from: replaceLine.from,
        to: replaceLine.to,
        type: "delete",
        markerType: "replace",
      })
    );

    // Process all lines in delete block
    for (let i = block.search.start + 1; i < block.search.end; i++) {
      const line = view.state.doc.line(i);
      effects.push(
        addDiffHighlight.of({
          from: line.from,
          to: line.to,
          type: "delete",
        })
      );
    }

    // Process all lines in add block
    for (let i = block.search.end + 1; i < block.replace.end; i++) {
      const line = view.state.doc.line(i);
      effects.push(
        addDiffHighlight.of({
          from: line.from,
          to: line.to,
          type: "add",
        })
      );
    }
  });

  return effects;
};

export const createDiffExtension = (): Extension => {
  return [
    diffHighlightPlugin,
    EditorView.updateListener.of((update) => {
      // Check and apply diff on initialization or content change
      if (update.docChanged || update.startState.doc.length === 0) {
        const content = update.state.doc.toString();
        if (hasDiffContent(content)) {
          applyDiffHighlights(update.view);
        }
      }
    }),
    // View initialization extension
    EditorView.domEventHandlers({
      // Use focusin event to ensure editor is fully initialized
      focusin: (event, view) => {
        const content = view.state.doc.toString();
        if (hasDiffContent(content)) {
          console.log("Detected diff content on focusin");
          applyDiffHighlights(view);
        }
      },
    }),
    // Add custom Enter key handler
    keymap.of([
      {
        key: "Enter",
        run: (view: EditorView) => {
          const content = view.state.doc.toString();

          if (hasDiffContent(content)) {
            view.dispatch(view.state.replaceSelection("\n"));
            return true;
          }
          return false;
        },
        // Increase priority
        preventDefault: true,
      },
    ]),
  ];
};

// Apply diff highlights
export const applyDiffHighlights = (view: EditorView) => {
  const effects = createHighlightEffects(view);
  if (effects.length > 0) {
    view.dispatch({
      effects: effects,
    });
  }
};
