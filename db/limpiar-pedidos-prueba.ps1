param(
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$Database = "quantumware",
    [string]$User = "quantumware_app"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PGCLIENTENCODING = "UTF8"

$ErrorActionPreference = "Stop"

function Resolve-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidatos = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue
    if ($candidatos) { return ($candidatos | Sort-Object FullName -Descending | Select-Object -First 1).FullName }
    throw "No se encontró psql. Agrega la carpeta bin de PostgreSQL al PATH."
}

$psql = Resolve-Psql

Write-Host "Esta operación eliminará todos los pedidos y sus detalles (datos ficticios de prueba)."
$confirmacion = Read-Host "Escribe CONFIRMAR para continuar"
if ($confirmacion -ne "CONFIRMAR") {
    Write-Host "Operación cancelada."
    return
}

$secure = Read-Host "Contraseña de $User" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plano = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
$env:PGPASSWORD = $plano

try {
    "DELETE FROM pedido;" | & $psql -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $User -d $Database
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron eliminar los pedidos." }
    Write-Host "Pedidos de prueba eliminados."
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
