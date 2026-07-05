window.App = window.App || {};

/**
 * The core of the tool: a grid of product cards (Tiqets-style), and a
 * single modal that both creates and edits a product — form on one
 * side, a live preview styled after a real Tiqets product page on the
 * other, a pricing assistant, and a push panel. Smart Ingestion (paste a
 * URL, get a draft) lives inside the "add product" version of this same
 * modal instead of being a separate feature.
 */
App.Editor = {
  destKey: null,
  productId: null, // null while creating a new product
  draft: null,

  // ---------- Grid ----------
  renderGrid(destKey) {
    this.gridDestKey = destKey;
    const db = App.DB.load();
    const dest = db.destinations[destKey];
    const grid = document.getElementById('product-grid');

    grid.innerHTML = dest.products.map(p => this._cardHtml(destKey, p)).join('') + `
      <button type="button" class="product-card add-card" onclick="App.Editor.openNew('${destKey}')">
        <span class="add-icon">+</span>
        <span>Add product</span>
      </button>
    `;
  },

  _cardHtml(destKey, p) {
    const statusBadge = p.status === 'Active'
      ? `<span class="badge badge-success">Active</span>`
      : `<span class="badge badge-warning" title="${p.issue}">Needs attention</span>`;
    return `
      <button type="button" class="product-card" onclick="App.Editor.openEdit('${destKey}','${p.id}')">
        <div class="card-hero" style="background:linear-gradient(135deg, ${p.heroColor}, #0f172a);">
          <span class="card-hero-icon">${p.heroIcon}</span>
          <span class="card-rating">★ ${p.rating}</span>
        </div>
        <div class="card-body">
          <div class="card-title">${p.name}</div>
          <div class="card-tagline">${p.tagline}</div>
          <div class="card-footer-row">
            <span class="card-price">From ${p.currency}${p.price}</span>
            ${statusBadge}
          </div>
          ${p.lastEditedBy ? `<div class="card-edited-by">${p.lastEditedBy.avatar} edited by ${p.lastEditedBy.name}</div>` : ''}
        </div>
      </button>
    `;
  },

  // ---------- Open / close ----------
  openNew(destKey) {
    this.destKey = destKey;
    this.productId = null;
    this.draft = {
      id: null, name: 'New venue product', tagline: '', description: '',
      included: ['Entry ticket'], status: 'Pending', issue: 'Awaiting review',
      price: 50, currency: App.DB.load().destinations[destKey].products[0]?.currency || '€',
      ticketOptions: [], rating: 4.5, reviews: 0,
      cancellationPolicy: 'Free cancellation up to 24 hours before your visit date.',
      heroIcon: '🎟️', heroColor: '#0ea5e9', lastEditedBy: null, priceSchedule: {},
    };
    this._openModal(true);
  },

  openEdit(destKey, productId) {
    const db = App.DB.load();
    const product = db.destinations[destKey].products.find(p => p.id === productId);
    if (!product) return;
    this.destKey = destKey;
    this.productId = productId;
    this.draft = structuredClone(product);
    if (!this.draft.priceSchedule) this.draft.priceSchedule = {};
    this._openModal(false);
  },

  close() {
    document.getElementById('editor-modal').classList.add('hidden');
  },

  // ---------- Modal render ----------
  _openModal(isNew) {
    document.getElementById('editor-modal').classList.remove('hidden');
    document.getElementById('editor-modal-title').textContent = isNew ? 'Add product' : 'Edit product';

    document.getElementById('editor-ingestion-block').classList.toggle('hidden', !isNew);
    document.getElementById('push-panel').classList.toggle('hidden', isNew);

    this._fillForm();
    this._renderPreview();
    this._renderPricingAssistant();
    this._renderPriceCalendar();
    this._renderPushChannels();
    this._wireForm();
  },

  _fillForm() {
    const d = this.draft;
    document.getElementById('f-name').value = d.name;
    document.getElementById('f-tagline').value = d.tagline;
    document.getElementById('f-price').value = d.price;
    document.getElementById('f-currency').value = d.currency;
    document.getElementById('f-included').value = d.included.join('\n');
    document.getElementById('f-description').value = d.description;
    document.getElementById('f-cancellation').value = d.cancellationPolicy;
  },

  _wireForm() {
    const ids = ['f-name', 'f-tagline', 'f-price', 'f-currency', 'f-included', 'f-description', 'f-cancellation'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      el.oninput = () => { this._syncDraftFromForm(); this._renderPreview(); };
    });
    document.getElementById('ingestion-url').value = '';
    document.getElementById('save-btn').onclick = () => this.save();
    document.getElementById('apply-suggestion-btn').onclick = () => this.applySuggestion();
    document.getElementById('push-btn').onclick = () => this.pushCurrent();
    document.getElementById('run-ingestion-btn').onclick = () => this.runIngestion();
  },

  _syncDraftFromForm() {
    const d = this.draft;
    d.name = document.getElementById('f-name').value;
    d.tagline = document.getElementById('f-tagline').value;
    d.price = Number(document.getElementById('f-price').value) || 0;
    d.currency = document.getElementById('f-currency').value || '€';
    d.included = document.getElementById('f-included').value.split('\n').map(s => s.trim()).filter(Boolean);
    d.description = document.getElementById('f-description').value;
    d.cancellationPolicy = document.getElementById('f-cancellation').value;
  },

  // ---------- Smart ingestion (used only when adding a new product) ----------
  detectDestinationFromUrl(url) {
    const text = url.toLowerCase();
    const map = {
      paris: ['paris'], orlando: ['orlando', 'waltdisneyworld', 'wdw'], tokyo: ['tokyo'],
      anaheim: ['anaheim', 'californiaadventure'], hongkong: ['hongkong', 'hong-kong'], shanghai: ['shanghai'],
    };
    for (const [key, needles] of Object.entries(map)) {
      if (needles.some(n => text.includes(n))) return key;
    }
    return null;
  },

  async runIngestion() {
    const url = document.getElementById('ingestion-url').value.trim();
    const btn = document.getElementById('run-ingestion-btn');
    const note = document.getElementById('ingestion-note');
    if (!url) { App.UI.toast('Paste a venue URL first.', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Reading page…';
    await new Promise(r => setTimeout(r, 600));

    const key = this.detectDestinationFromUrl(url);
    if (key) {
      const dest = App.DB.load().destinations[key];
      const sample = dest.products[0];
      this.draft.name = `${sample.name.split('—')[0].trim()} — New Ticket Product`;
      this.draft.currency = sample.currency;
      this.draft.price = sample.price;
      this.draft.tagline = sample.tagline;
      this.destKey = key;
      note.textContent = `Detected "${dest.cityName}" — this product will be saved under ${dest.cityName}, with fields pre-filled from its catalog. Review before saving.`;
      note.className = 'field-hint';
    } else {
      note.textContent = "Couldn't match a known destination in that URL — fill in the fields manually.";
      note.className = 'field-hint';
    }
    this._fillForm();
    this._renderPreview();
    btn.disabled = false; btn.textContent = 'Generate draft';
  },

  // ---------- Preview (mirrors a real Tiqets product page, generic placeholders only) ----------
  _renderPreview() {
    const d = this.draft;
    const host = document.getElementById('editor-preview');
    host.innerHTML = `
      <div class="tiq-preview">
        <div class="tiq-hero" style="background:linear-gradient(135deg, ${d.heroColor}, #0f172a);">
          <span class="tiq-hero-icon">${d.heroIcon}</span>
        </div>
        <div class="tiq-gallery-dots">${Array.from({ length: 5 }, () => '<span></span>').join('')}</div>
        <div class="tiq-body">
          <div class="tiq-rating">★ ${d.rating} · ${d.reviews.toLocaleString('en-GB')} reviews</div>
          <h2 class="tiq-title">${d.name || 'Untitled product'}</h2>
          <p class="tiq-tagline">${d.tagline || ''}</p>

          <div class="tiq-price-box">
            <span class="tiq-price">From ${d.currency}${d.price}</span>
            <span class="tiq-price-sub">per person</span>
          </div>

          <div class="tiq-section">
            <div class="tiq-section-label">What's included</div>
            <ul class="tiq-list">${d.included.map(i => `<li>${i}</li>`).join('')}</ul>
          </div>

          <div class="tiq-section">
            <div class="tiq-section-label">Description</div>
            <p class="tiq-desc">${d.description || '—'}</p>
          </div>

          <div class="tiq-section">
            <div class="tiq-section-label">Cancellation policy</div>
            <p class="tiq-desc">${d.cancellationPolicy || '—'}</p>
          </div>
        </div>
      </div>
    `;
  },

  // ---------- Pricing assistant ----------
  _renderPricingAssistant() {
    const weather = App.Dashboard.currentWeather;
    const events = App.Dashboard.currentEvents;
    const match = App.Dashboard.currentMatch;
    const bookingWindow = App.Dashboard.getBookingWindow();
    const dest = App.DB.load().destinations[this.destKey];
    const suggestion = App.Pricing.computeSuggestion(this.draft, weather, events, bookingWindow, match, dest);
    document.getElementById('suggestion-text').textContent = suggestion.headline;
    document.getElementById('suggestion-price').textContent = `${this.draft.currency}${suggestion.newPrice}`;
    this._pendingSuggestion = suggestion;
  },

  applySuggestion() {
    if (!this._pendingSuggestion) return;
    this.draft.price = this._pendingSuggestion.newPrice;
    document.getElementById('f-price').value = this.draft.price;
    this._renderPreview();
    this._renderPriceCalendar();
    App.UI.toast('Suggested price applied — remember to save.', 'info');
  },

  // ---------- Price calendar ----------
  _renderPriceCalendar() {
    const host = document.getElementById('price-calendar');
    if (!host) return;
    const dest = App.DB.load().destinations[this.destKey];
    const days = App.Calendar.generate(this.draft, dest, App.Dashboard.currentEvents, App.Dashboard.currentMatch);
    const schedule = this.draft.priceSchedule || {};

    host.innerHTML = days.map(d => {
      const scheduled = schedule[d.dateKey];
      const weekdayLabel = d.date.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayLabel = d.date.getDate();
      return `
        <div class="cal-day cal-${d.tier}">
          <div class="cal-weekday">${weekdayLabel}</div>
          <div class="cal-daynum">${dayLabel}</div>
          <div class="cal-price">${this.draft.currency}${scheduled || d.suggestedPrice}</div>
          <div class="cal-meta">${d.availabilityPct}% left</div>
          <div class="cal-meta">${d.projectedSales} proj. sales</div>
          ${d.note ? `<div class="cal-note" title="${d.note}">${d.note}</div>` : ''}
          <button type="button" class="cal-apply ${scheduled ? 'scheduled' : ''}"
                  onclick="App.Editor.toggleSchedule('${d.dateKey}', ${d.suggestedPrice})">
            ${scheduled ? '📌 Scheduled' : 'Schedule'}
          </button>
        </div>
      `;
    }).join('');
  },

  toggleSchedule(dateKey, suggestedPrice) {
    if (!this.draft.priceSchedule) this.draft.priceSchedule = {};
    if (this.draft.priceSchedule[dateKey]) {
      delete this.draft.priceSchedule[dateKey];
    } else {
      this.draft.priceSchedule[dateKey] = suggestedPrice;
    }
    this._renderPriceCalendar();
  },

  // ---------- Push channel picker ----------
  _renderPushChannels() {
    const host = document.getElementById('push-channel-list');
    if (!host) return;
    const channels = App.DB.load().otaChannels;
    host.innerHTML = channels.map(ch => `
      <label class="push-channel-row ${ch.connected ? '' : 'disabled'}">
        <input type="checkbox" data-channel-id="${ch.id}" ${ch.connected ? 'checked' : 'disabled'}>
        <span>${ch.name}</span>
        ${ch.connected ? '' : '<span class="connect-hint">Connect in Channel Sync</span>'}
      </label>
    `).join('');
  },

  _selectedChannels() {
    const checked = Array.from(document.querySelectorAll('#push-channel-list input[type="checkbox"]:checked'));
    const ids = checked.map(c => c.dataset.channelId);
    return App.DB.load().otaChannels.filter(ch => ids.includes(ch.id));
  },

  // ---------- Save / push ----------
  save() {
    this._syncDraftFromForm();
    const db = App.DB.load();
    const user = db.currentUser;
    this.draft.lastEditedBy = user;

    if (this.productId) {
      const dest = db.destinations[this.destKey];
      const idx = dest.products.findIndex(p => p.id === this.productId);
      dest.products[idx] = this.draft;
      App.DB.logActivity({ user, action: 'edited', productName: this.draft.name, destKey: this.destKey, channels: [] });
    } else {
      const dest = db.destinations[this.destKey];
      const num = String(dest.products.length + 1).padStart(2, '0');
      this.draft.id = `DIS-${this.destKey.slice(0, 3).toUpperCase()}-${num}`;
      dest.products.push(this.draft);
      this.productId = this.draft.id;
      App.DB.logActivity({ user, action: 'added', productName: this.draft.name, destKey: this.destKey, channels: [] });
    }
    App.DB.save();

    if (this.destKey !== this.gridDestKey) {
      document.getElementById('destination-selector').value = this.destKey;
      App.Dashboard.loadDestination(this.destKey);
    } else {
      App.Editor.renderGrid(this.gridDestKey);
    }
    App.OTA.renderActivity();
    document.getElementById('push-panel').classList.remove('hidden');
    document.getElementById('editor-ingestion-block').classList.add('hidden');
    document.getElementById('editor-modal-title').textContent = 'Edit product';
    App.UI.toast('Saved. Ready to push to your connected channels.', 'success');
  },

  async pushCurrent() {
    const log = document.getElementById('push-log');
    const btn = document.getElementById('push-btn');
    const channels = this._selectedChannels();
    log.innerHTML = '';
    btn.disabled = true; btn.textContent = 'Pushing…';

    const ok = await App.OTA.pushProduct(this.destKey, this.draft, channels, (ch) => {
      const time = App.UI.timeNow();
      log.insertAdjacentHTML('beforeend', `<div class="log-line"><span class="log-time">${time}</span><span>→ ${ch.name}: updated.</span></div>`);
    });

    btn.disabled = false; btn.textContent = 'Push selected channels';
    if (ok) App.UI.toast('Pushed to selected channels.', 'success');
  },
};
