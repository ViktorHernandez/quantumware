param(
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$Database = "quantumware",
    [string]$User = "quantumware_app",
    [string]$ConnectionString = ""
)

$ErrorActionPreference = "Stop"

function Resolve-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidatos = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue
    if ($candidatos) { return ($candidatos | Sort-Object FullName -Descending | Select-Object -First 1).FullName }
    throw "No se encontro psql. Agrega la carpeta bin de PostgreSQL al PATH."
}

$psql = Resolve-Psql
$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path
$archivo = Join-Path $carpeta "datos-demostracion.sql"
$env:PGCLIENTENCODING = "UTF8"

Write-Host "Esta operacion agrega datos ficticios de demostracion (productos, pedidos y movimientos)."
Write-Host "Es idempotente y no modifica ni elimina registros existentes."

try {
    if ($ConnectionString) {
        & $psql -v ON_ERROR_STOP=1 -d $ConnectionString -f $archivo
    }
    else {
        $secure = Read-Host "Contrasena de $User" -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        & $psql -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $User -d $Database -f $archivo
    }
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron cargar los datos de demostracion." }
    Write-Host "Datos de demostracion cargados."
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\PGCLIENTENCODING -ErrorAction SilentlyContinue
    if ($bstr) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
