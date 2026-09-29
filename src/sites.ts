import type { CityState } from './city';
import { SITE_H, SITE_W } from './site-roiet';

export interface SiteInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  builtin?: boolean;
}

/** the original college keeps the pre-multi-site storage key, so edits made before this survive */
const LEGACY_KEY = 'tribemap.site.v3';
const LIST_KEY = 'tribemap.sites';
const CURRENT_KEY = 'tribemap.current-site';

export const BUILTIN_SITES: SiteInfo[] = [
  { id: 'roiet', name: 'วิทยาลัยอาชีวศึกษาร้อยเอ็ด', width: SITE_W, height: SITE_H, builtin: true },
];

/**
 * an edited plan saved with "บันทึกผัง" can be dropped in as src/sites/<id>.json
 * to become that site's shipped original — the one "ผังต้นฉบับ" restores
 */
const ORIGINALS = import.meta.glob<CityState>('./sites/*.json', { eager: true, import: 'default' });

export function shippedOriginal(id: string): CityState | undefined {
  return ORIGINALS[`./sites/${id}.json`];
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function customSites(): SiteInfo[] {
  return read<SiteInfo[]>(LIST_KEY, []);
}

export function allSites(): SiteInfo[] {
  return [...BUILTIN_SITES, ...customSites()];
}

export function storageKeyFor(id: string) {
  return id === 'roiet' ? LEGACY_KEY : `${LEGACY_KEY}.${id}`;
}

export function currentSite(): SiteInfo {
  const sites = allSites();
  const wanted = new URLSearchParams(location.search).get('site') ?? read<string>(CURRENT_KEY, 'roiet');
  return sites.find((s) => s.id === wanted) ?? sites[0];
}

export function openSite(id: string) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(id));
  const url = new URL(location.href);
  url.searchParams.set('site', id);
  location.href = url.toString();
}

export function createSite(name: string, width: number, height: number): SiteInfo {
  const site: SiteInfo = { id: `s${Date.now().toString(36)}`, name, width, height };
  localStorage.setItem(LIST_KEY, JSON.stringify([...customSites(), site]));
  return site;
}

export function deleteSite(id: string) {
  localStorage.setItem(LIST_KEY, JSON.stringify(customSites().filter((s) => s.id !== id)));
  localStorage.removeItem(storageKeyFor(id));
}
