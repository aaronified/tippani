-- 0090: an episode a refetch added is marked new until the Episodes dialog is next saved.
--
-- A show whose reader has made a custom order is refetched, and the provider has episodes the custom
-- order has never placed. They are placed right after the episode before them in tv order, and marked,
-- so the dialog can say which ones to look at. The mark is cleared by any save of the dialog.
ALTER TABLE episodes ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0;
