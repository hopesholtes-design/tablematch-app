import { logger } from "../lib/logger";
import { getMatchBoostMap } from "./db";

export interface Restaurant {
  id: string;
  name: string;
  photo: string;
  cuisine: string;
  rating: number;
  price: string;
  address: string;
  mapsLink: string;
}

export interface RestaurantFilters {
  radiusMiles: number;
  maxPrice: number;     // 1–4
  vibes: string[];
}

// ── Vibe keyword mapping ──────────────────────────────────────────────────

const VIBE_KEYWORDS: Record<string, string[]> = {
  Cozy:     ["cozy", "intimate", "cafe", "wine bar"],
  Trendy:   ["trendy", "modern", "popular"],
  Romantic: ["romantic", "date night", "italian", "steakhouse"],
  Casual:   ["casual", "quick bite", "local"],
  Lively:   ["bar", "brunch", "music", "busy"],
};

// ── Scoring ───────────────────────────────────────────────────────────────

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreRestaurant(opts: {
  rating: number;
  reviewCount: number;
  distanceMiles: number;
  radiusMiles: number;
  vibes: string[];
  name: string;
  cuisine: string;
  matchBoost: number;
}): number {
  const { rating, reviewCount, distanceMiles, radiusMiles, vibes, name, cuisine, matchBoost } = opts;

  // Rating (0–1): normalize 1–5 scale
  const ratingScore = (Math.max(1, Math.min(5, rating)) - 1) / 4;

  // Reviews (0–1): log scale capped at 10k
  const reviewScore = Math.min(1, Math.log10(Math.max(1, reviewCount)) / Math.log10(10000));

  // Distance (0–1): inverse of distance within radius
  const distScore = Math.max(0, 1 - distanceMiles / Math.max(1, radiusMiles));

  // Vibe (0–1): keyword overlap
  let vibeScore = 0.5; // neutral when no vibes selected
  if (vibes.length > 0) {
    const keywords = vibes.flatMap((v) => VIBE_KEYWORDS[v] ?? []);
    const haystack = `${name} ${cuisine}`.toLowerCase();
    const hits = keywords.filter((kw) => haystack.includes(kw)).length;
    vibeScore = keywords.length > 0 ? hits / keywords.length : 0;
  }

  // Historical match boost (tiny additive bonus, max ~0.1)
  const boostScore = Math.min(0.1, Math.log10(Math.max(1, matchBoost + 1)) * 0.05);

  return (
    ratingScore  * 0.40 +
    reviewScore  * 0.25 +
    distScore    * 0.15 +
    vibeScore    * 0.20 +
    boostScore
  );
}

// ── Price helpers ─────────────────────────────────────────────────────────

