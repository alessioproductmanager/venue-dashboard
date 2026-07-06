window.App = window.App || {};

/**
 * Lightweight "login" — a name and an avatar, nothing else. There is no
 * real auth here (no password, no backend); its only job is to attach a
 * human name to every edit and push so the activity log reads like a
 * real team log instead of an anonymous demo.
 */
App.Login = {
  selectedAvatar: null,

  init() {
    const db = App.DB.load();
    if (db.currentUser) {
      this._enterOnboarding();
      return;
    }
    this._render();
  },

  _render() {
    const grid = document.getElementById('avatar-grid');
    grid.innerHTML = App.AVATARS.map((a, i) =>
      `<button type="button" class="avatar-option" data-i="${i}" onclick="App.Login._pick(${i})">${a}</button>`
    ).join('');

    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });
  },

  _pick(i) {
    this.selectedAvatar = App.AVATARS[i];
    document.querySelectorAll('.avatar-option').forEach((el, idx) => el.classList.toggle('selected', idx === i));
    document.getElementById('avatar-preview').textContent = this.selectedAvatar;
  },

  _submit() {
    const nameInput = document.getElementById('login-name');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); App.UI.toast('Enter a name to continue.', 'error'); return; }
    if (!this.selectedAvatar) { App.UI.toast('Pick an icon first.', 'error'); return; }

    const db = App.DB.load();
    db.currentUser = { name, avatar: this.selectedAvatar };
    App.DB.save();
    this._enterOnboarding();
  },

  _enterOnboarding() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    App.Start.init();
  },
};
