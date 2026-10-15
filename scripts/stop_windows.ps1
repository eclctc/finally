# Stop and remove the FinAlly container. The data volume is kept.
$Container = if ($env:FINALLY_CONTAINER) { $env:FINALLY_CONTAINER } else { "finally" }

$Existing = docker ps -aq --filter "name=^$Container$"
if ($Existing) {
    docker stop $Container | Out-Null
    docker rm $Container | Out-Null
    Write-Host "FinAlly stopped."
} else {
    Write-Host "FinAlly is not running."
}
