window.App = window.App || {};

/**
 * Rule-based pricing suggestions — not a real ML model. Grounded in a few
 * well-documented real-world practices (see README): museums and theme
 * parks already vary price by date, weather and nearby events; venues
 * tend to frame these moves as off-peak savings rather than surcharges,
 * because that framing is what visitors accept; and advance purchase is
 * usually rewarded rather than penalized.
 */
App.Pricing = {
  citation: 'Similar in spirit to how Disney already varies its own ticket prices by calendar date, and how venues like the Empire State Building adjust prices live using demand, weather and nearby events.',

  isIndoorLike(product) {
    return /dining|cirque|show|theatre|theater/i.test(`${product.name} ${product.tagline || ''}`);
  },

  explainSignals(weather, events, bookingWindow, match, dest) {
    const lines = [];

    if (dest) {
      const open = App.Hours.isOpenNow(dest);
      lines.push({
        icon: open ? '🟢' : '⚪',
        text: `${dest.cityName.split(',')[0]} is ${open ? 'open now' : 'closed now'} (${dest.openingHours.open}–${dest.openingHours.close} local, typical hours). ${open ? 'Live signals below are acting on today\'s visit window.' : "Outside opening hours right now — today's signals matter most for tomorrow's pricing."}`,
      });
    }

    if (weather.isWet) {
      lines.push({ icon: '🌧️', text: 'Rain forecast. Outdoor tickets typically see softer demand in this window — indoor experiences (dining, shows) usually hold or gain.' });
    } else {
      lines.push({ icon: '☀️', text: 'Weather is favorable — no weather-driven adjustment needed.' });
    }

    const highImpact = events.find(e => e.impact === 'high');
    if (highImpact) {
      lines.push({ icon: '🎫', text: `${highImpact.name} nearby (${highImpact.distanceKm} km) — expect a visitor spike, the kind of window venues usually reserve for premium-only availability.` });
    } else if (events.length) {
      lines.push({ icon: '📍', text: `${events[0].name} nearby (${events[0].distanceKm} km) — a moderate uplift is plausible, worth monitoring rather than acting on yet.` });
    }

    if (match) {
      const tag = match.live ? '' : ' (demo fixture)';
      const countdown = ` · <span id="match-countdown" class="mono"></span>`;
      const duringHours = dest ? App.Hours.isOpenAt(dest, match.kickoffUtc) : true;
      if (!duringHours) {
        lines.push({ icon: '⚽', text: `${match.home} vs ${match.away} — ${match.kickoffLabel} local time${tag}${countdown}. Kicks off outside opening hours — limited pricing impact for this venue.` });
      } else if (match.relevant) {
        lines.push({ icon: '⚽', text: `${match.home} vs ${match.away} — ${match.kickoffLabel} local time${tag}${countdown}, while the park is open. The local team is playing: expect a dip around kickoff as visitors stay in to watch rather than come to the park.` });
      } else {
        lines.push({ icon: '⚽', text: `${match.home} vs ${match.away} — ${match.kickoffLabel} local time${tag}${countdown}, while the park is open. A smaller, broader dip is plausible during the match itself.` });
      }
    }

    if (bookingWindow === 'far') {
      lines.push({ icon: '🗓️', text: 'Booked a month or more out — this is where a modest early-bird saving locks in demand without giving up much margin.' });
    } else if (bookingWindow === 'soon') {
      lines.push({ icon: '⏱️', text: 'Booked within days — this close to the date, most venues hold price steady or firm it up rather than discount further.' });
    }

    return lines;
  },

  /** Computes one concrete suggested price for the product currently open in the editor. */
  computeSuggestion(product, weather, events, bookingWindow, match, dest) {
    let deltaPct = 0;
    const reasons = [];
    const indoor = this.isIndoorLike(product);

    if (weather.isWet) {
      if (indoor) { deltaPct += 12; reasons.push('rain lifting indoor demand'); }
      else { deltaPct -= 8; reasons.push('rain softening outdoor demand'); }
    }

    const highImpact = events.find(e => e.impact === 'high');
    if (highImpact) { deltaPct += 15; reasons.push(`${highImpact.name} nearby`); }

    const matchDuringHours = match && dest ? App.Hours.isOpenAt(dest, match.kickoffUtc) : !!match;
    if (match && match.relevant && matchDuringHours) { deltaPct -= 6; reasons.push(`${match.home} vs ${match.away} kickoff pulling local demand away`); }

    if (bookingWindow === 'far') { deltaPct -= 5; reasons.push('early-bird window'); }
    if (bookingWindow === 'soon' && !highImpact) { deltaPct += 0; } // hold steady, no reason needed

    deltaPct = Math.max(-20, Math.min(25, deltaPct));
    const newPrice = Math.round(product.price * (1 + deltaPct / 100));

    return {
      deltaPct,
      newPrice,
      headline: reasons.length
        ? `${deltaPct >= 0 ? '+' : ''}${deltaPct}% — ${reasons.join(', ')}`
        : 'No change suggested — current price already fits the context',
    };
  },
};
