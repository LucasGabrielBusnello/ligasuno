
DROP VIEW IF EXISTS public.public_leagues;
CREATE VIEW public.public_leagues
WITH (security_invoker = on) AS
SELECT * FROM public.leagues
WHERE published = true AND paid_until IS NOT NULL AND paid_until >= CURRENT_DATE;
GRANT SELECT ON public.public_leagues TO anon, authenticated;
