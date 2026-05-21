#!/usr/bin/env pwsh
# =======================================================================================
# SHADOWRECON ULTIMATE - BUILD & START SCRIPT
# ফাইল: build.ps1 | লাইন: ২২০+ | স্বয়ংক্রিয় বিল্ড, ডিপেন্ডেন্সি চেক, লগিং
# =======================================================================================

param(
  [ValidateSet("build","start","clean","test","all")]
  [string]$Action = "build",
  
  [switch]$Verbose,
  [switch]$Force,
  [string]$Target = "win"  # win, linux, mac
)

$ErrorActionPreference = "Stop"
$script:StartTime = Get-Date

function Write-Step {
  param([string]$Msg, [string]$Color = "Cyan")
  Write-Host ("`n[ShadowRecon] " + $Msg) -ForegroundColor $Color
}

function Write-ErrorMsg {
  param([string]$Msg)
  Write-Host ("[ERROR] " + $Msg) -ForegroundColor Red
}

function Write-Success {
  param([string]$Msg)
  Write-Host ("[SUCCESS] " + $Msg) -ForegroundColor Green
}

function Write-Warning {
  param([string]$Msg)
  Write-Host ("[WARNING] " + $Msg) -ForegroundColor Yellow
}

function Write-Debug {
  param([string]$Msg)
  if ($Verbose) {
    Write-Host ("[DEBUG] " + $Msg) -ForegroundColor DarkGray
  }
}

function Test-NodeInstalled {
  try {
    $nodeVer = node --version 2>$null
    if ($nodeVer) {
      Write-Debug "Node.js version: $nodeVer"
      return $true
    }
  } catch {}
  return $false
}

function Test-NpmInstalled {
  try {
    $npmVer = npm --version 2>$null
    if ($npmVer) {
      Write-Debug "npm version: $npmVer"
      return $true
    }
  } catch {}
  return $false
}

function Get-NodeVersion {
  $ver = node --version 2>$null
  if ($ver -match "v(\d+)\.\d+\.\d+") { return [int]$Matches[1] }
  return 0
}

function Clear-BuildArtifacts {
  Write-Step "ক্লিনিং শুরু..." "Yellow"
  $dirsToClean = @("dist", "reports", "logs", "tools", "captures", "node_modules/.cache")
  foreach ($dir in $dirsToClean) {
    if (Test-Path $dir) {
      Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
      Write-Debug "Removed: $dir"
    }
  }
  Write-Success "ক্লিনিং সম্পন্ন"
}

function Install-Dependencies {
  Write-Step "Node.js এবং npm নির্ভরতা চেক করছি..." "Cyan"
  
  if (-not (Test-NodeInstalled)) {
    Write-ErrorMsg "Node.js পাওয়া যায়নি। অনুগ্রহ করে https://nodejs.org/ থেকে ইনস্টল করুন।"
    exit 1
  }
  
  if (-not (Test-NpmInstalled)) {
    Write-ErrorMsg "npm পাওয়া যায়নি। Node.js রিইনস্টল করুন।"
    exit 1
  }
  
  $nodeMajor = Get-NodeVersion
  if ($nodeMajor -lt 18) {
    Write-Warning "Node.js সংস্করণ $nodeMajor (প্রয়োজন 18+) – কিছু ফিচার কাজ নাও করতে পারে।"
  }
  
  Write-Step "npm install চলছে..."
  if ($Verbose) {
    npm install
  } else {
    npm install --silent
  }
  
  if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "npm install ব্যর্থ হয়েছে।"
    exit $LASTEXITCODE
  }
  Write-Success "নির্ভরতা ইনস্টল সম্পন্ন"
}

function Invoke-Build {
  Write-Step "Windows installer build (electron-builder) চলছে..." "Cyan"
  
  $buildCmd = "npm run build"
  if ($Target -eq "win") {
    $buildCmd = "npm run build:win"
  } elseif ($Target -eq "linux") {
    $buildCmd = "npm run build:linux"
  } elseif ($Target -eq "mac") {
    $buildCmd = "npm run build:mac"
  }
  
  Write-Debug "Build command: $buildCmd"
  Invoke-Expression $buildCmd
  
  if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "বিল্ড ব্যর্থ হয়েছে।"
    exit $LASTEXITCODE
  }
  
  if (Test-Path "dist") {
    Write-Success "বিল্ড সম্পন্ন। আউটপুট ফোল্ডার: dist\"
    Write-Step "ফাইলসমূহ:" "Green"
    Get-ChildItem -Path "dist" -File | ForEach-Object { Write-Host "  - $($_.Name)" }
  } else {
    Write-Warning "dist ফোল্ডার পাওয়া যায়নি।"
  }
}

function Invoke-Test {
  Write-Step "মৌলিক টেস্ট চালানো হচ্ছে..." "Cyan"
  if (Test-Path "main.js") {
    Write-Success "main.js উপস্থিত"
  } else {
    Write-ErrorMsg "main.js অনুপস্থিত"
  }
  if (Test-Path "index.html") {
    Write-Success "index.html উপস্থিত"
  } else {
    Write-ErrorMsg "index.html অনুপস্থিত"
  }
  Write-Success "টেস্ট সম্পন্ন"
}

function Invoke-All {
  Write-Step "সমস্ত অপারেশন এক্সিকিউট হচ্ছে (clean, install, build, test)" "Magenta"
  Clear-BuildArtifacts
  Install-Dependencies
  Invoke-Build
  Invoke-Test
  Write-Success "সবকিছু সম্পন্ন!"
}

function Start-App {
  Write-Step "Electron অ্যাপ ডেভ মোডে চালু হচ্ছে..." "Cyan"
  npm start
}

switch ($Action) {
  "build" {
    Install-Dependencies
    Invoke-Build
  }
  "start" {
    Install-Dependencies
    Start-App
  }
  "clean" {
    Clear-BuildArtifacts
  }
  "test" {
    Invoke-Test
  }
  "all" {
    Invoke-All
  }
  default {
    Write-ErrorMsg "অজানা অ্যাকশন: $Action"
    Write-Host "ব্যবহার: .\build.ps1 -Action [build|start|clean|test|all] [-Verbose] [-Force] [-Target win|linux|mac]"
    exit 1
  }
}

$elapsed = (Get-Date) - $script:StartTime
Write-Step "সময় লেগেছে: $($elapsed.TotalSeconds) সেকেন্ড" "DarkCyan"
