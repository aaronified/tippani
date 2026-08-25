import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock, ANNOTATION_HEX, CloseButton, FieldIconButton, GhostButton, IconShare, InfoDot, MonoLabel, Select, Toggle, toast, usePersistedState, useIsMobileScreen } from "./ui.jsx";
import { buildModel, drawQuoteCard, ensureFonts, loadFaceImages, loadTileImage, readTheme, tileImage } from "./quoteImage.js";
import { t } from "./i18n.js";
import { DEFAULT_CREDIT_SEPS, splitCredits } from "./people.jsx";
import { categoryHex, MAT_SET_DEFAULT, MAT_SET_LABELS, MAT_SETS, paletteTheme, tileFor } from "./theme.js";
import { DEMO, apiURL, copyText, coverImgURL, json } from "./api.js";

// resolveFaces turns a credit string + a name→metadata map into the portrait
// chips drawn on the quote-card image: one per credited name that has a saved
// photo, first credited first (the image draws them overlapping, first on top).
// The url is the same-origin cover route, so the canvas stays untainted.
function resolveFaces(credit, people, seps) {
  if (!credit || !people) return [];
  return splitCredits(credit, seps || DEFAULT_CREDIT_SEPS)
    .map((n) => people[n])
    .filter((p) => p && p.image_path)
    .map((p) => ({ name: p.name, url: coverImgURL(p.image_path) }));
}

// The picture is chosen along the same two axes the app is: a mode and a material.
// Both are export choices, persisted per device and independent of the live app
// theme, so sharing a dark Bindery card out of a light Manuscript app is one pick.
//
// TWO CONTROLS RATHER THAN ONE LIST OF FOURTEEN. There used to be four skins —
// paper and film in light and dark — as a single list, which worked at four and does
// not at 7 x 2. The two axes were always independent; the old list only got away
// with enumerating them.
// Functions rather than tables: the names are copy, read at render time.
const imageThemes = () => [
  ["light", t("share.image.theme.light.label")],
  ["dark", t("share.image.theme.dark.label")],
];
const imageMaterials = () =>
  Object.keys(MAT_SETS).map((name) => [name, t(MAT_SET_LABELS[name])]);

// defaultImageTheme seeds the picker from whatever the app is showing now, so
// the first share matches the live skin until the user picks otherwise.
function defaultImageTheme() {
  return readTheme().dark ? "dark" : "light";
}

function defaultImageMaterial() {
  const s = readTheme().materialSet;
  return MAT_SETS[s] ? s : MAT_SET_DEFAULT;
}

// drawTheme resolves the two picker values to the canvas theme object, keeping the
// app's current accent (the picker swaps the mode and the material, not the accent).
//
// A DEVICE THAT REMEMBERS "film-dark" STILL GETS DARK. The stored mode is per-device
// and predates the split, so it can be any of the four old keys; anything ending in
// "dark" reads as dark and everything else falls to light. Same shape as every other
// retired preference here — unknown means default, and nobody migrates a
// localStorage key.
//
// The tile rides on the theme object because that is what drawQuoteCard is handed.
// Its image may be null on the first draw; the effect below loads it and redraws,
// exactly as it already does for fonts and for portrait faces.
function drawTheme(key, material) {
  const k = String(key || "");
  const dark = k === "dark" || k.endsWith("-dark");
  const tile = tileFor(material, "card");
  return {
    ...paletteTheme(dark, readTheme().accent),
    materialSet: MAT_SETS[material] ? material : MAT_SET_DEFAULT,
    tile: { ...tile, img: tileImage(tile.url) },
  };
}

const PRIMARY = "tp-btn tp-btn-primary";

