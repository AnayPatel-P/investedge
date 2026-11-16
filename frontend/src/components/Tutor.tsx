import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, streamChat, useAiStatus, useSummary } from "../api/client";
import type { ProfileKey } from "../api/types";
import { RichText } from "./RichText";
import "./Tutor.css";

const TOOL_LABEL: Record<string, string> = {
  get_metrics: "risk metrics",
  get_forecasts: "forecasts",
  get_scorecard: "scorecard",
  get_price_history: "price history",
};

interface Turn {
  role: "user" | "assistant";
  content: string;
  lookups?: { name: string; symbol: string | null; ok: boolean }[];
  error?: string;
  pending?: boolean;
}

const STARTERS = (sym: string) => [
  `How reliable are the forecasts for ${sym}?`,
  `How risky is ${sym} for someone like me?`,
  "What does beta mean on this page?",
  `Should I buy ${sym}?`,
];

/** AI briefing + grounded tutor chat (Phase 5). */
export function Tutor({ symbol, profile }: { symbol: string; profile: ProfileKey | null }) {
  const status = useAiStatus();
  const configured = status.data?.configured ?? false;

  return (
    <section className="tutor" aria-labelledby="tutor-title">
      <header className="tutor-head">
        <p className="kicker">AI tutor</p>
        <h2 id="tutor-title">Ask about {symbol}</h2>
        <p className="tutor-note muted">
          Written by Claude from the numbers on this page. It explains — it never tells you to buy or sell. It can be wrong;
          the charts and tables above are the source of truth.
        </p>
      </header>
      {status.isLoading ? null : !configured ? (
        <p className="tutor-off">
          The AI tutor isn't switched on for this copy of InvestEdge — the server needs an Anthropic API key. Everything else on
          the page works without it.
        </p>
      ) : (
        <>
          {profile && <Briefing symbol={symbol} profile={profile} />}
          <Chat symbol={symbol} profile={profile} />
        </>
      )}
    </section>
  );
}

function Briefing({ symbol, profile }: { symbol: string; profile: ProfileKey }) {
  const { data, isLoading, error } = useSummary(symbol, profile, true);
  return (
    <div className="briefing" aria-live="polite" aria-busy={isLoading}>
      <p className="kicker">Briefing for {profile === "aggressive" ? "an" : "a"} {profile} investor</p>
      {isLoading && (
        <div aria-hidden="true" className="briefing-skeleton">
          {[92, 100, 96, 70].map((w, i) => (
            <span key={i} className="skeleton" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {error && (
        <p className="muted">
          {error instanceof ApiError && error.status === 429
            ? "Too many briefings this hour — try again later."
            : error instanceof ApiError && error.status === 503
              ? error.message
              : "Couldn't write a briefing right now."}
        </p>
      )}
      {data && <RichText className="briefing-text" text={data.text} />}
    </div>
  );
}

function Chat({ symbol, profile }: { symbol: string; profile: ProfileKey | null }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLOListElement>(null);

  // New stock = new conversation.
  useEffect(() => {
    abortRef.current?.abort();
    setTurns([]);
    setBusy(false);
  }, [symbol]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = [...turns.filter((t) => !t.error && t.content), { role: "user" as const, content: q }];
    setTurns([...history, { role: "assistant", content: "", lookups: [], pending: true }]);
    setDraft("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (fn: (t: Turn) => Turn) => setTurns((ts) => [...ts.slice(0, -1), fn(ts[ts.length - 1])]);
    try {
      await streamChat(
        symbol,
        { profile, messages: history.map(({ role, content }) => ({ role, content })) },
        (e) => {
          if (e.type === "text") patch((t) => ({ ...t, content: t.content + e.text }));
          else if (e.type === "tool") patch((t) => ({ ...t, lookups: [...(t.lookups ?? []), e] }));
          else if (e.type === "replace") patch((t) => ({ ...t, content: e.text }));
          else if (e.type === "error") patch((t) => ({ ...t, error: e.message }));
        },
        ctrl.signal,
      );
    } catch (err) {
      if (!ctrl.signal.aborted) patch((t) => ({ ...t, error: err instanceof Error ? err.message : "Something went wrong" }));
    } finally {
      patch((t) => ({ ...t, pending: false }));
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  return (
    <div className="chat">
      {turns.length === 0 && (
        <div className="starters" role="group" aria-label="Suggested questions">
          {STARTERS(symbol).map((s) => (
            <button key={s} type="button" className="starter" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <ol className="chat-log" ref={logRef} aria-live="polite">
        {turns.map((t, i) => (
          <li key={i} className={`turn ${t.role}`}>
            <span className="turn-mark mono" aria-hidden="true">
              {t.role === "user" ? "Q." : "A."}
            </span>
            <div className="turn-body">
              {t.lookups && t.lookups.length > 0 && (
                <p className="lookups mono">
                  {t.lookups.map((l, j) => (
                    <span key={j} className={l.ok ? "" : "down"}>
                      ↳ {l.ok ? "looked up" : "couldn't find"} {TOOL_LABEL[l.name] ?? l.name}
                      {l.symbol ? ` · ${l.symbol}` : ""}
                    </span>
                  ))}
                </p>
              )}
              {t.content && <RichText className="turn-text" text={t.content} />}
              {t.pending && !t.content && <p className="thinking muted">Thinking it through…</p>}
              {t.error && (
                <p className="down" role="alert">
                  {t.error}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={onSubmit}>
        <label htmlFor="tutor-input" className="visually-hidden">
          Ask the tutor about {symbol}
        </label>
        <textarea
          id="tutor-input"
          rows={2}
          maxLength={1000}
          value={draft}
          placeholder={`Ask anything about ${symbol}, its chart, or these models…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        {busy ? (
          <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn primary" disabled={!draft.trim()}>
            Ask
          </button>
        )}
      </form>
    </div>
  );
}
