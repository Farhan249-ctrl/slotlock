# scripts/test.ps1
# Loads variables from root .env and executes backend integration tests

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$envFile = Join-Path $rootDir ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line.Split("=", 2)
            if ($parts.Length -eq 2) {
                $name = $parts[0].Trim()
                $value = $parts[1].Trim()
                [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
} else {
    Write-Error ".env file not found at $envFile"
    exit 1
}

$backendDir = Join-Path $rootDir "backend"
Push-Location $backendDir
try {
    .\mvnw.cmd test
} finally {
    Pop-Location
}
