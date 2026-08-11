# Nexus Peer

A small background program that turns your computer into a **node of the Nexus network** —
a community-run distribution layer for [Nostr](https://github.com/nostr-protocol/nostr) events.

You install it, it runs quietly while your device is on, and it helps serve recent events to
other participants over a direct peer-to-peer channel. No account, no payment, no obligation.
Turn it off whenever you want.

> **What this is, honestly:** peer-to-peer distribution **with centralized discovery** — the same
> shape as BitTorrent with a tracker. A central relay (`nexus.libernet.app`) introduces peers to
> each other (signaling); the actual event data travels **directly between peers** over a WebRTC
> data channel, and the relay never sees that traffic. Every event is verified by
> content-addressing (SHA-256) on the receiving side, so a peer cannot serve tampered data.
> It is **not** a fully decentralized network: if the relay is down, no *new* peer connections are
> made. We say what the code does — nothing more.

## How it works

```
        browsers / apps (request events)
              ▲     ▲
   [ RELAY: introduces peers + provides TURN ]   ← signaling only, never sees the data
              ▲     ▲
        peers running Nexus Peer (serve events)   ← this program
```

The peer connects to the relay, caches recent events, announces what it has, and serves those
events directly to whoever asks — verified end-to-end by the requester.

## Privacy — read before installing

This program participates in a public peer-to-peer network. Like running a Tor relay or a
BitTorrent client, **other participants can see your IP address** when your node serves them data.
That is inherent to serving on an open network. If that is not acceptable to you, do not install it.

## Install

Prebuilt binaries for Linux, Windows and macOS are published on the
[Releases](../../releases) page. It runs in the background and starts with your user login (not as
root/administrator). A tray icon lets you turn it on and off at any time.

Run from source (any OS with Node 20+):

```bash
npm install
npm start
```

See [BUILD.md](BUILD.md) for packaging and service-install details.

## Configuration (environment variables)

| Var | Default | What it is |
|-----|---------|------------|
| `NEXUS_URL` | `wss://nexus.libernet.app` | The Nexus relay (signaling + TURN) |
| `PUBLIC_KEY` | *(empty — anonymous)* | Optional Nostr pubkey to tie reputation to your identity |
| `PEER_BANDWIDTH` | `100` | Self-reported Mbps |
| `PEER_STORAGE` | `5000` | Cache size in MB |

## Protocol

The wire protocol is specified in **NIP-NX** ("Nexus — Hybrid P2P Relay"). Peers announce a
`protocolVersion` on register so the relay can handle version drift.

## License

MIT
