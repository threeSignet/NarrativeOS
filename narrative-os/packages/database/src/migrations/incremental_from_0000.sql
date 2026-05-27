-- Incremental migration: bring existing database from 0000_strange_red_shift to current schema
-- Run this on existing databases. New databases can start from 0000_mysterious_dazzler.sql directly.

-- 1. Add missing columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS core_creativity text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- 2. Fix ai_proposals: rename source_agent -> source_node, add revision_notes
ALTER TABLE ai_proposals RENAME COLUMN source_agent TO source_node;
ALTER TABLE ai_proposals ADD COLUMN IF NOT EXISTS revision_notes text;

-- 3. Add FK for discussions.proposal_id
DO $$ BEGIN
  ALTER TABLE discussions ADD CONSTRAINT discussions_proposal_id_ai_proposals_id_fk
    FOREIGN KEY (proposal_id) REFERENCES ai_proposals(id) ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4. Add missing columns to llm_logs
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS prompt_cache_hit_tokens integer;
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS prompt_cache_miss_tokens integer;

-- 5. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id),
  priority text DEFAULT 'p2' NOT NULL,
  category text DEFAULT 'system' NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  source_node text,
  related_entity_type text,
  related_entity_id uuid,
  status text DEFAULT 'unread' NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 6. Create notification_reads table
CREATE TABLE IF NOT EXISTS notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL REFERENCES notifications(id),
  action text NOT NULL,
  actor text DEFAULT 'author' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 7. Add indexes
CREATE INDEX IF NOT EXISTS projects_deleted_at_idx ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS sessions_project_id_idx ON sessions(project_id);
CREATE INDEX IF NOT EXISTS discussions_session_id_idx ON discussions(session_id);
CREATE INDEX IF NOT EXISTS discussions_project_id_idx ON discussions(project_id);
CREATE INDEX IF NOT EXISTS ai_proposals_project_status_idx ON ai_proposals(project_id, status);
CREATE INDEX IF NOT EXISTS ai_proposals_session_id_idx ON ai_proposals(session_id);
CREATE INDEX IF NOT EXISTS ai_proposals_parent_id_idx ON ai_proposals(parent_id);
CREATE INDEX IF NOT EXISTS setting_items_project_type_idx ON setting_items(project_id, type);
CREATE INDEX IF NOT EXISTS setting_items_project_status_idx ON setting_items(project_id, status);
CREATE INDEX IF NOT EXISTS setting_items_proposal_id_idx ON setting_items(proposal_id);
CREATE INDEX IF NOT EXISTS llm_logs_project_created_idx ON llm_logs(project_id, created_at);
CREATE INDEX IF NOT EXISTS mou_states_project_status_idx ON mou_states(project_id, status);
CREATE INDEX IF NOT EXISTS mou_states_proposal_id_idx ON mou_states(proposal_id);
CREATE INDEX IF NOT EXISTS notifications_project_status_idx ON notifications(project_id, status);
CREATE INDEX IF NOT EXISTS notification_reads_notification_id_idx ON notification_reads(notification_id);

-- 8. Add pipeline and option_group columns to ai_proposals
ALTER TABLE ai_proposals ADD COLUMN IF NOT EXISTS pipeline jsonb;
ALTER TABLE ai_proposals ADD COLUMN IF NOT EXISTS option_group text;
CREATE INDEX IF NOT EXISTS ai_proposals_option_group_idx ON ai_proposals(option_group);

-- 9. Create outlines table (Phase 2)
CREATE TABLE IF NOT EXISTS outlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id),
  title text NOT NULL,
  summary text,
  content jsonb NOT NULL,
  status text DEFAULT 'draft' NOT NULL,
  proposal_id uuid REFERENCES ai_proposals(id),
  version integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS outlines_project_id_idx ON outlines(project_id);
CREATE INDEX IF NOT EXISTS outlines_project_status_idx ON outlines(project_id, status);

-- 10. Create volumes table (Phase 2)
CREATE TABLE IF NOT EXISTS volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id),
  volume_number integer NOT NULL,
  title text NOT NULL,
  summary text,
  outline jsonb,
  status text DEFAULT 'draft' NOT NULL,
  proposal_id uuid REFERENCES ai_proposals(id),
  word_count_target integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS volumes_project_volume_idx ON volumes(project_id, volume_number);
CREATE INDEX IF NOT EXISTS volumes_project_status_idx ON volumes(project_id, status);

-- 11. Create chapters table (Phase 2)
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id),
  volume_id uuid NOT NULL REFERENCES volumes(id),
  chapter_number integer NOT NULL,
  title text NOT NULL,
  summary text,
  outline jsonb,
  status text DEFAULT 'draft' NOT NULL,
  proposal_id uuid REFERENCES ai_proposals(id),
  word_count_target integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS chapters_volume_chapter_idx ON chapters(volume_id, chapter_number);
CREATE INDEX IF NOT EXISTS chapters_project_id_idx ON chapters(project_id);
