-- 0009: draggable sticker position for annotations + dialogues.
--   The corner "seal" (first tag) can be dragged anywhere inside the quote block;
--   sticker_x / sticker_y store its centre as a fraction of the block WIDTH
--   (width-normalised so the coordinate is stable regardless of how the text
--   reflows around it). NULL = unplaced → the UI defaults to the top-right corner,
--   i.e. exactly the pre-drag behaviour. Plain ADD COLUMN; FTS triggers only touch
--   quote/note, so no table rebuild is needed.
ALTER TABLE annotations ADD COLUMN sticker_x REAL;
ALTER TABLE annotations ADD COLUMN sticker_y REAL;
ALTER TABLE dialogues ADD COLUMN sticker_x REAL;
ALTER TABLE dialogues ADD COLUMN sticker_y REAL;
