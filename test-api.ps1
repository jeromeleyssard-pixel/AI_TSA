# test-api.ps1
# Exécuter après que le serveur Node et le service d'embeddings soient démarrés.
# Envoie quelques requêtes de test et affiche les résultats.

$base = 'http://localhost:3000'

Write-Host "Testing /ask..."
try {
  $body = @{ message = "Je veux finir une tâche, comment commencer ?"; mode = 'planification' } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$base/ask" -Method Post -ContentType 'application/json' -Body $body -ErrorAction Stop
  Write-Host "Response (reply):`n" ($r.reply -join "`n")
  Write-Host "Examples returned: " ($r.examples | ConvertTo-Json -Depth 3)
} catch {
  Write-Host "Error calling /ask: $_" -ForegroundColor Red
}

Write-Host "\nTesting /examples..."
try {
  $ex = Invoke-RestMethod -Uri "$base/examples" -Method Get -ErrorAction Stop
  Write-Host ("Found {0} examples" -f ($ex.items.Count))
} catch {
  Write-Host "Error calling /examples: $_" -ForegroundColor Red
}

Write-Host "\nTesting /feedback (list)..."
try {
  $fb = Invoke-RestMethod -Uri "$base/feedback" -Method Get -ErrorAction Stop
  Write-Host ("Found {0} feedback entries" -f ($fb.items.Count))
} catch {
  Write-Host "Error calling /feedback: $_" -ForegroundColor Red
}

Write-Host "\nTesting rebuild-index..."
try {
  $rb = Invoke-RestMethod -Uri "$base/rebuild-index" -Method Post -ErrorAction Stop
  Write-Host "Rebuild result: " ($rb | ConvertTo-Json -Depth 3)
} catch {
  Write-Host "Error calling /rebuild-index: $_" -ForegroundColor Red
}

Write-Host "\nDone tests."