import { useEffect, useMemo, useRef, useState } from "react";
import { ANNOTATION_HEX, GhostButton, MonoLabel, Select, Toggle, usePersistedState, useIsMobileScreen } from "./ui.jsx";
import { buildModel, drawQuoteCard, ensureFonts, readTheme } from "./quoteImage.js";
import { paletteTheme } from "./theme.js";
import { DEMO, apiURL, copyText, json } from "./api.js";

// Image themes for the share card — the app's four skins, chosen independently
// of the live app theme (an export choice, persisted per device). Value is the
// "aesthetic-mode" palette key drawTheme() resolves.
const IMAGE_THEMES = [
  ["paper-light", "Paper · Light"],
  ["paper-dark", "Paper · Dark"],
  ["film-light", "Film · Light"],
  ["film-dark", "Film · Dark"],
];

// defaultImageTheme seeds the picker from whatever the app is showing now, so
// the first share matches the live skin until the user picks otherwise.
function defaultImageTheme() {
  const t = readTheme();
  return `${t.aesthetic}-${t.dark ? "dark" : "light"}`;
}

// drawTheme resolves an IMAGE_THEMES key to the canvas theme object, keeping the
// app's current accent (the picker only swaps paper/film + light/dark).
function drawTheme(key) {
  const [aesthetic, mode] = String(key || "").split("-");
  return paletteTheme(aesthetic, mode === "dark", readTheme().accent);
}

const PRIMARY = "tp-btn tp-btn-primary";

// ---- supported formats -------------------------------------------------
// Each format's `logic` line is shown at the top of the popup so the sharer
// knows exactly which syntax will be produced; `hint` is a compact mono sample
// of that format's key tokens. Rules verified against the WhatsApp (2023
// formatting update) and Reddit markdown conventions.
export const SHARE_FORMATS = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    logic:
      "WhatsApp chat formatting — single-character wrappers; no headings or link syntax (raw URLs auto-link).",
    hint: "*bold*  _italic_  ~strike~  > quote  ```code```",
  },
  {
    id: "plaintext",
    name: "Plain",
    logic:
      "Plain text for Twitter/X, SMS — nothing renders, so: “curly quotes” around the quote and an — attribution line.",
    hint: "no markup · “…” · — Author, Title · #tags",
  },
  {
    id: "markdown",
    name: "Markdown",
    logic:
      "Rich Markdown — renders on GitHub, Obsidian, Notion and most editors.",
    hint: "**bold**  *italic*  ~~strike~~  > quote  `code`  [text](url)",
  },
  {
    id: "reddit",
    name: "Reddit",
    logic:
      "Reddit markdown (old & new) — like Markdown, with `> ` quotes and [text](url) links.",
    hint: "**bold**  *italic*  ~~strike~~  > quote  [text](url)",
  },
];

// ---- normalised share payload builders ---------------------------------
// Callers pass already-resolved strings (dates pre-formatted); these shape the
// uniform payload the dialog assembles + renders. Empty values are dropped by
// the dialog, so passing '' is fine.
export function bookShare({
  quote,
  note,
  author,
  title,
  published,
  chapter,
  location,
  date,
  tags,
  color,
}) {
  return {
    quote: quote || "",
    // The annotation colour (yellow|blue|pink|orange), for the quote-card
    // image's coloured edge. Ignored by the text formats.
    color: color || "",
    // Author-first (bold), work italic, then the publication year — the classic
    // epigraph order ("— **Author**, *Title*, 1965").
    attribution: [
      { id: "author", label: "Author", value: author || "", emphasis: "bold" },
      { id: "work", label: "Book", value: title || "", emphasis: "italic" },
      {
        id: "published",
        label: "Published",
        value: published ? String(published) : "",
      },
    ],
    // "Noted" is the date you saved/highlighted it (noted_at, else added_at) —
    // distinct from the publication year above.
    meta: [
      {
        id: "chapter",
        label: "Chapter",
        value: chapter ? `Ch. ${chapter}` : "",
      },
      {
        id: "location",
        label: "Location",
        value: location ? `p.${location}` : "",
      },
      { id: "noted", label: "Noted", value: date || "" },
    ],
    tags: tags || [],
    note: note || "",
  };
}

