-- Grant PostgREST access to overtime approval request tables.
-- RLS policies in migration 020 still control which rows each user can see/write.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.overtime_requests TO authenticated;
GRANT SELECT, INSERT ON TABLE public.overtime_request_participants TO authenticated;

NOTIFY pgrst, 'reload schema';
