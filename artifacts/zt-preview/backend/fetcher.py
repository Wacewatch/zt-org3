import os
import time
import asyncio
import logging
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

ZT_DOMAIN = 'zone-telechargement.org'
CACHE_TTL = 600
LOGIN_TTL = 20 * 60
BLOCK_MARKERS = ('cf-error-details', 'Just a moment...', 'challenge-platform', 'Attention Required! | Cloudflare')
BASE_URL = 'https://www.zone-telechargement.org'
USER_AGENT = (
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
)

# MongoDB is optional in preview; settings fall back to environment defaults.
_mongo_url = os.environ.get('MONGO_URL')
_db = None
if _mongo_url:
    from motor.motor_asyncio import AsyncIOMotorClient

    _db = AsyncIOMotorClient(_mongo_url)[os.environ.get('DB_NAME', 'zt_search')]
_cache: dict = {}
_sem = asyncio.Semaphore(6)
last_status: dict = {}
_site_session: Optional[httpx.AsyncClient] = None
_session_lock = asyncio.Lock()
_login_at = 0.0
_memory_settings = {'relays': [], 'scraperapi_key': '', 'direct': True}


class _LoginFormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == 'form':
            self.current = {'action': attrs.get('action', ''), 'inputs': []}
        elif tag.lower() == 'input' and self.current is not None:
            self.current['inputs'].append(attrs)

    def handle_endtag(self, tag):
        if tag.lower() == 'form' and self.current is not None:
            self.forms.append(self.current)
            self.current = None


def _has_origin_login(session: httpx.AsyncClient) -> bool:
    user_id = session.cookies.get('dle_user_id')
    password = session.cookies.get('dle_password')
    return bool(user_id and user_id not in ('0', '-1') and password)


async def _get_site_session(force_login: bool = False) -> httpx.AsyncClient:
    global _site_session, _login_at

    username = os.environ.get('ZT_ORIGIN_USERNAME', '').strip()
    password = os.environ.get('ZT_ORIGIN_PASSWORD', '')
    if bool(username) != bool(password):
        raise RuntimeError('Configure both ZT_ORIGIN_USERNAME and ZT_ORIGIN_PASSWORD.')

    if _site_session is None:
        _site_session = httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
            headers={
                'User-Agent': USER_AGENT,
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            },
        )

    if not username:
        return _site_session
    if not force_login and _has_origin_login(_site_session) and time.time() - _login_at < LOGIN_TTL:
        return _site_session

    async with _session_lock:
        if not force_login and _has_origin_login(_site_session) and time.time() - _login_at < LOGIN_TTL:
            return _site_session

        login_page = await _site_session.get(f'{BASE_URL}/index.php?do=login')
        if is_blocked(login_page.status_code, login_page.text):
            raise RuntimeError('The origin login page is unavailable or returned an access challenge.')

        parser = _LoginFormParser()
        parser.feed(login_page.text)
        login_form = next(
            (
                form for form in parser.forms
                if any(item.get('name') == 'login_name' for item in form['inputs'])
            ),
            None,
        )
        fields = {}
        action = f'{BASE_URL}/index.php?do=login'
        if login_form:
            action = urljoin(str(login_page.url), login_form['action'] or str(login_page.url))
            fields = {
                item['name']: item.get('value', '')
                for item in login_form['inputs']
                if item.get('type', '').lower() == 'hidden' and item.get('name')
            }
        fields.update({
            'login_name': username,
            'login_password': password,
            'login_not_save': '0',
            'login': 'submit',
        })

        response = await _site_session.post(action, data=fields)
        if response.status_code >= 400 or not _has_origin_login(_site_session):
            raise RuntimeError('Origin login failed; check the account credentials and site login form.')

        _login_at = time.time()
        return _site_session


def is_blocked(status: int, text: str) -> bool:
    if status != 200 or not text:
        return True
    head = text[:6000]
    return any(m in head for m in BLOCK_MARKERS)


async def get_settings() -> dict:
    doc = await _db.settings.find_one({'_id': 'fetch'}, {'_id': 0}) if _db else _memory_settings
    doc = doc or {}
    relays = list(doc.get('relays') or [])
    env_relay = os.environ.get('ZT_RELAY_URL')
    if env_relay and not any(r.get('url') == env_relay for r in relays):
        relays.append({'url': env_relay, 'key': os.environ.get('ZT_RELAY_KEY', '')})
    return {
        'relays': [r for r in relays if r.get('url')],
        'scraperapi_key': doc.get('scraperapi_key') or os.environ.get('SCRAPERAPI_KEY', ''),
        'direct': doc.get('direct', True),
    }


