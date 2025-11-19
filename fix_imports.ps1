# Script to fix imports in new DDD architecture

$projectRoot = "G:\Fintech\AigleApps\aigle-send-api-v2\app\features"

function Fix-Imports {
    param([string]$filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8
    $originalContent = $content

    # Fix imports to authentication feature
    $content = $content -replace "from '#shared/interfaces/repositories/user_repository'", "from '#features/authentication/domain/interfaces/user_repository'"
    $content = $content -replace "from '#shared/interfaces/repositories/OtpRepository'", "from '#features/authentication/domain/interfaces/OtpRepository'"
    $content = $content -replace "from '#shared/models/user'", "from '#features/authentication/domain/models/user'"
    $content = $content -replace "from '#shared/models/otp'", "from '#features/authentication/domain/models/otp'"
    $content = $content -replace "from '#shared/services/otp_service'", "from '#features/authentication/application/services/otp_service'"

    # Fix imports to transactions feature
    $content = $content -replace "from '#shared/interfaces/repositories/transaction\.repository'", "from '#features/transactions/domain/interfaces/transaction.repository'"
    $content = $content -replace "from '#shared/interfaces/repositories/payment\.repository'", "from '#features/transactions/domain/interfaces/payment.repository'"
    $content = $content -replace "from '#shared/models/transaction'", "from '#features/transactions/domain/models/transaction'"
    $content = $content -replace "from '#shared/models/payment'", "from '#features/transactions/domain/models/payment'"
    $content = $content -replace "from '#shared/services/transaction_service'", "from '#features/transactions/application/services/transaction_service'"
    $content = $content -replace "from '#shared/services/payment_service'", "from '#features/transactions/application/services/payment_service'"

    # Fix imports to wallet feature
    $content = $content -replace "from '#shared/interfaces/repositories/wallet_repository'", "from '#features/wallet/domain/interfaces/wallet_repository'"
    $content = $content -replace "from '#shared/models/wallet'", "from '#features/wallet/domain/models/wallet'"
    $content = $content -replace "from '#shared/services/wallet_service'", "from '#features/wallet/application/services/wallet_service'"

    # Fix imports to device feature
    $content = $content -replace "from '#shared/interfaces/repositories/device_repository'", "from '#features/device/domain/interfaces/device_repository'"
    $content = $content -replace "from '#shared/models/device'", "from '#features/device/domain/models/device'"
    $content = $content -replace "from '#shared/services/device_service'", "from '#features/device/application/services/device_service'"

    # Fix imports to fees feature
    $content = $content -replace "from '#shared/interfaces/repositories/service_provider_fees\.repository'", "from '#features/fees/domain/interfaces/service_provider_fees.repository'"
    $content = $content -replace "from '#shared/repositories/service_provider_fees_repository_impl'", "from '#features/fees/infrastructure/repositories/service_provider_fees_repository_impl'"
    $content = $content -replace "from '#shared/domain/fees/fee_calculator'", "from '#features/fees/domain/services/fee_calculator'"
    $content = $content -replace "from '#shared/domain/fees/fee_types'", "from '#features/fees/domain/services/fee_types'"

    # Fix shared/exceptions to kernel
    $content = $content -replace "from '#shared/exceptions/", "from '#shared/kernel/exceptions/"

    # Fix helpers to kernel/utils
    $content = $content -replace "from '\.\./\.\./\.\./\.\./helpers/utiles\.js'", "from '#shared/kernel/utils/utiles'"
    $content = $content -replace "from '\.\./\.\./\.\./\.\./helpers/http_helpers\.js'", "from '#shared/kernel/utils/http_helpers'"

    # Save only if modified
    if ($content -ne $originalContent) {
        Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($filePath.Replace($projectRoot, ''))" -ForegroundColor Green
        return $true
    }
    return $false
}

Write-Host "=== Fixing imports in features ===" -ForegroundColor Cyan
$fixed = 0
Get-ChildItem -Path $projectRoot -Filter "*.ts" -Recurse | ForEach-Object {
    if (Fix-Imports $_.FullName) {
        $fixed++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "$fixed files fixed" -ForegroundColor Green
