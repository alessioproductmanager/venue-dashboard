window.App = window.App || {};

/**
 * Renders the "Connected services" list on the Read Me tab. Reads
 * App.CONFIG directly so this reflects reality: paste a real
 * football-data.org token in and this list flips that row to Live
 * without anything else needing to change.
 */
App.Docs = {
  init() {
    const db = App.DB.load();
    document.getElementById('key-huggingface').value = db.userKeys?.huggingface || '';
    document.getElementById('key-footballdata').value = db.userKeys?.footballData || '';

    document.getElementById('keys-form').addEventListener('submit', (e) => {
      e.preventDefault();
      App.DB.saveUserKeys({
        huggingface: document.getElementById('key-huggingface').value.trim(),
        footballData: document.getElementById('key-footballdata').value.trim(),
      });
      this.render();
      document.getElementById('assistant-mode-tag').textContent = App.CONFIG.HUGGINGFACE_TOKEN
        ? 'Hugging Face + local fallback' : 'Local fallback (no HF key)';
      App.UI.toast('Keys saved to this browser only.', 'success');
    });

    document.getElementById('keys-clear-btn').addEventListener('click', () => {
      document.getElementById('key-huggingface').value = '';
      document.getElementById('key-footballdata').value = '';
      App.DB.saveUserKeys({ huggingface: '', footballData: '' });
      App.CONFIG.HUGGINGFACE_TOKEN = '';
      App.CONFIG.FOOTBALL_DATA_TOKEN = '';
      this.render();
      document.getElementById('assistant-mode-tag').textContent = 'Local fallback (no HF key)';
      App.UI.toast('Keys cleared.', 'info');
    });

    this.render();
  },

  render() {
    const host = document.getElementById('readme-services');
    if (!host) return;

    const rows = [
      { name: 'Weather', detail: 'Open-Meteo — current temperature & conditions per destination', live: true },
      { name: 'Nearby events', detail: 'Fixed demo dataset (js/events.js)', live: false },
      {
        name: 'World Cup fixtures',
        detail: App.CONFIG.FOOTBALL_DATA_TOKEN
          ? 'football-data.org — live fixtures for the configured token'
          : 'No token configured — showing demo fixtures (js/worldcup.js)',
        live: !!App.CONFIG.FOOTBALL_DATA_TOKEN,
      },
      { name: 'Smart Ingestion', detail: 'Keyword match on the pasted URL text, not real scraping', live: false },
      { name: 'OTA connect (GetYourGuide, Viator, Klook, Expedia)', detail: 'Mock OAuth — no real partner credentials', live: false },
      { name: 'Push to channels', detail: 'Simulated network round trip per channel', live: false },
      { name: 'API Monitoring', detail: 'Client-side random simulation, labeled "demo only" in the UI', live: false },
      { name: 'Login', detail: 'Name + icon only, no password, no server — a label for the activity feed', live: false },
    ];

    host.innerHTML = rows.map(r => `
      <div class="signal-row">
        <span class="badge ${r.live ? 'badge-success' : 'badge-neutral'}" style="flex-shrink:0; width:52px; text-align:center;">${r.live ? 'LIVE' : 'MOCK'}</span>
        <span><strong>${r.name}</strong> — <span class="text-muted">${r.detail}</span></span>
      </div>
    `).join('');
  },
};
