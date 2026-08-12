package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

// Fila de pedidos de scrape pendentes — em memória, de propósito.
// O backend nunca chama o ETL (ele está atrás do NAT da rede do
// usuário, inalcançável de fora sem tunel); o ETL é quem pergunta
// periodicamente "tem pedido pendente?" (poll()) e reivindica um de
// cada vez. Perder a fila num restart do backend é aceitável — o
// pior caso é o usuário clicar "Atualizar agora" de novo.
@Service
public class EtlTriggerService {

    private record TriggerEntry(Instant timestamp, String plate) {}

    private final Map<ImportType, TriggerEntry> pending = new ConcurrentHashMap<>();

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

    public record EtlTriggerPayload(ImportType type, String plate) {}

}
