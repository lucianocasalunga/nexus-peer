# Nexus Super Peer — daemon nativo (Linux / Windows / macOS)

Peer P2P headless do Nexus. Conecta em `wss://nexus.libernet.app`, cacheia o
firehose, anuncia e **serve eventos a outros peers via WebRTC** (`node-datachannel`,
sem navegador). Provado em produção rodando na fábrica (CloudMor) atrás de FortiGate.

## Configuração (env)

| Var | Default | O que é |
|-----|---------|---------|
| `NEXUS_URL` | `wss://nexus.libernet.app` | Relay Nexus (signaling + TURN) |
| `PUBLIC_KEY` | *(demo)* | Sua chave Nostr (64 hex) — liga reputação/recompensa em sats à SUA identidade |
| `PEER_BANDWIDTH` | `100` | Mbps auto-reportado |
| `PEER_STORAGE` | `5000` | MB de cache |
| `NODE_TYPE` | `server` | Papel |
| `LOG_LEVEL` | `info` | Verbosidade |

## Rodar direto (qualquer SO com Node 20+)

```bash
npm install
PUBLIC_KEY=<sua_pubkey_hex> npm start
```

## Binário único por SO

`node-datachannel` é um módulo **nativo** (um `.node` por plataforma), então o
binário tem que ser gerado **no próprio SO alvo** (não dá pra cross-compilar de
forma confiável a partir do Linux). Dois caminhos:

- **CI (recomendado):** o workflow `.github/workflows/build-peer.yml` roda uma
  matrix em `ubuntu-latest` / `windows-latest` / `macos-latest`, cada um instala o
  prebuilt certo e empacota com `@yao-pkg/pkg`. Dispara em *Actions ▸ Run workflow*
  ou com uma tag `peer-v*`. Sai um artefato por SO.
- **Local (na máquina do SO alvo):**
  ```bash
  npm install
  npm i -D @yao-pkg/pkg
  npm run build:linux   # ou build:win / build:macos
  # → dist/nexus-peer-<os>
  ```

## Instalar como serviço (inicia no boot, reinicia sozinho)

- **Linux (systemd):** copie o binário p/ `/usr/local/bin/nexus-peer`, o unit
  `packaging/systemd/nexus-peer.service` p/ `/etc/systemd/system/`, edite as env,
  `sudo systemctl enable --now nexus-peer`.
- **macOS (launchd):** binário em `/usr/local/bin/nexus-peer`, o plist
  `packaging/launchd/*.plist` em `~/Library/LaunchAgents/`, `launchctl load -w ...`.
- **Windows:** `packaging/windows/install-service.ps1 -ExePath <caminho.exe>`
  (usa NSSM; rode como Administrador).

## Pendências honestas (antes de distribuir pra usuário final)

- **Assinatura de código:** macOS pede Developer ID (a LiberNet possui) + notarização;
  Windows pede cert (ainda não temos) senão dá aviso do SmartScreen. Sem assinar, o
  daemon serve pra quem é técnico; distribuição em massa precisa dos certos.
- **UI de bandeja (opcional, camada B):** o esqueleto Tauri é `nexus-peer-app`. Como
  o WebRTC agora vive no processo Node (`node-datachannel`), o app de bandeja só
  precisa spawnar/embarcar este daemon e mostrar on/off + stats — não precisa mais
  escrever WebRTC no renderer (que era o que estava travando).
- Primeira geração de binário via `pkg` + módulo nativo costuma pedir **1 iteração**
  (ajuste do caminho do `.node`). O scaffold está pronto; a validação é rodar a CI.
