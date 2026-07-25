package com.fusion.fusion.installation;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.common.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class InstallationService {

    private final InstallationRepository repository;

    private final InstallationObservationRepository observationRepository;

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

    public long countCritical() {
        ZoneId tz = ZoneId.of("America/Sao_Paulo");
        LocalDate today = LocalDate.now(tz);
        return repository.findByStatusOrderByCreatedAtDesc(InstallationStatus.PENDING)
                .stream()
                .filter(i -> {
                    if (i.getPortalCreatedAt() == null) return false;
                    LocalDate created = i.getPortalCreatedAt().atZone(tz).toLocalDate();
                    return ChronoUnit.DAYS.between(created, today) >= 3;
                })
                .count();
    }

    public Map<String, Object> getDashboard() {

        ZoneId tz = ZoneId.of("America/Sao_Paulo");
        LocalDate today = LocalDate.now(tz);

        List<Installation> pending = repository.findByStatusOrderByCreatedAtDesc(InstallationStatus.PENDING);

        long ok = 0, warning = 0, critical = 0;
        for (Installation i : pending) {
            if (i.getPortalCreatedAt() == null) { ok++; continue; }
            LocalDate created = i.getPortalCreatedAt().atZone(tz).toLocalDate();
            int days = (int) ChronoUnit.DAYS.between(created, today);
            if (days <= 1) ok++;
            else if (days == 2) warning++;
            else critical++;
        }

        LocalDateTime startOfDay = today.atStartOfDay(tz).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        LocalDateTime endOfDay = today.atTime(23, 59, 59).atZone(tz).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();

        long closedToday = repository.countByStatusAndClosedAtBetween(
                InstallationStatus.SCHEDULED, startOfDay, endOfDay);

        List<InstallationResponse> recentlyClosed = repository
                .findTop5ByStatusNotOrderByClosedAtDesc(InstallationStatus.PENDING)
                .stream()
                .map(InstallationResponse::from)
                .toList();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", pending.size());
        stats.put("ok", ok);
        stats.put("warning", warning);
        stats.put("critical", critical);
        stats.put("closedToday", closedToday);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stats", stats);
        result.put("recentlyClosed", recentlyClosed);

        return result;

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
        Installation installation = findOrThrow(id);
        observationRepository.deleteAll(
                observationRepository.findByInstallationOrderByCreatedAtDesc(installation)
        );
        repository.deleteById(id);
    }

    @Transactional
    public InstallationObservationResponse addObservation(Long id, String text) {

        Installation installation = findOrThrow(id);

        InstallationObservation obs = InstallationObservation.builder()
                .installation(installation)
                .text(text)
                .createdBy(currentUserService.getCurrentUserName())
                .build();

        observationRepository.save(obs);

        installation.setLastObservation(text);
        repository.save(installation);

        return InstallationObservationResponse.from(obs);

    }

    public List<InstallationObservationResponse> getObservations(Long id) {

        Installation installation = findOrThrow(id);

        return observationRepository.findByInstallationOrderByCreatedAtDesc(installation)
                .stream()
                .map(InstallationObservationResponse::from)
                .toList();

    }

    @Transactional
    public InstallationResponse dismissAlert(Long id) {

        Installation installation = findOrThrow(id);

        installation.setAlertDismissedAt(LocalDate.now(ZoneId.of("America/Sao_Paulo")));

        repository.save(installation);

        return InstallationResponse.from(installation);

    }

    @Transactional
    public Map<String, Integer> sync(List<InstallationRequest> items) {

        int inserted = 0;
        int updated = 0;

        for (InstallationRequest req : items) {

            Optional<Installation> existing = req.externalId() != null
                    ? repository.findByExternalId(req.externalId())
                    : Optional.empty();

            if (existing.isPresent()) {
                Installation inst = existing.get();
                inst.setPortalStatus(req.portalStatus());
                if (inst.getStatus() == InstallationStatus.PENDING
                        && req.portalStatus() != null
                        && !"AGUARDANDO_AGENDAMENTO".equals(req.portalStatus())) {
                    inst.setStatus(InstallationStatus.SCHEDULED);
                    if (inst.getClosedAt() == null) {
                        inst.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
                    }
                }
                repository.save(inst);
                updated++;
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
                    .portalStatus(req.portalStatus())
                    .build();

            repository.save(installation);

            inserted++;

        }

        return Map.of("inserted", inserted, "updated", updated);


    }

    public List<InstallationResponse> report(String search, String status, LocalDate startDate, LocalDate endDate) {

        InstallationStatus statusEnum = null;
        if (status != null && !status.isBlank()) {
            statusEnum = InstallationStatus.valueOf(status.toUpperCase());
        }

        Specification<Installation> spec = buildReportSpec(search, statusEnum, startDate, endDate);

        return repository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(InstallationResponse::from)
                .toList();

    }

    private Specification<Installation> buildReportSpec(
            String search, InstallationStatus status, LocalDate startDate, LocalDate endDate
    ) {
        return (root, query, cb) -> {

            List<Predicate> predicates = new ArrayList<>();

            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("customerName")), like),
                        cb.like(cb.lower(root.get("plate")), like),
                        cb.like(cb.lower(root.get("city")), like)
                ));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(
                        root.get("portalCreatedAt"), startDate.atStartOfDay()
                ));
            }

            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(
                        root.get("portalCreatedAt"), endDate.atTime(23, 59, 59)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));

        };
    }

    private Installation findOrThrow(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instalação não encontrada"
                ));

    }

}
