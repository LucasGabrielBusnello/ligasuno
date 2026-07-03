SELECT cron.unschedule('event-reminders-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'event-reminders-hourly');

SELECT cron.schedule(
  'event-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--f4ef971d-0569-4e15-b95c-df097f27d208.lovable.app/api/public/cron/event-reminders',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );
  $$
);