# Adding your language to tippani

1. Run `node scripts/locale-template.mjs --out data/Locales/xx.txt`, where `xx`
   is your language's code — the file name *is* the code, and it is what the app
   stores as your choice. Nothing needs rebuilding; restart and it is in the list.
2. Fill in the empty values. One `key = value` per line, split on the **first**
   `=`, so a value may contain `=`. Blank lines are ignored, a line starting with
   `#` is a comment, and the comments above each key are context plus the English
   and Bengali for reference.
3. `_name` is how your language is labelled in the picker — write it in your own
   language (`_name = Français`).
4. `_fallback` names the language that fills your gaps before a built-in does
   (`_fallback = en`). Optional; a cycle between two files is detected and broken.
5. `_dir = rtl` for a right-to-left language. **This flips text direction only.
   The layout has not been audited for RTL** — expect misplaced icons and edges.
6. A line with no `=`, or an empty value, costs exactly that one string: the rest
   of the file loads and the missing string falls back.
7. Partial is fine. The picker shows your coverage as a percentage beside the
   name, so incompleteness is a visible fact rather than a build failure.
8. `en.txt` and `bn.txt` in *this* directory ship inside the binary. A file of
   the same name in `data/Locales/` overrides them per key, so you can correct
   one English string without touching the source.
