package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

// Fila de pedidos de scrape pendentes — em memoria, de proposito.
// O backend nunca chama o ETL (ele esta atras do NAT da rede do
// usuario, inalcancavel de fora sem tunel); o ETL e' quem pergunta
// periodicamente "tem pedido pendente?" (poll()) e reivindica um de
// cada vez. Perder a fila num restart do backend e aceitavel — o
// pior caso e' o usuario clicar "Atualizar agora" de novo.
@Service
public class EtlTriggerService {

    private final Map<ImportType, Instant> pending =
            new ConcurrentHashMap<>();

    public void request(ImportType type) {

        pending.put(type, Instant.now());

    }

    // Reivindica (remove) um pedido pendente, se existir, na ordem em
    // que foram solicitados.
    public Optional<ImportType> poll() {

        return pending.entrySet()
                .stream()
                .min(Map.Entry.comparingByValue())
                .map(entry -> {

                    pending.remove(entry.getKey());

                    return entry.getKey();

                });

    }

}
