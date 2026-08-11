var Connection = require('./connection').Connection;
var EventCache = require('./cache').EventCache;
var PeerProtocol = require('./peer-protocol').PeerProtocol;
var WebRTCManager = require('./webrtc').WebRTCManager;
var config = require('./config');

console.log('===========================================');
console.log('  Nexus P2P Super Peer - CloudMor');
console.log('===========================================');
console.log('Relay:     ' + config.NEXUS_URL);
console.log('Type:      ' + config.NODE_TYPE);
console.log('Bandwidth: ' + config.PEER_BANDWIDTH + ' Mbps');
console.log('Storage:   ' + config.PEER_STORAGE + ' MB');
console.log('Cache TTL: 24h (max ' + config.CACHE_MAX_EVENTS + ' events)');
console.log('WebRTC:    enabled (node-datachannel)');
console.log('===========================================');

var cache = new EventCache();
var webrtc = null;
var protocol = null;

var conn = new Connection(
  function onMessage(msg) { protocol.handleMessage(msg); },
  function onOpen() {
    protocol.conn = conn;
    webrtc.conn = conn;
    protocol.onReconnect();
  },
  function onClose() {
    protocol.onDisconnect();
  }
);

webrtc = new WebRTCManager(cache, conn);
protocol = new PeerProtocol(conn, cache, webrtc);

conn.connect();

// Status log every 5 minutes
setInterval(function() {
  var stats = protocol.getStats();
  console.log('[status] ' + stats.status +
    ' | cache: ' + stats.cacheSize +
    ' | received: ' + stats.eventsReceived +
    ' | p2p_peers: ' + stats.p2pPeers +
    ' | p2p_served: ' + stats.p2pEventsServed +
    ' | p2p_bytes: ' + stats.p2pBytes);
}, 300000);

function shutdown(signal) {
  console.log('\n[' + signal + '] shutting down...');
  conn.disconnect();
  webrtc.destroy();
  cache.destroy();
  process.exit(0);
}

process.on('SIGTERM', function() { shutdown('SIGTERM'); });
process.on('SIGINT', function() { shutdown('SIGINT'); });

console.log('[main] Super Peer starting with WebRTC support...');
