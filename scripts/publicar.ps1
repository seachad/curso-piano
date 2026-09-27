# Publica una lección: la marca como lista en el índice, pasa los tests sobre lo que va al commit, hace commit y push.
# Uso: pwsh scripts/publicar.ps1 2
param([Parameter(Mandatory)][int]$N)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$data = 'assets/curso-data.js'
$src = Get-Content $data -Raw -Encoding utf8
$pattern = "(\{ n: $N, file: '([^']+)'[^\n]*?ready: )false"
$m = [regex]::Match($src, $pattern)
if (-not $m.Success) { throw "La lección $N no existe o ya está publicada" }
$file = "lecciones/$($m.Groups[2].Value).html"
if (-not (Test-Path $file)) { throw "Falta $file" }
Set-Content $data ([regex]::Replace($src, $pattern, '${1}true')) -Encoding utf8 -NoNewline

git add $file $data
$env:STAGED = '1'
node tests/run.mjs
$code = $LASTEXITCODE
Remove-Item Env:STAGED
if ($code -ne 0) {
  git restore --staged $file $data
  Set-Content $data $src -Encoding utf8 -NoNewline
  throw "Los tests fallan: la lección $N no se publica"
}
$title = [regex]::Match($m.Value, "title: '([^']+)'").Groups[1].Value
git commit -q -m "Leccion ${N}: $title"
git push -q
git log --oneline -1
