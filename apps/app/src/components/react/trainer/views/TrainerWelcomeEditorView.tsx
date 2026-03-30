import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  StudioWelcomeContentStored,
  StudioWelcomeLocaleBlock,
  StudioWelcomeLocaleKey,
} from '@/types/studio-welcome-content';
import { getStudioWelcomeContentLimits } from '@/lib/studio-welcome-content-schema';

const WELCOME_LIMITS = getStudioWelcomeContentLimits();

const FIELD_CHAR_LIMIT: Record<keyof StudioWelcomeLocaleBlock, number> = {
  heroTitle: WELCOME_LIMITS.heroTitle,
  heroSub: WELCOME_LIMITS.heroSub,
  clientStatusStrip: WELCOME_LIMITS.statusStrip,
  friendStatusStrip: WELCOME_LIMITS.statusStrip,
  successFriend: WELCOME_LIMITS.success,
  successClient: WELCOME_LIMITS.success,
  openAppCta: WELCOME_LIMITS.openAppCta,
  trainerTeaserTemplate: WELCOME_LIMITS.trainerTeaser,
};

const LOCALE_TABS: { id: StudioWelcomeLocaleKey; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
];

const FIELD_META: {
  key: keyof StudioWelcomeLocaleBlock;
  label: string;
  hint?: string;
  rows: number;
}[] = [
  { key: 'heroTitle', label: 'Hero title (invited headline)', rows: 2 },
  {
    key: 'heroSub',
    label: 'Hero subline',
    hint: 'Shown when the invite link has no token (missing code), and as an extra line when a token is present (signed out).',
    rows: 3,
  },
  { key: 'clientStatusStrip', label: 'Status strip — client invite (signed out)', rows: 3 },
  { key: 'friendStatusStrip', label: 'Status strip — friend invite (signed out)', rows: 3 },
  { key: 'successFriend', label: 'After accept — friend success message', rows: 3 },
  { key: 'successClient', label: 'After accept — client success message', rows: 3 },
  { key: 'openAppCta', label: 'After accept — primary button label', rows: 2 },
  {
    key: 'trainerTeaserTemplate',
    label: 'Welcome back — teaser with trainer name',
    hint: 'Use {name} for the trainer’s first name (logged-in /welcome, no invite token).',
    rows: 3,
  },
];

function emptyBlock(): StudioWelcomeLocaleBlock {
  return {};
}

