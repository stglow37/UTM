// Scheduled Edge Function: pushes a reminder for each incomplete task whose
// notify instant (due_at, minus reminder_lead_minutes for "exact" mode tasks)
// has passed and that hasn't been reminded about yet.
// Triggered by a pg_cron job (see supabase/migrations/0004_reschedule_cron_5min.sql).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

// Longest supported lead time (see task-reminder-lead options in index.html),
// used to bound the candidate query so it doesn't scan every future task.
const MAX_LEAD_MINUTES = 60;

webpush.setVapidDetails(
    "mailto:stglow37@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

Deno.serve(async (_req) => {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const now = Date.now();
    const lookaheadIso = new Date(now + MAX_LEAD_MINUTES * 60_000).toISOString();

    const { data: candidates, error: taskError } = await supabase
        .from("tasks")
        .select("id, user_id, title, reminder_mode, reminder_lead_minutes, due_at")
        .eq("completed", false)
        .is("reminder_sent_at", null)
        .not("due_at", "is", null)
        .lte("due_at", lookaheadIso);

    if (taskError) {
        console.error("Failed to query due tasks:", taskError);
        return new Response(JSON.stringify({ error: taskError.message }), { status: 500 });
    }

    // Notify once the due instant, minus its lead time, has actually passed.
    const dueTasks = (candidates || []).filter((task) => {
        const leadMs = (task.reminder_lead_minutes || 0) * 60_000;
        return new Date(task.due_at).getTime() - leadMs <= now;
    });

    if (dueTasks.length === 0) {
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

        let notificationTitle = "Task due today";
        if (task.reminder_mode === "exact") {
            const lead = task.reminder_lead_minutes || 0;
            notificationTitle = lead > 0 ? `Due in ${lead} minutes` : "Task due now";
        }

        const payload = JSON.stringify({
            title: notificationTitle,
            body: task.title,
            taskId: task.id
        });

        for (const sub of subs) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };

            try {
                await webpush.sendNotification(pushSubscription, payload, { urgency: "high" });
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