export function movieShare({
  quote,
  note,
  title,
  year,
  character,
  actor,
  timestamp,
  tags,
  tmdbId,
  tvdbId,
}) {
  return {
    quote: quote || "",
    attribution: [
      { id: "work", label: "Title", value: title || "", emphasis: "italic" },
      { id: "year", label: "Released", value: year ? String(year) : "" },
      { id: "tmdb", label: "TMDB", value: tmdbId ? `TMDB #${tmdbId}` : "" },
      { id: "tvdb", label: "TVDB", value: tvdbId ? `TVDB #${tvdbId}` : "" },
    ],
    // Actor name bold inside the "played by …" credit; character stays plain.
    meta: [
      { id: "character", label: "Character", value: character || "" },
      {
        id: "actor",
        label: "Actor",
        value: actor || "",
        emphasis: "bold",
        prefix: "played by ",
      },
      { id: "timestamp", label: "Time", value: timestamp || "" },
    ],
    tags: tags || [],
    note: note || "",
  };
}

// fieldsOf lists the toggleable parts present in a payload, in output order.
function fieldsOf(share) {
  const f = [];
  if (share.quote) f.push({ id: "quote", label: "Quote" });
  for (const a of share.attribution || [])
    if (a.value) f.push({ id: a.id, label: a.label });
  for (const m of share.meta || [])
    if (m.value) f.push({ id: m.id, label: m.label });
  if (share.tags && share.tags.length) f.push({ id: "tags", label: "Tags" });
  if (share.note) f.push({ id: "note", label: "Note" });
  return f;
}

// ---- text generation (source per format) -------------------------------
function italic(text, fmt) {
  if (fmt === "markdown" || fmt === "reddit") return `*${text}*`;
  if (fmt === "whatsapp") return `_${text}_`;
  return text; // plaintext: no styling
}
function bold(text, fmt) {
  if (fmt === "markdown" || fmt === "reddit") return `**${text}**`;
  if (fmt === "whatsapp") return `*${text}*`;
  return text; // plaintext: no styling
}
// emph applies a part's emphasis (bold for people — author/actor; italic for
// works — book/film title) in the syntax of the chosen format.
function emph(text, style, fmt) {
  if (style === "bold") return bold(text, fmt);
  if (style === "italic") return italic(text, fmt);
  return text;
}

