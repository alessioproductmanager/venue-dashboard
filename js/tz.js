window.App = window.App || {};

/**
 * Small timezone helpers, dependency-free. Native JS has no built-in for
 * "what's the wall-clock time in this IANA zone right now" or its
 * inverse, so this wraps Intl.DateTimeFormat to provide both.
 */
App.TZ = {
  /** Formats an absolute instant in a given IANA timezone, e.g. "Mon 21:00". */
  formatInZone(date, timeZone, opts) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone, ...opts,
    }).format(date);
  },

  /** Current wall-clock time in a given IANA zone, as {hour, minute, weekdayIdx (0=Sun)}. */
  nowInZone(timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short',
    });
    const parts = dtf.formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { hour: Number(parts.hour), minute: Number(parts.minute), weekday: parts.weekday, weekdayIdx: weekdays.indexOf(parts.weekday) };
  },

  /** Offset in minutes between UTC and the given zone, at the given instant (handles DST correctly). */
  getUtcOffsetMinutes(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = dtf.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return (asUtc - date.getTime()) / 60000;
  },

  /** Converts a wall-clock date+time *in a given IANA timezone* into a real UTC Date instant. */
  zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
    const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const offsetMinutes = this.getUtcOffsetMinutes(guess, timeZone);
    return new Date(guess.getTime() - offsetMinutes * 60000);
  },
};
