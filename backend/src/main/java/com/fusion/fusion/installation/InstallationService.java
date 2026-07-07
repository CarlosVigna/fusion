package com.fusion.fusion.installation;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.common.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InstallationService {

    private final InstallationRepository repository;

    private final CurrentUserService currentUserService;

    public List<InstallationResponse> findAll(String status) {

        if (status == null || status.isBlank()) {
            return repository.findAllByOrderByCreatedAtDesc()
                    .stream()
                    .map(InstallationResponse::from)
                    .toList();
        }

        InstallationStatus s = InstallationStatus.valueOf(status.toUpperCase());

        return repository.findByStatusOrderByCreatedAtDesc(s)
                .stream()
                .map(InstallationResponse::from)
                .toList();

    }

    public long countPending() {
        return repository.countByStatus(InstallationStatus.PENDING);
    }

    @Transactional
    public InstallationResponse create(InstallationRequest request) {

        Installation installation = Installation.builder()
                .externalId(request.externalId())
                .customerName(request.customerName())
                .address(request.address())
                .neighborhood(request.neighborhood())
                .city(request.city())
                .state(request.state())
                .zipCode(request.zipCode())
                .phone(request.phone())
                .plate(request.plate())
                .model(request.model())
                .numeroProposta(request.numeroProposta())
                .portalCreatedAt(request.portalCreatedAt())
                .serviceType(request.serviceType())
                .build();

        repository.save(installation);

        return InstallationResponse.from(installation);

    }

    @Transactional
    public InstallationResponse markSent(Long id) {

        Installation installation = findOrThrow(id);

        installation.setStatus(InstallationStatus.SENT);

        installation.setSentAt(LocalDateTime.now(ZoneOffset.UTC));

        installation.setSentBy(currentUserService.getCurrentUserName());

        repository.save(installation);

        return InstallationResponse.from(installation);

    }

    @Transactional
    public InstallationResponse cancel(Long id) {

        Installation installation = findOrThrow(id);

        installation.setStatus(InstallationStatus.CANCELLED);

        repository.save(installation);

        return InstallationResponse.from(installation);

    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    @Transactional
    public Map<String, Integer> sync(List<InstallationRequest> items) {

        int inserted = 0;
        int skipped = 0;

        for (InstallationRequest req : items) {

            if (req.externalId() != null
                    && repository.findByExternalId(req.externalId()).isPresent()) {
                skipped++;
                continue;
            }

            Installation installation = Installation.builder()
                    .externalId(req.externalId())
                    .customerName(req.customerName())
                    .address(req.address())
                    .neighborhood(req.neighborhood())
                    .city(req.city())
                    .state(req.state())
                    .zipCode(req.zipCode())
                    .phone(req.phone())
                    .plate(req.plate())
                    .model(req.model())
                    .numeroProposta(req.numeroProposta())
                    .portalCreatedAt(req.portalCreatedAt())
                    .serviceType(req.serviceType())
                    .build();

            repository.save(installation);

            inserted++;

        }

        return Map.of("inserted", inserted, "skipped", skipped);

    }

    private Installation findOrThrow(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instalação não encontrada"
                ));

    }

}