const TrainerWelcomeEditorView: React.FC = () => {
  const [tab, setTab] = useState<StudioWelcomeLocaleKey>('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [coachDisplayName, setCoachDisplayName] = useState<string | null>(null);
  const [en, setEn] = useState<StudioWelcomeLocaleBlock>(emptyBlock());
  const [es, setEs] = useState<StudioWelcomeLocaleBlock>(emptyBlock());
  const [fr, setFr] = useState<StudioWelcomeLocaleBlock>(emptyBlock());
  const [emailSenderNote, setEmailSenderNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trainer/welcome-content', { credentials: 'include' });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
        displayName?: string;
        stored?: {
          en?: StudioWelcomeLocaleBlock;
          es?: StudioWelcomeLocaleBlock;
          fr?: StudioWelcomeLocaleBlock;
          emailSenderNote?: string | null;
        };
      };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to load');
        return;
      }
      setCoachSlug(data.slug ?? null);
      setCoachDisplayName(data.displayName ?? null);
      const st = data.stored ?? {};
      setEn({ ...(st.en ?? {}) });
      setEs({ ...(st.es ?? {}) });
      setFr({ ...(st.fr ?? {}) });
      setEmailSenderNote(st.emailSenderNote ?? '');
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentBlock = tab === 'en' ? en : tab === 'es' ? es : fr;
  const setCurrentBlock = (next: StudioWelcomeLocaleBlock) => {
    if (tab === 'en') setEn(next);
    else if (tab === 'es') setEs(next);
    else setFr(next);
  };

  const updateField = (key: keyof StudioWelcomeLocaleBlock, value: string) => {
    setCurrentBlock({ ...currentBlock, [key]: value });
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch('/api/trainer/welcome-content', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailSenderNote: emailSenderNote.trim() || null,
          en,
          es,
          fr,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        stored?: StudioWelcomeContentStored;
      };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed');
        return;
      }
      setSavedMsg('Saved.');
      if (data.stored) {
        setEn({ ...(data.stored.en ?? {}) });
        setEs({ ...(data.stored.es ?? {}) });
        setFr({ ...(data.stored.fr ?? {}) });
        setEmailSenderNote(data.stored.emailSenderNote ?? '');
      }
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const appBase =
    typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APP_URL
      ? String(import.meta.env.PUBLIC_APP_URL).replace(/\/$/, '')
      : 'https://app.aiworkoutgenerator.com';

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-light border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl text-white">
      <div className="mb-8">
        <Link
          to="/roster"
          className="text-sm font-medium uppercase tracking-wide text-white/45 hover:text-orange-light"
        >
          ← Roster
        </Link>
        <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight">
          Coach landing copy
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Personal overrides for invite and welcome-back text. When you are linked to a studio,
          studio branding still leads visually; non-empty fields here override the matching studio
          strings.{' '}
          <Link to="/roster/welcome" className="text-orange-light hover:text-white">
            Edit studio org copy
          </Link>
          .
        </p>
      </div>

      <p className="mb-6 text-sm text-white/50">
        Coach: <span className="text-white/80">{coachDisplayName ?? '—'}</span>{' '}
        {coachSlug ? <span className="text-white/35">({coachSlug})</span> : null}
      </p>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {savedMsg ? (
        <div className="mb-6 text-sm font-medium text-emerald-400/90">{savedMsg}</div>
      ) : null}

      <section className="mb-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-2 font-heading text-lg font-bold uppercase tracking-wide text-orange-light">
          Invitation emails (Supabase Auth)
        </h2>
        <p className="text-sm text-white/60">
          Roster invites use Supabase <strong className="text-white/80">invite user</strong> and{' '}
          <strong className="text-white/80">magic link</strong> emails. The message body is
          controlled in the Supabase Dashboard → Authentication → Email Templates (Invite user,
          Magic link).
        </p>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-white/55">
          <li>
            Redirect / confirmation links should land on your app origin so the invite token is
            preserved:{' '}
            <code className="break-all text-xs text-white/70">{appBase}/welcome?invite=…</code> or
            vanity{' '}
            <code className="break-all text-xs text-white/70">
              {appBase}/s/&#123;slug&#125;/i/&#123;token&#125;
            </code>
            .
          </li>
        </ul>
        <label className="mt-4 block text-xs font-medium uppercase tracking-wider text-white/40">
          Internal note (not sent, not shown to invitees)
        </label>
        <textarea
          value={emailSenderNote}
          onChange={(e) => setEmailSenderNote(e.target.value)}
          maxLength={WELCOME_LIMITS.emailSenderNote}
          rows={4}
          className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
          placeholder="e.g. Reminder: we use custom template X in Supabase…"
        />
      </section>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {LOCALE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide ${
              tab === t.id
                ? 'bg-orange-light/25 text-orange-light'
                : 'text-white/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {FIELD_META.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium uppercase tracking-wider text-white/50">
              {f.label}
              <span className="ml-2 font-mono text-[10px] text-white/35">
                max {FIELD_CHAR_LIMIT[f.key]} chars
              </span>
            </label>
            {f.hint ? <p className="mt-1 text-xs text-white/35">{f.hint}</p> : null}
            <textarea
              value={(currentBlock[f.key] as string | undefined) ?? ''}
              onChange={(e) => updateField(f.key, e.target.value)}
              rows={f.rows}
              className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
              placeholder="(default)"
            />
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="rounded-xl bg-orange-light px-8 py-3 text-sm font-bold uppercase text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <a
          href="/welcome"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium uppercase tracking-wide text-white/45 hover:text-orange-light"
        >
          Open /welcome preview →
        </a>
      </div>
    </div>
  );
};

export default TrainerWelcomeEditorView;
