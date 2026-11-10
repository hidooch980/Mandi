param(
  [switch]$BumpVersion,
  [string]$NewVersionName = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$VersionFile = Join-Path $PSScriptRoot "android\version.properties"
$props = Get-Content $VersionFile -Raw
$currentCode = [int]([regex]::Match($props, "VERSION_CODE\s*=\s*(\d+)").Groups[1].Value)
$currentName = ([regex]::Match($props, "VERSION_NAME\s*=\s*([^\r\n]+)").Groups[1].Value).Trim()

if ($BumpVersion) {
  $currentCode = $currentCode + 1
  if ($NewVersionName -ne "") {
    $currentName = $NewVersionName
  } else {
    $parts = $currentName.Split(".")
    if ($parts.Length -eq 3) {
      $parts[2] = [string]([int]$parts[2] + 1)
      $currentName = ($parts -join ".")
    }
  }
  @"
VERSION_CODE=$currentCode
VERSION_NAME=$currentName
"@ | Set-Content -Path $VersionFile -Encoding UTF8
  Write-Host "Version bumped to $currentName (code $currentCode)" -ForegroundColor Cyan
}

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "D:\Android\Sdk"
$gradleBat = "$env:USERPROFILE\.gradle\wrapper\dists\gradle-9.3.1-all\9ot9r568e8zfvvd4mn8rbu1j0\gradle-9.3.1\bin\gradle.bat"

& $gradleBat -p "$PSScriptRoot\android" assembleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }

$builtApk = Join-Path $PSScriptRoot "android\app\build\outputs\apk\release\app-release.apk"
if (!(Test-Path $builtApk)) { throw "Release APK not found at $builtApk" }

$apksigner = "D:\Android\Sdk\build-tools\36.0.0\apksigner.bat"
if (Test-Path $apksigner) {
  & $apksigner verify --print-certs $builtApk
  if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed" }
}

New-Item -ItemType Directory -Force -Path "$PSScriptRoot\release", "$PSScriptRoot\public\downloads" | Out-Null
$releaseApk = "$PSScriptRoot\release\petronabz-v$currentName-code$currentCode.apk"
$latestApk = "$PSScriptRoot\public\downloads\petronabz-latest.apk"

Copy-Item $builtApk $releaseApk -Force
Copy-Item $builtApk $latestApk -Force

Write-Host "Signed APK ready:" -ForegroundColor Green
Write-Host "  1) $releaseApk"
Write-Host "  2) $latestApk"
