param([string]$CarpetaAccesos = [Environment]::GetFolderPath('Desktop'))
$ErrorActionPreference = 'Stop'
$candidatos = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$chrome = $candidatos | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Instala Google Chrome en el equipo conectado a la impresora POS.' }
if (-not (Test-Path -LiteralPath $CarpetaAccesos -PathType Container)) { throw 'La carpeta de accesos no existe.' }
$perfil = Join-Path $env:LOCALAPPDATA 'Fedra\Chrome-Tickets'
$shellAccesos = New-Object -ComObject WScript.Shell
foreach ($modo in @('Configurar','Directo')) {
  $destino = Join-Path $CarpetaAccesos "Fedra Tickets $modo.lnk"
  if (Test-Path -LiteralPath $destino) { throw "Ya existe $destino. Conserva o retira ese acceso antes de repetir." }
}
foreach ($modo in @('Configurar','Directo')) {
  $destino = Join-Path $CarpetaAccesos "Fedra Tickets $modo.lnk"
  $acceso = $shellAccesos.CreateShortcut($destino)
  $acceso.TargetPath = $chrome
  $directo = if ($modo -eq 'Directo') { ' --kiosk-printing' } else { '' }
  $acceso.Arguments = "--user-data-dir=`"$perfil`" --app=https://sistema-fedra.vercel.app/ventas$directo"
  $acceso.WorkingDirectory = Split-Path -Parent $chrome
  $acceso.Save()
}
Write-Output 'Accesos creados. Primero abre Fedra Tickets Configurar, inicia sesión y selecciona POS-8360, rollo 80 mm y escala 100% al imprimir.'
Write-Output 'Comprueba un ticket de una venta ya registrada usando Reimprimir. Cierra todas las ventanas de ese perfil antes de abrir Fedra Tickets Directo.'
Write-Output 'Usa ese perfil solo para tickets. Las recetas y las historias clínicas se imprimen desde el navegador habitual.'
