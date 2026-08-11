var config = require('./config');

function PeerProtocol(connection, cache, webrtc) {
  this.conn = connection;
  this.cache = cache;
  this.webrtc = webrtc;
  this.peerId = null;
  this.status = 'disconnected';
  this.announceTimer = null;
  this.eventsReceived = 0;
  this.firstAnnounce = true;
}

PeerProtocol.prototype.register = function() {
  this.conn.send(['PEER_REGISTER', {
    bandwidth: config.PEER_BANDWIDTH,
    storage: config.PEER_STORAGE,
    publicKey: config.PUBLIC_KEY,
    nodeType: config.NODE_TYPE,
  }]);
  console.log('[peer] registering as server peer...');
};

PeerProtocol.prototype.handleMessage = function(msg) {
  if (!Array.isArray(msg) || msg.length < 1) return;

  var type = msg[0];
  var payload = msg[1] || {};

  switch (type) {
    case 'PEER_REGISTERED':
      this.peerId = payload.peer_id;
      this.status = 'registered';
      console.log('[peer] registered! id=' + this.peerId);
      this.firstAnnounce = true;
      this.startAnnouncing();
      this.announceCache();
      break;

    case 'PEER_HEARTBEAT_ACK':
      break;

    case 'PEER_PROMOTED':
      this.status = 'super_peer';
      console.log('[peer] PROMOTED to Super Peer! reason=' + payload.reason);
      break;

    case 'PEER_DEMOTED':
      this.status = 'registered';
      console.log('[peer] demoted: ' + payload.reason);
      break;

    case 'PEER_EVENT_NEW':
      this.onNewEvent(payload);
      break;

    case 'PEER_OFFER':
      console.log('[peer] received PEER_OFFER');
      break;

    case 'PEER_SIGNAL_RELAY':
      if (this.webrtc && payload.from_peer && payload.signal_data) {
        this.webrtc.handleSignal(payload.from_peer, payload.signal_data).catch(function(e) { console.error("[peer] signal error:", e.message); });
      }
      break;

    case 'PEER_RECONNECT':
      console.log('[peer] received PEER_RECONNECT, re-announcing cache...');
      this.firstAnnounce = true;
      this.announceCache();
      break;

    case 'PEER_STATS_OK':
      break;

    case 'PEER_ERROR':
      console.error('[peer] error: ' + payload.message);
      if (payload.action === 're-register') {
        console.log('[peer] re-registering...');
        this.register();
      }
      // Se peer alvo desconectou, abortar WebRTC para parar de gerar ICE candidates
      if (payload.message === 'target_peer not found' && payload.target_peer && this.webrtc) {
        console.log('[peer] aborting WebRTC with dead peer ' + payload.target_peer.slice(0, 8));
        this.webrtc.cleanupPeer(payload.target_peer);
      }
      break;

    default:
      break;
  }
};

PeerProtocol.prototype.onNewEvent = function(payload) {
  if (!payload.event || !payload.event.id) return;

  var event = payload.event;
  if (!this.cache.has(event.id)) {
    this.cache.add(event);
    this.eventsReceived++;
    if (this.eventsReceived % 10 === 0) {
      console.log('[peer] cached ' + this.eventsReceived + ' events total (' + this.cache.size() + ' in cache)');
    }
  }
};

PeerProtocol.prototype.announceCache = function() {
  // v2: send metadata with announce (incremental after first)
  var incremental = !this.firstAnnounce;
  var events = this.cache.getEventsWithMeta(incremental);
  this.firstAnnounce = false;

  if (events.length === 0) return;

  // Send in batches of 200
  for (var i = 0; i < events.length; i += 200) {
    var batch = events.slice(i, i + 200);
    this.conn.send(['PEER_CACHE_HAVE', { events: batch }]);
  }
  console.log('[peer] announced ' + events.length + ' cached events (v2' + (incremental ? ', incremental' : ', full') + ')');
};

PeerProtocol.prototype.reportStats = function() {
  var webrtcStats = this.webrtc ? this.webrtc.getStats() : { eventsServed: 0, bytesTransferred: 0, activePeers: 0, recentServedIds: [] };
  var payload = {
    events_served: webrtcStats.eventsServed,
    bytes_transferred: webrtcStats.bytesTransferred,
    peers_connected: webrtcStats.activePeers,
  };
  // v2: incluir IDs para verificação do servidor (melhora reputação)
  if (webrtcStats.recentServedIds && webrtcStats.recentServedIds.length > 0) {
    payload.event_ids_served = webrtcStats.recentServedIds;
  }
  this.conn.send(['PEER_STATS', payload]);
};

PeerProtocol.prototype.startAnnouncing = function() {
  this.stopAnnouncing();
  var self = this;
  this.announceTimer = setInterval(function() {
    self.announceCache();
    self.reportStats();
  }, config.CACHE_ANNOUNCE_INTERVAL);
};

PeerProtocol.prototype.stopAnnouncing = function() {
  if (this.announceTimer) {
    clearInterval(this.announceTimer);
    this.announceTimer = null;
  }
};

PeerProtocol.prototype.onDisconnect = function() {
  this.status = 'disconnected';
  this.peerId = null;
  this.stopAnnouncing();
};

PeerProtocol.prototype.onReconnect = function() {
  this.register();
};

PeerProtocol.prototype.getStats = function() {
  var webrtcStats = this.webrtc ? this.webrtc.getStats() : { activePeers: 0, eventsServed: 0, bytesTransferred: 0 };
  return {
    peerId: this.peerId,
    status: this.status,
    cacheSize: this.cache.size(),
    eventsReceived: this.eventsReceived,
    p2pPeers: webrtcStats.activePeers,
    p2pEventsServed: webrtcStats.eventsServed,
    p2pBytes: webrtcStats.bytesTransferred,
  };
};

module.exports = { PeerProtocol: PeerProtocol };
