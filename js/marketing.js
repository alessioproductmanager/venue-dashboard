window.App = window.App || {};

/**
 * Marketing Packages — lets a supplier buy visibility budget for one
 * product across Google/Meta/TikTok. Everything here is a demo: no real
 * ad platform is connected, no payment is processed. The "AI suggestion"
 * is a small rule-based read of the product's own data (status, review
 * count) — not a model call — because a recommendation like this needs
 * to be reproducible and explainable in a sales conversation, which a
 * black-box call wouldn't buy us here.
 */
App.Marketing = {
  currentProductId: null,

  TIERS: [
    {
      id: 'starter', name: 'Starter', price: 150, period: '/month',
      channels: ['Google Search'],
      impressions: '+8,000/mo', ctr: '+5% click-through', sales: '+3–5 bookings/mo',
      blurb: 'Search visibility for people already looking for this venue.',
    },
    {
      id: 'growth', name: 'Growth', price: 450, period: '/month',
      channels: ['Google Search', 'Meta (Instagram + Facebook)'],
      impressions: '+35,000/mo', ctr: '+9% click-through', sales: '+10–16 bookings/mo',
      blurb: "Adds visual retargeting for people who viewed but didn't book.",
      featured: true,
    },
    {
      id: 'premium', name: 'Premium', price: 950, period: '/month',
      channels: ['Google Search', 'Meta (Instagram + Facebook)', 'TikTok'],
      impressions: '+90,000/mo', ctr: '+14% click-through', sales: '+22–30 bookings/mo',
      blurb: "Adds short-form video reach for discovery beyond people already searching.",
    },
  ],

  renderForDestination(destKey) {
    const db = App.DB.load();
    const dest = db.destinations[destKey];
    const sel = document.getElementById('marketing-product-selector');
    sel.innerHTML = dest.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    this.currentProductId = dest.products[0]?.id || null;
    if (this.currentProductId) this.renderProduct(destKey, this.currentProductId);
  },

  renderProduct(destKey, productId) {
    this.currentProductId = productId;
    this.destKey = destKey;
    const product = this._product(destKey, productId);
    if (!product) return;

    document.getElementById('marketing-ai-suggestion').innerHTML = this._suggestionHtml(product);

    document.getElementById('marketing-tiers').innerHTML = this.TIERS.map(t => `
      <div class="tier-card ${t.featured ? 'tier-featured' : ''}">
        ${t.featured ? '<div class="tier-badge">Most picked</div>' : ''}
        <div class="tier-name">${t.name}</div>
        <div class="tier-price">€${t.price}<span class="tier-period">${t.period}</span></div>
        <p class="tier-blurb">${t.blurb}</p>
        <ul class="tier-list">
          <li><strong>${t.impressions}</strong> impressions</li>
          <li><strong>${t.ctr}</strong></li>
          <li><strong>${t.sales}</strong> projected</li>
        </ul>
        <div class="tier-channels">${t.channels.map(c => `<span class="tag">${c}</span>`).join('')}</div>
        <button class="btn ${t.featured ? 'btn-primary' : 'btn-outline'} btn-block" type="button"
                onclick="App.Marketing.openCheckout('${t.id}')">Buy ${t.name}</button>
      </div>
    `).join('');
  },

  _product(destKey, productId) {
    return App.DB.load().destinations[destKey]?.products.find(p => p.id === productId);
  },

  /** Rule-based, explainable — reads the product's own data rather than calling a model. */
  _suggestionHtml(product) {
    let tierId, reason;
    if (product.status !== 'Active') {
      tierId = 'starter'; reason = `${product.name} is still ${product.status.toLowerCase()} — get the listing live and searchable before spending on wider reach.`;
    } else if (product.reviews < 1000) {
      tierId = 'growth'; reason = `Only ${product.reviews.toLocaleString('en-GB')} reviews so far — Growth adds retargeting to convert people who've already seen the listing.`;
    } else {
      tierId = 'premium'; reason = `Strong review base (${product.reviews.toLocaleString('en-GB')}) — Premium's TikTok reach targets people who haven't discovered it yet, not just search intent.`;
    }
    const tier = this.TIERS.find(t => t.id === tierId);
    return `<span class="badge badge-info">Suggested: ${tier.name}</span> <span class="text-sm">${reason}</span>`;
  },

  // ---------- Checkout (demo) ----------
  openCheckout(tierId) {
    const tier = this.TIERS.find(t => t.id === tierId);
    const product = this._product(this.destKey, this.currentProductId);
    this._checkoutTier = tier;

    document.getElementById('checkout-summary').innerHTML = `
      <div class="signal-row"><span>📦</span><span><strong>${tier.name}</strong> — €${tier.price}${tier.period}</span></div>
      <div class="signal-row"><span>🎟️</span><span>${product.name}</span></div>
      <div class="signal-row"><span>📡</span><span>${tier.channels.join(' · ')}</span></div>
    `;
    document.getElementById('checkout-modal').classList.remove('hidden');
    document.getElementById('checkout-success').classList.add('hidden');
    document.getElementById('checkout-form').classList.remove('hidden');
  },

  closeCheckout() {
    document.getElementById('checkout-modal').classList.add('hidden');
  },

  confirmPurchase(event) {
    event.preventDefault();
    const product = this._product(this.destKey, this.currentProductId);
    const db = App.DB.load();

    App.DB.logActivity({
      user: db.currentUser,
      action: 'purchased',
      productName: `${this._checkoutTier.name} marketing package for ${product.name}`,
      destKey: this.destKey,
      channels: this._checkoutTier.channels,
    });
    App.OTA.renderActivity();

    document.getElementById('checkout-form').classList.add('hidden');
    document.getElementById('checkout-success').classList.remove('hidden');
  },
};
