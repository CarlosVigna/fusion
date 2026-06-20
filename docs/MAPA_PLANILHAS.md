# Mapa de dados das planilhas do Multiportal

Documento gerado a partir da inspeção direta dos arquivos reais mais recentes
em `C:/FusionData/imports/backup/multiportal/` em 2026-06-20. Sempre que o
Multiportal mudar o layout do relatório, este documento deve ser atualizado.

Estrutura comum às 3 planilhas: linha 0 = metadado ("Data Emissão: ..."),
linhas 1-2 em branco, linha 3 = cabeçalho real, dados a partir da linha 4.
**Os 3 import services já localizam o cabeçalho dinamicamente** (procurando
pelo texto da primeira coluna — "Número", "Data Inicial" ou "Placa"), em vez
de usar um número de linha fixo. Não há offset hardcoded nesse ponto.

---

## Planilha: Dispositivos (Device)

Arquivo de referência: `MULTIPORTAL_DEVICES_2026-06-20_17-46.xlsx`
Aba: `Dispositivo` · Linha de cabeçalho real: índice 3

| Índice | Coluna (cabeçalho) | Exemplo | Usado no código? | Campo no banco |
|--------|---------------------|---------|-------------------|----------------|
| 0 | Número | 1598 | Sim | `device.number` |
| 1 | Número STR | 1598 | Sim | `device.numberStr` — **chave única do Device** (substituiu IMEI na Sprint 4) |
| 2 | Versão Módulo | (vazio) | Não | — |
| 3 | Data cadastro | 07/10/2025 - 11:58 | Não | — |
| 4 | Veículo | TESTE2605 | Sim | placa usada para achar/criar `Vehicle` e linkar direto |
| 5 | Móvel | Não | Não | — |
| 6 | Serial Chip 1 | 89555480000080945112 | Não | — |
| 7 | Operadora 1 | Tim | Sim | `device.operator` (campo sensível — passa por aprovação se já existia) |
| 8 | Linha chip 1 | 5512982582938 | Sim | `device.lineNumber` (campo sensível) |
| 9 | Serial Chip 2 | (vazio) | Não | — |
| 10 | Operadora 2 | (vazio) | Não | — |
| 11 | Linha chip 2 | (vazio) | Não | — |
| 12 | Imei | (geralmente vazio) | Sim | `device.imei` — só preenche se vier não-vazio, não bloqueia mais a criação |
| 13 | Atualização ICCID | (vazio) | Não | — |
| 14 | Fabricante | RST-MICRO | Sim | `device.manufacturer` (campo sensível) |
| 15 | Modelo | (vazio) | Sim | `device.model` (campo sensível) |
| 16 | Usuário cadastro | Yuri | Não | — |
| 17 | Celular - Localização | (vazio) | Não | — |
| 18 | Status | Ativado | Sim | `device.active` (`true` se = "Ativado") |
| 19 | Vínculo Motorista | (vazio) | Não | — |
| 20 | VínculoIbutton | (vazio) | Não | — |
| 21 | Dispositivo Principal | false | Não | — |
| 22 | Local de instalação | (vazio) | Não | — |
| 23 | Observação | (vazio) | Não | — |
| 24 | Status (duplicado) | Sem status | Não | — |

### Observações
- **A maioria das linhas (≈75%) tem IMEI vazio.** Por isso a Sprint 4 trocou a
  chave de identificação do `Device` de `imei` para `numberStr`, que sempre
  vem preenchido.
- Coluna 24 repete o nome "Status" — parece ser outro campo (texto livre tipo
  "Sem status"), distinto da coluna 18. Nenhum dos dois é o mesmo dado.
- Quando a coluna "Veículo" (4) está vazia, o dispositivo é um equipamento em
  estoque, sem veículo associado ainda — comportamento esperado, não é erro.

---

## Planilha: Vínculo (Linkage)

Arquivo de referência: `MULTIPORTAL_LINKS_2026-06-20_17-59.xlsx`
Aba: `Dispositivo Vínculo` · Linha de cabeçalho real: índice 3

