' Roda start-etl.bat sem nenhuma janela de console visivel.
' "Run ..., 0, True" = janela oculta (0) e espera o processo terminar
' (True) — preserva o comportamento de detectar falha/reiniciar da
' Tarefa Agendada (ela monitora o processo do wscript.exe, que so
' termina quando o node.exe dentro do .bat termina).
Dim WshShell, fso, scriptDir

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.Run """" & scriptDir & "\start-etl.bat""", 0, True
