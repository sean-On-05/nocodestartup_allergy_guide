-- Read-only. Run in Supabase SQL Editor and export the result as CSV.
-- No row contents, credentials, or personal records are selected.
SELECT 'column' AS kind,
       c.table_schema, c.table_name, c.column_name AS name,
       c.data_type || CASE WHEN c.udt_name IS NOT NULL THEN ' (' || c.udt_name || ')' ELSE '' END AS details,
       c.is_nullable AS extra
FROM information_schema.columns c
WHERE c.table_schema = 'public'
UNION ALL
SELECT 'constraint', tc.table_schema, tc.table_name, tc.constraint_name,
       tc.constraint_type || ': ' || COALESCE(kcu.column_name, ''),
       CASE WHEN ccu.table_name IS NOT NULL THEN ccu.table_schema || '.' || ccu.table_name || '.' || ccu.column_name ELSE '' END
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
UNION ALL
SELECT 'policy', p.schemaname, p.tablename, p.policyname,
       p.cmd || ': roles=' || array_to_string(p.roles, ','),
       'using=' || COALESCE(p.qual, '') || '; check=' || COALESCE(p.with_check, '')
FROM pg_policies p WHERE p.schemaname = 'public'
UNION ALL
SELECT 'rls', n.nspname, c.relname, 'row_level_security',
       c.relrowsecurity::text, c.relforcerowsecurity::text
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY table_name, kind, name;
