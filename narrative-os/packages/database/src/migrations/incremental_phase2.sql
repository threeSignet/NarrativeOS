-- Incremental migration: add outline_items, project_daily_stats, and missing chapter columns
-- Run after incremental_from_0000.sql

-- 1. Add missing columns to chapters
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS content_path text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS content_summary text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS actual_words integer DEFAULT 0 NOT NULL;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS ai_generated_words integer DEFAULT 0;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS human_written_words integer DEFAULT 0;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS volume_chapter_number integer;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS emotion_overall text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS emotion_points jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS narrative_pace text DEFAULT 'medium';
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS foreshadowing_planted jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS foreshadowing_resolved jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS key_characters jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS key_locations jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS key_events jsonb;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS writing_style text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS last_ai_action text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS frozen_at timestamp with time zone;

-- 2. Add missing columns to outlines
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS outline_mode text DEFAULT 'rough';
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS structure_mode text;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS target_total_words integer;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS target_chapter_count integer;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS target_volume_count integer;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS narrative_pace text DEFAULT 'medium';
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS content_focus jsonb;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS custom_requirements text;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS generation_model_id text;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT false;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS previous_outline_id uuid;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS source_proposal_id uuid;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS total_outline_items integer DEFAULT 0;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS total_planned_words integer DEFAULT 0;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS deprecated_at timestamp with time zone;

-- 3. Add missing columns to volumes
ALTER TABLE volumes ADD COLUMN IF NOT EXISTS total_chapters integer DEFAULT 0;

-- 4. Create outline_items table
CREATE TABLE IF NOT EXISTS outline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  outline_id uuid NOT NULL REFERENCES outlines(id),
  volume_number integer NOT NULL DEFAULT 1,
  chapter_number integer NOT NULL,
  volume_chapter_number integer,
  title text NOT NULL,
  rough_summary text,
  detailed_plot text,
  plot_points jsonb,
  emotion_overall text,
  emotion_points jsonb,
  narrative_pace text DEFAULT 'medium',
  key_characters jsonb,
  key_locations jsonb,
  key_items jsonb,
  key_events jsonb,
  to_plant_foreshadowings jsonb,
  to_resolve_foreshadowings jsonb,
  to_reference_foreshadowings jsonb,
  target_words integer DEFAULT 3000,
  min_words integer DEFAULT 2000,
  max_words integer DEFAULT 5000,
  linked_chapter_id uuid REFERENCES chapters(id),
  execution_status text DEFAULT 'pending',
  author_notes text,
  ai_suggestions jsonb,
  sort_order integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS outline_items_outline_idx ON outline_items(outline_id);
CREATE INDEX IF NOT EXISTS outline_items_chapter_idx ON outline_items(outline_id, chapter_number);
CREATE INDEX IF NOT EXISTS outline_items_linked_idx ON outline_items(linked_chapter_id);

-- 5. Create project_daily_stats table
CREATE TABLE IF NOT EXISTS project_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id),
  date text NOT NULL,
  words_written integer DEFAULT 0 NOT NULL,
  ai_generated_words integer DEFAULT 0 NOT NULL,
  human_written_words integer DEFAULT 0 NOT NULL,
  chapters_edited integer DEFAULT 0 NOT NULL,
  chapters_created integer DEFAULT 0 NOT NULL,
  ai_calls integer DEFAULT 0 NOT NULL,
  proposals_generated integer DEFAULT 0 NOT NULL,
  proposals_approved integer DEFAULT 0 NOT NULL,
  proposals_rejected integer DEFAULT 0 NOT NULL,
  tokens_used integer DEFAULT 0 NOT NULL,
  active_writing_minutes integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS project_daily_stats_project_date_idx ON project_daily_stats(project_id, date);

-- 6. Add missing columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_words integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_chapter_count integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_rules jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_writing_style text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_chapters integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latest_chapter_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latest_chapter_number integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_words integer DEFAULT 0;
