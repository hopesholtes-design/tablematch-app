import { logger } from "../lib/logger";

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
  maxPrice: number;     // 1–4 ($–$$$$)
  vibes: string[];
}

const VIBE_KEYWORDS: Record<string, string[]> = {
  Cozy: ["cozy", "intimate", "wine bar", "cafe"],
  Trendy: ["trendy", "modern", "popular"],
  Romantic: ["romantic", "date night", "fine dining", "italian", "steakhouse"],
  Casual: ["casual", "quick bite", "local"],
  Lively: ["lively", "bar", "brunch", "music"],
};

// Scoring bias per vibe: { minRating, preferredPriceLevels (1-4) }
const VIBE_BIAS: Record<string, { minRating: number; priceLevels: number[] }> = {
  Cozy:     { minRating: 4.0, priceLevels: [1, 2] },
  Trendy:   { minRating: 4.2, priceLevels: [2, 3, 4] },
  Romantic: { minRating: 4.5, priceLevels: [2, 3, 4] },
  Casual:   { minRating: 0,   priceLevels: [1, 2] },
  Lively:   { minRating: 4.2, priceLevels: [1, 2, 3] },
};

const PRICE_LEVEL_MAP: Record<string, number> = { "$": 1, "$$": 2, "$$$": 3, "$$$$": 4 };

function vibeScore(restaurant: Restaurant, vibes: string[]): number {
  if (!vibes.length) return 0;
  let score = 0;
  const priceLevel = PRICE_LEVEL_MAP[restaurant.price] ?? 2;
  for (const vibe of vibes) {
    const bias = VIBE_BIAS[vibe];
    if (!bias) continue;
    if (restaurant.rating >= bias.minRating) score += 1;
    if (bias.priceLevels.includes(priceLevel)) score += 1;
    // Keyword match in name or cuisine
    const keywords = VIBE_KEYWORDS[vibe] ?? [];
    const haystack = `${restaurant.name} ${restaurant.cuisine}`.toLowerCase();
    if (keywords.some((kw) => haystack.includes(kw))) score += 2;
  }
  return score;
}

function applyVibeRanking(restaurants: Restaurant[], vibes: string[]): Restaurant[] {
  if (!vibes.length) return restaurants;
  return [...restaurants].sort((a, b) => vibeScore(b, vibes) - vibeScore(a, vibes));
}

function filterByPrice(restaurants: Restaurant[], maxPrice: number): Restaurant[] {
  return restaurants.filter((r) => {
    const level = PRICE_LEVEL_MAP[r.price] ?? 2;
    return level <= maxPrice;
  });
}

const restaurantCache = new Map<string, Restaurant[]>();