function quoteBlock(quote, fmt) {
  if (fmt === "plaintext") return `“${quote}”`;
  // markdown / reddit / whatsapp all support the "> " blockquote prefix.
  return quote
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

function hashtag(t) {
  const clean = String(t).trim().replace(/\s+/g, "");
  return clean ? "#" + clean : "";
}

export function buildShareText(share, selected, fmt) {
  const blocks = [];
  if (selected.quote && share.quote) blocks.push(quoteBlock(share.quote, fmt));

  const attr = [];
  for (const a of share.attribution || [])
    if (selected[a.id] && a.value) attr.push(emph(a.value, a.emphasis, fmt));
  if (attr.length) blocks.push("— " + attr.join(", "));

  const meta = [];
  for (const m of share.meta || [])
    if (selected[m.id] && m.value)
      meta.push((m.prefix || "") + emph(m.value, m.emphasis, fmt));
  if (meta.length) blocks.push(meta.join(" · "));

  if (selected.note && share.note) blocks.push(share.note);

  if (selected.tags && share.tags && share.tags.length) {
    const tags = share.tags.map(hashtag).filter(Boolean).join(" ");
    if (tags) blocks.push(tags);
  }
  return blocks.join("\n\n");
}

// ---- HTML-simulation renderer ------------------------------------------
// Not a markdown library: a small per-format tokenizer that mirrors how each
// target app *displays* the source, so the live preview reflects the real
// result. Inline patterns are tried at each position; the earliest match wins
// (ties broken by array order, so ** beats *), and inner text recurses so
// bold-inside-italic etc. nest. `code` does not recurse (renders literally).

const mdInline = [
  {
    re: /`([^`]+)`/,
    el: (m, k) => (
      <code key={k} className="share-code">
        {m[1]}
      </code>
    ),
  },
  {
    re: /\*\*([^*]+)\*\*/,
    el: (m, k, P) => <strong key={k}>{inlineNodes(m[1], P)}</strong>,
  },
  {
    re: /__([^_]+)__/,
    el: (m, k, P) => <strong key={k}>{inlineNodes(m[1], P)}</strong>,
  },
  { re: /~~([^~]+)~~/, el: (m, k, P) => <s key={k}>{inlineNodes(m[1], P)}</s> },
  {
    re: /\*([^*\n]+)\*/,
    el: (m, k, P) => <em key={k}>{inlineNodes(m[1], P)}</em>,
  },
  {
    // Markdown italic, but not inside snake_case words. Avoid a leading
    // lookbehind — older Android WebViews / Safari lack ES2018 lookbehind and
    // Vite lowers the literal to a runtime `new RegExp(...)` that then throws
    // there, blanking the app. Instead consume the boundary char as group 1
    // (re-emitted as text by inlineNodes' `lead`), with the content in group 2.
    re: /(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/,
    lead: 1,
    el: (m, k, P) => <em key={k}>{inlineNodes(m[2], P)}</em>,
  },
  {
    re: /\[([^\]]+)\]\(([^)\s]+)\)/,
    el: (m, k) => (
      <a key={k} className="share-link">
        {m[1]}
      </a>
    ),
  },
];

const waInline = [
  {
    re: /```([^`]+)```/,
    el: (m, k) => (
      <code key={k} className="share-code">
        {m[1]}
      </code>
    ),
  },
  {
    re: /`([^`]+)`/,
    el: (m, k) => (
      <code key={k} className="share-code">
        {m[1]}
      </code>
    ),
  },
  {
    re: /\*([^*\n]+)\*/,
    el: (m, k, P) => <strong key={k}>{inlineNodes(m[1], P)}</strong>,
  },
  {
    re: /_([^_\n]+)_/,
    el: (m, k, P) => <em key={k}>{inlineNodes(m[1], P)}</em>,
  },
  { re: /~([^~\n]+)~/, el: (m, k, P) => <s key={k}>{inlineNodes(m[1], P)}</s> },
];

function patternsFor(fmt) {
  if (fmt === "whatsapp") return waInline;
  if (fmt === "markdown" || fmt === "reddit") return mdInline;
  return null; // plaintext: no inline markup
}

// inlineNodes tokenizes one line of text into React nodes using `patterns`.
function inlineNodes(text, patterns) {
  if (!patterns) return [text];
  const out = [];
  let rest = text;
  let k = 0;
  let guard = 0;
  while (rest.length && guard++ < 2000) {
    let best = null;
    for (const p of patterns) {
      const m = p.re.exec(rest); // non-global: always scans from index 0
      if (m && (!best || m.index < best.m.index)) best = { p, m };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    // A `lead` group is a boundary char the pattern had to consume (no
    // lookbehind on old engines) but that isn't part of the markup — keep it
    // as plain text so the preceding character survives.
    const lead = best.p.lead ? best.m[best.p.lead] || "" : "";
    const start = best.m.index + lead.length;
    if (start > 0) out.push(rest.slice(0, start));
    out.push(best.p.el(best.m, "i" + k++, patterns));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

// multiline renders text with intra-block newlines as <br>.
function multiline(text, patterns, keyBase) {
  const lines = text.split("\n");
  return lines.map((line, j) => (
    <span key={`${keyBase}-${j}`}>
      {inlineNodes(line, patterns)}
      {j < lines.length - 1 && <br />}
    </span>
  ));
}

function renderBlock(blk, fmt, patterns, i) {
  const lines = blk.split("\n");
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  // blockquote — supported by markdown / reddit / whatsapp
  if (
    fmt !== "plaintext" &&
    nonEmpty.length &&
    nonEmpty.every((l) => /^>\s?/.test(l))
  ) {
    const inner = lines.map((l) => l.replace(/^>\s?/, "")).join("\n");
    return (
      <blockquote key={i} className="share-quote">
        {multiline(inner, patterns, `q${i}`)}
      </blockquote>
    );
  }
  // heading — markdown / reddit only (whatsapp shows '#' literally)
  if ((fmt === "markdown" || fmt === "reddit") && lines.length === 1) {
    const h = blk.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(h[1].length + 2, 6); // keep previews modest (h3–h6)
      const Tag = `h${lvl}`;
      return (
        <Tag key={i} className="share-h">
          {inlineNodes(h[2], patterns)}
        </Tag>
      );
    }
  }
  // bulleted list
  if (
    fmt !== "plaintext" &&
    nonEmpty.length &&
    nonEmpty.every((l) => /^[-*+]\s+/.test(l))
  ) {
    return (
      <ul key={i} className="share-ul">
        {nonEmpty.map((l, j) => (
          <li key={j}>{inlineNodes(l.replace(/^[-*+]\s+/, ""), patterns)}</li>
        ))}
      </ul>
    );
  }
  // numbered list
  if (
    fmt !== "plaintext" &&
    nonEmpty.length &&
    nonEmpty.every((l) => /^\d+[.)]\s+/.test(l))
  ) {
    return (
      <ol key={i} className="share-ol">
        {nonEmpty.map((l, j) => (
          <li key={j}>{inlineNodes(l.replace(/^\d+[.)]\s+/, ""), patterns)}</li>
        ))}
      </ol>
    );
  }
  return (
    <p key={i} className="share-p">
      {multiline(blk, patterns, `p${i}`)}
    </p>
  );
}

export function renderShareHTML(text, fmt) {
  const patterns = patternsFor(fmt);
  const blocks = text.split(/\n{2,}/);
  return blocks.map((blk, i) => renderBlock(blk, fmt, patterns, i));
}

// ---- quote-card image (ROADMAP §10) ------------------------------------
// The "Image" format: the same field-picking, rendered to a shareable PNG in
// the current paper/film skin (drawn locally on a <canvas>, see quoteImage.js).
function QuoteImagePanel({ share, selected, onShared }) {
  const canvasRef = useRef(null);
  const mobile = useIsMobileScreen();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // The image skin is chosen independently of the app theme and persisted per
  // device (an export preference, not an identity one — like the view toggles).
  const [imageTheme, setImageTheme] = usePersistedState("tippani:shareImageTheme", defaultImageTheme());

  useEffect(() => {
    let cancelled = false;
    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      try {
        const colorHex = share.color ? ANNOTATION_HEX[share.color] : null;
        drawQuoteCard(canvas, buildModel(share, selected, colorHex), drawTheme(imageTheme));
        setErr("");
      } catch {
        setErr("couldn't render the image on this device");
      }
    };
    redraw();
    // Redraw once the bundled fonts are ready (first paint may fall back) and
    // whenever the app accent flips (the chosen skin follows the picker, but the
    // accent still tracks the app).
    ensureFonts().then(redraw);
    window.addEventListener("tippani:theme", redraw);
    return () => {
      cancelled = true;
      window.removeEventListener("tippani:theme", redraw);
    };
  }, [share, selected, imageTheme]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return setErr("couldn't render the image on this device");
    // Phones get the native share sheet (save to Photos/Files, or share
    // straight on) via a named File. The anchor-download path is broken on
    // mobile two ways: iOS Safari — and installed PWAs especially — ignore
    // a.download on blob: URLs (the file saves under the blob's UUID, the
    // "hash" filename), and the async save races URL.revokeObjectURL (a
    // truncated, corrupt PNG). Desktop keeps the plain download it had.
    if (mobile && navigator.canShare && navigator.share) {
      const file = new File([blob], "tippani-quote.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          onShared?.();
          return;
        } catch (e) {
          if (e?.name === "AbortError") return; // user closed the sheet — not an error
          // anything else falls through to the server round-trip below
        }
      }
    }
    // Phones without a usable Web Share API — Android WebView wrappers
    // (Native Alpha) never implement it, and plain-HTTP origins strip it —
    // round-trip through the server instead: stage the PNG, then download the
    // returned one-shot URL. A real URL + Content-Disposition survives the
    // WebView DownloadManager boundary that garbles blob: names and bytes.
    if (mobile) {
      try {
        const form = new FormData();
        form.append("file", blob, "tippani-quote.png");
        const r = await fetch(apiURL("/share/image"), { method: "POST", body: form });
        if (r.ok) {
          const { url } = await r.json();
          const a = document.createElement("a");
          a.href = apiURL(url);
          a.download = "tippani-quote.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          onShared?.();
          return;
        }
      } catch {
        // server unreachable — the blob anchor below is the last resort
      }
    }
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "tippani-quote.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke LATER: browsers save blob URLs asynchronously (mobile especially);
    // an immediate revoke truncates the download into a corrupt file.
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    onShared?.();
  }

  const canCopyImage =
    typeof window !== "undefined" &&
    typeof window.ClipboardItem !== "undefined" &&
    !!navigator.clipboard?.write;

  async function copyImage() {
    const canvas = canvasRef.current;
    if (!canvas || !canCopyImage) return;
    setBusy(true);
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      onShared?.();
    } catch {
      setErr("image copy isn't supported here — use Download");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MonoLabel>theme</MonoLabel>
        <Select
          ariaLabel="Image theme"
          value={imageTheme}
          onChange={setImageTheme}
          options={IMAGE_THEMES}
        />
        <span className="microcopy" style={{ color: "var(--soft)" }}>
          image only — doesn’t change the app
        </span>
      </div>
      <MonoLabel className="mb-1.5 block">preview</MonoLabel>
      <div className="share-image-preview">
        <canvas ref={canvasRef} className="share-image-canvas" aria-label="Quote card image preview" />
      </div>
      {err && (
        <p className="microcopy mt-2" style={{ color: "var(--error)" }}>
          {err}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {canCopyImage && (
          <GhostButton onClick={copyImage} disabled={busy}>
            {copied ? "Copied ✓" : "Copy image"}
          </GhostButton>
        )}
        <button className={PRIMARY} onClick={download}>
          {mobile ? "Share / save PNG" : "Download PNG"}
        </button>
      </div>
    </div>
  );
}

// ---- the dialog --------------------------------------------------------
export function ShareDialog({ share, seen, onClose }) {
  const [format, setFormat] = useState("whatsapp");
  const fields = useMemo(() => fieldsOf(share), [share]);
  const [selected, setSelected] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.id, true])),
  );
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const mobile = useIsMobileScreen()
  // Sharing a quote counts as "seeing" it (spaced-repetition reinforcement).
  // Fire once per dialog, on the first successful copy/download, for the item
  // being shared. Fire-and-forget: it's a marginal bump, off unless srSeen > 1.
  const seenFired = useRef(false);
  const markSeen = () => {
    if (seenFired.current || DEMO || !seen?.id) return;
    seenFired.current = true;
    json("POST", "/review/seen", { kind: seen.kind, id: seen.id });
  };

  const active = SHARE_FORMATS.find((f) => f.id === format) || SHARE_FORMATS[0];
  // "Image" is a format alongside the text ones — same field-picking, rendered
  // to a PNG instead of copyable text (ROADMAP §10).
  const isImage = format === "image";
  const formatOptions = [...SHARE_FORMATS.map((f) => [f.id, f.name]), ["image", "Image"]];

  // Regenerate the source whenever the format or the chosen fields change.
  // Manual edits to the textarea persist until the next such change.
  useEffect(() => {
    setText(buildShareText(share, selected, format));
    setCopied(false);
  }, [share, selected, format]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    // copyText falls back to execCommand on insecure origins (self-hosted over
    // HTTP), where navigator.clipboard is undefined and the old path silently
    // no-opped — that was the "copy does nothing" bug.
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      markSeen();
    }
  }

  const preview = useMemo(() => renderShareHTML(text, format), [text, format]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      style={{ background: "rgba(21,16,12,.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share quote"
        className="hand-card hc-r2 mx-auto w-full max-w-3xl px-6 py-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="display-title text-xl">Share</h2>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>

        {/* format toggle + the per-format logic shown up top */}
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <MonoLabel>format</MonoLabel>
            {mobile ? (
              <select
                className="tp-input"
                aria-label="Share format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {formatOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="share-format-toggle">
                <Toggle
                  ariaLabel="Share format"
                  value={format}
                  onChange={setFormat}
                  options={formatOptions}
                />
              </div>
            )}
          </div>
          {isImage ? (
            <p className="microcopy" style={{ color: "var(--soft)" }}>
              a shareable image in your current paper/film skin — pick what to include below, then download or copy it.
            </p>
          ) : (
            <>
              <p className="microcopy" style={{ color: "var(--soft)" }}>
                {active.logic}
              </p>
              <code className="share-hint">{active.hint}</code>
            </>
          )}
        </div>

        {/* choose what to include */}
        {fields.length > 0 && (
          <div className="mb-4">
            <MonoLabel className="mb-2 block">include</MonoLabel>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {fields.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-2"
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[f.id]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [f.id]: e.target.checked }))
                    }
                  />
                  <span className="microcopy">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Image: rendered card + download/copy. Text: editable source ↔ live
            rendered preview. */}
        {isImage ? (
          <QuoteImagePanel share={share} selected={selected} onShared={markSeen} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <MonoLabel className="mb-1.5 block">text</MonoLabel>
              <textarea
                className="tp-input share-source"
                rows="11"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Shareable text"
              />
            </div>
            <div>
              <MonoLabel className="mb-1.5 block">preview</MonoLabel>
              <div className="share-preview" aria-live="polite">
                {text.trim() ? (
                  preview
                ) : (
                  <p className="microcopy">nothing selected</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <GhostButton onClick={onClose}>Done</GhostButton>
          {!isImage && (
            <button className={PRIMARY} onClick={copy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
