# Script to fix Country imports to use new feature path

$projectRoot = "G:\Fintech\AigleApps\aigle-send-api-v2\app"

function Fix-CountryImports {
    param([string]$filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8
    $originalContent = $content

    # Fix Country model imports
    $content = $content -replace "from '#shared/models/country'", "from '#features/country/domain/models/country'"

    # Fix CountryRepository interface imports
    $content = $content -replace "from '#shared/interfaces/repositories/country_repository'", "from '#features/country/domain/interfaces/country_repository'"

    # Save only if modified
    if ($content -ne $originalContent) {
        Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($filePath.Replace($projectRoot, ''))" -ForegroundColor Green
        return $true
    }
    return $false
}

Write-Host "=== Fixing Country imports ===" -ForegroundColor Cyan
$fixed = 0
Get-ChildItem -Path $projectRoot -Filter "*.ts" -Recurse | ForEach-Object {
    if (Fix-CountryImports $_.FullName) {
        $fixed++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "$fixed files fixed" -ForegroundColor Green
