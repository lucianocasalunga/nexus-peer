module.exports = {
  NEXUS_URL: process.env.NEXUS_URL || 'wss://nexus.libernet.app',
  HEARTBEAT_INTERVAL: 30000,
  RECONNECT_BASE: 5000,
  RECONNECT_MAX: 60000,
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24h
  CACHE_MAX_EVENTS: 10000,
  CACHE_ANNOUNCE_INTERVAL: 60000, // announce cache every 60s
  PEER_BANDWIDTH: parseInt(process.env.PEER_BANDWIDTH || '100'),
  PEER_STORAGE: parseInt(process.env.PEER_STORAGE || '5000'),
  NODE_TYPE: process.env.NODE_TYPE || 'server',
  // Vazio por default: cada instalação roda anônima (sem reputação vinculada).
  // Quem quiser vincular identidade Nostr (ex. para gorjeta futura) seta PUBLIC_KEY no ambiente.
  // NUNCA cravar uma pubkey concreta aqui — repo público + todo install reportaria a mesma identidade.
  PUBLIC_KEY: process.env.PUBLIC_KEY || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
