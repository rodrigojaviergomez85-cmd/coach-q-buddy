DROP INDEX IF EXISTS public.coaches_external_id_key;
CREATE UNIQUE INDEX coaches_external_id_key ON public.coaches USING btree (external_id);