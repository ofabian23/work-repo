# PSScriptAnalyzer settings for the launch scripts (ADR-059).
#   Invoke-ScriptAnalyzer -Path scripts/windows -Settings scripts/windows/PSScriptAnalyzerSettings.psd1
@{
    # Write-Host is intended: these are interactive console scripts with colored status lines.
    ExcludeRules = @('PSAvoidUsingWriteHost')
    Rules        = @{
        # Must run in Windows PowerShell 5.1 (the default on Windows laptops) and PowerShell 7.
        PSUseCompatibleSyntax   = @{ Enable = $true; TargetVersions = @('5.1', '7.0') }
        PSUseCompatibleCommands = @{
            Enable         = $true
            TargetProfiles = @('win-8_x64_10.0.17763.0_5.1.17763.316_x64_4.0.30319.42000_framework')
        }
    }
}
