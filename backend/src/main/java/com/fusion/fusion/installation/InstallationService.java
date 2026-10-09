package com.fusion.fusion.installation;

import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.common.security.CurrentUserService;
import com.fusion.fusion.ors.OrsService;
import com.fusion.fusion.serviceorder.ServiceOrderService;
import com.fusion.fusion.technician.Technician;
import com.fusion.fusion.technician.TechnicianRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
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
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InstallationService {

    private final InstallationRepository repository;

    private final InstallationObservationRepository observationRepository;

    private final CurrentUserService currentUserService;

    private final ServiceOrderService serviceOrderService;

    private final OrsService orsService;

    private final TechnicianRepository technicianRepository;

    // Criacao manual via POST /installations (usuario logado, JWT) —
    // diferente do sync() em lote abaixo, que e' exclusivo do ETL local
    // via X-ETL-Key e espera externalId vindo do portal. externalId
    // fica null aqui de proposito (instalacao nao vem do portal); a
    // ServiceOrder criada em seguida ja lida bem com isso (ver
    // comentario em ServiceOrderService.createFromInstallation()).
    @Transactional
    public InstallationResponse create(InstallationRequest request) {

        if (request.plate() == null || request.plate().isBlank()) {
            throw new BusinessException("Placa é obrigatória");
        }

        if (request.customerName() == null || request.customerName().isBlank()) {
            throw new BusinessException("Nome do segurado é obrigatório");
        }

        Installation installation = Installation.builder()
                .customerName(request.customerName())
                .address(request.address())
                .neighborhood(request.neighborhood())
                .city(request.city())
                .state(request.state())
                .zipCode(request.zipCode())
                .phone(request.phone())
                .plate(request.plate())
                .model(request.model())
                .serviceType(request.serviceType())
                .build();

        repository.save(installation);

        serviceOrderService.createFromInstallation(
                installation.getExternalId(),
                installation.getPlate(),
                installation.getCustomerName(),
                installation.getPhone(),
                installation.getCity(),
                installation.getAddress(),
                installation.getNeighborhood(),
                installation.getState(),
                installation.getZipCode(),
                installation.getPortalCreatedAt(),
                request.technicianId()
        );

        log.info("[INSTALACOES] Instalação criada manualmente: plate={} customerName={}",
                installation.getPlate(), installation.getCustomerName());

        return InstallationResponse.from(installation);

    }

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
    public InstallationResponse approvePayment(Long id) {

        Installation installation = findOrThrow(id);

        installation.setStatus(InstallationStatus.APPROVED_FOR_PAYMENT);

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

    // Arquiva em lote as instalacoes criadas antes de cutoff (UTC, mesmo
    // fuso do createdAt gravado no @PrePersist). PENDING fica de fora —
    // ainda esta aguardando agendamento no portal.
    @Transactional
    public int archiveOlderThan(LocalDateTime cutoff) {

        List<Installation> toArchive = repository
                .findByCreatedAtBeforeAndStatusNot(cutoff, InstallationStatus.ARCHIVED)
                .stream()
                .filter(i -> i.getStatus() != InstallationStatus.PENDING)
                .toList();

        toArchive.forEach(i -> i.setStatus(InstallationStatus.ARCHIVED));

        repository.saveAll(toArchive);

        log.info("[INSTALACOES] {} instalações arquivadas (createdAt < {} UTC)", toArchive.size(), cutoff);

        return toArchive.size();

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

    public Map<String, Long> countByPortalStatus() {
        Map<String, Long> result = new LinkedHashMap<>();
        repository.findAll().forEach(i -> {
            String status = i.getPortalStatus() != null ? i.getPortalStatus() : "null";
            result.merge(status, 1L, Long::sum);
        });
        return result;
    }

    // ─── Fase 2: endpoints chamados pelo ETL ────────────────────────────────

    public Optional<Installation> findByPlate(String plate) {
        return repository.findByPlateIgnoreCase(plate);
    }

    @Transactional
    public Installation updateFinancialApproval(Long id, InstallationFinancialApprovalRequest req) {
        Installation inst = findOrThrow(id);
        inst.setFinancialApprovalStatus(req.getFinancialApprovalStatus());
        inst.setDeclaredDisplacementValue(req.getDeclaredValue());
        inst.setCalculatedKm(req.getCalculatedKm());
        inst.setCalculatedDisplacementValue(req.getCalculatedDisplacement());
        inst.setFinancialApprovedAt(LocalDateTime.now(ZoneOffset.UTC));
        return repository.save(inst);
    }

    public Map<String, Object> calculateDisplacement(Long installationId, UUID technicianId) {
        Installation inst = findOrThrow(installationId);

        Technician tech = technicianRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("Técnico não encontrado: " + technicianId));

        if (tech.getLatitude() == null || tech.getLongitude() == null) {
            throw new BusinessException("Técnico não tem coordenadas cadastradas");
        }

        String address = inst.getAddress() != null ? inst.getAddress() : "";
        String city    = inst.getCity()    != null ? inst.getCity()    : "";
        String state   = inst.getState()   != null ? inst.getState()   : "";

        double[] clientCoords = orsService.geocode(address, city, state);

        Map<String, Object> result = new LinkedHashMap<>();

        if (clientCoords == null) {
            log.warn("[DISPLACEMENT] Não foi possível geocodificar: plate={} address={} city={} state={}",
                    inst.getPlate(), address, city, state);
            result.put("km", null);
            result.put("displacement", null);
            result.put("technicianName", tech.getName());
            result.put("warning", "Não foi possível geocodificar o endereço do cliente");
            return result;
        }

        Double km = orsService.calculateRoundTripKm(
                tech.getLatitude(), tech.getLongitude(),
                clientCoords[0], clientCoords[1]
        );

        if (km == null) {
            log.warn("[DISPLACEMENT] OSRM não retornou rota: plate={}", inst.getPlate());
            result.put("km", null);
            result.put("displacement", null);
            result.put("technicianName", tech.getName());
            result.put("warning", "Não foi possível calcular a rota (OSRM indisponível)");
            return result;
        }

        BigDecimal displacement = orsService.calculateDisplacement(km);

        result.put("km", km);
        result.put("displacement", displacement);
        result.put("technicianName", tech.getName());
        result.put("technicianCity", tech.getCity());

        log.info("[DISPLACEMENT] plate={} km={} displacement={}", inst.getPlate(), km, displacement);

        return result;
    }

    // ────────────────────────────────────────────────────────────────────────

    private Installation findOrThrow(Long id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instalação não encontrada"
                ));

    }

}
