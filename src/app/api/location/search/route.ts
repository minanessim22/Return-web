import { apiError, apiJson, enforceRateLimit } from '@/lib/server/http';

export const runtime = 'nodejs';

type LocationItem = {
  lat: number;
  lng: number;
  address: string;
};

function isValidCoordinate(value: string | null, min: number, max: number) {
  if (value === null || value === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function normalizeItem(entry: any): LocationItem | null {
  const lat = Number(entry?.lat);
  const lng = Number(entry?.lon);
  const address = typeof entry?.display_name === 'string' ? entry.display_name.trim() : '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address) {
    return null;
  }
  return { lat, lng, address };
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      headers: {
        'accept-language': 'en',
        'user-agent': 'RETURN/1.0 location lookup'
      },
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Location service returned ${response.status}.`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const rateError = enforceRateLimit({
    request,
    label: 'location-search',
    limit: 30,
    windowMs: 60 * 1000
  });
  if (rateError) {
    return rateError;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() || '';
  const latitude = url.searchParams.get('lat');
  const longitude = url.searchParams.get('lng') ?? url.searchParams.get('lon');
  const countryCode = url.searchParams.get('countryCode')?.trim() || '';

  try {
    if (query.length >= 3) {
      const params = new URLSearchParams({
        format: 'jsonv2',
        q: query,
        limit: '5',
        addressdetails: '1'
      });
      if (countryCode) {
        params.set('countrycodes', countryCode);
      }
      const payload = await fetchJson(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      const items = Array.isArray(payload)
        ? payload.map(normalizeItem).filter((item): item is LocationItem => Boolean(item))
        : [];
      return apiJson({ items });
    }

    if (isValidCoordinate(latitude, -90, 90) && isValidCoordinate(longitude, -180, 180)) {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        zoom: '18',
        addressdetails: '1'
      });
      const payload = await fetchJson(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
      const item = normalizeItem(payload);
      return apiJson({ item });
    }

    return apiError(400, 'Provide a search query or coordinates.');
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Location lookup timed out. Please try again.'
      : error instanceof Error
        ? error.message
        : 'Unable to look up this location right now.';
    return apiError(502, message);
  }
}
