import { NextResponse } from "next/server";
import { query, DB_REALMD } from "@/lib/db";

export async function GET() {
  let realmAddress = "127.0.0.1";
  try {
    const rows = await query<{ address: string }>(
      `SELECT address FROM ${DB_REALMD}.realmlist ORDER BY id LIMIT 1`
    );
    if (rows.length) realmAddress = rows[0].address;
  } catch { /* ignore */ }

  const script = `# setup-client.ps1 — WoW 3.3.5a Client Setup
# Right-click this file and select "Run with PowerShell"

$realmlist = "set realmlist ${realmAddress}"

# Update realmlist.wtf for all locales
$locales = @("enUS", "enGB", "deDE", "esES", "esMX", "frFR", "koKR", "ruRU", "zhCN", "zhTW")
foreach ($locale in $locales) {
    $wtfPath = Join-Path $PSScriptRoot "Data\\$locale\\realmlist.wtf"
    if (Test-Path (Split-Path $wtfPath)) {
        Set-Content -Path $wtfPath -Value $realmlist -Encoding ASCII
        Write-Host "Updated $wtfPath" -ForegroundColor Green
    }
}

# Enable windowed mode in WTF/Config.wtf
$configDir = Join-Path $PSScriptRoot "WTF"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
}
$configPath = Join-Path $configDir "Config.wtf"
if (Test-Path $configPath) {
    $content = Get-Content $configPath -Raw
    if ($content -match 'SET gxWindow') {
        $content = $content -replace 'SET gxWindow "\\d+"', 'SET gxWindow "1"'
    } else {
        $content += "\`nSET gxWindow \`"1\`""
    }
    Set-Content -Path $configPath -Value $content -Encoding ASCII
} else {
    Set-Content -Path $configPath -Value 'SET gxWindow "1"' -Encoding ASCII
}
Write-Host "Enabled windowed mode in WTF/Config.wtf" -ForegroundColor Green

Write-Host ""
Write-Host "Done! Your client is configured for ${realmAddress}" -ForegroundColor Cyan
Write-Host "Launch WoW.exe to connect." -ForegroundColor Cyan
Read-Host "Press Enter to close"
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="setup-client.ps1"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
