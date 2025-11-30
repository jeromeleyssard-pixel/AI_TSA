<#
run-all.ps1
Script d'aide pour lancer l'application localement (Windows PowerShell).
- crée/active l'environnement virtuel Python (.venv)
- installe les dépendances Python (embeddings-requirements.txt)
- installe les dépendances Node si nécessaire
- ouvre deux nouvelles fenêtres PowerShell : une pour le service d'embeddings, une pour le serveur Node
- ouvre la page admin dans le navigateur

Usage (double-cliquez ou exécutez depuis PowerShell):
  .\run-all.ps1

Remarque: si l'exécution de scripts PowerShell est bloquée, exécutez en administrateur:
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "Working directory: $ScriptDir"

# Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "Python n'est pas trouvé dans le PATH. Installez Python 3.8+ puis relancez ce script." -ForegroundColor Yellow
    Write-Host "https://www.python.org/downloads/"
    exit 1
}

# Create venv if missing
$venvPath = Join-Path $ScriptDir '.venv'
if (-not (Test-Path $venvPath)) {
    Write-Host "Création de l'environnement virtuel .venv..."
    python -m venv "$venvPath"
}

# Activate venv for this session
Write-Host "Activation de .venv et mise à jour de pip..."
. "$venvPath\Scripts\Activate.ps1"
python -m pip install --upgrade pip

# Install Python requirements
if (Test-Path (Join-Path $ScriptDir 'embeddings-requirements.txt')) {
    Write-Host "Installation des dépendances Python... (cela peut prendre du temps pour torch)"
    python -m pip install -r "$ScriptDir\embeddings-requirements.txt"
} else {
    Write-Host "embeddings-requirements.txt introuvable, saut de l'installation Python." -ForegroundColor Yellow
}

# Install Node deps if node_modules missing
if (-not (Test-Path (Join-Path $ScriptDir 'node_modules'))) {
    Write-Host "Installation des dépendances Node (npm install)..."
    Push-Location $ScriptDir
    npm install
    Pop-Location
} else {
    Write-Host "Dépendances Node déjà installées (node_modules présent)."
}

# Start embeddings service in a new PowerShell window
$embCmd = "Set-Location -Path '$ScriptDir'; . '$venvPath\Scripts\Activate.ps1'; python .\embeddings_service.py"
Write-Host "Démarrage du service embeddings dans une nouvelle fenêtre PowerShell..."
Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-Command', $embCmd

# Start Node server in a new PowerShell window
$nodeCmd = "Set-Location -Path '$ScriptDir'; npm start"
Write-Host "Démarrage du serveur Node dans une nouvelle fenêtre PowerShell..."
Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-Command', $nodeCmd

Start-Sleep -Seconds 2

# Open admin UI
$adminUrl = 'http://localhost:3000/admin'
Write-Host "Ouverture de l'interface admin: $adminUrl"
Start-Process $adminUrl

Write-Host "Tous les processus ont été lancés (vérifiez les fenêtres ouvertes)." -ForegroundColor Green
