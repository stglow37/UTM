-- Schedules the send-task-reminders Edge Function to run every 15 minutes.
-- Run this in the Supabase SQL Editor AFTER the function has been deployed.
--
-- Replace <SERVICE_ROLE_KEY> with your project's service_role key
-- (Project Settings -> API -> service_role). Do not commit the filled-in
-- version of this file to git - keep the secret out of version control.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
    'send-task-reminders-every-15-min',
    '*/15 * * * *',
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
--   select cron.unschedule('send-task-reminders-every-15-min');