const PRICE_STRING: Record<number, string> = { 0: "Free", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

// ── Cache ─────────────────────────────────────────────────────────────────

const restaurantCache = new Map<string, Restaurant[]>();

// ── Mock data ─────────────────────────────────────────────────────────────

interface MockSource {
  id: string; name: string; photo: string; cuisine: string;
  rating: number; reviewCount: number; price: string;
  address: string; mapsLink: string; lat: number; lng: number;
}

const MOCK_SOURCES: MockSource[] = [
  { id:"mock-1",  name:"The Golden Fork",    photo:"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",  cuisine:"Contemporary American", rating:4.5, reviewCount:320, price:"$$",  address:"123 Main St, San Francisco, CA",            mapsLink:"https://maps.google.com/?q=The+Golden+Fork",    lat:37.7749, lng:-122.4194 },
  { id:"mock-2",  name:"Sakura Sushi Bar",   photo:"https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",  cuisine:"Japanese",              rating:4.7, reviewCount:510, price:"$$$", address:"456 Union St, San Francisco, CA",             mapsLink:"https://maps.google.com/?q=Sakura+Sushi+Bar",   lat:37.7975, lng:-122.4045 },
  { id:"mock-3",  name:"La Piazza",          photo:"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",  cuisine:"Italian",               rating:4.3, reviewCount:280, price:"$$",  address:"789 Columbus Ave, San Francisco, CA",         mapsLink:"https://maps.google.com/?q=La+Piazza",          lat:37.7998, lng:-122.4077 },
  { id:"mock-4",  name:"Spice Garden",       photo:"https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",  cuisine:"Indian",                rating:4.6, reviewCount:195, price:"$$",  address:"321 Valencia St, San Francisco, CA",          mapsLink:"https://maps.google.com/?q=Spice+Garden",       lat:37.7677, lng:-122.4214 },
  { id:"mock-5",  name:"Le Petit Bistro",    photo:"https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",     cuisine:"French",                rating:4.8, reviewCount:430, price:"$$$", address:"654 Clay St, San Francisco, CA",              mapsLink:"https://maps.google.com/?q=Le+Petit+Bistro",    lat:37.7949, lng:-122.4052 },
  { id:"mock-6",  name:"Taco Loco",          photo:"https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80",  cuisine:"Mexican",               rating:4.2, reviewCount:125, price:"$",   address:"987 Mission St, San Francisco, CA",           mapsLink:"https://maps.google.com/?q=Taco+Loco",          lat:37.7762, lng:-122.4175 },
  { id:"mock-7",  name:"Dragon Palace",      photo:"https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80",     cuisine:"Chinese",               rating:4.4, reviewCount:240, price:"$$",  address:"147 Grant Ave, San Francisco, CA",            mapsLink:"https://maps.google.com/?q=Dragon+Palace",      lat:37.7956, lng:-122.4064 },
  { id:"mock-8",  name:"Olive & Vine",       photo:"https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80",  cuisine:"Mediterranean",         rating:4.6, reviewCount:310, price:"$$",  address:"258 Fillmore St, San Francisco, CA",          mapsLink:"https://maps.google.com/?q=Olive+Vine",         lat:37.7761, lng:-122.4325 },
  { id:"mock-9",  name:"Seoul Kitchen",      photo:"https://images.unsplash.com/photo-1583224994559-1b1a83ac35af?w=800&q=80",  cuisine:"Korean",                rating:4.5, reviewCount:185, price:"$$",  address:"369 Geary St, San Francisco, CA",             mapsLink:"https://maps.google.com/?q=Seoul+Kitchen",      lat:37.7870, lng:-122.4111 },
  { id:"mock-10", name:"The Smokehouse",     photo:"https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",     cuisine:"BBQ",                   rating:4.3, reviewCount:265, price:"$$",  address:"741 Divisadero St, San Francisco, CA",        mapsLink:"https://maps.google.com/?q=The+Smokehouse",     lat:37.7754, lng:-122.4380 },
  { id:"mock-11", name:"Pho Saigon",         photo:"https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80",  cuisine:"Vietnamese",            rating:4.4, reviewCount:150, price:"$",   address:"852 Irving St, San Francisco, CA",            mapsLink:"https://maps.google.com/?q=Pho+Saigon",         lat:37.7634, lng:-122.4663 },
  { id:"mock-12", name:"Harbor Catch",       photo:"https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",  cuisine:"Seafood",               rating:4.7, reviewCount:390, price:"$$$", address:"963 The Embarcadero, San Francisco, CA",      mapsLink:"https://maps.google.com/?q=Harbor+Catch",       lat:37.7985, lng:-122.3978 },
];

// ── Main fetch function ───────────────────────────────────────────────────

export async function fetchRestaurants(
  lat: number,
  lng: number,
  sessionId: string,
  filters: RestaurantFilters = { radiusMiles: 5, maxPrice: 4, vibes: [] },
): Promise<Restaurant[]> {
  const vibeKey = [...filters.vibes].sort().join(",");
  const cacheKey = `${Math.round(lat * 100)}_${Math.round(lng * 100)}_r${filters.radiusMiles}_p${filters.maxPrice}_v${vibeKey}`;

  if (restaurantCache.has(cacheKey)) {
    return restaurantCache.get(cacheKey)!;
  }

  const matchBoostMap = getMatchBoostMap();
  const radiusMeters = Math.round(filters.radiusMiles * 1609);
  const vibeKeywords = filters.vibes.flatMap((v) => VIBE_KEYWORDS[v] ?? []);
  const keyword = vibeKeywords.length > 0 ? vibeKeywords.slice(0, 3).join(" ") : undefined;
  const googleApiKey = process.env["GOOGLE_PLACES_API_KEY"];

  if (googleApiKey) {
    const result = await fetchFromGoogle(lat, lng, radiusMeters, filters, keyword, googleApiKey, matchBoostMap);
    if (result) {
      restaurantCache.set(cacheKey, result);
      logger.info({ count: result.length, sessionId, filters }, "Fetched from Google Places");
      return result;
    }
  }

  // Fallback: scored mock data
  logger.info({ sessionId, filters }, "Using mock restaurant data");
  const mock = scoredMock(lat, lng, filters, matchBoostMap);
  restaurantCache.set(cacheKey, mock);
  return mock;
}

// ── Google Places fetch ───────────────────────────────────────────────────

interface PlaceResult {
  place_id: string;
  name: string;
  photos?: Array<{ photo_reference: string }>;
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  vicinity?: string;
  business_status?: string;
  geometry?: { location: { lat: number; lng: number } };
}

async function fetchFromGoogle(
  lat: number,
  lng: number,
  radiusMeters: number,
  filters: RestaurantFilters,
  keyword: string | undefined,
  apiKey: string,
  matchBoostMap: Map<string, number>,
): Promise<Restaurant[] | null> {
  const buildUrl = (withKeyword: boolean) => {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("type", "restaurant");
    url.searchParams.set("maxprice", String(filters.maxPrice));
    url.searchParams.set("key", apiKey);
    if (withKeyword && keyword) url.searchParams.set("keyword", keyword);
    return url.toString();
  };

  const tryFetch = async (withKeyword: boolean) => {
    const res = await fetch(buildUrl(withKeyword));
    return res.json() as Promise<{ status: string; results: PlaceResult[] }>;
  };

  try {
    let data = await tryFetch(!!keyword);

    // Relax vibe keyword if too few results
    if ((data.status !== "OK" || data.results.length < 5) && keyword) {
      data = await tryFetch(false);
    }

    if (data.status !== "OK" || data.results.length === 0) return null;

    // Quality pre-filter
    const qualified = data.results.filter(
      (p) =>
        (p.business_status ?? "OPERATIONAL") === "OPERATIONAL" &&
        (p.rating ?? 0) >= 4.2 &&
        (p.user_ratings_total ?? 0) >= 75,
    );

    // Fall back to unfiltered if too restrictive
    const pool = qualified.length >= 5 ? qualified : data.results.slice(0, 30);

    const scored = pool.map((place) => {
      const pLat = place.geometry?.location.lat ?? lat;
      const pLng = place.geometry?.location.lng ?? lng;
      const dist = haversineMiles(lat, lng, pLat, pLng);
      const score = scoreRestaurant({
        rating: place.rating ?? 4.0,
        reviewCount: place.user_ratings_total ?? 100,
        distanceMiles: dist,
        radiusMiles: filters.radiusMiles,
        vibes: filters.vibes,
        name: place.name,
        cuisine:
          (place.types ?? []).find(
            (t) =>
              t !== "restaurant" &&
              t !== "food" &&
              t !== "establishment" &&
              t !== "point_of_interest",
          ) ?? "restaurant",
        matchBoost: matchBoostMap.get(place.place_id) ?? 0,
      });
      return { place, pLat, pLng, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 25);

    return top.map(({ place, pLat, pLng }) => {
      const photoRef = place.photos?.[0]?.photo_reference;
      return {
        id: place.place_id,
        name: place.name,
        photo: photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`
          : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
        cuisine:
          (place.types ?? []).find(
            (t) =>
              t !== "restaurant" &&
              t !== "food" &&
              t !== "establishment" &&
              t !== "point_of_interest",
          ) ?? "Restaurant",
        rating: place.rating ?? 4.0,
        price: PRICE_STRING[place.price_level ?? 2] ?? "$$",
        address: place.vicinity ?? "",
        mapsLink: `https://maps.google.com/?q=${pLat},${pLng}`,
      };
    });
  } catch (err) {
    logger.error({ err }, "Google Places API error");
    return null;
  }
}

// ── Scored mock fallback ──────────────────────────────────────────────────

const PRICE_LEVELS: Record<string, number> = { "$": 1, "$$": 2, "$$$": 3, "$$$$": 4 };

function scoredMock(
  lat: number,
  lng: number,
  filters: RestaurantFilters,
  matchBoostMap: Map<string, number>,
): Restaurant[] {
  const priced = MOCK_SOURCES.filter(
    (r) => (PRICE_LEVELS[r.price] ?? 2) <= filters.maxPrice,
  );
  const pool = priced.length >= 4 ? priced : MOCK_SOURCES;

  const scored = pool.map((r) => ({
    r,
    score: scoreRestaurant({
      rating: r.rating,
      reviewCount: r.reviewCount,
      distanceMiles: haversineMiles(lat, lng, r.lat, r.lng),
      radiusMiles: filters.radiusMiles,
      vibes: filters.vibes,
      name: r.name,
      cuisine: r.cuisine,
      matchBoost: matchBoostMap.get(r.id) ?? 0,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map(({ r }) => ({
    id: r.id,
    name: r.name,
    photo: r.photo,
    cuisine: r.cuisine,
    rating: r.rating,
    price: r.price,
    address: r.address,
    mapsLink: r.mapsLink,
  }));
}
