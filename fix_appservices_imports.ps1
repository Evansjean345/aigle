# Script to fix imports for appServices feature

$projectRoot = "G:\Fintech\AigleApps\aigle-send-api-v2\app"

function Fix-AppServicesImports {
    param([string]$filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8
    $originalContent = $content

    # Fix imports for ServiceType
    $content = $content -replace "from '#shared/models/service_type'", "from '#features/appServices/domain/models/service_type'"
    $content = $content -replace "from '#shared/interfaces/services_management/service_type_repository'", "from '#features/appServices/domain/interfaces/service_type_repository'"
    $content = $content -replace "from '#shared/repositories/service_type_repository_impl'", "from '#features/appServices/infrastructure/repositories/service_type_repository_impl'"

    # Fix imports for Provider
    $content = $content -replace "from '#shared/models/provider'", "from '#features/appServices/domain/models/provider'"
    $content = $content -replace "from '#shared/interfaces/services_management/provider_repository'", "from '#features/appServices/domain/interfaces/provider_repository'"
    $content = $content -replace "from '#shared/repositories/provider_repository_impl'", "from '#features/appServices/infrastructure/repositories/provider_repository_impl'"

    # Fix imports for PaymentMethod
    $content = $content -replace "from '#shared/models/payment_method'", "from '#features/appServices/domain/models/payment_method'"
    $content = $content -replace "from '#shared/interfaces/services_management/payment_method_repository'", "from '#features/appServices/domain/interfaces/payment_method_repository'"
    $content = $content -replace "from '#shared/repositories/payment_method_repository_impl'", "from '#features/appServices/infrastructure/repositories/payment_method_repository_impl'"

    # Fix imports for ServiceProviderMethod
    $content = $content -replace "from '#shared/models/service_provider_method'", "from '#features/appServices/domain/models/service_provider_method'"

    # Fix admin services_management controllers imports
    $content = $content -replace "from '#admin/services_management/controllers/", "from '#features/appServices/presentation/admin/controllers/"
    $content = $content -replace "from '#admin/services_management/repositories/", "from '#features/appServices/infrastructure/repositories/"

    # Fix mobile services imports
    $content = $content -replace "from '#mobile/services/", "from '#features/appServices/presentation/mobile/"

    # Fix internal imports within appServices files (relative to absolute)
    if ($filePath -like "*\appServices\*") {
        # Fix relative imports to use feature alias
        $content = $content -replace "from '\.\./\.\./domain/models/service_type'", "from '#features/appServices/domain/models/service_type'"
        $content = $content -replace "from '\.\./\.\./domain/models/provider'", "from '#features/appServices/domain/models/provider'"
        $content = $content -replace "from '\.\./\.\./domain/models/payment_method'", "from '#features/appServices/domain/models/payment_method'"
        $content = $content -replace "from '\.\./\.\./domain/models/service_provider_method'", "from '#features/appServices/domain/models/service_provider_method'"
        $content = $content -replace "from '\.\./\.\./domain/interfaces/", "from '#features/appServices/domain/interfaces/"
        $content = $content -replace "from '\.\./\.\./infrastructure/repositories/", "from '#features/appServices/infrastructure/repositories/"
        $content = $content -replace "from '\.\.\/\.\.\/\.\.\/domain/", "from '#features/appServices/domain/"
        $content = $content -replace "from '\.\.\/\.\.\/\.\.\/infrastructure/", "from '#features/appServices/infrastructure/"
    }

    # Save only if modified
    if ($content -ne $originalContent) {
        Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($filePath.Replace($projectRoot, ''))" -ForegroundColor Green
        return $true
    }
    return $false
}

Write-Host "=== Fixing appServices imports ===" -ForegroundColor Cyan
$fixed = 0
Get-ChildItem -Path $projectRoot -Filter "*.ts" -Recurse | ForEach-Object {
    if (Fix-AppServicesImports $_.FullName) {
        $fixed++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "$fixed files fixed" -ForegroundColor Green
