
ALTER TABLE public.semester_payments
  ADD CONSTRAINT semester_payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
