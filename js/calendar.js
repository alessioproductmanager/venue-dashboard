window.App = window.App || {};

/**
 * Generates a 14-day demand/price outlook for one product. Deterministic
 * per product+date (seeded PRNG) so the same day shows the same tier
 * every time you open the editor, rather than reshuffling on each render.
 * Demo capacity/availability/sales numbers — no real inventory system
 * exists behind this — but the demand tiers do react to the same real
 * weekend pattern, and to the same event/match signals already on the
 * dashboard, so the two views agree with each other.
 */
App.Calendar = {
  DAYS: 14,
  BASE_CAPACITY: 60, // demo daily capacity used to derive a plausible sales number

  generate(product, dest, events, match) {
    const today = new Date();
    const eventDay = events && events.length ? events[0] : null;
    const matchDayOffset = match ? this._dayOffsetInZone(match.kickoffUtc, dest.timezone) : null;

    const days = [];
    for (let i = 0; i < this.DAYS; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const seed = this._hash(`${product.id}:${date.toISOString().slice(0, 10)}`);
      const rand = this._seededRandom(seed);
      const weekdayIdx = date.getDay(); // 0=Sun..6=Sat
      const isWeekend = weekdayIdx === 0 || weekdayIdx === 6 || weekdayIdx === 5;

      let score = rand + (isWeekend ? 0.22 : 0);
      let note = null;

      if (eventDay && i === 2) { score += 0.28; note = eventDay.name; } // demo events land ~2 days out
      if (matchDayOffset === i && match.relevant) { score -= 0.22; note = `${match.home} vs ${match.away}`; }

      score = Math.max(0, Math.min(1, score));
      const tier = score < 0.35 ? 'low' : score < 0.65 ? 'medium' : 'high';
      const multiplier = { low: 0.90, medium: 1.0, high: 1.15 }[tier];
      const suggestedPrice = Math.round(product.price * multiplier);
      const availabilityPct = Math.round(tier === 'high' ? 12 + rand * 20 : tier === 'low' ? 60 + rand * 30 : 32 + rand * 25);
      const projectedSales = Math.round(((100 - availabilityPct) / 100) * this.BASE_CAPACITY);

      days.push({
        date, tier, suggestedPrice, availabilityPct, projectedSales, note,
        dateKey: date.toISOString().slice(0, 10),
        isWeekend,
      });
    }
    return days;
  },

  _dayOffsetInZone(date, timeZone) {
    const dateKeyInZone = (d) => new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d); // en-CA renders as YYYY-MM-DD
    const todayDate = new Date(`${dateKeyInZone(new Date())}T00:00:00Z`);
    const targetDate = new Date(`${dateKeyInZone(date)}T00:00:00Z`);
    return Math.round((targetDate - todayDate) / 86400000);
  },

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h >>> 0;
  },

  _seededRandom(seed) {
    // mulberry32
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
};
