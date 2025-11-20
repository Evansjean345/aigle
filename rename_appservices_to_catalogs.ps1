# Script to rename appServices feature to catalogs

$projectRoot = "G:\Fintech\AigleApps\aigle-send-api-v2"

Write-Host "=== Etape 1: Renommage du dossier appServices -> catalogs ===" -ForegroundColor Cyan

# Verifier que le dossier appServices existe
if (Test-Path "$projectRoot\app\features\appServices") {
    Rename-Item -Path "$projectRoot\app\features\appServices" -NewName "catalogs" -Force
    Write-Host "OK Dossier renomme: app\features\appServices -> app\features\catalogs" -ForegroundColor Green
} else {
    Write-Host "ERREUR Le dossier appServices n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Etape 2: Mise a jour de package.json ===" -ForegroundColor Cyan

$packageJsonPath = "$projectRoot\package.json"
$packageJson = Get-Content $packageJsonPath -Raw -Encoding UTF8
$originalPackageJson = $packageJson

# Remplacer la ligne d'import appServices par catalogs
$packageJson = $packageJson -replace '"#features/appServices/\*": "\./app/features/appServices/\*\.js"', '"#features/catalogs/*": "./app/features/catalogs/*.js"'

if ($packageJson -ne $originalPackageJson) {
    Set-Content $packageJsonPath -Value $packageJson -Encoding UTF8 -NoNewline
    Write-Host "OK package.json mis a jour" -ForegroundColor Green
} else {
    Write-Host "WARN package.json inchange" -ForegroundColor Yellow
}

Write-Host "`n=== Etape 3: Correction des imports dans tous les fichiers TypeScript ===" -ForegroundColor Cyan

function Fix-AppServicesImports {
    param([string]$filePath)

    $content = Get-Content $filePath -Raw -Encoding UTF8
    $originalContent = $content

    # Remplacer tous les imports de #features/appServices par #features/catalogs
    $content = $content -replace "from '#features/appServices/", "from '#features/catalogs/"
    $content = $content -replace 'from "#features/appServices/', 'from "#features/catalogs/'

    # Sauvegarder seulement si modifie
    if ($content -ne $originalContent) {
        Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  OK Fixed: $($filePath.Replace($projectRoot, ''))" -ForegroundColor Green
        return $true
    }
    return $false
}

$fixed = 0
Get-ChildItem -Path "$projectRoot\app" -Filter "*.ts" -Recurse | ForEach-Object {
    if (Fix-AppServicesImports $_.FullName) {
        $fixed++
    }
}

Write-Host "`n=== Etape 4: Mise a jour de providers/repository_provider.ts ===" -ForegroundColor Cyan

$providerPath = "$projectRoot\providers\repository_provider.ts"
if (Test-Path $providerPath) {
    $providerContent = Get-Content $providerPath -Raw -Encoding UTF8
    $originalProviderContent = $providerContent

    $providerContent = $providerContent -replace "from '#features/appServices/", "from '#features/catalogs/"

    if ($providerContent -ne $originalProviderContent) {
        Set-Content $providerPath -Value $providerContent -Encoding UTF8 -NoNewline
        Write-Host "OK repository_provider.ts mis a jour" -ForegroundColor Green
        $fixed++
    } else {
        Write-Host "WARN repository_provider.ts inchange" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Etape 5: Renommage du script fix_appservices_imports.ps1 ===" -ForegroundColor Cyan

$oldScriptPath = "$projectRoot\fix_appservices_imports.ps1"
$newScriptPath = "$projectRoot\fix_catalogs_imports.ps1"

if (Test-Path $oldScriptPath) {
    # Lire le contenu et le mettre a jour
    $scriptContent = Get-Content $oldScriptPath -Raw -Encoding UTF8
    $scriptContent = $scriptContent -replace "appServices", "catalogs"
    $scriptContent = $scriptContent -replace "appservices", "catalogs"

    # Creer le nouveau script
    Set-Content $newScriptPath -Value $scriptContent -Encoding UTF8 -NoNewline

    # Supprimer l'ancien
    Remove-Item $oldScriptPath -Force

    Write-Host "OK Script renomme: fix_appservices_imports.ps1 -> fix_catalogs_imports.ps1" -ForegroundColor Green
} else {
    Write-Host "WARN fix_appservices_imports.ps1 non trouve" -ForegroundColor Yellow
}

Write-Host "`n=== RESUME ===" -ForegroundColor Cyan
Write-Host "Dossier renomme: app\features\appServices -> app\features\catalogs" -ForegroundColor Green
Write-Host "Fichiers TypeScript corriges: $fixed" -ForegroundColor Green
Write-Host "package.json mis a jour" -ForegroundColor Green
Write-Host "`nOK Migration appServices -> catalogs terminee avec succes!" -ForegroundColor Green
