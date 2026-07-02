-- Tightens the reminder cron from 15-minute to 5-minute intervals for
-- better precision on "Specific Time" reminders. Run in the SQL Editor
-- AFTER 0003_due_time.sql has been applied.
--
-- Replace <SERVICE_ROLE_KEY> with your project's service_role key
-- (Project Settings -> API -> service_role). Do not commit the filled-in
-- version of this file to git.

select cron.unschedule('send-task-reminders-every-15-min');

select cron.schedule(
    'send-task-reminders-every-5-min',
    '*/5 * * * *',
    $$
    select net.http_post(
        url := 'https://ernjkqamkjlatjodfjdg.supabase.co/functions/v1/send-task-reminders',
        headers := jsonb_build_object(
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- To inspect or remove the job later:
--   select * from cron.job;
--   select cron.unschedule('send-task-reminders-every-5-min');
