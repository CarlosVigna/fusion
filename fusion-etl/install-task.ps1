<#
.SYNOPSIS
    Registra a Tarefa Agendada do Windows que inicia o ETL Fusion
    (scheduler.js + polling de atualizacao manual) automaticamente ao
    fazer logon, sem abrir nenhuma janela de console visivel.

.NOTES
    Execute este script UMA VEZ, logado como o proprio usuario que vai
    rodar o ETL (nao precisa ser administrador).
#>

$TaskName = "FusionETL"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BatPath = Join-Path $ScriptDir "start-etl.bat"
$VbsPath = Join-Path $ScriptDir "start-etl-hidden.vbs"
$CurrentUser = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path $BatPath)) {
    Write-Error "Nao encontrei $BatPath. Rode este script de dentro de fusion-etl/."
    exit 1
}

Write-Host "Registrando tarefa '$TaskName' para o usuario '$CurrentUser'..."

# Executa via wscript.exe + .vbs em vez do .bat direto — assim a janela
# de console do node.exe fica oculta. O .vbs espera o processo terminar
# (Run ..., 0, True), entao a Tarefa Agendada ainda detecta queda e
# reinicia normalmente.
$Action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "`"$VbsPath`"" `
    -WorkingDirectory $ScriptDir

$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser

# ExecutionTimeLimit = zero -> sem limite (o ETL deve rodar indefinidamente,
# nao e uma tarefa de execucao unica). RestartCount/RestartInterval cobrem
# o caso do processo cair sozinho.
$Settings = New-ScheduledTaskSettingsSet `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

# LogonType Interactive + RunLevel Limited: roda com a sessao interativa
# do usuario (necessario para o Playwright abrir o browser corretamente),
# sem privilegio elevado.
$Principal = New-ScheduledTaskPrincipal `
    -UserId $CurrentUser `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Inicia o ETL Fusion (scheduler + polling) ao fazer login, sem janela visivel" `
    -Force

Write-Host ""
Write-Host "Tarefa '$TaskName' registrada com sucesso."
Write-Host "Ela vai iniciar automaticamente no proximo logon."
Write-Host "Para iniciar agora sem precisar relogar, rode:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