// ---- supported formats -------------------------------------------------
// Each format's `logic` line says exactly which syntax will be produced and
// `hint` is a compact mono sample of that format's key tokens. Both live behind
// the format row's InfoDot: they are reference material — you read them once,
// when you are deciding, and then you know — and four lines of syntax reference
// standing permanently above the thing they describe pushes the quote itself
// below the fold on a phone. Rules verified against the WhatsApp (2023
// formatting update) and Reddit markdown conventions.
// GETTERS, because this table is built at module scope — before a locale has
// been applied — and the dialog reads `active.name` / `.logic` / `.hint` while it
// renders. The four names are product names and stay as they are in every
// language; the `hint` lines are literal markup samples.
export const SHARE_FORMATS = [
  {
    id: "whatsapp",
    get name() { return t("share.format.whatsapp.name"); },
    get logic() { return t("share.format.whatsapp.what"); },
    get hint() { return t("share.format.whatsapp.hint"); },
  },
  {
    id: "plaintext",
    get name() { return t("share.format.plaintext.name"); },
    get logic() { return t("share.format.plaintext.what"); },
    get hint() { return t("share.format.plaintext.hint"); },
  },
  {
    id: "markdown",
    get name() { return t("share.format.markdown.name"); },
    get logic() { return t("share.format.markdown.what"); },
    get hint() { return t("share.format.markdown.hint"); },
  },
  {
    id: "reddit",
    get name() { return t("share.format.reddit.name"); },
    get logic() { return t("share.format.reddit.what"); },
    get hint() { return t("share.format.reddit.hint"); },
  },
];

// The Image "format" has no syntax to describe, so its help says what the thing
// IS instead. It sits here beside the `logic` lines because it answers the same
// question in the same place — what am I about to produce — and the dialog
// picks between them on one condition rather than laying out two different
// explanations in two different shapes.
const IMAGE_LOGIC = () => t("share.format.image.what");

// ---- normalised share payload builders ---------------------------------
// Callers pass already-resolved strings (dates pre-formatted); these shape the
// uniform payload the dialog assembles + renders. Empty values are dropped by
// the dialog, so passing '' is fine.
export function bookShare({
  quote,
  note,
  translation,
  author,
  title,
  published,
  chapter,
  location,
  // WHO SAID IT (0047). A highlight from a novel is very often a line somebody
  // speaks, and the box that records that shipped four releases before this
  // payload learned about it — so the character was on the card in the app and
  // absent from every copy and every picture made of it. Between the locator and
  // the save-date, which is where a film line's character sits on its own meta
  // line: it is not the attribution (a book's attribution is its author) and it
  // is not a page number.
  character,
  date,
  tags,
  color,
  people,
  seps,
}) {
  return {
    quote: quote || "",
    // WHAT THE LINE SAYS (0051). The same slot, and the same argument, that
    // quoteShare has carried since 0035: a share of a Bengali highlight that
    // carried only the original is half the quote to anybody who cannot read it.
    // The dialog offers it as a toggle like any other part, so a share of an
    // untranslated highlight is byte-for-byte what it was.
    translation: translation || "",
    // The annotation colour (yellow|blue|pink|orange), for the quote-card
    // image's coloured edge. Ignored by the text formats.
    color: color || "",
    // Author face(s) for the image, gated by the "Author" toggle (facesFor).
    faces: resolveFaces(author, people, seps),
    facesFor: "author",
    // Author-first (bold), work italic, then the publication year — the classic
    // epigraph order ("— **Author**, *Title*, 1965").
    attribution: [
      { id: "author", label: t("share.field.author.label"), value: author || "", emphasis: "bold" },
      { id: "work", label: t("share.field.work.book.label"), value: title || "", emphasis: "italic" },
      {
        id: "published",
        label: t("share.field.published.label"),
        value: published ? String(published) : "",
      },
    ],
    // "Noted" is the date you saved/highlighted it (noted_at, else added_at) —
    // distinct from the publication year above.
    meta: [
      { id: "character", label: t("share.field.character.label"), value: character || "" },
      {
        id: "chapter",
        label: t("share.field.chapter.label"),
        value: chapter ? t("share.credit.chapter.phrase", { n: chapter }) : "",
      },
      {
        id: "location",
        label: t("share.field.location.label"),
        value: location ? t("share.credit.location.phrase", { n: location }) : "",
      },
      { id: "noted", label: t("share.field.noted.label"), value: date || "" },
    ],
    tags: tags || [],
    note: note || "",
  };
}

