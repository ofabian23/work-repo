<#
.SYNOPSIS
    Starts the Linde Sphere production server so the Android kiosk can open it over the local network.

.DESCRIPTION
    Checks Node.js, npm, dependencies, .env, the SQLite database, the production build and the port, then
    starts `next start` on 0.0.0.0 (all network adapters) and waits for /api/health. It prints the
    laptop's candidate IPv4 addresses and the URL to open on the kiosk.

    The script does NOT change firewall rules, the Mobile Hotspot, power settings or execution policy.
    Those are organizationally controlled: request them from Linde IT.

    Stop the server with Ctrl+C in this window (see README, Deployment: safe shutdown).

.PARAMETER Port
    TCP port. Default: PORT environment variable, then PORT in .env, then 3000.

.PARAMETER CheckOnly
    Run every check and show the addresses, but do not start the server.

.PARAMETER StartupTimeoutSeconds
    How long to wait for the health check after starting (default 90).

.EXAMPLE
    powershell -NoProfile -File scripts\windows\start-kiosk-server.ps1

.EXAMPLE
    powershell -NoProfile -File scripts\windows\start-kiosk-server.ps1 -Port 3001 -CheckOnly
#>
[CmdletBinding()]
param(
    [string]$Port,
    [switch]$CheckOnly,
    [int]$StartupTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'launch-common.ps1')

$root = Get-ProjectRoot
Write-Host ''
Write-Host 'Linde Sphere - production server for the kiosk (local network)' -ForegroundColor Cyan
Write-Host "Project folder: $root"
Write-Host ''

try {
    $resolved = Resolve-ServerPort $root $Port
} catch {
    Write-Fail $_.Exception.Message
    exit 1
}
Write-Ok "Port $($resolved.Port) (from $($resolved.Source))"

$ready = $true
if (-not (Test-NodeRuntime)) { $ready = $false }
if ($ready -and -not (Test-NodeModule $root)) { $ready = $false }
Test-EnvFile $root
if (-not (Test-Database $root)) { $ready = $false }
if (-not (Test-ProductionBuild $root)) { $ready = $false }
if (-not (Test-PortFree $resolved.Port)) { $ready = $false }

$null = Show-KioskAddress $resolved.Port
Show-FirewallNote $resolved.Port

if (-not $ready) {
    Write-Host ''
    Write-Fail 'The server was not started. Fix the items marked [FAIL] above, then run this script again.'
    exit 1
}
if ($CheckOnly) {
    Write-Host ''
    Write-Ok 'All checks passed (-CheckOnly: the server was not started).'
    exit 0
}

Write-Host ''
Write-Step 'Starting the production server on 0.0.0.0 ...'
$node = (Get-Command node).Source
$nextBin = Join-Path $root 'node_modules\next\dist\bin\next'
$env:NODE_ENV = 'production'
# Quoted: user folders on Windows often contain spaces.
$arguments = @("`"$nextBin`"", 'start', '-H', '0.0.0.0', '-p', [string]$resolved.Port)
$server = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $root -NoNewWindow -PassThru

$exitCode = 0
try {
    $health = Wait-ServerHealth $resolved.Port $server $StartupTimeoutSeconds
    if ($server.HasExited) {
        Show-StartFailureHelp $server.ExitCode $resolved.Port
        $exitCode = 2
    } elseif (-not $health) {
        # Typically an invalid .env: Next.js prints the error above but keeps a process that never answers.
        Write-Fail "The server did not answer http://localhost:$($resolved.Port)/api/health within $StartupTimeoutSeconds s."
        Show-StartFailureHelp -1 $resolved.Port
        Write-Hint 'On a very slow laptop, try again with -StartupTimeoutSeconds 180.'
        $exitCode = 2
    } else {
        Show-HealthSummary $health
        Write-Host ''
        Write-Host '============================================================' -ForegroundColor Cyan
        Write-Host " Server running. On the kiosk, open  http://<laptop-IPv4>:$($resolved.Port)/" -ForegroundColor Cyan
        Write-Host ' (see the candidate addresses above). Keep this window open.' -ForegroundColor Cyan
        Write-Host ' Stop: press Ctrl+C here (back up first: npm run db:backup).' -ForegroundColor Cyan
        Write-Host '============================================================' -ForegroundColor Cyan
        $server.WaitForExit()
        if ($server.ExitCode -ne 0) {
            Write-Warn "The server stopped with exit code $($server.ExitCode)."
            $exitCode = 2
        } else {
            Write-Ok 'The server stopped.'
        }
    }
} finally {
    # Ctrl+C or an error in this script: never leave a server running without its window.
    if ($server -and -not $server.HasExited) {
        Write-Step 'Stopping the server ...'
        Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
        $server.WaitForExit(10000) | Out-Null
        Write-Ok 'The server stopped.'
    }
}
exit $exitCode
