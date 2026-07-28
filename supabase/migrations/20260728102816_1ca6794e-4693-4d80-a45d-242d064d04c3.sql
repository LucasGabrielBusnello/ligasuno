
-- ASSETS
CREATE TABLE IF NOT EXISTS public.athletic_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id uuid NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  code text NOT NULL,
  acquisition_date date,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  available_quantity integer NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athletic_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_assets TO authenticated;
GRANT ALL ON public.athletic_assets TO service_role;
ALTER TABLE public.athletic_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_select_auth" ON public.athletic_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets_insert_auth" ON public.athletic_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "assets_update_auth" ON public.athletic_assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assets_delete_auth" ON public.athletic_assets FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_assets_updated ON public.athletic_assets;
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.athletic_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LOANS
CREATE TABLE IF NOT EXISTS public.athletic_asset_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.athletic_assets(id) ON DELETE CASCADE,
  borrower_name text NOT NULL,
  borrower_email text,
  borrower_phone text,
  return_date date,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_asset_loans TO authenticated;
GRANT ALL ON public.athletic_asset_loans TO service_role;
ALTER TABLE public.athletic_asset_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_loans_select_auth" ON public.athletic_asset_loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "asset_loans_insert_auth" ON public.athletic_asset_loans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "asset_loans_update_auth" ON public.athletic_asset_loans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "asset_loans_delete_auth" ON public.athletic_asset_loans FOR DELETE TO authenticated USING (true);

-- AGGREGATED VISITS (bypass 1000-row cap)
CREATE OR REPLACE FUNCTION public.get_visits_summary(_since timestamptz, _granularity text)
RETURNS TABLE(label text, unique_count bigint, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE _granularity
      WHEN 'hour' THEN to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24":00"')
      WHEN 'day'  THEN to_char(date_trunc('day',  created_at), 'YYYY-MM-DD')
      WHEN 'week' THEN to_char(date_trunc('week', created_at), 'YYYY-MM-DD')
      ELSE             to_char(date_trunc('month',created_at), 'YYYY-MM')
    END AS label,
    count(DISTINCT visitor_id)::bigint AS unique_count,
    count(*)::bigint AS total
  FROM public.site_visits
  WHERE created_at >= _since
  GROUP BY 1
  ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_visits_summary(timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_visits_totals(_since timestamptz)
RETURNS TABLE(unique_visitors bigint, total_visits bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT visitor_id)::bigint, count(*)::bigint
  FROM public.site_visits WHERE created_at >= _since;
$$;
GRANT EXECUTE ON FUNCTION public.get_visits_totals(timestamptz) TO authenticated;

-- AGGREGATED AD ANALYTICS
CREATE OR REPLACE FUNCTION public.get_ad_analytics_summary(_since timestamptz)
RETURNS TABLE(ad_id uuid, day date, action text, cnt bigint, unique_users bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ad_id, (created_at)::date AS day, action,
         count(*)::bigint AS cnt,
         count(DISTINCT user_id)::bigint AS unique_users
  FROM public.ad_analytics
  WHERE created_at >= _since
  GROUP BY 1, 2, 3;
$$;
GRANT EXECUTE ON FUNCTION public.get_ad_analytics_summary(timestamptz) TO authenticated;
