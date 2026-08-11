const WebSocket = require('ws');
const config = require('./config');

class Connection {
  constructor(onMessage, onOpen, onClose) {
    this.ws = null;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.reconnectDelay = config.RECONNECT_BASE;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.wsPingTimer = null;
    this.shouldReconnect = true;
  }

  connect() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }

    console.log(`[conn] connecting to ${config.NEXUS_URL}...`);
    this.ws = new WebSocket(config.NEXUS_URL);

    this.ws.on('open', () => {
      console.log('[conn] connected');
      this.reconnectDelay = config.RECONNECT_BASE;
      this.startHeartbeat();
      this.startWsPing();
      if (this.onOpen) this.onOpen();
    });

    this.ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (this.onMessage) this.onMessage(msg);
      } catch (err) {
        console.error('[conn] invalid message:', err.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[conn] disconnected (code=${code})`);
      this.stopHeartbeat();
      this.stopWsPing();
      if (this.onClose) this.onClose();
      if (this.shouldReconnect) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error(`[conn] error: ${err.message}`);
    });

    this.ws.on('ping', () => {
      this.ws.pong();
    });

    this.ws.on('pong', () => {
      // Cloudflare tunnel keepalive confirmed
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send(['PEER_HEARTBEAT']);
    }, config.HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  startWsPing() {
    this.stopWsPing();
    this.wsPingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  stopWsPing() {
    if (this.wsPingTimer) {
      clearInterval(this.wsPingTimer);
      this.wsPingTimer = null;
    }
  }

  scheduleReconnect() {
    console.log(`[conn] reconnecting in ${this.reconnectDelay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, config.RECONNECT_MAX);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.stopWsPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

module.exports = { Connection };
