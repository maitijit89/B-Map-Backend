import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import {
  LifestyleBooking,
  LifestyleBookingStatus,
  LifestyleBookingType,
  LifestylePoiCategory,
  LifestylePoiItem,
  LifestyleServiceItem,
} from './super-app.types';

export class LifestyleDiscoveryService {
  /**
   * Curated registry of premier lifestyle POIs across Indian metros.
   */
  private poiRegistry: Map<string, LifestylePoiItem> = new Map();

  /**
   * In-memory store for lifestyle bookings & reservations.
   */
  private bookingsRegistry: Map<string, LifestyleBooking> = new Map();

  constructor() {
    this.seedDefaultLifestylePois();
  }

  /**
   * Seeds premier curated lifestyle POIs across dining, cafes, entertainment, wellness, and shopping.
   */
  private seedDefaultLifestylePois(): void {
    const pois: LifestylePoiItem[] = [
      // 1. Fine Dining - Bukhara, New Delhi
      {
        poiId: 'poi_bukhara_delhi',
        name: 'Bukhara - ITC Maurya',
        category: 'dining_restaurant',
        subCategories: ['North Indian', 'Tandoori', 'Luxury Dining', 'Michelin Rated'],
        rating: 4.95,
        reviewCount: 8420,
        priceTier: '₹₹₹₹',
        avgCostForTwoInr: 7500,
        location: [77.1730, 28.5975],
        address: 'ITC Maurya, Diplomatic Enclave, Chanakyapuri, New Delhi',
        city: 'New Delhi',
        contactPhone: '+91 11 2611 2233',
        openingHours: '12:30 PM - 02:45 PM, 07:00 PM - 11:45 PM',
        isOpenNow: true,
        photos: [
          'https://cdn.bmap.in/lifestyle/bukhara_ambience.webp',
          'https://cdn.bmap.in/lifestyle/dal_bukhara.webp',
        ],
        tags: ['Iconic', 'Valet Parking', 'Signature Dal Bukhara', 'Celebrity Favorite'],
        cuisines: ['North Indian', 'North-West Frontier', 'Kebabs'],
        availableTimeSlots: ['07:00 PM', '07:30 PM', '08:15 PM', '09:00 PM', '09:45 PM'],
        bookingEnabled: true,
      },

      // 2. Contemporary Dining - Farzi Cafe, DLF Cyber Hub Gurugram
      {
        poiId: 'poi_farzi_cyberhub',
        name: 'Farzi Café & Modern Spice Bistro',
        category: 'dining_restaurant',
        subCategories: ['Modern Indian', 'Molecular Gastronomy', 'Cocktail Bar'],
        rating: 4.82,
        reviewCount: 6150,
        priceTier: '₹₹₹',
        avgCostForTwoInr: 2800,
        location: [77.0878, 28.4950],
        address: 'DLF Cyber Hub, Level 1, DLF Phase 2, Gurugram',
        city: 'Gurugram',
        contactPhone: '+91 88006 90419',
        openingHours: '12:00 PM - 01:00 AM',
        isOpenNow: true,
        photos: [
          'https://cdn.bmap.in/lifestyle/farzi_cocktails.webp',
          'https://cdn.bmap.in/lifestyle/farzi_terrace.webp',
        ],
        tags: ['Outdoor Seating', 'Live DJ', 'Cocktails', 'Craft Beer', 'Pure Veg Options'],
        cuisines: ['Modern Indian', 'Tapas', 'Continental Fusion'],
        availableTimeSlots: ['01:00 PM', '02:00 PM', '08:00 PM', '08:30 PM', '09:30 PM'],
        bookingEnabled: true,
      },

      // 3. Artisanal Cafe - Blue Tokai Coffee Roasters, Khan Market
      {
        poiId: 'poi_bluetokai_khanmarket',
        name: 'Blue Tokai Coffee Roasters & Specialty Brew Bar',
        category: 'cafe_bistro',
        subCategories: ['Specialty Coffee', 'Bakery', 'Work Friendly'],
        rating: 4.88,
        reviewCount: 3890,
        priceTier: '₹₹',
        avgCostForTwoInr: 900,
        location: [77.2275, 28.6002],
        address: 'Shop 42, Middle Lane, Khan Market, New Delhi',
        city: 'New Delhi',
        contactPhone: '+91 98211 44556',
        openingHours: '07:30 AM - 11:00 PM',
        isOpenNow: true,
        photos: [
          'https://cdn.bmap.in/lifestyle/bluetokai_latte.webp',
          'https://cdn.bmap.in/lifestyle/bluetokai_beans.webp',
        ],
        tags: ['Single Origin Coffee', 'Free High-Speed Wi-Fi', 'Sourdough Croissants', 'Pet Friendly'],
        cuisines: ['Coffee & Desserts', 'Artisanal Bakery'],
        availableTimeSlots: ['10:00 AM', '11:30 AM', '03:00 PM', '05:00 PM'],
        bookingEnabled: true,
      },

      // 4. Luxury Cinema - PVR Director's Cut, Vasant Kunj
      {
        poiId: 'poi_pvr_directors_cut',
        name: "PVR Director's Cut & Gold Class Cinema",
        category: 'cinema_multiplex',
        subCategories: ['Luxury Cinema', 'Gourmet In-Seat Dining', 'Dolby Atmos'],
        rating: 4.91,
        reviewCount: 5120,
        priceTier: '₹₹₹₹',
        avgCostForTwoInr: 3200,
        location: [77.1558, 28.5412],
        address: 'Ambience Mall, Level 3, Nelson Mandela Marg, Vasant Kunj, New Delhi',
        city: 'New Delhi',
        contactPhone: '+91 11 4087 0000',
        openingHours: '09:00 AM - 01:00 AM',
        isOpenNow: true,
        photos: [
          'https://cdn.bmap.in/lifestyle/pvr_dc_recliners.webp',
          'https://cdn.bmap.in/lifestyle/pvr_dc_lounge.webp',
        ],
        tags: ['Plush Leather Recliners', 'Dedicated Butler Service', 'Laser 4K Projection'],
        serviceCatalog: [
          {
            itemId: 'serv_ticket_gold_recliner',
            name: 'Gold Class Luxury Recliner Seat (Evening Show)',
            description: 'Motorized ergonomic leather recliner with blanket, pillow & welcome drink',
            priceInr: 1450,
            categoryName: 'Cinema Tickets',
          },
          {
            itemId: 'serv_gourmet_popcorn_combo',
            name: 'Truffle Butter Caramel Popcorn & Mocktail Combo',
            description: 'Gourmet freshly popped popcorn with handcrafted iced mocktail',
            priceInr: 650,
            categoryName: 'In-Seat Dining',
          },
        ],
        availableTimeSlots: ['03:30 PM', '06:45 PM', '09:30 PM'],
        bookingEnabled: true,
      },

      // 5. Wellness & Spa - Kaya Skin Clinic & Luxury Day Spa
      {
        poiId: 'poi_kaya_wellness_cp',
        name: 'Kaya Skin Clinic & Ayurvedic Rejuvenation Spa',
        category: 'spa_wellness',
        subCategories: ['Skin Care', 'Deep Tissue Massage', 'Dermatology'],
        rating: 4.79,
        reviewCount: 2450,
        priceTier: '₹₹₹',
        avgCostForTwoInr: 4500,
        location: [77.2215, 28.6320],
        address: 'Block E, Inner Circle, Connaught Place, New Delhi',
        city: 'New Delhi',
        contactPhone: '+91 11 4151 7788',
        openingHours: '10:00 AM - 08:30 PM',
        isOpenNow: true,
        photos: [
          'https://cdn.bmap.in/lifestyle/kaya_spa_room.webp',
        ],
        tags: ['Certified Dermatologists', 'Aromatherapy', 'Private Treatment Suites'],
        serviceCatalog: [
          {
            itemId: 'serv_abhyanga_massage',
            name: 'Traditional Kerala Abhyanga Full-Body Herbal Massage',
            description: 'Warm medicated herbal oil deep relaxation therapy',
            priceInr: 2800,
            durationMinutes: 60,
            categoryName: 'Body Therapy',
          },
          {
            itemId: 'serv_hydra_facial',
            name: 'Hydra-Infusion Glow Radiance Facial',
            description: 'Deep pore cleansing, multi-vitamin serum hydration & LED therapy',
            priceInr: 3400,
            durationMinutes: 45,
            categoryName: 'Skin Aesthetics',
          },
        ],
        availableTimeSlots: ['11:00 AM', '02:00 PM', '04:30 PM', '06:00 PM'],
        bookingEnabled: true,
      },
    ];

    for (const p of pois) {
      this.poiRegistry.set(p.poiId, p);
    }
  }

