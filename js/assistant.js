window.App = window.App || {};

/**
 * Floating product assistant. With a Hugging Face token configured it
 * calls the Inference API (with recent turns for context). If that call
 * fails, the real reason is shown inline — gated/private models return
 * 403, models not hosted on the free serverless API return 404, a
 * cold-loading model returns 503 — rather than silently vanishing into
 * the local fallback with no explanation. The fallback itself reflects
 * the same live pricing signals shown on the dashboard, so open-ended
 * questions like "suggest a pricing strategy" get a real, current answer
 * instead of a canned non-reply.
 */
App.Assistant = {
  opened: false,
  history: [],
  lastProduct: null,

  // Calls the new Inference Providers router (api-inference.huggingface.co
  // was fully decommissioned — that old endpoint now fails DNS resolution
  // entirely, which is why this used to error with "hostname not found").
  // Meta's Llama models are gated: visit huggingface.co/<model> and accept
  // the license while logged in first, or any call 403s regardless of the
  // endpoint. If no provider currently serves this exact model, you'll get
  // a 404 — try appending ":provider" (e.g. ":together", ":groq") or swap
  // to a model you know is hosted. The chat will show you which of these
  // it is rather than guessing silently.
  model: 'meta-llama/Llama-3.1-8B-Instruct',

  SUGGESTIONS: [
    'What needs attention?',
    'Suggest a pricing strategy',
    'Which products are active?',
    "What's the cheapest ticket?",
  ],

  ACTIONS: [
    { match: /seo description/i, action: 'add a short description and 2-3 highlight bullets — Smart Ingestion or the description field both work — then save' },
    { match: /age policy/i, action: 'add an age / child policy line to the description or cancellation field before pushing this live' },
    { match: /localized copy/i, action: 'add a translated tagline and description for the local market before syncing to regional OTAs' },
    { match: /ticket variant/i, action: "add at least one more ticket option (e.g. a 2-day or premium variant) to match this destination's usual catalog shape" },
    { match: /payment method/i, action: 'confirm local payment methods are enabled for this market before pushing to channels' },
    { match: /awaiting review/i, action: 'review the auto-filled fields from Smart Ingestion, then push to your connected channels' },
  ],
  DEFAULT_ACTION: 'open the product, fill in the missing field, save, then push it to your connected channels',

  init() {
    this._updateModeTag();

    document.getElementById('assistant-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('assistant-input');
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this.send(q);
    });
  },

  _updateModeTag() {
    document.getElementById('assistant-mode-tag').textContent = App.CONFIG.HUGGINGFACE_TOKEN
      ? `Hugging Face (${this.model.split('/')[1] || this.model}) + local fallback`
      : 'Local fallback (no HF key)';
  },

  toggle() {
    this.opened = !this.opened;
    document.getElementById('assistant-panel').classList.toggle('hidden', !this.opened);
    if (this.opened && !this.history.length) {
      this._updateModeTag();
      this._addMessage('bot', this._greeting(), 'local');
      this._renderSuggestions();
    }
  },

  _renderSuggestions() {
    const host = document.getElementById('assistant-suggestions');
    if (!host) return;
    host.innerHTML = this.SUGGESTIONS.map(s => `<button type="button" class="suggestion-chip">${s}</button>`).join('');
    host.querySelectorAll('.suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => { host.innerHTML = ''; this.send(btn.textContent); });
    });
  },

  _greeting() {
    const products = this._currentProducts();
    const pending = products.filter(p => p.status !== 'Active');
    const dest = this._currentDest();
    const where = dest ? ` in ${dest.cityName}` : '';
    if (!pending.length) return `Hi! All ${products.length} product(s)${where} are Active. Try one of these, or ask me anything:`;
    return `Hi! I'm looking at ${products.length} product(s)${where}. ${pending.length} need attention. Try one of these, or ask anything:`;
  },

  _currentDest() {
    return App.DB.load().destinations[App.Dashboard.currentKey] || null;
  },

  _currentProducts() {
    const dest = this._currentDest();
    return dest ? dest.products : [];
  },

  async send(question) {
    this._addMessage('user', question);
    const thinkingId = this._addMessage('bot', '…', 'local');

    let reply;
    if (App.CONFIG.HUGGINGFACE_TOKEN) {
      try {
        reply = await this._callHuggingFace(question);
      } catch (e) {
        const diagnostic = this._explainHfError(e);
        reply = { text: `⚠️ ${diagnostic}\n\n${this._localReply(question)}`, source: 'local' };
      }
    } else {
      reply = { text: this._localReply(question), source: 'local' };
    }

    this._updateMessage(thinkingId, reply.text, reply.source);
  },

  _explainHfError(e) {
    const msg = e.message || String(e);
    if (msg.includes('403')) return `Hugging Face error 403 (forbidden) — "${this.model}" is likely gated. Visit huggingface.co/${this.model}, accept the license while logged in (a click, usually instant), and make sure your token has "Make calls to Inference Providers" permission. Local answer below:`;
    if (msg.includes('404')) return `Hugging Face error 404 — no provider currently serves "${this.model}" through Inference Providers. Check huggingface.co/${this.model} for which providers list it, or try appending one, e.g. "${this.model}:together". Local answer below:`;
    if (msg.includes('503')) return `Hugging Face error 503 — the model is cold-loading. Try again in ~20s. Local answer below:`;
    if (e.name === 'AbortError') return `Hugging Face request timed out after 15s. Local answer below:`;
    if (msg.includes('Failed to fetch') || msg.includes('Load failed') || msg.includes('hostname')) return `Network error reaching Hugging Face — if you opened this file directly (file://), try "npx serve" instead, since some browsers restrict cross-origin fetch from file:// pages. Local answer below:`;
    return `Hugging Face error: ${msg}. Local answer below:`;
  },

  async _callHuggingFace(question) {
    const products = this._currentProducts();
    const context = products.map(p => `${p.id}: "${p.name}" — ${p.status}, €${p.price}, issue: ${p.issue}`).join('\n');
    const systemPrompt = `You are a friendly, concise assistant for a ticketing supplier dashboard. Current catalog:\n${context}\n\nAnswer briefly and specifically, in 1-3 sentences unless asked for more.`;

    // this.history currently ends with [..., {user: question}, {bot: '…' placeholder}] —
    // exclude both since the question is added explicitly below.
    const priorTurns = this.history.slice(0, -2).slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
    const messages = [{ role: 'system', content: systemPrompt }, ...priorTurns, { role: 'user', content: question }];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      res = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${App.CONFIG.HUGGINGFACE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, max_tokens: 150, stream: false }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}${body ? ' — ' + body.slice(0, 200) : ''}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error)));

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from model');
    return { text, source: 'huggingface' };
  },

  // ---------- Conversational local fallback ----------
  _localReply(question) {
    const q = question.toLowerCase().trim();
    const products = this._currentProducts();

    if (/^(hi|hey|hello|ciao|yo)\b/.test(q)) return this._pick(["Hey! What do you want to know about the catalog?", "Hi there — ask me about a product, or what needs attention."]);
    if (/thank/.test(q)) return this._pick(["Anytime.", "You're welcome — let me know if anything else comes up.", "Happy to help."]);
    if (/^(bye|goodbye|see ya)/.test(q)) return "See you — I'll be here if you need anything else.";
    if (/how are you|how's it going/.test(q)) return "Running fine — more importantly, how's the catalog looking? Want a status summary?";

    if (/pricing strateg|price strateg|how should i price|pricing advice|pricing tip/.test(q)) {
      return this._pricingStrategyReply();
    }

    if (/how many|count/.test(q) && /product/.test(q)) {
      return `There ${products.length === 1 ? 'is' : 'are'} ${products.length} product(s) here: ${products.filter(p => p.status === 'Active').length} Active, ${products.filter(p => p.status !== 'Active').length} need work.`;
    }
    if (/which (ones? )?(are )?active/.test(q) || (/active/.test(q) && /which|what/.test(q))) {
      const active = products.filter(p => p.status === 'Active');
      return active.length ? `Active: ${active.map(p => p.name).join(', ')}.` : 'None are Active yet here.';
    }
    if (/most expensive|highest price/.test(q)) {
      const top = [...products].sort((a, b) => b.price - a.price)[0];
      return top ? `${top.name} at ${top.currency}${top.price}.` : "There's nothing in the catalog yet.";
    }
    if (/cheapest|lowest price/.test(q)) {
      const bottom = [...products].sort((a, b) => a.price - b.price)[0];
      return bottom ? `${bottom.name} at ${bottom.currency}${bottom.price}.` : "There's nothing in the catalog yet.";
    }

    const named = this._matchProduct(q, products);
    if (named) {
      this.lastProduct = named;
      if (/price|cost|how much/.test(q)) return `${named.name} is ${named.currency}${named.price}.`;
      if (/rating|review/.test(q)) return `${named.name}: ${named.rating}★ across ${named.reviews.toLocaleString('en-GB')} reviews.`;
      return this._describeProduct(named);
    }

    if (this.lastProduct && /\b(it|that one|this one|and the price|and status)\b/.test(q)) {
      if (/price/.test(q)) return `${this.lastProduct.name} is ${this.lastProduct.currency}${this.lastProduct.price}.`;
      return this._describeProduct(this.lastProduct);
    }

    const genericMarkers = ['attention', 'missing', 'status', 'help', 'todo', 'wrong', 'what should', 'pending', 'issue'];
    if (!q || genericMarkers.some(m => q.includes(m))) {
      const pending = products.filter(p => p.status !== 'Active');
      if (!pending.length) return 'Everything here is Active — nothing needs attention right now.';
      return pending.map(p => `• ${p.name}: ${p.issue} — ${this._actionFor(p.issue)}.`).join('\n');
    }

    const pending = products.filter(p => p.status !== 'Active');
    return `I don't have a scripted answer for that, but here's what's real right now: ${products.length} product(s), ${pending.length} pending. Try "suggest a pricing strategy", "what needs attention", or name a product.`;
  },

  /** Reflects the actual live pricing signals already computed on the dashboard — not a generic tip. */
  _pricingStrategyReply() {
    const dest = this._currentDest();
    if (!dest) return "Pick a destination first and I can read its live signals.";
    const weather = App.Dashboard.currentWeather;
    const events = App.Dashboard.currentEvents;
    const match = App.Dashboard.currentMatch;
    const bookingWindow = App.Dashboard.getBookingWindow();
    const staticCountdown = match
      ? (match.kickoffUtc.getTime() > Date.now() ? `kickoff in ${App.Dashboard._formatDuration(match.kickoffUtc.getTime() - Date.now())}` : 'kicked off')
      : null;
    const lines = App.Pricing.explainSignals(weather, events, bookingWindow, match, dest, { staticCountdown })
      .map(l => l.text.replace(/<[^>]+>/g, ''));

    const products = this._currentProducts();
    const sample = products.find(p => p.status === 'Active') || products[0];
    let priceLine = '';
    if (sample) {
      const s = App.Pricing.computeSuggestion(sample, weather, events, bookingWindow, match, dest);
      priceLine = `\n\nFor ${sample.name}: ${s.headline}, suggested ${sample.currency}${s.newPrice} (currently ${sample.currency}${sample.price}). Open it in Product Hub to apply.`;
    }
    return `Here's what's live right now for ${dest.cityName}:\n${lines.join('\n')}${priceLine}`;
  },

  _matchProduct(q, products) {
    return products.find(p =>
      q.includes(p.name.toLowerCase()) || q.includes(p.id.toLowerCase()) ||
      p.name.toLowerCase().split(' ').some(w => w.length > 3 && q.includes(w))
    );
  },

  _describeProduct(p) {
    if (p.status === 'Active') return `${p.name} is Active — live on all connected channels, ${p.currency}${p.price}. No action needed.`;
    return `${p.name} is ${p.status} at ${p.currency}${p.price}. Issue: ${p.issue} — ${this._actionFor(p.issue)}.`;
  },

  _actionFor(issue) {
    const hit = this.ACTIONS.find(a => a.match.test(issue));
    return hit ? hit.action : this.DEFAULT_ACTION;
  },

  _pick(options) {
    return options[Math.floor(Math.random() * options.length)];
  },

  // ---------- Rendering ----------
  _addMessage(role, text, source) {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.history.push({ id, role, text, source });
    const host = document.getElementById('assistant-messages');
    const tagHtml = source === 'huggingface' ? '<span class="msg-tag">🤗 Hugging Face</span>' : role === 'bot' ? '<span class="msg-tag">🔧 local</span>' : '';
    host.insertAdjacentHTML('beforeend', `
      <div class="msg msg-${role}" id="${id}">
        <div class="msg-bubble">${this._escapeAndBreak(text)}</div>
        ${tagHtml}
      </div>
    `);
    host.scrollTop = host.scrollHeight;
    return id;
  },

  _updateMessage(id, text, source) {
    const entry = this.history.find(m => m.id === id);
    if (entry) { entry.text = text; entry.source = source; }

    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.msg-bubble').innerHTML = this._escapeAndBreak(text);
    const tagHtml = source === 'huggingface' ? '<span class="msg-tag">🤗 Hugging Face</span>' : '<span class="msg-tag">🔧 local</span>';
    const existingTag = el.querySelector('.msg-tag');
    if (existingTag) existingTag.outerHTML = tagHtml; else el.insertAdjacentHTML('beforeend', tagHtml);
    document.getElementById('assistant-messages').scrollTop = document.getElementById('assistant-messages').scrollHeight;
  },

  _escapeAndBreak(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  },
};
