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

export async function fetchRestaurants(lat: number, lng: number, sessionId: string): Promise<Restaurant[]> {
  const cacheKey = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`;

  if (restaurantCache.has(cacheKey)) {
    return restaurantCache.get(cacheKey)!;
  }

  const googleApiKey = process.env["GOOGLE_PLACES_API_KEY"];

  if (googleApiKey) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      url.searchParams.set("location", `${lat},${lng}`);
      url.searchParams.set("radius", "2000");
      url.searchParams.set("type", "restaurant");
      url.searchParams.set("key", googleApiKey);

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
        const restaurants: Restaurant[] = data.results.slice(0, 20).map((place) => {
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
            cuisine: (place.types ?? ["restaurant"]).find((t) => t !== "restaurant" && t !== "food" && t !== "establishment" && t !== "point_of_interest") ?? "Restaurant",
            rating: place.rating ?? 4.0,
            price,
            address: place.vicinity ?? "",
            mapsLink: `https://maps.google.com/?q=${lat2},${lng2}`,
          };
        });

        restaurantCache.set(cacheKey, restaurants);
        logger.info({ count: restaurants.length, sessionId }, "Fetched restaurants from Google Places");
        return restaurants;
      }
    } catch (err) {
      logger.error({ err }, "Google Places API failed, using mock data");
    }
  }

  // Fallback to mock data
  logger.info({ sessionId }, "Using mock restaurant data");
  restaurantCache.set(cacheKey, MOCK_RESTAURANTS);
  return MOCK_RESTAURANTS;
}
