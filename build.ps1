#!/usr/bin/env pwsh

param(
  [ValidateSet("build","start")]
  [string]$Action = "build"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ("`n[ShadowRecon] " + $msg) -ForegroundColor Cyan
}

Write-Step "Node.js এবং npm নির্ভরতা চেক ও ইনস্টল করছি…"
npm install

if ($Action -eq "start") {
  Write-Step "Electron app start হচ্ছে…"
  npm start
  exit 0
}

Write-Step "Windows installer build (electron-builder) চলছে…"
npm run build

Write-Step "Done. dist\\ ফোল্ডারে আউটপুট তৈরি হয়েছে।"

