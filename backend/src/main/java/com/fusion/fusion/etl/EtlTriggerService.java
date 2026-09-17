package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

// Fila de pedidos de scrape pendentes — em memória, de propósito.
// O backend nunca chama o ETL (ele está atrás do NAT da rede do
// usuário, inalcançável de fora sem tunel); o ETL é quem pergunta
// periodicamente "tem pedido pendente?" (poll()) e reivindica um de
// cada vez. Perder a fila num restart do backend é aceitável — o
// pior caso é o usuário clicar "Atualizar agora" de novo.
@Service
public class EtlTriggerService {

    private record TriggerEntry(Instant timestamp, String plate) {}

    // 1 pendente por tipo — correto pros jobs de scrape (Dispositivos/
    // Vinculos/Posicao/i4pro), onde um segundo clique em "Atualizar
    // agora" antes do primeiro ser reivindicado deve mesmo substituir o
    // pedido anterior (nao faz sentido rodar o mesmo scrape duas vezes
    // seguidas). Mensagem de WhatsApp NAO se encaixa nesse modelo — cada
    // instalacao nova precisa da sua propria mensagem entregue, entao
    // fica numa fila separada abaixo.
    private final Map<ImportType, TriggerEntry> pending = new ConcurrentHashMap<>();

    // Fila especifica pra mensagens de WhatsApp — suporta multiplas
    // pendentes. Sem isso, duas instalacoes novas no mesmo ciclo de sync
    // (30min) faziam a segunda chamada a request(WHATSAPP_MESSAGE, ...)
    // sobrescrever a primeira no Map acima antes do ETL local conseguir
    // reivindicar (caso real: BCG6D83 perdida, PWT3869 sobrescreveu).
    private final Queue<String> whatsappQueue = new ConcurrentLinkedQueue<>();

    // O backend nao tem visibilidade nenhuma da conexao Baileys em si —
    // ela vive inteiramente no processo Node externo (triggerPoller.js),
    // que so aparece aqui puxando pollWhatsApp() a cada 15s (ver
    // POLL_INTERVAL_MS la). Carimbar esse instante e' o unico sinal real
    // que o backend tem de "o poller (e portanto o Baileys) esta vivo" —
    // usado por GET /setup/system-health pra inferir CONECTADO/
    // DESCONECTADO sem inventar um estado que o backend nao possui.
    private volatile Instant lastWhatsAppPollAt;

    public void request(ImportType type) {
        request(type, null);
    }

    public void request(ImportType type, String plate) {
        pending.put(type, new TriggerEntry(Instant.now(), plate));
    }

    // Reivindica (remove) um pedido pendente, se existir, na ordem em
    // que foram solicitados. Retorna o tipo e a placa (null = bulk).
    public Optional<EtlTriggerPayload> poll() {
        return pending.entrySet()
                .stream()
                .min(Comparator.comparing(e -> e.getValue().timestamp()))
                .map(entry -> {
                    String plate = entry.getValue().plate();
                    pending.remove(entry.getKey());
                    return new EtlTriggerPayload(entry.getKey(), plate);
                });
    }

    public void requestWhatsApp(String message) {
        whatsappQueue.offer(message);
    }

    // Reivindica (remove) a mensagem mais antiga da fila, ou null se
    // vazia. Chamado repetidamente pelo ETL local ate' esvaziar —
    // diferente de poll() acima, aqui pode haver varias pendentes.
    public String pollWhatsApp() {
        lastWhatsAppPollAt = Instant.now();
        return whatsappQueue.poll();
    }

    public Instant getLastWhatsAppPollAt() {
        return lastWhatsAppPollAt;
    }

    public record EtlTriggerPayload(ImportType type, String plate) {}

}
