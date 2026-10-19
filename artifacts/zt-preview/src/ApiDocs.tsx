import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, BookOpen, Check, ChevronRight, Code2, Copy, ExternalLink,
  Search, ShieldCheck, Terminal,
} from 'lucide-react';

type Method = 'GET' | 'POST' | 'PUT';
type Endpoint = {
  id: string;
  group: string;
  method: Method;
  path: string;
  title: string;
  description: string;
  params?: string[];
  headers?: string[];
  body?: string;
  response?: string;
  example: string;
  note?: string;
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const contentResult = {
  title: 'Exemple de titre',
  poster: 'https://example.com/poster.jpg',
  quality: '1080P',
  lang: 'MULTI',
  pageUrls: ['https://example.com/catalogue/titre'],
  year: '2024',
  seasons: [],
  meta: {},
};

const linkResult = {
  host: 'ExempleHost',
  hoster: 'ExempleHost',
  url: 'https://example.com/ressource',
  type: 'download',
  quality: '1080P',
  lang: 'VF',
  size: '2.4 Go',
  filename: 'exemple-video.mkv',
  protection: '',
  release: 'Exemple release',
  releaseName: 'exemple-video',
  releaseSize: '2.4 Go',
  season: null,
  episode: null,
};

const endpoints: Endpoint[] = [
  {
    id: 'categories',
    group: 'Catalogue',
    method: 'GET',
    path: '/zt-api/api/categories',
    title: 'Lister les catégories',
    description: 'Retourne les catégories disponibles, leur type, leur libellé et leurs sous-catégories.',
    response: pretty({
      categories: [
        { type: 'movie', label: 'Films', tmdb: true, subcategories: [{ slug: 'film', label: 'Tous les films' }] },
        { type: 'tv', label: 'Séries', tmdb: true, subcategories: [{ slug: 'serie', label: 'Toutes les séries' }] },
        { type: 'anime', label: 'Animes', tmdb: true, subcategories: [{ slug: 'manga', label: 'Tous les animes' }] },
      ],
    }),
    example: 'curl -s "$BASE_URL/zt-api/api/categories"',
    note: 'Autres types disponibles : jeux, musique, ebook, logiciel, documentaire, emission, spectacle, concert et sport.',
  },
  {
    id: 'search',
    group: 'Catalogue',
    method: 'GET',
    path: '/zt-api/api/search',
    title: 'Rechercher un titre',
    description: 'Recherche un titre dans une catégorie et renvoie les résultats regroupés par contenu.',
    params: ['q (requis) : texte de recherche, au moins un caractère.', 'type (facultatif) : type de contenu, par défaut movie.'],
    response: pretty({
      query: 'Exemple de titre',
      type: 'movie',
      total: 1,
      results: [contentResult],
      blocked: false,
      errors: [],
    }),
    example: 'curl -G "$BASE_URL/zt-api/api/search" \\\n  --data-urlencode "q=Exemple de titre" \\\n  --data-urlencode "type=movie"',
    note: 'Types courants : movie, tv, anime, jeux, musique, ebook, logiciel, documentaire, emission, spectacle, concert, sport.',
  },
  {
    id: 'latest',
    group: 'Catalogue',
    method: 'GET',
    path: '/zt-api/api/latest',
    title: 'Derniers ajouts',
    description: 'Retourne les derniers contenus d’une catégorie.',
    params: ['type (facultatif) : type de contenu, par défaut movie.', 'limit (facultatif) : nombre maximal de résultats, de 1 à 48, par défaut 24.'],
    response: pretty({ type: 'movie', total: 1, results: [contentResult] }),
    example: 'curl -G "$BASE_URL/zt-api/api/latest" \\\n  --data-urlencode "type=movie" \\\n  --data-urlencode "limit=24"',
  },
  {
    id: 'detail',
    group: 'Catalogue',
    method: 'GET',
    path: '/zt-api/api/detail',
    title: 'Détails d’un contenu',
    description: 'Récupère les métadonnées et les qualités associées à une ou plusieurs pages catalogue.',
    params: ['urls (requis) : URL(s) de page, séparées par des virgules. Jusqu’à 10 URL sont traitées.'],
    response: pretty({
      result: {
        title: 'Exemple de titre',
        originalTitle: null,
        poster: 'https://example.com/poster.jpg',
        year: '2024',
        synopsis: 'Résumé du contenu.',
        actors: null,
        director: null,
        duration: null,
        genres: null,
        origin: null,
        rating: null,
        qualities: [{
          quality: '1080P',
          lang: 'VF',
          size: '2.4 Go',
          downloadLinks: [linkResult],
          streamLinks: [],
        }],
      },
    }),
    example: 'curl -G "$BASE_URL/zt-api/api/detail" \\\n  --data-urlencode "urls=https://example.com/catalogue/titre"',
  },
  {
    id: 'tmdb-links',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/api/liens',
    title: 'Recherche par identifiant TMDB',
    description: 'Recherche un film ou une série à partir d’un identifiant TMDB. total compte les liens individuels, total_qualities les groupes qualité/langue. qualities fournit les groupes comme dans la fiche catalogue et links conserve la liste aplatie. Les liens Zoneurs sont réessayés automatiquement; si un lien reste protégé, il est quand même renvoyé avec son champ protection et compté dans unresolved_protected_links.',
    params: ['media_type (requis) : film ou serie.', 'tmdb_id (requis) : identifiant TMDB positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({
      tmdb_id: 550,
      media_type: 'movie',
      title: 'Exemple de titre',
      matched_title: 'Exemple de titre',
      year: '2024',
      poster: 'https://example.com/poster.jpg',
      result_url: 'https://example.com/catalogue/titre',
      season: null,
      episode: null,
      total: 1,
      total_qualities: 1,
      unresolved_protected_links: 0,
      qualities: [{
        quality: '1080P',
        lang: 'VF',
        size: '2.4 Go',
        downloadLinks: [linkResult],
        streamLinks: [],
      }],
      links: [linkResult],
    }),
    example: 'curl -G "$BASE_URL/zt-api/api/liens" \\\n  --data-urlencode "media_type=film" \\\n  --data-urlencode "tmdb_id=550"',
    note: 'Ne transmets pas TMDB_API_KEY dans la requête : la clé est lue par le backend depuis les secrets Replit.',
  },
  {
    id: 'tmdb-film-alias',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/api/liens/film/{tmdb_id}',
    title: 'Recherche film (route directe)',
    description: 'Alias de la recherche TMDB pour les films.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'title (facultatif) : titre à utiliser si la résolution TMDB automatique échoue.'],
    response: pretty({ tmdb_id: 550, media_type: 'movie', title: 'Exemple de titre', total: 1, total_qualities: 1, qualities: [{ quality: '1080P', lang: 'VF', size: '2.4 Go', downloadLinks: [linkResult], streamLinks: [] }], links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/api/liens/film/550"',
  },
  {
    id: 'tmdb-series-alias',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/api/liens/serie/{tmdb_id}',
    title: 'Recherche série (route directe)',
    description: 'Alias de la recherche TMDB pour les séries.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'title (facultatif) : titre à utiliser si la résolution TMDB automatique échoue.'],
    response: pretty({ tmdb_id: 1399, media_type: 'series', title: 'Exemple de série', total: 1, total_qualities: 1, qualities: [{ quality: '1080P', lang: 'VF', size: '2.4 Go', downloadLinks: [linkResult], streamLinks: [] }], links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/api/liens/serie/1399"',
  },
  {
    id: 'tmdb-movie-compat',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/liens/movie/{tmdb_id}',
    title: 'Compatibilité : film',
    description: 'Route courte conservée pour les intégrations existantes.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 550, media_type: 'movie', total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/liens/movie/550"',
  },
  {
    id: 'tmdb-series-compat',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/liens/series/{tmdb_id}',
    title: 'Compatibilité : série',
    description: 'Route courte conservée pour les intégrations existantes.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 1399, media_type: 'series', total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/liens/series/1399"',
  },
  {
    id: 'tmdb-api-movie-compat',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/api/liens/movie/{tmdb_id}',
    title: 'Compatibilité API : film',
    description: 'Alias de compatibilité monté dans le préfixe API principal.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 550, media_type: 'movie', total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/api/liens/movie/550"',
  },
  {
    id: 'tmdb-api-series-compat',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/api/liens/series/{tmdb_id}',
    title: 'Compatibilité API : série',
    description: 'Alias de compatibilité monté dans le préfixe API principal.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 1399, media_type: 'series', total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/api/liens/series/1399"',
  },
  {
    id: 'tmdb-api-season',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/api/liens/series/{tmdb_id}/{season}',
    title: 'Compatibilité API : saison',
    description: 'Alias de compatibilité pour cibler une saison précise.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'season (chemin) : numéro de saison positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 1399, media_type: 'series', season: 1, episode: null, total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/api/liens/series/1399/1"',
  },
  {
    id: 'tmdb-api-episode',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/api/liens/series/{tmdb_id}/{season}/{episode}',
    title: 'Compatibilité API : épisode',
    description: 'Alias de compatibilité pour cibler un épisode précis.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'season (chemin) : numéro de saison positif.', 'episode (chemin) : numéro d’épisode positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 1399, media_type: 'series', season: 1, episode: 2, total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/api/liens/series/1399/1/2"',
  },
  {
    id: 'tmdb-season',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/liens/series/{tmdb_id}/{season}',
    title: 'Recherche par saison',
    description: 'Recherche les liens d’une saison précise.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'season (chemin) : numéro de saison positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 1399, media_type: 'series', season: 1, episode: null, total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/liens/series/1399/1"',
  },
  {
    id: 'tmdb-episode',
    group: 'Films & séries',
    method: 'GET',
    path: '/zt-api/liens/series/{tmdb_id}/{season}/{episode}',
    title: 'Recherche par épisode',
    description: 'Recherche les liens d’un épisode précis d’une série.',
    params: ['tmdb_id (chemin) : identifiant TMDB positif.', 'season (chemin) : numéro de saison positif.', 'episode (chemin) : numéro d’épisode positif.', 'title (facultatif) : titre de recherche de remplacement.'],
    response: pretty({ tmdb_id: 1399, media_type: 'series', season: 1, episode: 2, total: 1, links: [linkResult] }),
    example: 'curl "$BASE_URL/zt-api/liens/series/1399/1/2"',
  },
  {
    id: 'status',
    group: 'Sources & admin',
    method: 'GET',
    path: '/zt-api/api/status',
    title: 'État des sources',
    description: 'Retourne l’état des sources, des relais et du dernier test.',
    response: pretty({
      relays: [{ url: 'https://relay.example', key: '•••' }],
      scraperapi: false,
      direct: true,
      proxyPool: {},
      last: {},
    }),
    example: 'curl -s "$BASE_URL/zt-api/api/status"',
  },
  {
    id: 'settings-read',
    group: 'Sources & admin',
    method: 'GET',
    path: '/zt-api/api/settings',
    title: 'Lire les réglages des sources',
    description: 'Retourne les réglages d’administration des relais et du scraper.',
    headers: ['X-Admin-Key: clé administrateur configurée côté serveur.'],
    response: pretty({ relays: [{ url: 'https://relay.example', key: 'CLE_MASQUEE' }], scraperapi_key: '', direct: true }),
    example: 'curl "$BASE_URL/zt-api/api/settings" \\\n  -H "X-Admin-Key: $ADMIN_KEY"',
    note: 'Réponse : 401 si la clé est invalide, 503 si ADMIN_KEY n’est pas configurée. Ne publie jamais cette réponse si elle contient des secrets.',
  },
  {
    id: 'settings-write',
    group: 'Sources & admin',
    method: 'PUT',
    path: '/zt-api/api/settings',
    title: 'Enregistrer les réglages des sources',
    description: 'Met à jour les relais, la clé ScraperAPI et le mode direct.',
    headers: ['Content-Type: application/json', 'X-Admin-Key: clé administrateur configurée côté serveur.'],
    body: pretty({ relays: [{ url: 'https://relay.example', key: 'CLE_RELAIS' }], scraperapi_key: 'CLE_SCRAPERAPI', direct: true }),
    response: pretty({ ok: true }),
    example: 'curl -X PUT "$BASE_URL/zt-api/api/settings" \\\n  -H "X-Admin-Key: $ADMIN_KEY" \\\n  -H "Content-Type: application/json" \\\n  --data \'{"relays":[],"scraperapi_key":"","direct":true}\'',
    note: 'Utilise des variables d’environnement ou un gestionnaire de secrets pour les clés. Ne les intègre pas dans le code client.',
  },
  {
    id: 'sources-test',
    group: 'Sources & admin',
    method: 'POST',
    path: '/zt-api/api/status/test',
    title: 'Tester les sources',
    description: 'Lance un test des sources configurées.',
    headers: ['X-Admin-Key: clé administrateur configurée côté serveur.'],
    response: pretty({ target: 'https://example.com/', results: [{ source: 'direct', ok: true, http_code: 200, ms: 123 }] }),
    example: 'curl -X POST "$BASE_URL/zt-api/api/status/test" \\\n  -H "X-Admin-Key: $ADMIN_KEY"',
  },
  {
    id: 'image',
    group: 'Utilitaires',
    method: 'GET',
    path: '/zt-api/api/img',
    title: 'Proxy d’image',
    description: 'Récupère une image distante depuis les hôtes autorisés.',
    params: ['u (requis) : URL de l’image, encodée comme paramètre de requête.'],
    example: 'curl -G "$BASE_URL/zt-api/api/img" \\\n  --data-urlencode "u=https://zone-telechargement.org/img/exemple.webp" \\\n  --output image.webp',
    note: 'Hôtes autorisés par le serveur : zone-telechargement.org et zone-images.com. Réponse : image binaire; 400/404 en cas d’URL refusée ou d’image absente.',
  },
  {
    id: 'relay',
    group: 'Utilitaires',
    method: 'GET',
    path: '/zt-api/api/relay/{name}',
    title: 'Télécharger un fichier relais',
    description: 'Retourne un fichier relais parmi la liste autorisée par le serveur.',
    params: ['name (chemin) : relay.php, relay.py, README.md ou zt_org.php.'],
    example: 'curl "$BASE_URL/zt-api/api/relay/README.md"',
    note: 'Réponse en texte brut avec un en-tête Content-Disposition de téléchargement.',
  },
];

const groups = ['Tout', ...Array.from(new Set(endpoints.map((endpoint) => endpoint.group)))];
const methodStyles: Record<Method, string> = {
  GET: 'border-sky-300/20 bg-sky-200/[.07] text-sky-200',
  POST: 'border-amber-300/20 bg-amber-200/[.07] text-amber-200',
  PUT: 'border-violet-300/20 bg-violet-200/[.07] text-violet-200',
};

function CodeBlock({ value, copyId, copiedId, onCopy }: {
  value: string; copyId: string; copiedId: string; onCopy: (id: string, value: string) => void;
}) {
  return <div className="overflow-hidden rounded-xl border border-white/[.07] bg-[#0a0f14]">
    <div className="flex items-center justify-between border-b border-white/[.06] px-3 py-2">
      <span className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-slate-600">Exemple JSON</span>
      <button type="button" onClick={() => onCopy(copyId, value)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-white/[.05] hover:text-emerald-200" aria-label="Copier le JSON">
        {copiedId === copyId ? <Check size={12} /> : <Copy size={12} />}{copiedId === copyId ? 'Copié' : 'Copier'}
      </button>
    </div>
    <pre className="max-h-80 overflow-auto p-3 font-mono-ui text-[10px] leading-5 text-slate-400">{value}</pre>
  </div>;
}

export default function ApiDocsPage() {
  const [, navigate] = useLocation();
  const [group, setGroup] = useState('Tout');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const visibleEndpoints = useMemo(() => endpoints.filter((endpoint) => {
    const matchesGroup = group === 'Tout' || endpoint.group === group;
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || `${endpoint.method} ${endpoint.path} ${endpoint.title} ${endpoint.description} ${endpoint.group}`.toLowerCase().includes(needle);
    return matchesGroup && matchesSearch;
  }), [group, search]);

  const copy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => current === id ? '' : current), 1600);
    } catch {
      setCopiedId('');
    }
  };

  return <div className="min-h-[100dvh] bg-[#0d1218] text-slate-200">
    <header className="sticky top-0 z-40 border-b border-white/[.07] bg-[#0d1218]/90 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-7">
        <button onClick={() => navigate('/')} className="inline-flex shrink-0 items-center gap-2 rounded-lg text-left text-sm font-bold text-slate-100 hover:text-emerald-200">
          <ArrowLeft size={15} /><span className="hidden sm:inline">Retour à ZT Search</span><span className="sm:hidden">Retour</span>
        </button>
        <span className="h-6 w-px bg-white/10" />
        <BookOpen size={16} className="text-emerald-300" />
        <span className="text-xs font-semibold text-slate-300">Documentation API</span>
        <span className="ml-auto rounded-full border border-emerald-200/15 bg-emerald-200/[.05] px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-wider text-emerald-200">v1</span>
      </div>
    </header>

    <main className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-7">
      <section className="relative overflow-hidden border-b border-white/[.07] py-9 sm:py-12">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-emerald-200/[.07] sm:right-16">
          <div className="m-8 h-56 w-56 rounded-full border border-emerald-200/[.05]" />
        </div>
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-200/[.055] px-3 py-1.5 font-mono-ui text-[9px] uppercase tracking-[.2em] text-emerald-100">
            <Code2 size={12} /> Référence développeur
          </div>
          <h1 className="font-display text-[clamp(2rem,5vw,3.8rem)] font-bold leading-[1.02] tracking-[-.06em] text-[#f1f3ee]">
            API <span className="text-emerald-300">ZT Search</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
            Routes disponibles pour le catalogue, les films, les séries, les saisons et les épisodes. Les exemples utilisent des valeurs fictives.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <div className="rounded-xl border border-white/[.07] bg-[#141b22] px-3.5 py-2.5">
              <div className="font-mono-ui text-[9px] uppercase tracking-widest text-slate-600">Base API</div>
              <code className="mt-1 block font-mono-ui text-xs text-emerald-200">/zt-api/api</code>
            </div>
            <div className="rounded-xl border border-white/[.07] bg-[#141b22] px-3.5 py-2.5">
              <div className="font-mono-ui text-[9px] uppercase tracking-widest text-slate-600">Encodage</div>
              <code className="mt-1 block font-mono-ui text-xs text-slate-300">JSON · UTF-8</code>
            </div>
            <div className="rounded-xl border border-white/[.07] bg-[#141b22] px-3.5 py-2.5">
              <div className="font-mono-ui text-[9px] uppercase tracking-widest text-slate-600">Routes documentées</div>
              <code className="mt-1 block font-mono-ui text-xs text-slate-300">{endpoints.length} endpoints</code>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-[57px] z-30 -mx-4 border-b border-white/[.06] bg-[#0d1218]/95 px-4 py-3 backdrop-blur-xl sm:-mx-7 sm:px-7">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrer par route ou fonction…" className="h-10 w-full rounded-xl border border-white/[.08] bg-[#141b22] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-300/30" aria-label="Filtrer les routes API" />
          </div>
          <nav aria-label="Groupes d’endpoints" className="scrollbar-none flex gap-1.5 overflow-x-auto">
            {groups.map((item) => <button key={item} onClick={() => setGroup(item)} className={`shrink-0 rounded-lg border px-3 py-2 text-[10px] font-semibold transition ${group === item ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-white/[.06] text-slate-500 hover:bg-white/[.04] hover:text-slate-200'}`}>{item}</button>)}
          </nav>
        </div>
      </section>

      <div className="mt-7 flex items-center justify-between gap-3">
        <p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-slate-600">{visibleEndpoints.length} route(s)</p>
        <a href="#authentification" className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-200">Authentification admin <ChevronRight size={12} /></a>
      </div>

      <div className="mt-3 space-y-3">
        {visibleEndpoints.map((endpoint) => <article key={endpoint.id} id={endpoint.id} className="scroll-mt-40 overflow-hidden rounded-2xl border border-white/[.07] bg-[#121920]">
          <div className="flex flex-wrap items-start gap-3 border-b border-white/[.06] px-4 py-4 sm:px-5">
            <span className={`rounded-md border px-2 py-1 font-mono-ui text-[9px] font-bold tracking-wider ${methodStyles[endpoint.method]}`}>{endpoint.method}</span>
            <div className="min-w-0 flex-1">
              <code className="break-all font-mono-ui text-xs leading-6 text-slate-100 sm:text-sm">{endpoint.path}</code>
              <h2 className="mt-1 font-display text-sm font-bold text-slate-200">{endpoint.title}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{endpoint.description}</p>
            </div>
            <span className="rounded-full border border-white/[.07] px-2.5 py-1 font-mono-ui text-[9px] text-slate-500">{endpoint.group}</span>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              {endpoint.params?.length ? <div>
                <h3 className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.16em] text-slate-600">Paramètres</h3>
                <ul className="space-y-1.5">{endpoint.params.map((param) => <li key={param} className="rounded-lg border border-white/[.05] bg-[#0d1319] px-3 py-2 text-[10px] leading-5 text-slate-400">{param}</li>)}</ul>
              </div> : null}
              {endpoint.headers?.length ? <div>
                <h3 className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.16em] text-slate-600">En-têtes</h3>
                <ul className="space-y-1.5">{endpoint.headers.map((header) => <li key={header} className="rounded-lg border border-white/[.05] bg-[#0d1319] px-3 py-2 font-mono-ui text-[10px] leading-5 text-slate-400">{header}</li>)}</ul>
              </div> : null}
              {endpoint.body && <div>
                <h3 className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.16em] text-slate-600">Corps de requête · JSON</h3>
                <CodeBlock value={endpoint.body} copyId={`${endpoint.id}-body`} copiedId={copiedId} onCopy={copy} />
              </div>}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-slate-600">Appel cURL</h3>
                  <button type="button" onClick={() => copy(`${endpoint.id}-curl`, endpoint.example)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-white/[.05] hover:text-emerald-200">
                    {copiedId === `${endpoint.id}-curl` ? <Check size={12} /> : <Copy size={12} />}{copiedId === `${endpoint.id}-curl` ? 'Copié' : 'Copier'}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-white/[.07] bg-[#0a0f14] p-3 font-mono-ui text-[10px] leading-5 text-emerald-100/80">{endpoint.example}</pre>
              </div>
              {endpoint.note && <p className="rounded-xl border border-amber-200/10 bg-amber-200/[.035] px-3 py-2.5 text-[10px] leading-5 text-amber-100/70">{endpoint.note}</p>}
            </div>
            {endpoint.response && <CodeBlock value={endpoint.response} copyId={`${endpoint.id}-response`} copiedId={copiedId} onCopy={copy} />}
          </div>
        </article>)}
        {!visibleEndpoints.length && <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center text-xs text-slate-500">Aucune route ne correspond à ce filtre.</div>}
      </div>

      <section id="authentification" className="mt-8 scroll-mt-40 rounded-2xl border border-amber-200/10 bg-[#141a1d] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-200/15 bg-amber-200/[.05] text-amber-200"><ShieldCheck size={16} /></div>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-200">Authentification des routes admin</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Les routes de réglages et de test exigent l’en-tête <code className="font-mono-ui text-amber-100">X-Admin-Key</code>. La clé doit rester côté serveur ou dans un gestionnaire de secrets : ne l’inscris pas dans une application publique ni dans un exemple partagé.</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/[.06] bg-[#0d1319] px-3 py-2 font-mono-ui text-[10px] text-slate-400"><Terminal size={12} className="text-amber-200" /> X-Admin-Key: $ADMIN_KEY</div>
          </div>
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.06] pt-5 text-[9px] text-slate-600">
        <span>ZT Search <span className="mx-1.5 text-slate-800">/</span> Documentation API</span>
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 hover:text-emerald-200"><ExternalLink size={11} /> Retour à l’application</button>
      </footer>
    </main>
  </div>;
}
