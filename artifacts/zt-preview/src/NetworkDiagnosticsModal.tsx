import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Check, CircleAlert, Copy, Globe2, KeyRound, LoaderCircle,
  LockKeyhole, RadioTower, RefreshCw, Router, Server, ShieldCheck, X,
} from 'lucide-react';
import {
  getGetNetworkDiagnosticsQueryKey,
  useGetNetworkDiagnostics,
} from '@workspace/api-client-react';

function formatDate(timestamp?: number | null) {
  return timestamp
    ? new Date(timestamp * 1000).toLocaleString('fr-FR')
    : 'Aucune requête enregistrée';
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function StatePill({ active, yes = 'Actif', no = 'Inactif' }: {
  active: boolean; yes?: string; no?: string;
}) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${active ? 'border-emerald-300/20 bg-emerald-300/[.08] text-emerald-200' : 'border-white/[.08] bg-white/[.03] text-slate-500'}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-300' : 'bg-slate-600'}`} />
    {active ? yes : no}
  </span>;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/[.05] py-2.5 last:border-0">
    <span className="text-xs text-slate-500">{label}</span>
    <span className="text-right text-xs font-medium text-slate-200">{children}</span>
  </div>;
}

function Panel({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return <section className="rounded-2xl border border-white/[.07] bg-[#0d141a] p-4">
    <h3 className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-slate-400">
      <span className="text-sky-200">{icon}</span>{title}
    </h3>
    {children}
  </section>;
}

export default function NetworkDiagnosticsModal({ open, close }: {
  open: boolean; close: () => void;
}) {
  const [adminKey, setAdminKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const request = useMemo(() => ({
    headers: { 'X-Admin-Key': adminKey },
  }), [adminKey]);
  const diagnostics = useGetNetworkDiagnostics({
    request,
    query: {
      enabled: open && unlocked,
      queryKey: getGetNetworkDiagnosticsQueryKey(),
      refetchInterval: open && unlocked ? 30_000 : false,
      refetchOnWindowFocus: true,
    },
  });

  useEffect(() => {
    if (!open) {
      setAdminKey('');
      setUnlocked(false);
    }
  }, [open]);

  if (!open) return null;
  const data = diagnostics.data;
  const unlock = () => {
    if (adminKey.trim()) setUnlocked(true);
  };
  const copyIp = async () => {
    if (data?.outboundIp) await navigator.clipboard?.writeText(data.outboundIp);
  };

  return <div data-testid="network-diagnostics-dialog" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="network-dialog-title" className="max-h-[92dvh] w-full max-w-[760px] overflow-y-auto rounded-3xl border border-white/10 bg-[#111920] p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono-ui text-[9px] uppercase tracking-[.22em] text-sky-200">État du serveur</div>
          <h2 id="network-dialog-title" className="mt-1 font-display text-2xl font-bold text-slate-100">Diagnostic réseau</h2>
          <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">IP de sortie, tunnel Replit, relais et état des services. L’accès est réservé à l’administration.</p>
        </div>
        <button data-testid="network-diagnostics-close" onClick={close} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-white/[.06] hover:text-white"><X size={17} /></button>
      </div>

      {!unlocked ? <div className="mt-6 rounded-2xl border border-white/[.07] bg-[#0d141a] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300"><KeyRound size={14} className="text-amber-200" /> Clé administrateur requise</div>
        <div className="flex gap-2">
          <input data-testid="network-admin-key-input" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') unlock(); }} placeholder="Clé administrateur" autoComplete="current-password" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111920] px-3 font-mono-ui text-xs text-slate-100 outline-none focus:border-sky-300/40" />
          <button data-testid="network-admin-unlock-btn" onClick={unlock} disabled={!adminKey.trim()} className="inline-flex items-center gap-2 rounded-xl bg-sky-200 px-4 text-xs font-bold text-[#091411] disabled:opacity-40"><LockKeyhole size={13} />Voir les infos</button>
        </div>
      </div> : diagnostics.isLoading ? <div data-testid="network-diagnostics-loading" className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-white/[.07] bg-[#0d141a] p-10 text-xs text-slate-400"><LoaderCircle size={15} className="animate-spin" />Lecture des diagnostics…</div> :
        diagnostics.isError ? <div data-testid="network-diagnostics-error" className="mt-6 flex gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-4 text-xs text-rose-200"><CircleAlert size={16} className="shrink-0" /><div>Impossible de lire les diagnostics. Vérifiez la clé administrateur ou réessayez.<button onClick={() => diagnostics.refetch()} className="ml-2 underline">Réessayer</button><button onClick={() => { setAdminKey(''); setUnlocked(false); }} className="ml-3 underline">Changer la clé</button></div></div> :
          data && <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="IP de sortie" icon={<Globe2 size={13} />}>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span data-testid="network-outbound-ip" className="break-all font-mono-ui text-lg font-bold text-slate-100">{data.outboundIp || 'Indisponible'}</span>
                  {data.outboundIp && <button onClick={copyIp} aria-label="Copier l’IP" className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"><Copy size={14} /></button>}
                </div>
                <p className="text-[10px] leading-4 text-slate-600">Mesurée par api.ipify.org à l’actualisation. Elle peut différer de l’IP d’un relais.</p>
              </Panel>
              <Panel title="Tunnel et entrée" icon={<Router size={13} />}>
                <InfoRow label="Plateforme">{data.tunnel.platform}</InfoRow>
                <InfoRow label="Hôte d’entrée">{data.tunnel.host || 'Non détecté'}</InfoRow>
                <InfoRow label="Protocole">{data.tunnel.protocol || 'Non détecté'}</InfoRow>
                <InfoRow label="Route API"><span className="font-mono-ui">{data.tunnel.apiPath}</span></InfoRow>
              </Panel>
              <Panel title="Source et accès" icon={<ShieldCheck size={13} />}>
                <InfoRow label="Domaine source">{data.source.origin}</InfoRow>
                <InfoRow label="Accès direct"><StatePill active={data.source.directEnabled} /></InfoRow>
                <InfoRow label="Compte source"><StatePill active={data.source.accountConfigured} yes="Configuré" no="Absent" /></InfoRow>
                <InfoRow label="Session active"><StatePill active={data.source.accountAuthenticated} /></InfoRow>
                <InfoRow label="TMDB"><StatePill active={data.source.tmdbConfigured} yes="Configuré" no="Absent" /></InfoRow>
                <InfoRow label="API relais"><StatePill active={data.source.scraperApiConfigured} yes="Configurée" no="Absente" /></InfoRow>
              </Panel>
              <Panel title="Relais configurés" icon={<RadioTower size={13} />}>
                {data.relays.length ? data.relays.map((relay, index) => <div key={`${relay.host}:${relay.port}:${index}`} className="border-b border-white/[.05] py-2.5 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono-ui text-[11px] text-slate-200">{relay.scheme}://{relay.host}{relay.port ? `:${relay.port}` : ''}</span>
                    <StatePill active={relay.keyConfigured} yes="Clé définie" no="Sans clé" />
                  </div>
                </div>) : <p className="py-3 text-xs text-slate-500">Aucun relais personnalisé.</p>}
              </Panel>
              <Panel title="Pool réseau" icon={<Activity size={13} />}>
                <InfoRow label="Relais disponibles">{data.proxyPool.pool}</InfoRow>
                <InfoRow label="Trouvés au dernier renouvellement">{data.proxyPool.last_refill_found}</InfoRow>
                <InfoRow label="Adresses vérifiées">{data.proxyPool.validations}</InfoRow>
                <InfoRow label="Dernier renouvellement">{formatDate(data.proxyPool.last_refill || null)}</InfoRow>
              </Panel>
              <Panel title="Dernière requête" icon={<Activity size={13} />}>
                <InfoRow label="Résultat">{data.lastRequest.ok === null ? 'Aucune requête' : data.lastRequest.ok ? 'Réussie' : 'Échec'}</InfoRow>
                <InfoRow label="Route utilisée">{data.lastRequest.source || '—'}</InfoRow>
                <InfoRow label="Horodatage">{formatDate(data.lastRequest.at)}</InfoRow>
                <InfoRow label="Sources en erreur">{data.lastRequest.errorCount}</InfoRow>
              </Panel>
              <Panel title="Serveur" icon={<Server size={13} />}>
                <InfoRow label="Service">{data.runtime.service}</InfoRow>
                <InfoRow label="Python">{data.runtime.python}</InfoRow>
                <InfoRow label="En fonctionnement depuis">{formatDuration(data.runtime.uptimeSeconds)}</InfoRow>
                <InfoRow label="Vérifié à">{formatDate(data.checkedAt)}</InfoRow>
              </Panel>
              <Panel title="Actualisation" icon={<RefreshCw size={13} />}>
                <p className="py-2 text-xs leading-5 text-slate-500">Mise à jour automatique toutes les 30 secondes. Les URL de relais et les clés ne sont pas affichées.</p>
                <button data-testid="network-diagnostics-refresh" onClick={() => diagnostics.refetch()} disabled={diagnostics.isFetching} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-sky-300/30 hover:text-sky-200 disabled:opacity-50">
                  <RefreshCw size={13} className={diagnostics.isFetching ? 'animate-spin' : ''} />Actualiser maintenant
                </button>
              </Panel>
            </div>
          </div>}
    </section>
  </div>;
}
