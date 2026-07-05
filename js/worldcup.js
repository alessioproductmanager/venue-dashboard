window.App = window.App || {};

/**
 * Live World Cup fixtures via football-data.org (free tier covers the
 * FIFA World Cup under competition code "WC"). Falls back to a small
 * mocked fixture list when no token is configured or the request fails.
 * Every kickoff shown to the user is converted to the destination's own
 * IANA timezone via App.TZ — never the browser's.
 */
App.WorldCup = {
  async fetchUpcoming(dest) {
    const token = App.CONFIG.FOOTBALL_DATA_TOKEN;
    if (!token) return this._mockFor(dest);

    try {
      const from = new Date();
      const to = new Date(Date.now() + 10 * 24 * 3600 * 1000);
      const fmt = (d) => d.toISOString().slice(0, 10);
      const url = `https://api.football-data.org/v4/competitions/${App.CONFIG.TOURNAMENT_CODE}/matches?dateFrom=${fmt(from)}&dateTo=${fmt(to)}`;
      const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
      if (!res.ok) throw new Error(`football-data.org responded ${res.status}`);
      const data = await res.json();

      const matches = (data.matches || []).map(m => ({
        home: m.homeTeam?.name || 'TBD',
        away: m.awayTeam?.name || 'TBD',
        kickoffUtc: new Date(m.utcDate),
        live: true,
      }));
      return this._pickRelevant(matches, dest);
    } catch (e) {
      console.warn('World Cup fetch failed, using mock fixtures.', e);
      return this._mockFor(dest);
    }
  },

  _mockFor(dest) {
    const today = new Date();
    const mock = [
      { home: 'France', away: 'Brazil', daysOut: 1, hour: 21, minute: 0 },
      { home: 'United States', away: 'Argentina', daysOut: 2, hour: 20, minute: 0 },
      { home: 'Japan', away: 'Germany', daysOut: 4, hour: 19, minute: 0 },
    ].map(m => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + m.daysOut);
      return {
        home: m.home, away: m.away, live: false,
        kickoffUtc: App.TZ.zonedTimeToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), m.hour, m.minute, dest.timezone),
      };
    });
    return this._pickRelevant(mock, dest);
  },

  _pickRelevant(matches, dest) {
    if (!matches.length) return null;
    const relevant = matches.find(m => m.home === dest.countryTeam || m.away === dest.countryTeam);
    const chosen = relevant || matches[0];
    return {
      home: chosen.home,
      away: chosen.away,
      kickoffUtc: chosen.kickoffUtc,
      relevant: !!relevant,
      live: chosen.live,
      kickoffLabel: App.TZ.formatInZone(chosen.kickoffUtc, dest.timezone),
      timezone: dest.timezone,
    };
  },
};
