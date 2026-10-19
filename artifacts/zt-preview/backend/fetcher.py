import os
import time
import asyncio
import logging
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import quote, urljoin, urlparse

import httpx
from curl_cffi.requests import AsyncSession

import proxy_manager
from state import get_setting, save_setting

logger = logging.getLogger(__name__)

ZT_DOMAIN = 'zone-telechargement.org'
CACHE_TTL = 600
LOGIN_TTL = 20 * 60
BASE_URL = os.environ.get(
    'ZT_ORIGIN_URL',
    'https://zone-telechargement.org',
).rstrip('/')
BLOCK_MARKERS = ('cf-error-details', 'Just a moment...', 'challenge-platform', 'Attention Required! | Cloudflare')

_cache: dict = {}
_sem = asyncio.Semaphore(6)
last_status: dict = {}
_site_session: Optional[httpx.AsyncClient] = None
_session_lock = asyncio.Lock()
_login_at = 0.0


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
    if not username:
        raise RuntimeError('Origin account credentials are not configured in Replit Secrets.')

    if _site_session is None:
        _site_session = httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
            headers={
                'User-Agent': (
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                ),
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            },
        )

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
            action_host = (urlparse(action).hostname or '').lower()
            if action_host not in {'zone-telechargement.org', 'www.zone-telechargement.org'}:
                raise RuntimeError('The origin login form points to an unexpected host.')
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
    doc = get_setting('fetch', {})
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
    save_setting('fetch', {
        'relays': relays,
        'scraperapi_key': scraperapi_key,
        'direct': direct,
    })
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
    response = await session.get(url, timeout=timeout)
    return response.status_code, response.text


async def _via_proxy(url: str, timeout: int, attempts: int = 8):
    status, text, proxy = await proxy_manager.fetch(url, timeout, attempts=attempts)
    if proxy:
        last_status['proxy'] = proxy
    return status, text


def _sources(settings: dict, url: str, attempts: int = 8) -> list:
    relays = [(f"relay:{r['url']}", lambda u, t, r=r: _via_relay(r, u, t)) for r in settings['relays']]
    api = [('scraperapi', lambda u, t: _via_scraperapi(settings['scraperapi_key'], u, t))] if settings['scraperapi_key'] else []
    direct = [('direct', _direct)] if settings['direct'] or ZT_DOMAIN not in url else []
    if ZT_DOMAIN in url:
        # Use the authenticated session first; never send its cookies to a proxy.
        proxy = [('proxy', lambda u, t: _via_proxy(u, t, attempts))]
        return direct + relays + api + proxy
    return direct + relays


async def fetch(
    url: str,
    timeout: int = 20,
    settings: Optional[dict] = None,
    attempts: int = 8,
) -> Optional[str]:
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    settings = settings or await get_settings()
    errors = []
    async with _sem:
        for name, fn in _sources(settings, url, attempts):
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


async def fetch_many(urls: list, timeout: int = 20, attempts: int = 8) -> dict:
    unique = list(set(filter(None, urls)))
    settings = await get_settings()
    texts = await asyncio.gather(
        *(fetch(u, timeout, settings, attempts) for u in unique)
    )
    return dict(zip(unique, texts))


async def fetch_post(
    url: str,
    data: dict,
    timeout: int = 20,
    attempts: int = 8,
) -> Optional[str]:
    """POST DLE search through the authenticated account session before fallbacks."""
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
        try:
            status, text, proxy = await proxy_manager.fetch(
                url, timeout, attempts=attempts, method='POST', data=data
            )
            if proxy and not is_blocked(status, text):
                _cache[key] = (time.time(), text)
                last_status.update({'ok': True, 'source': 'proxy', 'proxy': proxy,
                                    'at': time.time(), 'errors': errors})
                return text
            errors.append('proxy: no working proxy / blocked')
        except Exception as e:
            errors.append(f"proxy: {type(e).__name__} {str(e)[:120]}")
    last_status.update({'ok': False, 'source': None, 'at': time.time(), 'errors': errors})
    logger.warning(f"fetch_post failed {url}: {errors}")
    return None


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
