const config = require('./config');

class EventCache {
  constructor() {
    this.events = new Map(); // eventId -> { event, addedAt }
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    this.lastAnnounceTime = 0;
  }

  add(event) {
    if (this.events.size >= config.CACHE_MAX_EVENTS) {
      // LRU: remove oldest
      const oldest = this.events.keys().next().value;
      this.events.delete(oldest);
    }
    this.events.set(event.id, { event, addedAt: Date.now() });
  }

  get(eventId) {
    const entry = this.events.get(eventId);
    return entry ? entry.event : null;
  }

  has(eventId) {
    return this.events.has(eventId);
  }

  getEventIds() {
    return Array.from(this.events.keys());
  }

  // v2: Return events with metadata for announce
  getEventsWithMeta(incrementalOnly) {
    var cutoff = incrementalOnly ? this.lastAnnounceTime : 0;
    var result = [];
    for (var [id, entry] of this.events) {
      if (entry.addedAt > cutoff && entry.event) {
        result.push({
          id: entry.event.id,
          pubkey: entry.event.pubkey || '',
          kind: entry.event.kind || 0,
          created_at: entry.event.created_at || 0,
        });
      }
    }
    this.lastAnnounceTime = Date.now();
    return result;
  }

  size() {
    return this.events.size;
  }

  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of this.events) {
      if (now - entry.addedAt > config.CACHE_TTL) {
        this.events.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      console.log('[cache] cleaned ' + removed + ' expired events, ' + this.events.size + ' remaining');
    }
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.events.clear();
  }
}

module.exports = { EventCache };
