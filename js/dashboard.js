window.App = window.App || {};

App.Dashboard = {
  currentKey: 'paris',
  currentWeather: { tempC: 20, condition: 'Clear', isWet: false, live: false },
  currentEvents: [],
  currentMatch: null,
  lastUpdated: null,

  init() {
    const db = App.DB.load();
    this._populateDestinationSelector(db);
    document.getElementById('pricing-citation').textContent = App.Pricing.citation;
    App.Docs.init();
    document.getElementById('destination-selector')
      .addEventListener('change', (e) => this.loadDestination(e.target.value));
    document.getElementById('booking-window')
      .addEventListener('change', () => this._refreshPricingCard());
    document.getElementById('refresh-signals-btn')
      .addEventListener('click', () => this.refreshLiveData(true));
    document.getElementById('marketing-product-selector')
      .addEventListener('change', (e) => App.Marketing.renderProduct(this.currentKey, e.target.value));

    App.OTA.render();
    App.Assistant.init();

    const startKey = db.quiz.visitedVenueIds[0] || 'paris';
    document.getElementById('destination-selector').value = startKey;
    this.loadDestination(startKey);

    // Ticks the "updated Xs ago" label and the match countdown every few
    // seconds — this runs regardless of whether new data has arrived, so
    // the card visibly feels alive even between refreshes.
    setInterval(() => this._tickClock(), 5000);

    // Actually re-fetches weather/events/match periodically so the card
    // reflects reality, not just a snapshot taken once on tab switch.
    setInterval(() => this.refreshLiveData(false), 90000);
  },

  _populateDestinationSelector(db) {
    const sel = document.getElementById('destination-selector');
    const visited = new Set(db.quiz.visitedVenueIds || []);
    sel.innerHTML = Object.entries(db.destinations).map(([key, d]) => {
      const tag = visited.has(key) ? ' ★ your venue' : '';
      return `<option value="${key}">${d.cityName}${tag}</option>`;
    }).join('');
  },

  getBookingWindow() {
    const el = document.getElementById('booking-window');
    return el ? el.value : 'medium';
  },

  async loadDestination(key) {
    this.currentKey = key;
    const db = App.DB.load();
    const dest = db.destinations[key];

    document.getElementById('ctx-city-name').textContent = dest.cityName;
    document.getElementById('pricing-signals').innerHTML = '<p class="text-muted text-sm">Reading live weather, nearby events and fixtures…</p>';

    await this._fetchLiveData(dest);
    App.Editor.renderGrid(key);
    App.ApiHealth.renderForDestination(key);
    App.Marketing.renderForDestination(key);
  },

  /** Re-fetches weather/events/match for whichever destination is currently selected, without touching the product grid or API monitoring. */
  async refreshLiveData(userTriggered) {
    const dest = App.DB.load().destinations[this.currentKey];
    const btn = document.getElementById('refresh-signals-btn');
    if (userTriggered && btn) { btn.disabled = true; btn.textContent = '↻ Refreshing…'; }
    await this._fetchLiveData(dest);
    if (userTriggered && btn) { btn.disabled = false; btn.textContent = '↻ Refresh now'; }
  },

  async _fetchLiveData(dest) {
    const [weather, events, match] = await Promise.all([
      App.Weather.fetch(dest.lat, dest.lon),
      App.Events.fetchNearby(this.currentKey),
      App.WorldCup.fetchUpcoming(dest),
    ]);
    this.currentWeather = weather;
    this.currentEvents = events;
    this.currentMatch = match;
    this.lastUpdated = new Date();
    this._refreshPricingCard();
  },

  _refreshPricingCard() {
    const weather = this.currentWeather;
    const dest = App.DB.load().destinations[this.currentKey];
    const lines = App.Pricing.explainSignals(weather, this.currentEvents, this.getBookingWindow(), this.currentMatch, dest);

    document.getElementById('live-temp').textContent = `${weather.tempC}°C`;
    document.getElementById('weather-source').textContent = weather.live ? 'Live · Open-Meteo' : 'Fallback · live fetch failed';

    document.getElementById('pricing-signals').innerHTML = lines.map(l =>
      `<div class="signal-row"><span>${l.icon}</span><span>${l.text}</span></div>`
    ).join('');

    this._tickClock();
  },

  /** Updates only the fast-changing bits — relative "updated" time and match countdown — without refetching anything. */
  _tickClock() {
    const el = document.getElementById('signals-updated-at');
    if (el && this.lastUpdated) {
      const secs = Math.round((Date.now() - this.lastUpdated.getTime()) / 1000);
      el.textContent = secs < 5 ? 'just now' : secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;
    }

    const cd = document.getElementById('match-countdown');
    if (cd && this.currentMatch) {
      const ms = this.currentMatch.kickoffUtc.getTime() - Date.now();
      cd.textContent = ms > 0 ? `kickoff in ${this._formatDuration(ms)}` : 'kicked off';
    }
  },

  _formatDuration(ms) {
    const totalMin = Math.round(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  },
};