| Índice | Coluna (cabeçalho) | Exemplo | Usado no código? | Campo no banco |
|--------|---------------------|---------|-------------------|----------------|
| 0 | Data Inicial | 14/05/2026 10:26:55 | Sim | `device_linkage.startAt` |
| 1 | Data Final | (vazio se "Aberto") | Sim | `device_linkage.endAt` |
| 2 | Placa | 000555 | Sim | usado para achar/criar `Vehicle` |
| 3 | Móvel | Não | Não | — |
| 4 | Número | 279917 | Não | (só `numberStr`, coluna 5, é usado para casar com `Device`) |
| 5 | Número Str | 866703066807969 | Sim | usado para localizar o `Device` (`findByNumberStr`) |
| 6 | Fabricante | Lumini | Sim | `device_linkage.manufacturer` |
| 7 | Aberto / Encerrado | Aberto | Sim | só linhas "Aberto" geram/atualizam vínculo ativo; "Encerrado" é ignorada |

### Observações
- Não há ambiguidade de data aqui — só existem "Data Inicial"/"Data Final",
  sem o problema de múltiplas colunas de data da planilha de Última Posição.
- A maioria das linhas é "Encerrado" (vínculos históricos); só uma fração é
  "Aberto" (vínculo vigente) — é esperado e correto ignorar as encerradas.

---

## Planilha: Última Posição (Operational)

Arquivo de referência: `MULTIPORTAL_LIST_2026-06-20_18-16.xls`
Aba: `Última Posição` · Linha de cabeçalho real: índice 3

| Índice | Coluna (cabeçalho) | Exemplo | Usado no código? | Campo no banco |
|--------|---------------------|---------|-------------------|----------------|
| 0 | Placa | PDK9F20 | Sim | usado para achar `Vehicle` (não cria — só atualiza) |
| 1 | Fabricante | LUMINI | Não | (já vem do Device, via Dispositivos) |
| 2 | Serial | 868022031343457 | Não | — |
| 3 | **Data GSM** | 20/06/2026 18:11:39 | **Sim** | `vehicle_operational_state.lastCommunicationAt` — a que o Grid exibe como posição/atraso |
| 4 | **Data Posição** | 20/06/2026 18:11:37 | **Sim** | `vehicle_operational_state.lastPositionAt` |
| 5 | **Data Evento** | 20/06/2026 18:11:37 | **Não** | ignorada |
| 6 | S/A | On -  Ativado | Não | — |
| 7 | Velocidade | 26 | Sim | `vehicle_operational_state.speed` |
| 8 | Online | Sim | Sim | `vehicle_operational_state.online` / `communicationStatus` |
| 9 | Eventos | Posição | Não | — |
| 10 | Lat/Lng | -8.038235 -34.918152 | Não | **ignorada — não há campo de coordenadas no banco hoje** |
| 11 | Proprietário | EDNA MARIANA DE LIMA | Sim | `vehicle.insuredName` (campo sensível só nesse fluxo, sem aprovação) |
| 12 | Endereço | r da olegarina... | Sim | `vehicle_operational_state.address` |
| 13 | Empresa | (geralmente vazio) | Não | — |
| 14 | Bateria | 100% | Sim | `vehicle_operational_state.batteryLevel` |

### Observação especial — Data GSM vs Data Posição vs Data Evento
Confirmado inspecionando a planilha real e o código (`OperationalListImportService.java`):

- **Data GSM (índice 3)** → lida corretamente como `lastCommunicationAt`,
  que é exatamente o campo que o Grid usa para `positionDate`/`positionTime`/
  atraso de sinal (`VehicleGridService` lê `snapshot.getLastCommunicationAt()`).
  **O sistema já está lendo a coluna certa, conforme você confirmou que
  Data GSM é a mais confiável.**
- **Data Posição (índice 4)** → lida como `lastPositionAt`, salva no banco
  mas **não é exibida em lugar nenhum do Grid hoje** (campo existe, só não é
  usado na resposta da API). Os dois valores costumam ficar muito próximos
  (1-2 segundos de diferença), então isso raramente importa na prática.
- **Data Evento (índice 5)** → não é lida em lugar nenhum. Nos exemplos
  reais, é idêntica a Data Posição.
- Conclusão: **não havia bug de coluna errada.** A causa real do atraso
  reportado (placa PDK9F20) está descrita na Parte 1 do diagnóstico — é o
  agendador (`scheduler.js`) não estar rodando continuamente, não uma leitura
  de coluna incorreta.

### Outras observações
- Coordenadas (Lat/Lng) são capturadas pelo Multiportal mas descartadas pelo
  import — dado útil não aproveitado, fica registrado aqui para uma
  eventual feature de mapa.
- "Empresa" aparece vazia em todos os exemplos observados; função
  desconhecida.
