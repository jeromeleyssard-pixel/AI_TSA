Param(
  [string]$OllamaKey = '',
  [string]$OllamaUrl = 'http://localhost:11434/api/generate',
  [string]$Model = 'llama2'
)

if (-not $OllamaKey -or $OllamaKey -eq '') {
  $OllamaKey = Read-Host "Entrez votre OLLAMA_API_KEY (laisser vide si non requis)"
}

if ($OllamaKey -and $OllamaKey -ne '') {
  $env:OLLAMA_API_KEY = $OllamaKey
  Write-Host "OLLAMA_API_KEY defini pour cette session."
} else {
  Write-Host "Aucune cle fournie - le proxy essaiera d'appeler Ollama sans authentification."
}

$env:OLLAMA_URL = $OllamaUrl
$env:OLLAMA_MODEL = $Model
Write-Host "OLLAMA_URL=$OllamaUrl"
Write-Host "OLLAMA_MODEL=$Model"

Write-Host "Démarrage du serveur (npm start). Ctrl+C pour arrêter."
npm start