export function movieShare({
  quote,
  note,
  translation,
  title,
  year,
  character,
  actor,
  timestamp,
  episode,
  tags,
  color,
  tmdbId,
  tvdbId,
  people,
  seps,
}) {
  return {
    quote: quote || "",
    translation: translation || "", // 0051; see bookShare
    // Actor face(s) for the image, gated by the "Actor" toggle (facesFor).
    faces: resolveFaces(actor, people, seps),
    facesFor: "actor",
    attribution: [
      { id: "work", label: t("share.field.work.film.label"), value: title || "", emphasis: "italic" },
      { id: "year", label: t("share.field.released.label"), value: year ? String(year) : "" },
      { id: "tmdb", label: t("share.field.tmdb.label"), value: tmdbId ? t("share.credit.tmdb.phrase", { code: tmdbId }) : "" },
      { id: "tvdb", label: t("share.field.tvdb.label"), value: tvdbId ? t("share.credit.tvdb.phrase", { code: tvdbId }) : "" },
    ],
    // Actor name bold inside the "played by …" credit; character stays plain.
    meta: [
      { id: "character", label: t("share.field.character.label"), value: character || "" },
      {
        id: "actor",
        label: t("share.field.actor.label"),
        value: actor || "",
        emphasis: "bold",
        // A PHRASE RATHER THAN A PREFIX. "played by " glued to the front of a
        // name is a sentence assembled by concatenation, and the credit does not
        // run left-to-right in every language. The key holds the whole clause.
        phrase: "share.credit.actor.phrase",
      },
      // A show's line says which episode; a film passes nothing and the part is
      // absent from the dialog altogether (fieldsOf skips empty values).
      { id: "episode", label: t("share.field.episode.label"), value: episode || "" },
      { id: "timestamp", label: t("share.field.time.label"), value: timestamp || "" },
    ],
    tags: tags || [],
    note: note || "",
    // Dialogues carry a colour like annotations do (0021), so the shareable
    // image tints the same way for both kinds.
    color: color || "",
  };
}

// quoteShare is the standalone-quote payload (ROADMAP §24). Unlike the other
// two it has no work to name, so the SPEAKER is the attribution — the position a
// book's author holds and a film's title holds. That is also why its faces hang
// on the attribution line rather than the meta line (see ATTRIBUTION_FACES).
//
// `when` is the occasion's date, already run through formatPartialDate by the
// caller: a year alone is a complete answer here, and Date parsing would invent
// a January morning nobody recorded. `noted` is the day you saved it, and stays
// off by default like every other save-date.
export function quoteShare({
  quote,
  translation,
  note,
  category,
  language,
  speaker,
  occasion,
  when,
  place,
  medium,
  date,
  tags,
  color,
  people,
  seps,
}) {
  return {
    quote: quote || "",
    // WHAT THE LINE SAYS, not a thought about it — 0035 drew that line between a
    // translation and a note, and the share keeps it: the translation sits with
    // the quote, above the credit, where the card puts it. A proverb IS its own
    // language plus this, so a share of one that carried only the original is
    // half the quote to anybody who cannot read it.
    translation: translation || "",
    color: color || "",
    faces: resolveFaces(speaker, people, seps),
    facesFor: "speaker",
    // "— **Bose**, *Burma Radio broadcast*, 1944" — speaker-first, occasion
    // italic, then when: the same epigraph order a book keeps.
    attribution: [
      { id: "speaker", label: t("share.field.speaker.label"), value: speaker || "", emphasis: "bold" },
      { id: "occasion", label: t("share.field.occasion.label"), value: occasion || "", emphasis: "italic" },
      { id: "when", label: t("share.field.when.label"), value: when || "" },
    ],
    meta: [
      // WHAT THIS IS, for the one kind of quote that otherwise says nothing about
      // itself. A proverb has no speaker, no occasion, no date and no place — so
      // every other field on this line is empty and a shared proverb arrives as
      // words from nowhere. The legend is the language plus the noun: "a Bengali
      // proverb".
      //
      // A PHRASE TOKEN, not a noun with the language glued in front of it. Word
      // order and the article are a translator's business — Bengali puts the noun
      // last and has no "a" — so the whole clause is one key with the hole in it,
      // the way the "played by …" credit stopped being a prefix. The hole is
      // {value}, which is what buildModel hands every phrase on this line.
      {
        id: "proverb",
        label: t("share.field.proverb.label"),
        value: category === "proverb" && language ? language : "",
        phrase: "share.field.proverb.legend",
      },
      { id: "place", label: t("share.field.place.label"), value: place || "" },
      { id: "medium", label: t("share.field.medium.label"), value: medium || "" },
      { id: "noted", label: t("share.field.noted.label"), value: date || "" },
    ],
    tags: tags || [],
    note: note || "",
  };
}

