-- Production PostgreSQL initialization for 1000+ users
-- Optimized for high-concurrency streaming workloads

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Optimized settings for streaming workloads (commented out problematic settings)
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- ALTER SYSTEM SET track_activity_query_size = 2048;
-- ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Create performance monitoring functions
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE(
    active_connections INTEGER,
    total_connections INTEGER,
    max_connections INTEGER,
    cache_hit_ratio NUMERIC,
    avg_query_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::INTEGER,
        (SELECT count(*) FROM pg_stat_activity)::INTEGER,
        (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections'),
        (SELECT ROUND((sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0))::NUMERIC, 2)
         FROM pg_stat_database),
        (SELECT ROUND(mean_exec_time::NUMERIC, 2) FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- Create streaming-optimized indexes after tables are created
-- This will be called by the migration scripts