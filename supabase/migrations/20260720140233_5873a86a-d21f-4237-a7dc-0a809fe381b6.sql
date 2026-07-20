
ALTER TABLE public.athletics
  ADD COLUMN IF NOT EXISTS history_title text,
  ADD COLUMN IF NOT EXISTS history_description text,
  ADD COLUMN IF NOT EXISTS history_images jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) LOOP
    v_username := v_username || floor(random()*1000)::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, email, phone, full_name)
  VALUES (
    NEW.id,
    v_username,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'full_name'
  );

  -- Vincula memberships pré-cadastradas (por e-mail) e ativa como sócio
  UPDATE public.athletic_memberships
     SET user_id = NEW.id,
         active = true,
         updated_at = now()
   WHERE lower(email) = lower(NEW.email)
     AND user_id IS NULL;

  RETURN NEW;
END;
$function$;
