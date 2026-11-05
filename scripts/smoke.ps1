# scripts/smoke.ps1
# End-to-end smoke test verifying: login, book, conflict, approve, cancel, and slot freeing

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

$baseUrl = "http://localhost:8080/api"

Write-Host "=========================================="
Write-Host "   SLOTLOCK END-TO-END SMOKE TEST         "
Write-Host "=========================================="

# 1. Admin login
$adminEmail = $env:ADMIN_EMAIL
if (-not $adminEmail) { $adminEmail = "admin@slotlock.local" }
$adminPassword = $env:ADMIN_PASSWORD

Write-Host "`n1. Logging in as Admin ($adminEmail)..."
$adminLoginBody = @{
    email = $adminEmail
    password = $adminPassword
} | ConvertTo-Json

$adminRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json"
$adminToken = $adminRes.token
if (-not $adminToken) { throw "Admin login failed" }
Write-Host "Admin login successful! Role: $($adminRes.role)"

# 2. Student registration
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$studentEmail = "smoke_student_$timestamp@test.com"
$studentPassword = "StudentPassword123!"
$studentName = "Smoke Student $timestamp"

Write-Host "`n2. Registering new Student ($studentEmail)..."
$studentRegBody = @{
    name = $studentName
    email = $studentEmail
    password = $studentPassword
} | ConvertTo-Json

$studentRes = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $studentRegBody -ContentType "application/json"
$studentToken = $studentRes.token
Write-Host "Student registered successfully! Id: $($studentRes.id), Name: $($studentRes.name)"

# 3. Get halls
Write-Host "`n3. Fetching Halls..."
$studentHeaders = @{ Authorization = "Bearer $studentToken" }
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

$halls = Invoke-RestMethod -Uri "$baseUrl/halls" -Method Get -Headers $studentHeaders
Write-Host "Found $($halls.Count) halls."
$testHall = $halls[0]
Write-Host "Using Hall: $($testHall.name) (ID: $($testHall.id), Capacity: $($testHall.capacity))"

# 4. Book a future slot
$futureDate = [DateTime]::UtcNow.AddDays(40).ToString("yyyy-MM-dd")
$startTime = "${futureDate}T10:00:00Z"
$endTime = "${futureDate}T11:00:00Z"

Write-Host "`n4. Booking a slot ($startTime - $endTime)..."
$bookingBody = @{
    hallId = $testHall.id
    title = "Smoke Test Seminar"
    startTime = $startTime
    endTime = $endTime
} | ConvertTo-Json

$bookingRes = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Post -Body $bookingBody -ContentType "application/json" -Headers $studentHeaders
$bookingId = $bookingRes.id
Write-Host "Booking created! ID: $bookingId, Status: $($bookingRes.status), Hall: $($bookingRes.hallName)"

# 5. Conflict: attempt to book the exact same slot
Write-Host "`n5. Testing CONFLICT (attempting to book same slot)..."
try {
    $conflictRes = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Post -Body $bookingBody -ContentType "application/json" -Headers $studentHeaders
    throw "Expected HTTP 409 Conflict, but received 200 OK!"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "Received HTTP $statusCode Conflict as expected!"
    Write-Host "Response body: $responseBody"
    if ($statusCode -ne 409) {
        throw "Expected status code 409, got $statusCode"
    }
}

# 6. Admin approves the booking
Write-Host "`n6. Admin approving booking ID $bookingId..."
$approveBody = @{ status = "APPROVED" } | ConvertTo-Json
$approveRes = Invoke-RestMethod -Uri "$baseUrl/bookings/$bookingId/status" -Method Patch -Body $approveBody -ContentType "application/json" -Headers $adminHeaders
Write-Host "Booking updated! New status: $($approveRes.status)"
if ($approveRes.status -ne "APPROVED") { throw "Status was not APPROVED" }

# 7. Student cancels their booking
Write-Host "`n7. Student cancelling their approved booking..."
$cancelRes = Invoke-RestMethod -Uri "$baseUrl/bookings/$bookingId/cancel" -Method Patch -Headers $studentHeaders
Write-Host "Booking cancelled! New status: $($cancelRes.status)"
if ($cancelRes.status -ne "CANCELLED") { throw "Status was not CANCELLED" }

# 8. Slot freed: re-booking succeeds
Write-Host "`n8. Verifying slot was freed by re-booking..."
$rebookRes = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Post -Body $bookingBody -ContentType "application/json" -Headers $studentHeaders
Write-Host "Re-booking successful! New booking ID: $($rebookRes.id), Status: $($rebookRes.status)"

Write-Host "`n=========================================="
Write-Host "   SMOKE TEST PASSED COMPLETELY!          "
Write-Host "=========================================="
