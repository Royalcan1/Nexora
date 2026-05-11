import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const supabase = createClient(
    'https://dmjctzpgondlavluwury.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let sent = 0, errors = [];

  try {
    const { data: subs } = await supabase.from('push_subscriptions').select('*');
    if (!subs) return res.status(200).json({ sent: 0 });

    for (const sub of subs) {
      const { data: tasks } = await supabase
        .from('tasks').select('*')
        .eq('user_id', sub.user_id).eq('done', false);

      if (!tasks || tasks.length === 0) continue;

      const urgent = tasks.filter(t => t.priority === 'urgent').length;
      let body;
      if (urgent > 0) body = `${urgent} tâche${urgent > 1 ? 's' : ''} urgente${urgent > 1 ? 's' : ''} ! ${tasks.length} en tout.`;
      else if (tasks.length === 1) body = `1 tâche : ${tasks[0].text}`;
      else body = `Tu as ${tasks.length} tâches en cours. On s'y met !`;

      const payload = JSON.stringify({
        title: '📚 Nexora',
        body,
        tag: 'nexora-daily',
        url: 'https://nex0ra.com'
      });

      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, payload);
        sent++;
      } catch (err) {
        errors.push({ id: sub.id, status: err.statusCode });
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return res.status(200).json({ sent, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
