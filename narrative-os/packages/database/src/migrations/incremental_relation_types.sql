-- Migration: Add adjacency and functional relation types
-- Context: Multi-pass geography refinement generates "adjacency" relations between neighboring regions.
-- Other engines may generate "functional" relations between complementary entities.
-- Date: 2026-05-24

ALTER TABLE setting_item_relations 
DROP CONSTRAINT IF EXISTS setting_item_relations_type_check;

ALTER TABLE setting_item_relations 
ADD CONSTRAINT setting_item_relations_type_check 
CHECK (relation_type = ANY (ARRAY['hierarchy', 'reference', 'opposition', 'dependency', 'geographic', 'affiliation', 'adjacency', 'functional']));
