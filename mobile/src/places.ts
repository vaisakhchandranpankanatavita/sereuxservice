import { useEffect, useState } from 'react';

export type Place = { label: string; lat: number; lng: number };

/* Address search-as-you-type on Photon (OpenStreetMap data, no API key), limited to India (minLon,minLat,maxLon,maxLat).
   Data © OpenStreetMap contributors. */
const INDIA_BBOX = '68,6,98,36';

const labelOf = (p: any) => {
  const parts = [p.name, [p.housenumber, p.street].filter(Boolean).join(' '), p.district || p.suburb || p.locality, p.city || p.county, p.state, p.postcode];
  return [...new Set(parts.filter(Boolean))].join(', ');
};

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&bbox=${INDIA_BBOX}`, { signal });
  if (!res.ok) throw new Error('Place search failed');
  const json = await res.json();
  return (json.features ?? [])
    .map((f: any) => ({ label: labelOf(f.properties ?? {}), lat: f.geometry?.coordinates?.[1], lng: f.geometry?.coordinates?.[0] }))
    .filter((p: Place) => p.label && typeof p.lat === 'number' && typeof p.lng === 'number');
}

/* Debounced suggestions for `query`; only searches while `active` (i.e. the user is typing, not after a pick). */
export function usePlaceSuggestions(query: string, active: boolean) {
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!active || q.length < 3) { setResults([]); setLoading(false); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchPlaces(q, ctl.signal)); }
      catch (e: any) { if (e?.name !== 'AbortError') setResults([]); }
      if (!ctl.signal.aborted) setLoading(false);
    }, 350);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [query, active]);

  return { results, loading };
}
