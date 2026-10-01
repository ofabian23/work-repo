# Shared helpers for the Linde Sphere launch scripts (ADR-059).
#
# Dot-sourced by start-kiosk-server.ps1 and start-dev-network.ps1. Compatible with Windows PowerShell 5.1
# (the default on Windows laptops) and PowerShell 7. Keep this file ASCII-only: Windows PowerShell 5.1
# reads files without a byte-order mark using the system code page.
#
# These helpers only READ the environment. They never change firewall rules, network adapters, the
# Mobile Hotspot, power settings or execution policy: those are organizationally controlled (Linde IT).

Set-StrictMode -Version 2.0

# Same rule as package.json "engines" (Prisma 7.10+): 20.19+ on Node 20, 22.12+ on Node 22, or 24+.
$script:MinimumNodeVersion = [version]'20.19.0'
$script:MinimumNode22Version = [version]'22.12.0'
$script:DefaultPort = 3000
$script:HotspotAddress = '192.168.137.1'

function Write-Step([string]$Message) { Write-Host "[....] $Message" }
function Write-Ok([string]$Message) { Write-Host "[ OK ] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail([string]$Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-Hint([string]$Message) { Write-Host "       $Message" }

function Get-ProjectRoot {
    # scripts/windows -> project root
    return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

# Reads one KEY=value line from .env without loading (or printing) anything else.
function Get-DotEnvValue([string]$Root, [string]$Name) {
    $file = Join-Path $Root '.env'
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    foreach ($line in Get-Content -LiteralPath $file) {
        if ($line -match "^\s*$Name\s*=\s*(.*?)\s*$") {
            $value = $Matches[1].Trim('"', "'")
            if ($value -ne '') { return $value }
        }
    }
    return $null
}

# Port precedence: -Port parameter, then the PORT environment variable, then PORT in .env, then 3000.
function Resolve-ServerPort([string]$Root, [string]$Requested) {
    $source = 'parameter -Port'
    $value = $Requested
    if (-not $value) { $value = $env:PORT; $source = 'environment variable PORT' }
    if (-not $value) { $value = Get-DotEnvValue $Root 'PORT'; $source = 'PORT in .env' }
    if (-not $value) { $value = [string]$script:DefaultPort; $source = 'default' }
    $number = 0
    if (-not [int]::TryParse($value, [ref]$number) -or $number -lt 1 -or $number -gt 65535) {
        throw "Invalid port '$value' (from $source). Use a whole number between 1 and 65535, e.g. 3000."
    }
    return [pscustomobject]@{ Port = $number; Source = $source }
}

function Test-NodeRuntime {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Fail 'Node.js was not found on PATH.'
        Write-Hint "Install Node.js 22 LTS (at least $script:MinimumNodeVersion), then open a NEW PowerShell window."
        return $false
    }
    $raw = (& $node.Source --version 2>$null | Out-String).Trim()
    $parsed = $null
    if (-not [version]::TryParse($raw.TrimStart('v'), [ref]$parsed)) {
        Write-Fail "Could not read the Node.js version (got '$raw')."
        return $false
    }
    $tooOld = ($parsed -lt $script:MinimumNodeVersion) -or
        ($parsed.Major -eq 21) -or
        ($parsed.Major -eq 22 -and $parsed -lt $script:MinimumNode22Version) -or
        ($parsed.Major -eq 23)
    if ($tooOld) {
        Write-Fail "Node.js $raw is not supported; use 22 LTS ($script:MinimumNode22Version or later) or $script:MinimumNodeVersion+ on Node 20."
        return $false
    }
    Write-Ok "Node.js $raw"
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        Write-Fail 'npm was not found on PATH (it is installed together with Node.js).'
        return $false
    }
    Write-Ok 'npm found'
    return $true
}

function Test-NodeModule([string]$Root) {
    $next = Join-Path $Root 'node_modules\next\dist\bin\next'
    if (-not (Test-Path -LiteralPath $next)) {
        Write-Fail 'Dependencies are not installed (node_modules\next is missing).'
        Write-Hint 'Run: npm install'
        return $false
    }
    Write-Ok 'Dependencies installed'
    return $true
}

function Test-EnvFile([string]$Root) {
    if (Test-Path -LiteralPath (Join-Path $Root '.env')) {
        Write-Ok '.env found (values are not displayed)'
    } else {
        Write-Warn '.env not found: safe defaults apply (demo content, email preview, admin off).'
        Write-Hint 'For the event: Copy-Item .env.example .env, then edit it (see README, Deployment).'
    }
}

