# ETL Fusion — início automático ao logar no Windows

## Por quê
O ETL (scrapers + agendador `scheduler.js`) precisa rodar continuamente no
PC local. Antes desta configuração, ninguém estava deixando o processo
rodando manualmente, e isso causava dados desatualizados (ex.: caso da
placa PDK9F20, ~40h sem nenhuma sincronização).

## Como funciona
- `start.js` — processo único que sobe `scheduler.js` (cron de 30min/diário)
  e `src/triggerPoller.js` (polling que pergunta ao backend a cada 15s se
  há um pedido de "Atualizar agora" pendente) juntos, na mesma janela/processo.
- `start-etl.bat` — define o PATH do Node e chama `start.js`.
- `start-etl-hidden.vbs` — roda o `.bat` sem nenhuma janela de console
  visível (é isso que a Tarefa Agendada executa, não o `.bat` direto).
- Uma Tarefa Agendada do Windows ("FusionETL") roda esse `.vbs`
  automaticamente sempre que você faz logon, e reinicia até 3 vezes
  (1 min de intervalo) se o processo cair sozinho.

Não existe mais nenhum servidor HTTP local (`server.js` foi removido):
o ETL só faz chamadas de **saída** (poll no backend + upload do
resultado), nunca recebe chamadas de fora — por isso não precisa mais
de túnel/IP público pra "Atualizar agora" funcionar.

## 1. Instalar (rodar uma vez)
Abra o PowerShell **como o seu usuário normal** (não precisa admin),
navegue até `fusion-etl/` e rode:

```powershell
cd C:\Users\jose.garcia\Desktop\Carlos\fusion\fusion-etl
.\install-task.ps1
```

Isso registra a tarefa "FusionETL" com gatilho "ao fazer logon".

## 2. Verificar se está rodando
```powershell
Get-ScheduledTask -TaskName "FusionETL" | Select-Object TaskName, State
```

`State` deve aparecer como `Running` (depois de logado) ou `Ready`
(aguardando o próximo logon).

Confira também os logs:
- `C:/FusionData/log/etl-startup.log` — timestamp de cada vez que o
  processo subiu.
- `C:/FusionData/log/etl.log` — execuções reais dos scrapers. Procure por
  linhas com `[CRON]` para confirmar que o agendador automático está
  disparando, e `[POLL]` para confirmar pedidos de "Atualizar agora"
  vindos do Fusion.

Status e histórico de execuções também ficam visíveis dentro do próprio
Fusion, na tela de monitoramento do ETL (menu lateral).

## 3. Reiniciar manualmente (sem precisar logout/login)
```powershell
Stop-ScheduledTask -TaskName "FusionETL"
Start-ScheduledTask -TaskName "FusionETL"
```

Se precisar matar processos Node travados antes:
```powershell
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like '*start.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## 4. Desinstalar / desativar
```powershell
# Desativar temporariamente (mantém a tarefa, só não dispara)
Disable-ScheduledTask -TaskName "FusionETL"

# Reativar
Enable-ScheduledTask -TaskName "FusionETL"

# Remover completamente
Unregister-ScheduledTask -TaskName "FusionETL" -Confirm:$false
```

## Observações
- A tarefa roda com a sessão interativa do usuário (`LogonType Interactive`),
  não como SYSTEM — necessário para o Playwright funcionar normalmente.
- Não precisa de privilégio de administrador para instalar nem para rodar.
- Se trocar a senha do Windows do usuário, normalmente não afeta o gatilho
  "At log on" (ele não depende de senha salva, dispara no evento de logon).
