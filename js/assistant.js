window.App = window.App || {};

/**
 * Floating product assistant. With a Hugging Face token configured it
 * calls the Inference API; without one — or if that call fails or the
 * model is cold-loading — it falls back to a rule-based reply built
 * directly from the product data already in App.DB. Every reply is
 * tagged with its real source so this never overstates what answered.
 */
App.Assistant = {
  opened: false,
  history: [],

  // Swap this for a stronger instruct model if your HF account has one warm.
  model: 'google/flan-t5-base',

  ACTIONS: [
    { match: /seo description/i, action: 'Add a short description and 2-3 highlight bullets — Smart Ingestion or the description field both work — then save.' },
    { match: /age policy/i, action: 'Add an age / child policy line to the description or cancellation field before pushing this live.' },
    { match: /localized copy/i, action: 'Add a translated tagline and description for the local market before syncing to regional OTAs.' },
    { match: /ticket variant/i, action: "Add at least one more ticket option (e.g. a 2-day or premium variant) to match this destination's usual catalog shape." },
    { match: /payment method/i, action: 'Confirm local payment methods are enabled for this market before pushing to channels.' },
    { match: /awaiting review/i, action: 'Review the auto-filled fields from Smart Ingestion, then push to your connected channels.' },
  ],
  DEFAULT_ACTION: 'Open the product, fill in the missing field, save, then push it to your connected channels.',

  init() {
    document.getElementById('assistant-mode-tag').textContent =
      App.CONFIG.FOOTBALL_DATA_TOKEN || App.CONFIG.HUGGINGFACE_TOKEN ? 'Checking…' : 'Local fallback';
    document.getElementById('assistant-mode-tag').textContent = App.CONFIG.HUGGINGFACE_TOKEN
      ? 'Hugging Face + local fallback'
      : 'Local fallback (no HF key)';

    document.getElementById('assistant-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('assistant-input');
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this.send(q);
    });
  },

  toggle() {
    this.opened = !this.opened;
    document.getElementById('assistant-panel').classList.toggle('hidden', !this.opened);
    if (this.opened && !this.history.length) {
      this._addMessage('bot', this._greeting(), 'local');
    }
  },

  _greeting() {
    const products = this._currentProducts();
    const pending = products.filter(p => p.status !== 'Active');
    if (!pending.length) return "Every product in this destination is Active. Ask me about a specific product any time.";
    return `Hi, I'm looking at ${products.length} product(s) here. ${pending.length} need attention. Ask "what needs attention" or name a product.`;
  },

  _currentProducts() {
    const db = App.DB.load();
    const dest = db.destinations[App.Dashboard.currentKey];
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
        console.warn('Hugging Face call failed, using local fallback.', e);
        reply = { text: this._localReply(question), source: 'local' };
      }
    } else {
      reply = { text: this._localReply(question), source: 'local' };
    }

    this._updateMessage(thinkingId, reply.text, reply.source);
  },

  async _callHuggingFace(question) {
    const products = this._currentProducts();
    const context = products.map(p => `${p.id}: "${p.name}" — status ${p.status}, issue: ${p.issue}`).join('\n');
    const prompt = `You manage a ticketing catalog. Products:\n${context}\n\nQuestion: ${question}\nGive one short, specific recommended action.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${App.CONFIG.HUGGINGFACE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Hugging Face responded ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const text = Array.isArray(data) ? (data[0]?.generated_text || data[0]?.summary_text) : data.generated_text;
    if (!text) throw new Error('Empty response from model');
    return { text, source: 'huggingface' };
  },

  _localReply(question) {
    const products = this._currentProducts();
    const q = question.toLowerCase();

    const named = products.find(p =>
      q.includes(p.name.toLowerCase()) || q.includes(p.id.toLowerCase()) || p.name.toLowerCase().split(' ').some(w => w.length > 3 && q.includes(w))
    );
    if (named) return this._describeProduct(named);

    const genericMarkers = ['attention', 'missing', 'status', 'help', 'todo', 'wrong', 'what should'];
    if (!q || genericMarkers.some(m => q.includes(m))) {
      const pending = products.filter(p => p.status !== 'Active');
      if (!pending.length) return 'Everything here is Active — nothing needs attention right now.';
      return pending.map(p => `• ${p.name}: ${p.issue}. ${this._actionFor(p.issue)}`).join('\n');
    }

    return `I couldn't match a product to that. Try naming one directly, or ask "what needs attention".`;
  },

  _describeProduct(p) {
    if (p.status === 'Active') return `${p.name} is Active — live on all connected channels. No action needed.`;
    return `${p.name} is ${p.status}. Issue: ${p.issue}. ${this._actionFor(p.issue)}`;
  },

  _actionFor(issue) {
    const hit = this.ACTIONS.find(a => a.match.test(issue));
    return hit ? hit.action : this.DEFAULT_ACTION;
  },

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
