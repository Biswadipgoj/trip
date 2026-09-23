// Curated natural travel photography (Unsplash CDN with optimized WebP/JPEG compression).
// Real, authentic places — mountains, coasts, road trips, cafes, stays, flights — no synthetic AI art.

export interface TravelDestination {
  id: string
  name: string
  tagline: string
  category: 'beach' | 'mountain' | 'roadtrip' | 'heritage' | 'nature' | 'city'
  image: string
  blurColor: string
}

export const TRAVEL_DESTINATIONS: TravelDestination[] = [
  {
    id: 'goa',
    name: 'Goa Coastal Getaway',
    tagline: 'Sunsets, shacks & ocean breeze',
    category: 'beach',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1000&q=80',
    blurColor: '#4A7C7A',
  },
  {
    id: 'manali',
    name: 'Manali & Kasol Hills',
    tagline: 'Snow peaks, pine trails & campfires',
    category: 'mountain',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1000&q=80',
    blurColor: '#3B4E68',
  },
  {
    id: 'ladakh',
    name: 'Ladakh High Passes',
    tagline: 'Endless horizons, bikes & blue skies',
    category: 'roadtrip',
    image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1000&q=80',
    blurColor: '#6B6256',
  },
  {
    id: 'kerala',
    name: 'Kerala Backwaters',
    tagline: 'Lush palms, houseboats & peace',
    category: 'nature',
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1000&q=80',
    blurColor: '#2D5A46',
  },
  {
    id: 'jaipur',
    name: 'Jaipur & Udaipur Forts',
    tagline: 'Palaces, rooftop dinners & royal vibes',
    category: 'heritage',
    image: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1000&q=80',
    blurColor: '#8C5E47',
  },
  {
    id: 'roadtrip',
    name: 'Western Ghats Road Trip',
    tagline: 'Misty twists, waterfalls & roadside chai',
    category: 'roadtrip',
    image: 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&w=1000&q=80',
    blurColor: '#4A6242',
  },
]

export const CATEGORY_BACKGROUNDS: Record<string, string> = {
  food: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', // cafe food
  travel: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80', // flight wing
  stay: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80', // resort pool/stay
  entertainment: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80', // concert lights
  shopping: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80', // market
  alcohol: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80', // bar glasses
  fuel: 'https://images.unsplash.com/photo-1527018606412-03c1507799cc?auto=format&fit=crop&w=800&q=80', // highway car
  tickets: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80', // bus/train
  misc: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80', // map / passport
}

export const LANDING_HERO_IMAGE = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80' // roadtrip friends van in nature
export const CELEBRATION_IMAGE = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=80' // friends laughing at sunset
