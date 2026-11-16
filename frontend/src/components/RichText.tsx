import { Fragment, type ReactNode } from "react";

/** The few Markdown shapes the tutor uses: paragraphs, bullet/numbered lists, **bold**.
 *  Rendered as React elements (escaped), never as HTML, so model text can't inject markup. */
export type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;
    let para: string[] = [];
    let list: Block | null = null;
    const flushPara = () => {
      if (para.length) blocks.push({ kind: "p", lines: para });
      para = [];
    };
    const flushList = () => {
      if (list) blocks.push(list);
      list = null;
    };
    for (const line of lines) {
      const kind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : null;
      if (kind) {
        flushPara();
        if (!list || list.kind !== kind) {
          flushList();
          list = { kind, items: [] };
        }
        (list as { items: string[] }).items.push(line.replace(kind === "ul" ? BULLET : NUMBERED, ""));
      } else {
        flushList();
        para.push(line.trim());
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

export function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {parseBlocks(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ) : b.kind === "ul" ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