// Parts that start unchecked in the share dialog (present only on book quotes):
// the page "Location" and the "Noted" save-date. See shareDefaults, which is
// where both the dialog and the cards' one-tap copy read it.
const SHARE_OFF_BY_DEFAULT = new Set(["location", "noted"]);

// fieldsOf lists the toggleable parts present in a payload, in output order.
function fieldsOf(share) {
  const f = [];
  if (share.quote) f.push({ id: "quote", label: t("share.field.quote.label") });
  if (share.translation) f.push({ id: "translation", label: t("share.field.translation.label") });
  for (const a of share.attribution || [])
    if (a.value) f.push({ id: a.id, label: a.label });
  for (const m of share.meta || [])
    if (m.value) f.push({ id: m.id, label: m.label });
  if (share.tags && share.tags.length) f.push({ id: "tags", label: t("share.field.tags.label") });
  if (share.note) f.push({ id: "note", label: t("share.field.note.label") });
  return f;
}

// shareDefaults is the tick state a freshly-opened share dialog starts in:
// everything the payload carries, minus the two parts that are factual noise to
// a reader (see SHARE_OFF_BY_DEFAULT). Exported because the card's one-tap copy
// has to produce the same quote the dialog would — a copy button that silently
// drops the author, or keeps a page number the dialog hides, is a second
// definition of "this quote, written out".
export function shareDefaults(share) {
  return Object.fromEntries(fieldsOf(share).map((f) => [f.id, !SHARE_OFF_BY_DEFAULT.has(f.id)]));
}

