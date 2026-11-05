# scripts/start-backend.ps1
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
                [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
            }
        }
    }
}

$backendJar = Join-Path $rootDir "backend\target\slotlock-backend-0.0.1-SNAPSHOT.jar"
$javaArgs = @(
    "-Duser.timezone=UTC",
    "-DJWT_SECRET=$($env:JWT_SECRET)",
    "-DADMIN_PASSWORD=$($env:ADMIN_PASSWORD)",
    "-DPOSTGRES_PASSWORD=$($env:POSTGRES_PASSWORD)",
    "-DPOSTGRES_PORT=$($env:POSTGRES_PORT)",
    "-DPOSTGRES_USER=$($env:POSTGRES_USER)",
    "-DPOSTGRES_DB=$($env:POSTGRES_DB)",
    "-DADMIN_EMAIL=$($env:ADMIN_EMAIL)",
    "-jar",
    $backendJar
)

& java @javaArgs
