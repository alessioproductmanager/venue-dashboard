window.App = window.App || {};

/**
 * Config & mock persistence layer.
 *
 * There is no real backend behind this prototype — "the database" is a
 * plain JS object persisted to localStorage. It is seeded once on first
 * run and read/written from every module through App.DB.get()/save().
 */
App.CONFIG = {
  HUGGINGFACE_TOKEN: '', // intentionally empty — see README before adding a real one
  FOOTBALL_DATA_TOKEN: '', // paste your football-data.org token here — see README
  TOURNAMENT_CODE: 'WC',
  STORAGE_KEY: 'tiqets_hub_db_v4',
};

App.AVATARS = ['🦁', '🐘', '🦋', '🐬', '🦉', '🦊', '🐯', '🐧', '🦄', '🐝'];

App.SEED_DB = {
  currentUser: null, // { name, avatar }
  userKeys: { huggingface: '', footballData: '' }, // pasted by whoever runs this, never committed
  start: { completed: false, chosenKey: null },
  activityLog: [], // { id, time, user:{name,avatar}, action, productName, destKey, channels:[] }

  otaChannels: [
    { id: 'tiqets', name: 'Tiqets', connected: true, isHome: true },
    { id: 'getyourguide', name: 'GetYourGuide', connected: false },
    { id: 'viator', name: 'Viator', connected: false },
    { id: 'klook', name: 'Klook', connected: false },
    { id: 'expedia', name: 'Expedia', connected: false },
  ],

  destinations: {
    paris: {
      cityName: 'Paris, France', lat: 48.8566, lon: 2.3522, countryTeam: 'France', timezone: 'Europe/Paris',
      openingHours: { open: '09:30', close: '22:40' },
      products: [
        {
          id: 'DIS-PAR-01', name: 'Disneyland Park Paris — 1-Day Ticket',
          tagline: 'Step into the original Disneyland Park, right outside Paris.',
          description: "A full day across the park's five themed lands, with parades, classic rides and character meet-ups included in the base ticket.",
          included: ['Entry to Disneyland Park for 1 day', 'Access to parades and daytime shows', 'Free re-entry until park close'],
          status: 'Active', issue: 'None',
          price: 62, currency: '€',
          ticketOptions: [{ label: '1-Day, 1-Park', price: 62 }, { label: '1-Day, 2-Park', price: 87 }],
          rating: 4.6, reviews: 18500,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🏰', heroColor: '#0ea5e9',
          lastEditedBy: null,
        },
        {
          id: 'DIS-PAR-03', name: 'Disney Character Dining Experience',
          tagline: 'A sit-down meal with a rotating cast of Disney characters.',
          description: 'Includes a fixed menu, a photo moment with two characters, and a reserved table inside the park.',
          included: ['Fixed 3-course menu', 'Two character visits', 'Reserved seating'],
          status: 'Pending', issue: 'Missing SEO description',
          price: 79, currency: '€',
          ticketOptions: [{ label: 'Lunch seating', price: 79 }, { label: 'Dinner seating', price: 89 }],
          rating: 4.3, reviews: 640,
          cancellationPolicy: 'Free cancellation up to 48 hours before your reservation.',
          heroIcon: '🍽️', heroColor: '#0d9488',
          lastEditedBy: null,
        },
      ],
    },
    orlando: {
      cityName: 'Orlando, USA', lat: 28.3852, lon: -81.5639, countryTeam: 'United States', timezone: 'America/New_York',
      openingHours: { open: '09:00', close: '22:00' },
      products: [
        {
          id: 'DIS-ORL-01', name: 'Magic Kingdom — General Admission',
          tagline: 'The park behind Cinderella Castle — rides, parades and fireworks.',
          description: 'One admission covers all four themed lands and the evening fireworks show over the castle.',
          included: ['Entry to Magic Kingdom for 1 day', 'Evening fireworks show', 'Access to all open attractions'],
          status: 'Active', issue: 'None',
          price: 118, currency: '$',
          ticketOptions: [{ label: '1-Day', price: 118 }, { label: '2-Day', price: 225 }],
          rating: 4.7, reviews: 41210,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🎇', heroColor: '#0ea5e9',
          lastEditedBy: null,
        },
        {
          id: 'DIS-ORL-04', name: 'Cirque du Soleil: Drawn to Life',
          tagline: 'A Pixar-inspired acrobatic show, staged nightly near Disney Springs.',
          description: 'A 90-minute live circus performance blending acrobatics with animation-style storytelling.',
          included: ['Reserved theatre seat', '90-minute live show'],
          status: 'Pending', issue: 'Missing age policy field',
          price: 74, currency: '$',
          ticketOptions: [{ label: 'Standard seat', price: 74 }, { label: 'Front section', price: 99 }],
          rating: 4.5, reviews: 2100,
          cancellationPolicy: 'Free cancellation up to 24 hours before showtime.',
          heroIcon: '🎪', heroColor: '#0d9488',
          lastEditedBy: null,
        },
      ],
    },
    tokyo: {
      cityName: 'Tokyo, Japan', lat: 35.6329, lon: 139.8804, countryTeam: 'Japan', timezone: 'Asia/Tokyo',
      openingHours: { open: '09:00', close: '21:00' },
      products: [
        {
          id: 'DIS-TYO-01', name: 'Tokyo Disneyland — Passport Ticket',
          tagline: "Tokyo's original Disney park, styled after the classic Magic Kingdom.",
          description: "A full-day passport covering rides, parades and the park's seasonal night show.",
          included: ['1-day park entry', 'Parade & night show access'],
          status: 'Active', issue: 'None',
          price: 58, currency: '$',
          ticketOptions: [{ label: '1-Day', price: 58 }, { label: '2-Day', price: 104 }],
          rating: 4.6, reviews: 9800,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🎠', heroColor: '#0ea5e9',
          lastEditedBy: null,
        },
        {
          id: 'DIS-TYO-02', name: 'Tokyo DisneySea — Premium Entry',
          tagline: 'Seven nautical-themed ports, including the newest expansion.',
          description: "Premium entry gives timed access to the park's newest area alongside standard admission.",
          included: ['1-day park entry', 'Timed entry to newest zone'],
          status: 'Pending', issue: 'Missing localized copy (JA)',
          price: 68, currency: '$',
          ticketOptions: [{ label: 'Standard', price: 68 }, { label: 'Premium', price: 92 }],
          rating: 4.7, reviews: 3400,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🌊', heroColor: '#0d9488',
          lastEditedBy: null,
        },
      ],
    },
    anaheim: {
      cityName: 'Anaheim, USA', lat: 33.8121, lon: -117.9190, countryTeam: 'United States', timezone: 'America/Los_Angeles',
      openingHours: { open: '08:00', close: '22:00' },
      products: [
        {
          id: 'DIS-ANH-01', name: 'Disneyland Park — 1-Day Ticket',
          tagline: "Where it all started — Walt Disney's original park.",
          description: 'One-day admission to the original Disneyland park in California, including its classic attractions.',
          included: ['1-day park entry', 'Access to classic attractions'],
          status: 'Active', issue: 'None',
          price: 104, currency: '$',
          ticketOptions: [{ label: '1-Park', price: 104 }, { label: '2-Park hopper', price: 169 }],
          rating: 4.6, reviews: 15200,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🎡', heroColor: '#0ea5e9',
          lastEditedBy: null,
        },
        {
          id: 'DIS-ANH-02', name: 'Disney California Adventure Park',
          tagline: 'A separate park next door, built around thrill rides.',
          description: 'A second park with a strong focus on thrill rides and immersive themed lands.',
          included: ['1-day park entry'],
          status: 'Pending', issue: 'Missing ticket variant pricing',
          price: 104, currency: '$',
          ticketOptions: [{ label: '1-Park', price: 104 }],
          rating: 4.5, reviews: 8700,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🚀', heroColor: '#0d9488',
          lastEditedBy: null,
        },
      ],
    },
    hongkong: {
      cityName: 'Hong Kong', lat: 22.3130, lon: 114.0417, countryTeam: 'China', timezone: 'Asia/Hong_Kong',
      openingHours: { open: '10:30', close: '20:30' },
      products: [
        {
          id: 'DIS-HKG-01', name: 'Hong Kong Disneyland — 1-Day Ticket',
          tagline: 'A compact park mixing classic Disney lands with newer attractions.',
          description: 'One-day admission to Hong Kong Disneyland, including access to all themed zones.',
          included: ['1-day park entry'],
          status: 'Active', issue: 'None',
          price: 71, currency: '$',
          ticketOptions: [{ label: '1-Day', price: 71 }],
          rating: 4.5, reviews: 6200,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🐉', heroColor: '#0ea5e9',
          lastEditedBy: null,
        },
        {
          id: 'DIS-HKG-02', name: 'Hong Kong Disneyland — Early Access Ticket',
          tagline: 'Same park, an hour before general admission opens.',
          description: 'Includes standard park admission plus early entry to the most popular attractions.',
          included: ['1-day park entry', 'Early entry (60 min before opening)'],
          status: 'Pending', issue: 'Missing payment method mapping',
          price: 86, currency: '$',
          ticketOptions: [{ label: '1-Day + Early Access', price: 86 }],
          rating: 4.6, reviews: 340,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '⭐', heroColor: '#0d9488',
          lastEditedBy: null,
        },
      ],
    },
    shanghai: {
      cityName: 'Shanghai, China', lat: 31.1443, lon: 121.6577, countryTeam: 'China', timezone: 'Asia/Shanghai',
      openingHours: { open: '08:30', close: '20:30' },
      products: [
        {
          id: 'DIS-SHA-01', name: 'Shanghai Disney Resort — 1-Day Ticket',
          tagline: 'Home to the tallest Disney castle built to date.',
          description: "One-day admission to Shanghai Disney Resort, including the park's original attractions.",
          included: ['1-day park entry'],
          status: 'Pending', issue: 'Missing ticket variant pricing',
          price: 65, currency: '$',
          ticketOptions: [{ label: '1-Day', price: 65 }],
          rating: 4.6, reviews: 5100,
          cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
          heroIcon: '🐼', heroColor: '#0ea5e9',
          lastEditedBy: null,
        },
      ],
    },
  },
};