// copyQuote puts one quote on the clipboard, plain — the quote, the credit, the
// note and the tags, with no markdown or WhatsApp syntax wrapped round any of
// it. The dialog opens on WhatsApp because somebody who went there is choosing
// where it is going; somebody who tapped a copy glyph on a card is not, and
// asterisks land as asterisks everywhere except the one app that eats them.
//
// Toasts rather than a silent result: copyText falls back to execCommand on the
// insecure origins where navigator.clipboard does not exist, and if even that
// fails the only honest thing is to say so rather than leave somebody pasting an
// old clipboard into a message.
export async function copyQuote(share) {
  const ok = await copyText(buildShareText(share, shareDefaults(share), "plaintext"));
  toast(t(ok ? "common.toast.copied" : "error.copy.generic"));
  return ok;
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
  if (fmt === "plaintext") return t("share.text.quote.phrase", { value: quote });
  // markdown / reddit / whatsapp all support the "> " blockquote prefix.
  return quote
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

function hashtag(tag) {
  const clean = String(tag).trim().replace(/\s+/g, "");
  return clean ? "#" + clean : "";
}

export function buildShareText(share, selected, fmt) {
  const blocks = [];
  if (selected.quote && share.quote) blocks.push(quoteBlock(share.quote, fmt));
  // Its own block, straight after the quote: it is the same words in another
  // language, so it belongs above the credit rather than down with the note.
  if (selected.translation && share.translation) blocks.push(quoteBlock(share.translation, fmt));

  const attr = [];
  for (const a of share.attribution || [])
    if (selected[a.id] && a.value) attr.push(emph(a.value, a.emphasis, fmt));
  if (attr.length) blocks.push(t("share.text.attribution.phrase", { value: attr.join(", ") }));

  const meta = [];
  for (const m of share.meta || [])
    if (selected[m.id] && m.value) {
      const piece = emph(m.value, m.emphasis, fmt);
      meta.push(m.phrase ? t(m.phrase, { value: piece }) : piece);
    }
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
// QuoteImagePanel draws the card and owns everything about producing the PNG. The
// one thing it does NOT own any more is the button that hands it over: `actionRef`
// is how the dialog's header reaches `download`, because that action now lives up
// beside the close glyph rather than at the bottom of this panel.
//
// A ref rather than lifting the canvas or the blob-making into the dialog: the
// whole render pipeline — theme, portrait, colour, fonts, redraw-on-event — belongs
// to this component, and moving any of it up to satisfy a button's position would
// be the tail wagging the dog.
function QuoteImagePanel({ share, selected, onShared, actionRef }) {
  const canvasRef = useRef(null);
  const mobile = useIsMobileScreen();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // The image skin is chosen independently of the app theme and persisted per
  // device (an export preference, not an identity one — like the view toggles).
  const [imageTheme, setImageTheme] = usePersistedState("tippani:shareImageTheme", defaultImageTheme());
  const [imageMaterial, setImageMaterial] = usePersistedState("tippani:shareImageMaterial", defaultImageMaterial());
  // How the credited person appears: as a small CHIP beside their name, or as a
  // BACKDROP bled in from the card's edge. Persisted per device beside the skin
  // — both are export preferences rather than identity ones.
  //
  // ONE CONTROL, TWO ANSWERS, because there were never three. The backdrop has
  // always replaced the chip rather than joining it — a 34px crop of the same
  // photograph beside a full-height version of it reads as a mistake — so an
  // Off/Backdrop switch was really a Chip/Backdrop switch with one of its
  // answers unnamed, and "off" was a lie: turning it off did not remove the
  // person from the card, it changed how they appeared.
  //
  // It offers nothing when nobody credited has a saved photo, so the control is
  // hidden rather than shown greyed: a toggle that cannot change the picture is
  // a question with one answer.
  const [portrait, setPortrait] = usePersistedState("tippani:sharePortrait", false);
  const canPortrait = (share.faces || []).length > 0;
  // WHICH WAY ROUND THE PEOPLE GO. Only the backdrop has sides — a chip row is
  // one cluster beside one name — so this appears with the backdrop and not
  // beside it, and it is meaningless with nobody to arrange.
  //
  // Persisted like the other two, and for the same reason: it is an export
  // preference. A reader who wants the speaker on the right generally wants that
  // in every picture they make, not in one.
  const [swap, setSwap] = usePersistedState("tippani:shareSwapSides", false);
  // Whether the quote's highlight colour appears at all. One switch for both
  // card kinds, because it is one decision: on a plain card the colour is the
  // edge stripe beside the words, on a backdrop card it is the hue of the
  // portrait, and "do I want this quote's colour in the picture" is the same
  // question either way. Persisted per device beside the skin and the backdrop.
  //
  // OFF by default, and that is a change of mind. A colour category is a private
  // filing decision — what KIND of note this is to me — and the picture goes to
  // someone who has no idea the scheme exists: to them a blue stripe or a blue
  // face is a design choice the card is making, and a fairly loud one. The
  // colour is worth offering and worth remembering; it is not worth assuming.
  //
  // THE KEY HAD TO MOVE WITH THE DEFAULT. usePersistedState writes on mount, so
  // the old default was stamped into local storage by the first render of this
  // panel on every device that has ever opened it — flipping the literal alone
  // would have changed the default for nobody. Retiring the key discards a value
  // almost nobody chose, and the switch is one click away for anyone who did.
  const [useColor, setUseColor] = usePersistedState("tippani:shareImageTint", false);
  const canColor = !!share.color;

  useEffect(() => {
    let cancelled = false;
    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      try {
        // categoryHex, not the default map: a canvas cannot resolve var(), so
        // this is the one consumer that needs a real value — and the one whose
        // output leaves the app, which makes it the worst place to be stale.
        const colorHex = useColor && share.color ? categoryHex(share.color) : null;
        drawQuoteCard(canvas, buildModel({ ...share, portrait: portrait && canPortrait, swap }, selected, colorHex), drawTheme(imageTheme, imageMaterial));
        setErr("");
      } catch {
        setErr(t("error.render.image"));
      }
    };
    redraw();
    // Redraw once the bundled fonts are ready (first paint may fall back) and
    // whenever the app accent flips (the chosen skin follows the picker, but the
    // accent still tracks the app).
    ensureFonts().then(redraw);
    // Author / actor portraits load lazily; redraw once they're in so the faces
    // fill the (already reserved) chip row.
    loadFaceImages((share.faces || []).map((f) => f.url)).then(redraw);
    // The material's tile, the same way: the first draw is flat and the grain
    // arrives a frame later rather than the whole picture waiting on it.
    loadTileImage(tileFor(imageMaterial, "card").url).then(redraw);
    window.addEventListener("tippani:theme", redraw);
    return () => {
      cancelled = true;
      window.removeEventListener("tippani:theme", redraw);
    };
  }, [share, selected, imageTheme, imageMaterial, portrait, canPortrait, swap, useColor]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return setErr(t("error.render.image"));
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

  // Published for the header's share glyph. Assigned on every render so the
  // closure the header calls is always the current one (it captures `share`,
  // `selected`, the chosen skin and the live canvas).
  if (actionRef) actionRef.current = download;

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
      setErr(t("share.image.copy.unsupported.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MonoLabel>{t("share.image.theme.label")}</MonoLabel>
        <Select
          ariaLabel={t("share.image.theme.aria")}
          value={imageTheme}
          onChange={setImageTheme}
          options={imageThemes()}
        />
        <InfoDot title={t("share.image.theme.info.title")} text={t("share.image.theme.info.body")} />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MonoLabel>{t("share.image.material.label")}</MonoLabel>
        <Select
          ariaLabel={t("share.image.material.aria")}
          value={imageMaterial}
          onChange={setImageMaterial}
          options={imageMaterials()}
        />
      </div>
      {canPortrait && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <MonoLabel>{t("share.image.portrait.label")}</MonoLabel>
          <Toggle
            ariaLabel={t("share.image.portrait.aria")}
            value={portrait ? "backdrop" : "chip"}
            onChange={(v) => setPortrait(v === "backdrop")}
            options={[["chip", t("share.image.portrait.chip.label")], ["backdrop", t("share.image.portrait.backdrop.label")]]}
          />
          <InfoDot title={t("share.image.portrait.info.title")} text={t("share.image.portrait.info.body")} />
        </div>
      )}
      {/* WHENEVER THERE IS SOMEBODY TO SWAP, and not only on a backdrop. It was
          gated on `portrait`, which is off by default — so a reader on the default
          settings never saw the control at all, and the request it answers says
          "chip". Both layouts honour it now (drawQuoteCard). */}
      {canPortrait && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <MonoLabel>{t("share.image.sides.label")}</MonoLabel>
          <Toggle
            ariaLabel={t("share.image.sides.aria")}
            value={swap ? "swapped" : "as-credited"}
            onChange={(v) => setSwap(v === "swapped")}
            options={[["as-credited", t("share.image.sides.as-credited.label")], ["swapped", t("share.image.sides.swap.label")]]}
          />
          <InfoDot title={t("share.image.sides.info.title")} text={t("share.image.sides.info.body")} />
        </div>
      )}
      {canColor && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <MonoLabel>{t("common.mono.colour.label")}</MonoLabel>
          <Toggle
            ariaLabel={t("share.image.colour.aria")}
            value={useColor ? "on" : "off"}
            onChange={(v) => setUseColor(v === "on")}
            options={[["off", t("common.toggle.off.label")], ["on", t("common.toggle.on.label")]]}
          />
          <InfoDot title={t("share.image.colour.info.title")} text={t("share.image.colour.info.body")} />
        </div>
      )}
      <MonoLabel className="mb-1.5 block">{t("share.preview.label")}</MonoLabel>
      <div className="share-image-preview">
        <canvas ref={canvasRef} className="share-image-canvas" aria-label={t("share.image.preview.aria")} />
      </div>
      {err && (
        <p className="microcopy mt-2" style={{ color: "var(--error)" }}>
          {err}
        </p>
      )}
      {/* No primary button here any more: sharing the picture is the share glyph in
          the dialog's header, next to the close. Copying it to the clipboard is a
          different act — it goes nowhere and needs somewhere to paste — so it stays
          a worded button, where the one-off actions in this app live. */}
      {canCopyImage && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <GhostButton onClick={copyImage} disabled={busy}>
            {t(copied ? "common.action.copy.done.label" : "share.image.copy.label")}
          </GhostButton>
        </div>
      )}
    </div>
  );
}