# The SQLite file named by DATABASE_URL (environment, then .env, then the default).
function Get-DatabaseFile([string]$Root) {
    $url = $env:DATABASE_URL
    if (-not $url) { $url = Get-DotEnvValue $Root 'DATABASE_URL' }
    if (-not $url) { $url = 'file:./data/linde-sphere.db' }
    $path = $url -replace '^file:', ''
    if (-not [System.IO.Path]::IsPathRooted($path)) { $path = Join-Path $Root $path }
    return [System.IO.Path]::GetFullPath($path)
}

function Test-Database([string]$Root) {
    $file = Get-DatabaseFile $Root
    if (Test-Path -LiteralPath $file) {
        Write-Ok "SQLite database found ($file)"
        return $true
    }
    Write-Fail "SQLite database not found: $file"
    Write-Hint 'Run: npm run db:deploy   (creates the database and applies migrations)'
    return $false
}

# Production build present, and not older than the source and content it was built from.
function Test-ProductionBuild([string]$Root) {
    $buildId = Join-Path $Root '.next\BUILD_ID'
    if (-not (Test-Path -LiteralPath $buildId)) {
        Write-Fail 'No production build found (.next\BUILD_ID is missing).'
        Write-Hint 'Run: npm run build'
        return $false
    }
    $builtAt = (Get-Item -LiteralPath $buildId).LastWriteTimeUtc
    $newer = @()
    foreach ($dir in @('src', 'content', 'public')) {
        $path = Join-Path $Root $dir
        if (Test-Path -LiteralPath $path) {
            $newer += @(Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTimeUtc -gt $builtAt } | Select-Object -First 1)
        }
    }
    if ($newer.Count -gt 0) {
        Write-Warn "The production build is older than recent changes (e.g. $($newer[0].Name))."
        Write-Hint 'Run npm run build again so the kiosk shows the current version.'
    } else {
        Write-Ok "Production build found (built $($builtAt.ToLocalTime().ToString('yyyy-MM-dd HH:mm')))"
    }
    return $true
}

function Test-PortFree([int]$Port) {
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        Write-Ok "Port $Port is free"
        return $true
    } catch {
        Write-Fail "Port $Port is already in use (another server, or a previous Linde Sphere window still open)."
        Write-Hint "Close the other window, or choose another port: -Port 3001"
        Write-Hint "To see what uses it: Get-NetTCPConnection -LocalPort $Port | Select-Object OwningProcess"
        return $false
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

function Test-PrivateIPv4([string]$Address) {
    $b = $Address.Split('.') | ForEach-Object { [int]$_ }
    if ($b[0] -eq 10) { return $true }
    if ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31) { return $true }
    if ($b[0] -eq 192 -and $b[1] -eq 168) { return $true }
    return $false
}

