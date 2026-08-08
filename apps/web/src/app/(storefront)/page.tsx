import type { HealthResponse } from '@imix/types';
import { apiBaseUrl, apiFetch } from '@/lib/api';

// The API is probed on every request, so the page must never be prerendered.
export const dynamic = 'force-dynamic';

async function getApiHealth(): Promise<HealthResponse | null> {
  try {
    return await apiFetch<HealthResponse>('/health');
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await getApiHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-ink-muted text-sm tracking-widest uppercase">Phase 1 · skeleton</p>

      <h1 className="text-6xl font-semibold tracking-tight text-balance">
        iMIX
        <span className="text-ink-muted block">phones and laptops, chosen well.</span>
      </h1>

      <p className="text-ink-muted max-w-prose">
        The storefront is not built yet — this page exists to prove the pipeline. The catalog and
        product pages arrive with Phase 1.4.
      </p>

      <dl className="rounded-card border-line bg-surface-alt border p-6 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">API</dt>
          <dd className="font-mono">{apiBaseUrl}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="text-ink-muted">Status</dt>
          <dd className={health ? 'text-success' : 'text-danger'}>
            {health ? `${health.service} · ${health.status}` : 'unreachable'}
          </dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="text-ink-muted">Database</dt>
          <dd className={health?.database === 'up' ? 'text-success' : 'text-danger'}>
            {health?.database ?? 'unknown'}
          </dd>
        </div>
      </dl>
    </main>
  );
}
