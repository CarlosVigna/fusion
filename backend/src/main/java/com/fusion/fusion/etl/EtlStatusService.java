package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EtlStatusService {

    private final EtlStatusRepository repository;

    public List<EtlStatusResponse> findAll() {

        return repository.findAll()
                .stream()
                .map(EtlStatusResponse::from)
                .toList();

    }

    @Transactional
    public void heartbeat(EtlHeartbeatRequest request) {

        EtlStatus status = repository.findById(request.type())
                .orElseGet(() -> EtlStatus.builder()
                        .type(request.type())
                        .build()
                );

        status.setStatus(request.status());

        status.setNextRunAt(request.nextRunAt());

        // SUCCESS/ERROR encerram a execucao — registra a "ultima vez
        // que terminou" e os detalhes. RUNNING so marca que comecou,
        // sem sobrescrever os detalhes da execucao anterior ainda.
        if (request.status() != EtlRunStatus.RUNNING) {

            status.setLastRunAt(LocalDateTime.now(ZoneOffset.UTC));

            status.setLastDurationMs(request.durationMs());

            status.setLastError(request.error());

            status.setLastRecordsProcessed(request.recordsProcessed());

        }

        status.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));

        repository.save(status);

    }

}
