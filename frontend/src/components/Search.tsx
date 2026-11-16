import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../api/client";

/** Type-ahead ticker search (ARIA combobox). Enter opens the highlighted stock. */
export function Search({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const listId = useId();
  const { data = [] } = useSearch(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 120);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setActive(0), [debounced]);

  const go = (symbol: string) => {
    setQ("");
    setOpen(false);
    navigate(`/stock/${symbol}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!data.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % data.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + data.length) % data.length);
    } else if (e.key === "Enter") {
      go(data[active].symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && q.trim().length > 0;
  return (
    <div className="search">
      <label className="visually-hidden" htmlFor={`${listId}-input`}>
        Search S&amp;P 500 stocks by ticker or company
      </label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && data[active] ? `${listId}-${data[active].symbol}` : undefined}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder="Search a stock — AAPL, Coca-Cola…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="search-list">
          {data.length === 0 && <li className="search-empty muted">No S&amp;P 500 match for “{q}”</li>}
          {data.map((t, i) => (
            <li
              key={t.symbol}
              id={`${listId}-${t.symbol}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(t.symbol)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="mono search-sym">{t.symbol}</span>
              <span className="search-name">{t.name}</span>
              <span className="search-sector muted">{t.sector}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
