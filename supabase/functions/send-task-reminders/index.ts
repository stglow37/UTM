// Scheduled Edge Function: pushes a "due today" reminder for each incomplete
// task whose dueDate is today and that hasn't been reminded about yet.
// Triggered by a pg_cron job (see supabase/migrations/0002_schedule_reminders.sql).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(
    "mailto:stglow37@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

Deno.serve(async (_req) => {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const todayKey = new Date().toISOString().split("T")[0];

    const { data: dueTasks, error: taskError } = await supabase
        .from("tasks")
        .select("id, user_id, title, dueDate")
        .eq("dueDate", todayKey)
        .eq("completed", false)
        .is("reminder_sent_at", null);

    if (taskError) {
        console.error("Failed to query due tasks:", taskError);
        return new Response(JSON.stringify({ error: taskError.message }), { status: 500 });
    }

    if (!dueTasks || dueTasks.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    let sentCount = 0;

    for (const task of dueTasks) {
        const { data: subs, error: subError } = await supabase
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", task.user_id);

        if (subError) {
            console.error(`Failed to load subscriptions for user ${task.user_id}:`, subError);
            continue;
        }

        if (!subs || subs.length === 0) continue;

        const payload = JSON.stringify({
            title: "Task due today",
            body: task.title,
            taskId: task.id
        });

        for (const sub of subs) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };

            try {
                await webpush.sendNotification(pushSubscription, payload);
                sentCount++;
            } catch (err) {
                console.error(`Push failed for subscription ${sub.id}:`, err);
                // 404/410 means the browser subscription is dead - remove it.
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                }
            }
        }

        await supabase
            .from("tasks")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", task.id);
    }

    return new Response(JSON.stringify({ sent: sentCount, tasksProcessed: dueTasks.length }), { status: 200 });
});
