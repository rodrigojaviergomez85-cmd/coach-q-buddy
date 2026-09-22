UPDATE public.app_config
SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'phrase' = 'Well Done'
         THEN jsonb_set(elem, '{phrase}', '"Great Job"'::jsonb)
         ELSE elem END
    ORDER BY ord
  )
  FROM jsonb_array_elements(value) WITH ORDINALITY AS t(elem, ord)
)
WHERE key = 'score_phrases';