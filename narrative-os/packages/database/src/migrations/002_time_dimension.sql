-- Migration: Add time dimension to setting_items
-- Context: Track world state evolution across chapters.
-- valid_at_chapter = which chapter this version became effective
-- superseded_at_chapter = which chapter made this version obsolete
-- Date: 2026-05-25

ALTER TABLE setting_items ADD COLUMN IF NOT EXISTS valid_at_chapter INTEGER;
ALTER TABLE setting_items ADD COLUMN IF NOT EXISTS superseded_at_chapter INTEGER;

COMMENT ON COLUMN setting_items.valid_at_chapter IS '此条目状态从哪个章节开始生效';
COMMENT ON COLUMN setting_items.superseded_at_chapter IS '此条目在哪个章节之后不再生效（null = 至今仍有效）';
