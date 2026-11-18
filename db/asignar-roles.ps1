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
$env:PGCLIENTENCODING = "UTF8"

Write-Host "Asignacion de roles en la tabla user_roles de QuantumWare."
Write-Host "Obten el identificador (user id / sub) de cada usuario en Supabase: Authentication > Users."

$subAdmin = Read-Host "sub del usuario administrador"
$subCliente = Read-Host "sub del usuario cliente"

if ([string]::IsNullOrWhiteSpace($subAdmin) -or [string]::IsNullOrWhiteSpace($subCliente)) {
    throw "Ambos identificadores son obligatorios."
}

$sql = @"
INSERT INTO user_roles (user_id, rol) VALUES ('$subAdmin', 'admin')
ON CONFLICT (user_id) DO UPDATE SET rol = EXCLUDED.rol;
INSERT INTO user_roles (user_id, rol) VALUES ('$subCliente', 'cliente')
ON CONFLICT (user_id) DO UPDATE SET rol = EXCLUDED.rol;
SELECT user_id, rol FROM user_roles ORDER BY rol;
"@

try {
    if ($ConnectionString) {
        $sql | & $psql -v ON_ERROR_STOP=1 -d $ConnectionString
    }
    else {
        $secure = Read-Host "Contrasena de $User" -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        $sql | & $psql -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $User -d $Database
    }
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron asignar los roles." }
    Write-Host "Roles asignados correctamente."
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\PGCLIENTENCODING -ErrorAction SilentlyContinue
    if ($bstr) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