  /**
   * Contextual discovery of lifestyle POIs with filters: category, proximity, price tier, min rating, open now.
   */
  searchLifestylePois(filters: {
    category?: LifestylePoiCategory;
    coordinate?: Coordinate;
    radiusMeters?: number;
    priceTier?: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹';
    minRating?: number;
    openNowOnly?: boolean;
    searchTerm?: string;
  }): Array<LifestylePoiItem & { distanceMeters?: number }> {
    let results: Array<LifestylePoiItem & { distanceMeters?: number }> = Array.from(this.poiRegistry.values());

    if (filters.category) {
      results = results.filter((p) => p.category === filters.category);
    }

    if (filters.priceTier) {
      results = results.filter((p) => p.priceTier === filters.priceTier);
    }

    if (filters.minRating) {
      results = results.filter((p) => p.rating >= filters.minRating!);
    }

    if (filters.openNowOnly) {
      results = results.filter((p) => p.isOpenNow);
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.tags.some((t) => t.toLowerCase().includes(term)) ||
          p.subCategories.some((sc) => sc.toLowerCase().includes(term))
      );
    }

    if (filters.coordinate) {
      const userCoord = filters.coordinate;
      const maxRadius = filters.radiusMeters || 10000;

      results = results
        .map((p) => {
          const dist = calculateDistanceMeters(userCoord, p.location);
          return { ...p, distanceMeters: Math.round(dist) };
        })
        .filter((p) => p.distanceMeters <= maxRadius)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    return results;
  }