const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: "mock-1",
    name: "The Golden Fork",
    photo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    cuisine: "Contemporary American",
    rating: 4.5,
    price: "$$",
    address: "123 Main St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=The+Golden+Fork+San+Francisco",
  },
  {
    id: "mock-2",
    name: "Sakura Sushi Bar",
    photo: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
    cuisine: "Japanese",
    rating: 4.7,
    price: "$$$",
    address: "456 Union St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Sakura+Sushi+Bar",
  },
  {
    id: "mock-3",
    name: "La Piazza",
    photo: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    cuisine: "Italian",
    rating: 4.3,
    price: "$$",
    address: "789 Columbus Ave, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=La+Piazza+San+Francisco",
  },
  {
    id: "mock-4",
    name: "Spice Garden",
    photo: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
    cuisine: "Indian",
    rating: 4.6,
    price: "$$",
    address: "321 Valencia St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Spice+Garden+San+Francisco",
  },
  {
    id: "mock-5",
    name: "Le Petit Bistro",
    photo: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
    cuisine: "French",
    rating: 4.8,
    price: "$$$",
    address: "654 Clay St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Le+Petit+Bistro+San+Francisco",
  },
  {
    id: "mock-6",
    name: "Taco Loco",
    photo: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80",
    cuisine: "Mexican",
    rating: 4.2,
    price: "$",
    address: "987 Mission St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Taco+Loco+San+Francisco",
  },
  {
    id: "mock-7",
    name: "Dragon Palace",
    photo: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80",
    cuisine: "Chinese",
    rating: 4.4,
    price: "$$",
    address: "147 Grant Ave, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Dragon+Palace+San+Francisco",
  },
  {
    id: "mock-8",
    name: "Olive & Vine",
    photo: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80",
    cuisine: "Mediterranean",
    rating: 4.6,
    price: "$$",
    address: "258 Fillmore St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Olive+Vine+San+Francisco",
  },
  {
    id: "mock-9",
    name: "Seoul Kitchen",
    photo: "https://images.unsplash.com/photo-1583224994559-1b1a83ac35af?w=800&q=80",
    cuisine: "Korean",
    rating: 4.5,
    price: "$$",
    address: "369 Geary St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Seoul+Kitchen+San+Francisco",
  },
  {
    id: "mock-10",
    name: "The Smokehouse",
    photo: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
    cuisine: "BBQ",
    rating: 4.3,
    price: "$$",
    address: "741 Divisadero St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=The+Smokehouse+San+Francisco",
  },
  {
    id: "mock-11",
    name: "Pho Saigon",
    photo: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80",
    cuisine: "Vietnamese",
    rating: 4.4,
    price: "$",
    address: "852 Irving St, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Pho+Saigon+San+Francisco",
  },
  {
    id: "mock-12",
    name: "Harbor Catch",
    photo: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",
    cuisine: "Seafood",
    rating: 4.7,
    price: "$$$",
    address: "963 The Embarcadero, San Francisco, CA",
    mapsLink: "https://maps.google.com/?q=Harbor+Catch+San+Francisco",
  },
];

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

  const googleApiKey = process.env["GOOGLE_PLACES_API_KEY"];
  const radiusMeters = Math.round(filters.radiusMiles * 1609);

  // Build vibe keyword string
  const vibeKeywords = filters.vibes.flatMap((v) => VIBE_KEYWORDS[v] ?? []);
  const keyword = vibeKeywords.length > 0 ? vibeKeywords.slice(0, 3).join(" ") : undefined;

  if (googleApiKey) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      url.searchParams.set("location", `${lat},${lng}`);
      url.searchParams.set("radius", String(radiusMeters));
      url.searchParams.set("type", "restaurant");
      url.searchParams.set("maxprice", String(filters.maxPrice));
      url.searchParams.set("key", googleApiKey);
      if (keyword) url.searchParams.set("keyword", keyword);

      const res = await fetch(url.toString());
      const data = await res.json() as { status: string; results: Array<{
        place_id: string;
        name: string;
        photos?: Array<{ photo_reference: string }>;
        types?: string[];
        rating?: number;
        price_level?: number;
        vicinity?: string;
        geometry?: { location: { lat: number; lng: number } };
      }> };

      if (data.status === "OK" && data.results.length > 0) {
        let restaurants: Restaurant[] = data.results.slice(0, 30).map((place) => {
          const photoRef = place.photos?.[0]?.photo_reference;
          const photoUrl = photoRef
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${googleApiKey}`
            : `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80`;

          const priceMap: Record<number, string> = { 0: "Free", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
          const price = place.price_level !== undefined ? (priceMap[place.price_level] ?? "$$") : "$$";

          const lat2 = place.geometry?.location.lat ?? lat;
          const lng2 = place.geometry?.location.lng ?? lng;

          return {
            id: place.place_id,
            name: place.name,
            photo: photoUrl,
            cuisine: (place.types ?? ["restaurant"]).find(
              (t) => t !== "restaurant" && t !== "food" && t !== "establishment" && t !== "point_of_interest"
            ) ?? "Restaurant",
            rating: place.rating ?? 4.0,
            price,
            address: place.vicinity ?? "",
            mapsLink: `https://maps.google.com/?q=${lat2},${lng2}`,
          };
        });

        // Apply vibe soft ranking
        restaurants = applyVibeRanking(restaurants, filters.vibes);

        restaurantCache.set(cacheKey, restaurants);
        logger.info({ count: restaurants.length, sessionId, filters }, "Fetched restaurants from Google Places");
        return restaurants;
      }

      // If too few results with keyword, fall through to retry without keyword weighting
      if (keyword) {
        const fallbackUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        fallbackUrl.searchParams.set("location", `${lat},${lng}`);
        fallbackUrl.searchParams.set("radius", String(radiusMeters));
        fallbackUrl.searchParams.set("type", "restaurant");
        fallbackUrl.searchParams.set("maxprice", String(filters.maxPrice));
        fallbackUrl.searchParams.set("key", googleApiKey);
        const fallbackRes = await fetch(fallbackUrl.toString());
        const fallbackData = await fallbackRes.json() as typeof data;
        if (fallbackData.status === "OK" && fallbackData.results.length > 0) {
          const restaurants: Restaurant[] = fallbackData.results.slice(0, 20).map((place) => {
            const photoRef = place.photos?.[0]?.photo_reference;
            const photoUrl = photoRef
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${googleApiKey}`
              : `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80`;
            const priceMap: Record<number, string> = { 0: "Free", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
            const price = place.price_level !== undefined ? (priceMap[place.price_level] ?? "$$") : "$$";
            const lat2 = place.geometry?.location.lat ?? lat;
            const lng2 = place.geometry?.location.lng ?? lng;
            return {
              id: place.place_id,
              name: place.name,
              photo: photoUrl,
              cuisine: (place.types ?? ["restaurant"]).find(
                (t) => t !== "restaurant" && t !== "food" && t !== "establishment" && t !== "point_of_interest"
              ) ?? "Restaurant",
              rating: place.rating ?? 4.0,
              price,
              address: place.vicinity ?? "",
              mapsLink: `https://maps.google.com/?q=${lat2},${lng2}`,
            };
          });
          const ranked = applyVibeRanking(restaurants, filters.vibes);
          restaurantCache.set(cacheKey, ranked);
          return ranked;
        }
      }
    } catch (err) {
      logger.error({ err }, "Google Places API failed, using mock data");
    }
  }

  // Fallback to mock data — apply price + vibe filtering/ranking
  logger.info({ sessionId, filters }, "Using mock restaurant data");
  let mock = filterByPrice(MOCK_RESTAURANTS, filters.maxPrice);
  if (!mock.length) mock = MOCK_RESTAURANTS; // relax if too restrictive
  mock = applyVibeRanking(mock, filters.vibes);

  restaurantCache.set(cacheKey, mock);
  return mock;
}
