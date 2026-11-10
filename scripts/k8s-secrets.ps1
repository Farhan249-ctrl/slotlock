# scripts/k8s-secrets.ps1
# Creates or updates the slotlock-secrets Kubernetes Secret from the local .env file.
# Secrets are never committed to version control.
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$envFile = Join-Path $rootDir ".env"

if (-not (Test-Path $envFile)) {
    throw ".env file not found at $envFile. Copy from .env.example first."
}

Write-Host "Creating/updating Kubernetes secret 'slotlock-secrets' in namespace 'slotlock'..."

# Ensure namespace exists prior to secret creation
kubectl create namespace slotlock --dry-run=client -o yaml | kubectl apply -f -

# Create or replace secret from .env file
kubectl create secret generic slotlock-secrets `
    --from-env-file=$envFile `
    --namespace=slotlock `
    --dry-run=client -o yaml | kubectl apply -f -

Write-Host "Secret 'slotlock-secrets' successfully applied in namespace 'slotlock'."