  /**
   * Retrieves single lifestyle POI by ID.
   */
  getPoiById(poiId: string): LifestylePoiItem | null {
    return this.poiRegistry.get(poiId) || null;
  }

  /**
   * Creates a confirmed dining reservation or wellness/entertainment appointment.
   */
  createBooking(params: {
    userId: string;
    userName: string;
    userPhone: string;
    poiId: string;
    bookingType: LifestyleBookingType;
    bookingDate: string; // YYYY-MM-DD
    timeSlot: string;
    partySize?: number;
    selectedServiceItemIds?: string[];
    specialRequests?: string;
  }): LifestyleBooking {
    const poi = this.poiRegistry.get(params.poiId);
    if (!poi) {
      throw new Error(`POI ${params.poiId} not found`);
    }

    const bookingId = `book_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const confirmationCode = `BMAP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let totalAmountInr = 0;
    const selectedItems: LifestyleServiceItem[] = [];

    if (params.selectedServiceItemIds && poi.serviceCatalog) {
      for (const id of params.selectedServiceItemIds) {
        const item = poi.serviceCatalog.find((s) => s.itemId === id);
        if (item) {
          selectedItems.push(item);
          totalAmountInr += item.priceInr;
        }
      }
    }

    // Dining reservation nominal deposit (e.g. ₹500 for fine dining reservation guarantee)
    const depositPaidInr = params.bookingType === 'table_reservation' ? 500 : totalAmountInr;

    const booking: LifestyleBooking = {
      bookingId,
      userId: params.userId,
      userName: params.userName,
      userPhone: params.userPhone,
      poiId: poi.poiId,
      poiName: poi.name,
      category: poi.category,
      bookingType: params.bookingType,
      status: 'confirmed',
      bookingDate: params.bookingDate,
      timeSlot: params.timeSlot,
      partySize: params.partySize || 2,
      selectedItems: selectedItems.length > 0 ? selectedItems : undefined,
      specialRequests: params.specialRequests,
      confirmationCode,
      totalAmountInr,
      depositPaidInr,
      createdAt: Date.now(),
    };

    this.bookingsRegistry.set(bookingId, booking);
    return booking;
  }

  /**
   * Cancels a lifestyle booking.
   */
  cancelBooking(bookingId: string): { success: boolean; message: string } {
    const booking = this.bookingsRegistry.get(bookingId);
    if (!booking) {
      return { success: false, message: `Booking ${bookingId} not found` };
    }

    booking.status = 'cancelled';
    return { success: true, message: `Booking ${bookingId} cancelled. Deposit refund initiated.` };
  }

  /**
   * Retrieves a booking by ID.
   */
  getBookingById(bookingId: string): LifestyleBooking | null {
    return this.bookingsRegistry.get(bookingId) || null;
  }
}

export const lifestyleDiscoveryService = new LifestyleDiscoveryService();
