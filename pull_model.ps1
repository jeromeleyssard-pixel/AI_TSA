Param(
  [Parameter(Mandatory=$true)][string]$ModelName
)

if (-not (Get-Command "ollama" -ErrorAction SilentlyContinue)) {
  Write-Host "La commande 'ollama' n'est pas trouvée. Installe Ollama et réessaie." -ForegroundColor Yellow
  exit 1
}

Write-Host "Exécution: ollama pull $ModelName" -ForegroundColor Cyan
try {
  & ollama pull $ModelName
} catch {
  Write-Host "Erreur lors du pull du modèle: $_" -ForegroundColor Red
  exit 2
}

Write-Host "Terminé. Vérifie avec 'ollama list' que le modèle est présent." -ForegroundColor Green
