# Script phase 2: Fix remaining import issues

$projectRoot = "G:\Fintech\AigleApps\aigle-send-api-v2\app\features"

function Fix-RemainingImports {
    param([string]$filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8
    $originalContent = $content

    # Fix case: OtpRepository -> otp_repository
    $content = $content -replace "from '#features/authentication/domain/interfaces/OtpRepository'", "from '#features/authentication/domain/interfaces/otp_repository'"

    # Fix transaction repository path
    $content = $content -replace "from '#features/transactions/domain/interfaces/transaction\.repository'", "from '#features/transactions/domain/interfaces/transaction_repository'"

    # Fix payment repository path
    $content = $content -replace "from '#features/transactions/domain/interfaces/payment\.repository'", "from '#features/transactions/domain/interfaces/payment_repository'"

    # Fix service provider fees repository path
    $content = $content -replace "from '#features/fees/domain/interfaces/service_provider_fees\.repository'", "from '#features/fees/domain/interfaces/service_provider_fees_repository'"

    # Save only if modified
    if ($content -ne $originalContent) {
        Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($filePath.Replace($projectRoot, ''))" -ForegroundColor Green
        return $true
    }
    return $false
}

Write-Host "=== Fixing remaining import issues ===" -ForegroundColor Cyan
$fixed = 0
Get-ChildItem -Path $projectRoot -Filter "*.ts" -Recurse | ForEach-Object {
    if (Fix-RemainingImports $_.FullName) {
        $fixed++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "$fixed files fixed" -ForegroundColor Green
