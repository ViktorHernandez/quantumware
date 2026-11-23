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
$archivos = Get-ChildItem -Path $carpeta -Filter "*.sql" | Sort-Object Name
$env:PGCLIENTENCODING = "UTF8"

function Invocar-Psql {
    param([string[]]$Argumentos)
    if ($ConnectionString) {
        & $psql -v ON_ERROR_STOP=1 -d $ConnectionString @Argumentos
    }
    else {
        & $psql -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $User -d $Database @Argumentos
    }
}

function Consultar-Psql {
    param([string]$Sql)
    if ($ConnectionString) {
        return (& $psql -tAc $Sql -d $ConnectionString)
    }
    return (& $psql -tAc $Sql -h $DbHost -p $Port -U $User -d $Database)
}

if (-not $ConnectionString) {
    Write-Host "Aplicando migraciones en $Database@$DbHost`:$Port como $User"
    $secure = Read-Host "Contrasena de $User" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

try {
    Invocar-Psql @("-q", "-c", "CREATE TABLE IF NOT EXISTS schema_migrations (archivo text PRIMARY KEY, aplicada timestamptz NOT NULL DEFAULT now());") | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No fue posible conectar a la base de datos." }

    foreach ($archivo in $archivos) {
        $yaAplicada = Consultar-Psql "SELECT 1 FROM schema_migrations WHERE archivo = '$($archivo.Name)'"
        if ($yaAplicada -eq "1") {
            Write-Host "  $($archivo.Name) ya aplicada" -ForegroundColor DarkGray
            continue
        }
        Write-Host "Ejecutando $($archivo.Name)"
        Invocar-Psql @("-f", $archivo.FullName)
        if ($LASTEXITCODE -ne 0) { throw "Fallo la ejecucion de $($archivo.Name)" }
        Invocar-Psql @("-q", "-c", "INSERT INTO schema_migrations (archivo) VALUES ('$($archivo.Name)') ON CONFLICT DO NOTHING") | Out-Null
    }
    Write-Host "Migraciones al dia." -ForegroundColor Green
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\PGCLIENTENCODING -ErrorAction SilentlyContinue
    if (-not $ConnectionString -and $bstr) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}