async def save_settings(relays: list, scraperapi_key: str, direct: bool):
    values = {'relays': relays, 'scraperapi_key': scraperapi_key, 'direct': direct}
    if _db:
        await _db.settings.update_one({'_id': 'fetch'}, {'$set': values}, upsert=True)
    else:
        _memory_settings.update(values)
    _cache.clear()


async def _via_relay(relay: dict, url: str, timeout: int):
    sep = '&' if '?' in relay['url'] else '?'
    target = f"{relay['url']}{sep}url={quote(url, safe='')}&key={quote(relay.get('key') or '', safe='')}"
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, verify=False) as c:
        r = await c.get(target, headers={'User-Agent': 'ZTSearch-Relay-Client/1.0'})
        return r.status_code, r.text


async def _via_scraperapi(key: str, url: str, timeout: int):
    target = f"https://api.scraperapi.com/?api_key={quote(key)}&country_code=fr&url={quote(url, safe='')}"
    async with httpx.AsyncClient(timeout=max(timeout, 60), verify=False) as c:
        r = await c.get(target)
        return r.status_code, r.text


async def _direct(url: str, timeout: int):
    session = await _get_site_session()
    r = await session.get(url, timeout=timeout)
    return r.status_code, r.text


def _sources(settings: dict, url: str) -> list:
    return [('direct', _direct)]


async def fetch(url: str, timeout: int = 20, settings: Optional[dict] = None) -> Optional[str]:
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    settings = settings or await get_settings()
    errors = []
    async with _sem:
        for name, fn in _sources(settings, url):
            try:
                status, text = await fn(url, timeout)
                if not is_blocked(status, text):
                    _cache[url] = (time.time(), text)
                    last_status.update({'ok': True, 'source': name, 'at': time.time(), 'errors': errors})
                    return text
                errors.append(f"{name}: HTTP {status} bloqué")
            except Exception as e:
                errors.append(f"{name}: {type(e).__name__} {str(e)[:120]}")
    if ZT_DOMAIN in url:
        last_status.update({'ok': False, 'source': None, 'at': time.time(), 'errors': errors})
    logger.warning(f"fetch failed {url}: {errors}")
    return None


async def fetch_many(urls: list, timeout: int = 20) -> dict:
    unique = list(set(filter(None, urls)))
    settings = await get_settings()
    texts = await asyncio.gather(*(fetch(u, timeout, settings) for u in unique))
    return dict(zip(unique, texts))


async def fetch_post(url: str, data: dict, timeout: int = 20) -> Optional[str]:
    """POST a search request through the authenticated direct session."""
    key = url + '|' + repr(sorted(data.items()))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    errors = []
    async with _sem:
        try:
            session = await _get_site_session()
            response = await session.post(url, data=data, timeout=timeout)
            if not is_blocked(response.status_code, response.text):
                _cache[key] = (time.time(), response.text)
                last_status.update({'ok': True, 'source': 'direct', 'at': time.time(), 'errors': []})
                return response.text
            errors.append(f'direct: HTTP {response.status_code} bloqué')
        except Exception as e:
            errors.append(f"direct: {type(e).__name__} {str(e)[:120]}")
    last_status.update({'ok': False, 'source': None, 'at': time.time(), 'errors': errors})
    logger.warning(f"fetch_post failed {url}: {errors}")
    return None


async def fetch_bytes(url: str, timeout: int = 15):
    session = await _get_site_session()
    response = await session.get(
        url,
        timeout=timeout,
        headers={
            'Referer': f'{BASE_URL}/',
            'Accept': 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
        },
    )
    return (
        response.status_code,
        response.content,
        response.headers.get('content-type', ''),
        'direct',
    )


async def test_sources(url: str) -> list:
    settings = await get_settings()
    out = []
    for name, fn in _sources(settings, url):
        t0 = time.time()
        try:
            status, text = await fn(url, 25)
            out.append({'source': name, 'http_code': status, 'ok': not is_blocked(status, text),
                        'ms': int((time.time() - t0) * 1000), 'bytes': len(text or '')})
        except Exception as e:
            out.append({'source': name, 'ok': False, 'error': f"{type(e).__name__} {str(e)[:150]}",
                        'ms': int((time.time() - t0) * 1000)})
    return out
