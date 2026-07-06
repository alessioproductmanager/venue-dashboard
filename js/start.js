window.App = window.App || {};

/**
 * The old onboarding was a 3-step trivia quiz. Replaced with a single
 * choice, styled like a plain search-engine or AI-assistant homepage:
 * one question, the real destinations as options, done. Returning
 * visitors skip straight to the dashboard, same as before.
 */
App.Start = {
  init() {
    const db = App.DB.load();
    if (db.start.completed) {
      this._enterApp();
      return;
    }
    this._render();
  },

  _render() {
    const db = App.DB.load();
    const host = document.getElementById('start-options');
    host.innerHTML = Object.entries(db.destinations).map(([key, d]) => {
      const icon = d.products[0]?.heroIcon || '📍';
      return `
        <button type="button" class="start-option" onclick="App.Start.choose('${key}')">
          <span class="start-option-icon">${icon}</span>
          <span class="start-option-label">${d.cityName}</span>
        </button>
      `;
    }).join('');
  },

  choose(key) {
    const db = App.DB.load();
    db.start.completed = true;
    db.start.chosenKey = key;
    App.DB.save();
    this._enterApp();
  },

  _enterApp() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    App.Dashboard.init();
  },
};
