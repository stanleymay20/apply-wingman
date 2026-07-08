-- Fix the misspelled saved-search keyword "AI Enginner". The keyword
-- relevance filter in discover-jobs matches literally, so the typo can never
-- match a real job title and silently contributes nothing to discovery runs.
-- Idempotent: replaces the typo where the correct spelling is absent, then
-- drops any leftover typo entries (avoids duplicates where both existed).

UPDATE public.saved_searches
SET keywords = array_replace(keywords, 'AI Enginner', 'AI Engineer')
WHERE 'AI Enginner' = ANY(keywords)
  AND NOT ('AI Engineer' = ANY(keywords));

UPDATE public.saved_searches
SET keywords = array_remove(keywords, 'AI Enginner')
WHERE 'AI Enginner' = ANY(keywords);
