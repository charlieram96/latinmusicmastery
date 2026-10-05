import { AdminText } from '@/components/admin/admin-text'
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RemainingClassItem {
  id: string;
  title: string;
  item_type: string;
  has_score: boolean;
  course_id: string;
  course_title: string;
  class_id: string;
  class_title: string;
}

export default async function PlaysenseStudioAuditPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) redirect('/dashboard');

  // Items still using the legacy soundslice_embed_url, with their full
  // course path so admins can navigate straight to them.
  const { data: rows } = await supabase
    .from('class_items')
    .select(
      `
      id, title, item_type, score_document_id, soundslice_embed_url,
      class:classes (
        id, title,
        section:course_sections (
          course_id,
          course:courses ( id, title )
        )
      )
      `
    )
    .not('soundslice_embed_url', 'is', null);

  const remaining: RemainingClassItem[] = (rows ?? []).flatMap((r) => {
    const cls = (r.class as unknown as {
      id: string;
      title: string;
      section: { course_id: string; course: { id: string; title: string } } | null;
    }) ?? null;
    if (!cls?.section) return [];
    return [
      {
        id: r.id,
        title: r.title,
        item_type: r.item_type,
        has_score: r.score_document_id !== null,
        course_id: cls.section.course.id,
        course_title: cls.section.course.title,
        class_id: cls.id,
        class_title: cls.title,
      },
    ];
  });

  // Group by course for the dashboard.
  const byCourse = new Map<string, { course_title: string; items: RemainingClassItem[] }>();
  for (const r of remaining) {
    if (!byCourse.has(r.course_id)) {
      byCourse.set(r.course_id, { course_title: r.course_title, items: [] });
    }
    byCourse.get(r.course_id)!.items.push(r);
  }

  // Total class_items + how many have a PlaySense Studio score attached so we can
  // show overall progress.
  const { count: totalItems } = await supabase
    .from('class_items')
    .select('id', { count: 'exact', head: true });
  const { count: itemsWithScore } = await supabase
    .from('class_items')
    .select('id', { count: 'exact', head: true })
    .not('score_document_id', 'is', null);

  // Recent legacy-iframe events so the operator can confirm the tail of
  // legacy traffic is dropping.
  const { count: legacyEvents24h } = await supabase
    .from('playsense_studio_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'playsense_studio_legacy_iframe_shown')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const remainingCount = remaining.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 py-3 border-b border-border bg-card flex items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Admin
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">PlaySense Studio cutover audit</h1>
      </header>

      <main className="px-6 py-6 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Items still on Soundslice"
            value={remainingCount}
            tone={remainingCount === 0 ? 'good' : 'warn'}
          />
          <Stat
            label="Items with PlaySense Studio scores"
            value={`${itemsWithScore ?? 0} / ${totalItems ?? 0}`}
          />
          <Stat
            label="Legacy iframe shows · last 24h"
            value={legacyEvents24h ?? 0}
            tone={(legacyEvents24h ?? 0) === 0 ? 'good' : 'neutral'}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Remaining Soundslice items by course
          </h2>
          {remainingCount === 0 ? (
            <div className="bg-card border border-border rounded-md px-4 py-6 text-sm text-muted-foreground text-center">
              Nothing left to migrate. After analytics confirm zero legacy iframe shows for 7+ days,
              you can safely run migration <code>016_compas_legacy_check.sql</code>.
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(byCourse.entries()).map(([courseId, { course_title, items }]) => (
                <div key={courseId} className="bg-card border border-border rounded-md overflow-hidden">
                  <header className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-medium">{course_title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {items.length} item{items.length === 1 ? '' : 's'}
                    </span>
                  </header>
                  <ul className="divide-y divide-border">
                    {items.map((it) => (
                      <li key={it.id} className="px-4 py-2 flex items-center gap-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground w-20 flex-shrink-0">
                          {it.item_type}
                        </span>
                        <span className="flex-1 truncate text-sm">{it.title}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          in {it.class_title}
                        </span>
                        {it.has_score ? (
                          <span className="text-xs text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/30">
                            Score attached · drop URL
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground"> <AdminText text={"No PlaySense Studio score"} /> </span>
                        )}
                        <Link
                          href={`/admin/courses/${it.course_id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        > <AdminText text={"Open"} /> <ExternalLink className="w-3 h-3" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-md px-5 py-4 text-xs text-muted-foreground space-y-1.5">
          <p>
            <strong className="text-foreground">Cutover playbook:</strong> see{' '}
            <code>docs/playsense-studio-migration.md</code> for the per-item recipe.
          </p>
          <p> <AdminText text={"Set"} /> <code>PLAYSENSE_STUDIO_ENABLED=false</code> in env to force the legacy iframe path even when
            scores are attached — useful if the PlaySense Studio player needs to be rolled back in production.
          </p>
        </section>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-primary/40 bg-primary/5'
      : tone === 'warn'
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-border bg-card';
  return (
    <div className={`rounded-md border ${toneClass} px-4 py-3`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