// ---- the dialog --------------------------------------------------------
export function ShareDialog({ share, seen, onClose }) {
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)
 // IMAGE OPENS THE DIALOG. It was WhatsApp, on the reasoning that the text
  // formats are the cheap ones — but a text format is a thing you paste, and
  // pasting is what the copy glyph on the card is for now. What the sheet is FOR
  // is the picture: the one output that needs choosing a skin, a portrait and a
  // colour before it is worth anything, and the one nobody can produce any other
  // way. So it is first in the row and it is what you land on.
  const [format, setFormat] = useState("image");
  const fields = useMemo(() => fieldsOf(share), [share]);
  // Everything on, except the two parts shareDefaults holds back (Location and
  // Noted — factual noise for most readers). The user can flip any of them per
  // share. Shared with the cards' copy glyph so the two cannot drift.
  const [selected, setSelected] = useState(() => shareDefaults(share));
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const mobile = useIsMobileScreen()
  // Sharing a quote counts as "seeing" it (spaced-repetition reinforcement).
  // Fire once per dialog, on the first successful copy/download, for the item
  // being shared. Fire-and-forget: it's a marginal bump, off unless srSeen > 1.
  // The picture panel's share action, so the header glyph above can fire it.
  const shareImage = useRef(null);
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
  const formatOptions = [["image", t("share.format.image.name")], ...SHARE_FORMATS.map((f) => [f.id, f.name])];

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
      className="tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("share.dialog.aria")}
        className="hand-card hc-r2 mx-auto w-full max-w-3xl px-6 py-6"
      >
        {/* Title, then the two glyphs: share, then close. The worded Close that
            used to sit in the footer is gone — a window that already has a × in its
            corner does not need a second way out written in words, and the footer
            row it left behind is one less thing between the picture and the reader.
            The share action came UP here from the picture panel so the two live
            together: they are the only two things you do to this window. */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="display-title text-xl">{t("share.dialog.title")}</h2>
          <span className="flex items-center gap-1">
            {isImage && (
              <FieldIconButton
                icon={<IconShare />}
                ariaLabel={t("share.image.share.aria")}
                onClick={() => shareImage.current?.()}
                tooltip={t("share.image.share.tip")}
              />
            )}
            <CloseButton onClick={onClose} />
          </span>
        </div>

        {/* format toggle; what each one produces lives behind the dot */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <MonoLabel>{t("share.format.label")}</MonoLabel>
          {mobile ? (
            <select
              className="tp-input"
              aria-label={t("share.format.aria")}
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
                ariaLabel={t("share.format.aria")}
                value={format}
                onChange={setFormat}
                options={formatOptions}
              />
            </div>
          )}
          {/* The dot is TITLED with the format, so it announces as "More
              information: WhatsApp" and re-reads as the selection changes,
              rather than sitting there as an anonymous i beside a control whose
              meaning it depends on. */}
          <InfoDot
            title={isImage ? t("share.format.image.name") : active.name}
            text={
              isImage ? (
                IMAGE_LOGIC()
              ) : (
                <>
                  {active.logic}
                  <code className="share-hint mt-2">{active.hint}</code>
                </>
              )
            }
          />
        </div>

        {/* choose what to include */}
        {fields.length > 0 && (
          <div className="mb-4">
            <MonoLabel className="mb-2 block">{t("share.include.label")}</MonoLabel>
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
          <QuoteImagePanel share={share} selected={selected} onShared={markSeen} actionRef={shareImage} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <MonoLabel className="mb-1.5 block">{t("share.text.label")}</MonoLabel>
              <textarea
                className="tp-input share-source"
                rows="11"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label={t("share.text.aria")}
              />
            </div>
            <div>
              <MonoLabel className="mb-1.5 block">{t("share.preview.label")}</MonoLabel>
              <div className="share-preview" aria-live="polite">
                {text.trim() ? (
                  preview
                ) : (
                  <p className="microcopy">{t("share.preview.empty")}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!isImage && (
          <div className="mt-5 flex items-center justify-end gap-2">
            <button className={PRIMARY} onClick={copy}>
              {t(copied ? "common.action.copy.done.label" : "common.action.copy.label")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