# Candidate IPv4 addresses of this laptop, with a short note for each. Uses .NET, so it works in Windows
# PowerShell 5.1, PowerShell 7 and on non-Windows systems (for testing).
function Get-CandidateAddress {
    $result = @()
    $interfaces = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object {
            $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and
            $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback
        }
    foreach ($nic in $interfaces) {
        foreach ($unicast in $nic.GetIPProperties().UnicastAddresses) {
            if ($unicast.Address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { continue }
            $ip = $unicast.Address.IPAddressToString
            if ($ip -like '127.*') { continue }
            $note = ''
            if ($ip -eq $script:HotspotAddress) {
                $note = 'usual Windows Mobile Hotspot address'
            } elseif ($ip -like '169.254.*') {
                $note = 'link-local: this adapter has no working network; the kiosk cannot use it'
            } elseif (Test-PrivateIPv4 $ip) {
                $note = 'private network'
            } else {
                $note = 'not a private address: refused by the host allowlist unless added to ALLOWED_HOSTS'
            }
            $result += [pscustomobject]@{ Address = $ip; Interface = $nic.Name; Note = $note }
        }
    }
    # Most likely first: hotspot, then other private addresses, then the rest.
    return @($result | Sort-Object -Property @(
            @{ Expression = { if ($_.Address -eq $script:HotspotAddress) { 0 } elseif ($_.Note -eq 'private network') { 1 } else { 2 } } },
            @{ Expression = { $_.Interface } }
        ))
}

function Show-KioskAddress([int]$Port) {
    $candidates = Get-CandidateAddress
    Write-Host ''
    Write-Host 'Candidate addresses of this laptop (open ONE of these on the kiosk, the one on the shared network):'
    if ($candidates.Count -eq 0) {
        Write-Warn 'No active IPv4 network adapter found. Connect to the network or turn on the approved hotspot.'
    }
    foreach ($c in $candidates) {
        Write-Host ("  http://{0}:{1}/   [{2}] {3}" -f $c.Address, $Port, $c.Interface, $c.Note)
    }
    Write-Host ''
    Write-Host "Kiosk URL format : http://<laptop-IPv4>:$Port/   (for example http://$($script:HotspotAddress):$Port/)"
    Write-Host "Health check     : http://<laptop-IPv4>:$Port/api/health   (on this laptop: http://localhost:$Port/api/health)"
    Write-Host 'Do not use http://0.0.0.0 - it means "all adapters" and does not work as an address to open.'
    return $candidates
}

function Show-FirewallNote([int]$Port) {
    Write-Host ''
    Write-Host 'Firewall: this script does NOT change firewall rules.' -ForegroundColor Cyan
    Write-Hint 'If the kiosk cannot connect, Windows Defender Firewall may be blocking inbound TCP port'
    Write-Hint "$Port for Node.js. Allowing it (Private network profile only) is an organizationally"
    Write-Hint 'controlled change: request it from Linde IT. Do not change firewall settings yourself.'
}

# GET without any proxy: a system or environment proxy must never handle a request to this laptop.
# Returns the body for any HTTP status (the health route answers 503 with JSON), or $null if there is no
# answer yet (connection refused, timeout). Works in Windows PowerShell 5.1 and PowerShell 7.
function Get-HttpBody([string]$Url) {
    $response = $null
    try {
        $request = [System.Net.HttpWebRequest]::Create($Url)
        $request.Proxy = $null
        $request.Timeout = 3000
        $response = $request.GetResponse()
    } catch {
        $e = $_.Exception
        while ($e -and -not ($e -is [System.Net.WebException])) { $e = $e.InnerException }
        if ($e -and $e.Response) { $response = $e.Response } else { return $null }
    }
    try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        return $reader.ReadToEnd()
    } finally {
        $response.Close()
    }
}

# Polls /api/health until it answers or the process exits. Returns the parsed JSON, or $null.
function Wait-ServerHealth([int]$Port, [System.Diagnostics.Process]$Process, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $url = "http://localhost:$Port/api/health"
    while ((Get-Date) -lt $deadline) {
        if ($Process -and $Process.HasExited) { return $null }
        $body = Get-HttpBody $url
        if ($body) {
            try { return ($body | ConvertFrom-Json) } catch { return $null }
        }
        Start-Sleep -Milliseconds 700
    }
    return $null
}

function Show-HealthSummary($Health) {
    $status = [string]$Health.status
    if ($status -eq 'ok') {
        Write-Ok "Health: ok (content mode: $($Health.app.contentMode), email: $($Health.email.provider))"
        return
    }
    Write-Warn "Health: $status"
    if ($Health.PSObject.Properties.Name -contains 'database' -and $Health.database) {
        Write-Hint "Database: $($Health.database.status) $($Health.database.reason)"
        if ($Health.database.status -eq 'not_initialized') { Write-Hint 'Run: npm run db:deploy, then start again.' }
    }
    if ($Health.configuration -and @($Health.configuration.invalidVariables).Count -gt 0) {
        Write-Hint "Invalid settings in .env: $(@($Health.configuration.invalidVariables) -join ', ')"
    }
    if ($status -eq 'error') {
        Write-Hint 'The configuration or content is invalid. Open the health URL on this laptop for details,'
        Write-Hint 'and compare .env with .env.example.'
    }
}

function Show-StartFailureHelp([int]$ExitCode, [int]$Port) {
    Write-Host ''
    if ($ExitCode -ge 0) { Write-Fail "The server stopped during start-up (exit code $ExitCode)." }
    Write-Hint 'Read the messages above; common causes:'
    Write-Hint "  - port $Port taken by another program     -> close it, or use -Port 3001"
    Write-Hint '  - invalid .env value (named in the error)  -> fix it; compare with .env.example'
    Write-Hint '  - missing or broken build                  -> npm run build'
    Write-Hint '  - database missing or not migrated         -> npm run db:deploy'
    Write-Hint '  - dependencies missing after an update     -> npm install'
}
