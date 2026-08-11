# Instala o Nexus Super Peer como serviço do Windows (inicia no boot, reinicia sozinho).
# Um .exe de console vira serviço via NSSM (https://nssm.cc) — o New-Service nativo
# espera um binário de serviço, que o nosso não é. Rode este script como Administrador.
#
#   .\install-service.ps1 -ExePath C:\Nexus\nexus-peer-win-x64.exe
#
param(
  [Parameter(Mandatory=$true)] [string]$ExePath,
  [string]$NexusUrl = "wss://nexus.libernet.app",
  [string]$PublicKey = "",
  [string]$ServiceName = "NexusPeer"
)

$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) {
  Write-Error "NSSM nao encontrado. Instale: 'winget install NSSM' ou baixe de https://nssm.cc, e rode de novo."
  exit 1
}

& $nssm install $ServiceName $ExePath
& $nssm set $ServiceName AppEnvironmentExtra "NEXUS_URL=$NexusUrl"
if ($PublicKey -ne "") { & $nssm set $ServiceName AppEnvironmentExtra "PUBLIC_KEY=$PublicKey" }
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppRestartDelay 5000
Start-Service $ServiceName
Write-Host "Servico '$ServiceName' instalado e iniciado. Ver logs: Get-EventLog / nssm."
