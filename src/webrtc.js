const { PeerConnection } = require('node-datachannel');
const https = require('https');

let cachedIceServers = null;
let cacheTime = 0;

function fetchIceServers() {
  return new Promise((resolve) => {
    if (cachedIceServers && (Date.now() - cacheTime) < 3600000) {
      return resolve(cachedIceServers);
    }
    https.get('https://nexus.libernet.app/turn-credentials', (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const servers = [];
          for (const s of parsed.iceServers) {
            // urls can be a string or an array of strings
            const urlList = Array.isArray(s.urls) ? s.urls : [s.urls];
            for (const url of urlList) {
              if (typeof url !== 'string') continue;
              if (url.startsWith('stun:')) {
                servers.push(url);
              } else if (url.startsWith('turn:') && s.username && s.credential) {
                const host = url.replace('turn:', '');
                servers.push('turn:' + s.username + ':' + s.credential + '@' + host);
              } else if (url.startsWith('turns:') && s.username && s.credential) {
                const host = url.replace('turns:', '');
                servers.push('turns:' + s.username + ':' + s.credential + '@' + host);
              }
            }
          }
          cachedIceServers = servers;
          cacheTime = Date.now();
          console.log('[webrtc] fetched ' + servers.length + ' ICE servers');
          resolve(servers);
        } catch (e) {
          console.error('[webrtc] failed to parse ICE servers:', e.message);
          resolve(['stun:stun.l.google.com:19302']);
        }
      });
    }).on('error', (e) => {
      console.error('[webrtc] failed to fetch ICE servers:', e.message);
      resolve(['stun:stun.l.google.com:19302']);
    });
  });
}

class WebRTCManager {
  constructor(cache, connection) {
    this.cache = cache;
    this.conn = connection;
    this.peers = new Map();
    this.eventsServed = 0;
    this.bytesTransferred = 0;
    this.recentServedIds = []; // v2 stats
    // Pre-fetch ICE servers
    fetchIceServers();
  }

  async handleSignal(fromPeer, signalData) {
    if (signalData.type === 'offer') {
      await this.handleOffer(fromPeer, signalData);
    } else if (signalData.type === 'answer') {
      this.handleAnswer(fromPeer, signalData);
    } else if (signalData.candidate) {
      this.handleCandidate(fromPeer, signalData);
    }
  }

  async handleOffer(fromPeer, offer) {
    var self = this;
    var shortId = fromPeer.slice(0, 8);
    console.log('[webrtc] received offer from ' + shortId);

    var iceServers = await fetchIceServers();

    var pc = new PeerConnection('cloudmor-peer', { iceServers: iceServers });

    var peerState = { pc: pc, dc: null, state: 'connecting' };
    this.peers.set(fromPeer, peerState);

    pc.onLocalDescription(function(sdp, type) {
      self.conn.send(['PEER_SIGNAL', {
        target_peer: fromPeer,
        signal_data: { type: type, sdp: sdp },
      }]);
    });

    pc.onLocalCandidate(function(candidate, mid) {
      self.conn.send(['PEER_SIGNAL', {
        target_peer: fromPeer,
        signal_data: {
          candidate: {
            candidate: candidate,
            sdpMid: mid || '0',
            sdpMLineIndex: parseInt(mid) || 0
          }
        },
      }]);
    });

    pc.onDataChannel(function(dc) {
      console.log('[webrtc] data channel opened with ' + shortId);
      peerState.dc = dc;
      peerState.state = 'connected';
      self.conn.send(['PEER_P2P_CONNECTED', { remote_peer: fromPeer }]);
      self.setupDataChannel(dc, fromPeer);
    });

    pc.onStateChange(function(state) {
      console.log('[webrtc] ' + shortId + ' state: ' + state);
      if (state === 'closed' || state === 'failed' || state === 'disconnected') {
        self.cleanupPeer(fromPeer);
      }
    });

    pc.setRemoteDescription(offer.sdp, offer.type);
  }

  handleAnswer(fromPeer, answer) {
    var peer = this.peers.get(fromPeer);
    if (peer && peer.pc) {
      peer.pc.setRemoteDescription(answer.sdp, answer.type);
    }
  }

  handleCandidate(fromPeer, signal) {
    var peer = this.peers.get(fromPeer);
    if (!peer || !peer.pc) return;
    var c = signal.candidate;
    if (typeof c === 'object' && c.candidate) {
      peer.pc.addRemoteCandidate(c.candidate, c.sdpMid || '0');
    } else if (typeof c === 'string') {
      peer.pc.addRemoteCandidate(c, signal.mid || '0');
    }
  }

  setupDataChannel(dc, peerId) {
    var self = this;
    var shortId = peerId.slice(0, 8);

    dc.onMessage(function(raw) {
      try {
        var msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
        self.handleP2PMessage(dc, peerId, msg);
      } catch (err) {
        console.error('[webrtc] invalid P2P message from ' + shortId + ': ' + err.message);
      }
    });

    dc.onClosed(function() {
      console.log('[webrtc] data channel closed with ' + shortId);
      self.cleanupPeer(peerId);
    });

    dc.onError(function(err) {
      console.error('[webrtc] data channel error with ' + shortId + ': ' + err);
    });
  }

  handleP2PMessage(dc, peerId, msg) {
    if (!msg.type) return;
    var shortId = peerId.slice(0, 8);

    switch (msg.type) {
      case 'P2P_REQUEST': {
        var eventId = msg.event_id;
        var eventIds = msg.event_ids || (eventId ? [eventId] : []);
        var events = [];
        for (var i = 0; i < eventIds.length; i++) {
          var event = this.cache.get(eventIds[i]);
          if (event) events.push(event);
        }
        var response = JSON.stringify({ type: 'P2P_EVENTS', events: events });
        dc.sendMessage(response);
        this.eventsServed += events.length;
        this.bytesTransferred += response.length;
        for (var j = 0; j < events.length; j++) { if (this.recentServedIds.length < 100) this.recentServedIds.push(events[j].id); }
        console.log('[webrtc] served ' + events.length + '/' + eventIds.length + ' events to ' + shortId + ' (' + response.length + ' bytes)');
        break;
      }
      case 'P2P_PING':
        dc.sendMessage(JSON.stringify({ type: 'P2P_PONG', ts: Date.now() }));
        break;
      default:
        console.log('[webrtc] unknown P2P message type: ' + msg.type);
    }
  }

  cleanupPeer(peerId) {
    var peer = this.peers.get(peerId);
    if (peer) {
      try { if (peer.dc) peer.dc.close(); } catch(e) {}
      try { peer.pc.close(); } catch(e) {}
      this.peers.delete(peerId);
    }
  }

  getStats() {
    var ids = this.recentServedIds.splice(0); // pega e limpa para próximo ciclo
    return {
      activePeers: this.peers.size,
      eventsServed: this.eventsServed,
      bytesTransferred: this.bytesTransferred,
      recentServedIds: ids,
    };
  }

  destroy() {
    var keys = Array.from(this.peers.keys());
    for (var i = 0; i < keys.length; i++) {
      this.cleanupPeer(keys[i]);
    }
  }
}

module.exports = { WebRTCManager };
