$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$certsDir = Join-Path $repoRoot "nginx\certs"

if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
}

Write-Host "Generating self-signed TLS certificate for localhost via alpine/openssl..."

$certsDockerPath = $certsDir.Replace('\', '/')

docker run --rm -v "${certsDockerPath}:/certs" alpine/openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout /certs/key.pem `
    -out /certs/cert.pem `
    -subj "/CN=localhost" `
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

if ((Test-Path "$certsDir\cert.pem") -and (Test-Path "$certsDir\key.pem")) {
    Write-Host "Certificate and private key generated successfully in $certsDir"
} else {
    throw "Certificate generation failed."
}
