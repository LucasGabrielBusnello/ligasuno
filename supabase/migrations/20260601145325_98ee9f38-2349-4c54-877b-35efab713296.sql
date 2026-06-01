
-- ============= SEMESTER CYCLES =============
CREATE TABLE public.semester_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  semester smallint NOT NULL CHECK (semester IN (1, 2)),
  year integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  due_date date NOT NULL,
  late_fee_cents integer NOT NULL DEFAULT 0 CHECK (late_fee_cents >= 0),
  is_current boolean NOT NULL DEFAULT true,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, year, semester)
);

CREATE INDEX idx_semester_cycles_league_current ON public.semester_cycles(league_id, is_current);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_cycles TO authenticated;
GRANT SELECT ON public.semester_cycles TO anon;
GRANT ALL ON public.semester_cycles TO service_role;

ALTER TABLE public.semester_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY sc_select ON public.semester_cycles FOR SELECT TO public USING (true);

CREATE POLICY sc_manage ON public.semester_cycles FOR ALL TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = semester_cycles.league_id AND l.president_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = semester_cycles.league_id AND l.president_id = auth.uid())
  );

CREATE TRIGGER sc_updated_at BEFORE UPDATE ON public.semester_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= SEMESTER PAYMENTS =============
CREATE TABLE public.semester_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.semester_cycles(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  amount_due_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  paid_at timestamptz,
  mp_payment_id text,
  mp_preference_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, user_id)
);

CREATE INDEX idx_semester_payments_cycle ON public.semester_payments(cycle_id);
CREATE INDEX idx_semester_payments_user ON public.semester_payments(user_id);
CREATE INDEX idx_semester_payments_league_status ON public.semester_payments(league_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_payments TO authenticated;
GRANT ALL ON public.semester_payments TO service_role;

ALTER TABLE public.semester_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_select ON public.semester_payments FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = semester_payments.league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = semester_payments.league_id AND m.user_id = auth.uid() AND m.role = 'diretor')
);

CREATE POLICY sp_manage_president ON public.semester_payments FOR ALL TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = semester_payments.league_id AND l.president_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = semester_payments.league_id AND l.president_id = auth.uid())
  );

CREATE TRIGGER sp_updated_at BEFORE UPDATE ON public.semester_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= Função: marca como overdue =============
CREATE OR REPLACE FUNCTION public.mark_overdue_semester_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.semester_payments sp
  SET status = 'overdue', updated_at = now()
  FROM public.semester_cycles sc
  WHERE sp.cycle_id = sc.id
    AND sp.status = 'pending'
    AND sc.due_date < CURRENT_DATE
    AND sc.is_current = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_overdue_semester_payments() TO service_role;