App.DB = {
  _cache: null,

  load() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(App.CONFIG.STORAGE_KEY);
      this._cache = raw ? JSON.parse(raw) : structuredClone(App.SEED_DB);
    } catch (e) {
      console.warn('DB load failed, reseeding.', e);
      this._cache = structuredClone(App.SEED_DB);
    }
    return this._cache;
  },

  save() {
    try {
      localStorage.setItem(App.CONFIG.STORAGE_KEY, JSON.stringify(this._cache));
    } catch (e) {
      console.warn('DB save failed (storage unavailable).', e);
    }
  },

  reset() {
    this._cache = structuredClone(App.SEED_DB);
    this.save();
  },

  logActivity(entry) {
    const db = this.load();
    db.activityLog.unshift({ id: `act-${Date.now()}`, time: new Date().toLocaleString('en-GB'), ...entry });
    db.activityLog = db.activityLog.slice(0, 30);
    this.save();
  },

  /** Overlays any locally-saved keys onto App.CONFIG. Called once on boot — this is the
   *  only place a real key ever lives: this browser's localStorage, never the committed code. */
  applyUserKeys() {
    const db = this.load();
    if (db.userKeys?.huggingface) App.CONFIG.HUGGINGFACE_TOKEN = db.userKeys.huggingface;
    if (db.userKeys?.footballData) App.CONFIG.FOOTBALL_DATA_TOKEN = db.userKeys.footballData;
  },

  saveUserKeys({ huggingface, footballData }) {
    const db = this.load();
    db.userKeys = { huggingface: huggingface || '', footballData: footballData || '' };
    this.save();
    this.applyUserKeys();
  },
};
