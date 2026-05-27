-- Runs once on first PostgreSQL boot (docker-entrypoint-initdb.d).
-- Subsequent boots skip this script; use a Drizzle migration if you
-- need to add extensions later.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sanity check that pgvector is loadable. If this fails the container
-- will fail to start, which is what we want.
DO $$
BEGIN
    PERFORM 1 FROM pg_extension WHERE extname = 'vector';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'pgvector extension is not installed';
    END IF;
END$$;
