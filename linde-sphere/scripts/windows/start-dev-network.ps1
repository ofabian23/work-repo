<#
.SYNOPSIS
    Starts the Linde Sphere DEVELOPMENT server on the local network, for testing on the Android kiosk.

.DESCRIPTION
    For development and rehearsals only: hot reload, development error pages, and slower than the
    production build. At the event, use start-kiosk-server.ps1 instead.

    Checks Node.js, npm, dependencies, .env, the SQLite database and the port, then starts `next dev` on
    0.0.0.0 and prints the laptop's candidate IPv4 addresses. Like the production script, it does NOT
    change firewall rules, the Mobile Hotspot, power settings or execution policy (Linde IT controls those).

    Stop the server with Ctrl+C in this window.

.PARAMETER Port
    TCP port. Default: PORT environment variable, then PORT in .env, then 3000.

.PARAMETER CheckOnly
    Run every check and show the addresses, but do not start the server.

.EXAMPLE
    powershell -NoProfile -File scripts\windows\start-dev-network.ps1
#>
[CmdletBinding()]
param(
    [string]$Port,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'launch-common.ps1')

$root = Get-ProjectRoot
Write-Host ''
Write-Host 'Linde Sphere - DEVELOPMENT server on the local network (not for the event)' -ForegroundColor Yellow
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
if (-not (Test-Database $root)) {
    Write-Hint 'The app still starts; lead submission and the health check need the database.'
}
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
Write-Step 'Starting the development server on 0.0.0.0 (first page load compiles and takes longer) ...'
$node = (Get-Command node).Source
$nextBin = Join-Path $root 'node_modules\next\dist\bin\next'
$arguments = @("`"$nextBin`"", 'dev', '-H', '0.0.0.0', '-p', [string]$resolved.Port)
$server = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $root -NoNewWindow -PassThru

$exitCode = 0
try {
    Start-Sleep -Seconds 2
    if ($server.HasExited) {
        Show-StartFailureHelp $server.ExitCode $resolved.Port
        $exitCode = 2
    } else {
        Write-Host ''
        Write-Host " Development server starting. On the kiosk, open  http://<laptop-IPv4>:$($resolved.Port)/" -ForegroundColor Yellow
        Write-Host ' Stop: press Ctrl+C here.' -ForegroundColor Yellow
        $server.WaitForExit()
        if ($server.ExitCode -ne 0) {
            Show-StartFailureHelp $server.ExitCode $resolved.Port
            $exitCode = 2
        }
    }
} finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
        $server.WaitForExit(10000) | Out-Null
    }
}
exit $exitCode
