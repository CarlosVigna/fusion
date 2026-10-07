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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InstallationService {

    private final InstallationRepository repository;

    private final InstallationObservationRepository observationRepository;

    private final CurrentUserService currentUserService;

    private final ServiceOrderService serviceOrderService;

    private final TechnicianRepository technicianRepository;

    private final OrsService orsService;

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

    // Usado pelo bot do WhatsApp (approvalFlow.js, fusion-etl) no comando
    // !aprovar-inst — autenticado por X-ETL-Key no controller, nao por
    // JWT (ver InstallationController).
    public InstallationResponse findByPlate(String plate) {
        Installation installation = repository.findByPlateIgnoreCase(plate)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instalação não encontrada para a placa: " + plate
                ));
        return InstallationResponse.from(installation);
    }

    // Idem findByPlate — chamado pelo bot em !aprovado-inst/!rejeitar-inst.
    // declaredValue vem do valor digitado em !aprovar-inst (nao recalculado
    // aqui); calculatedKm/calculatedDisplacement ficam null nesse fluxo,
    // porque o bot (Node) nao tem como chamar o OrsService (Java) e
    // Installation nao tem lat/lon do cliente pra calcular distancia —
    // ver nota no approvalFlow.js.
    @Transactional
    public InstallationResponse updateFinancialApproval(Long id, InstallationFinancialApprovalRequest request) {

        Installation installation = findOrThrow(id);

        installation.setFinancialApprovalStatus(request.financialApprovalStatus());
        installation.setDeclaredDisplacementValue(request.declaredValue());
        if (request.calculatedKm() != null) {
            installation.setCalculatedKm(request.calculatedKm());
        }
        if (request.calculatedDisplacement() != null) {
            installation.setCalculatedDisplacementValue(request.calculatedDisplacement());
        }
        installation.setFinancialApprovedAt(LocalDateTime.now(ZoneOffset.UTC));

        repository.save(installation);

        return InstallationResponse.from(installation);

    }

    // Diagnostico temporario (GET /installations/diagnostic/status-count)
    // — contagem real por portalStatus, pra comparar com o que o portal
    // mostra e confirmar se a varredura de orfaos (InstallationSyncService.
    // varreduraDeOrfaos) esta' limpando os registros que pararam de
    // aparecer em qualquer dos 8 status buscados.
    public Map<String, Long> getDiagnosticStatusCount() {
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object[] row : repository.countGroupedByPortalStatus()) {
            String status = (String) row[0];
            Long count = (Long) row[1];
            result.put(status == null ? "(sem portalStatus)" : status, count);
        }
        return result;
    }

    // Opcao B (Fase 2b) — calculo de deslocamento sob demanda pro fluxo
    // !aprovar-inst. Installation NAO tem lat/lon do cliente guardados
    // (so' endereco em texto — address/city/state), diferente de
    // Technician (que ja' cacheia lat/lon). Por isso geocodifica o
    // endereco do cliente a cada chamada, sem cache — a mesma limitacao
    // que a geocodificacao removida de Technicians.jsx tinha.
    public Map<String, Object> calculateDisplacement(Long installationId, UUID technicianId) {

        Installation installation = findOrThrow(installationId);

        Technician technician = technicianRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("Técnico não encontrado: " + technicianId));

        if (technician.getLatitude() == null || technician.getLongitude() == null) {
            throw new BusinessException("Técnico " + technician.getName() + " não tem coordenadas cadastradas");
        }

        if (installation.getAddress() == null || installation.getCity() == null) {
            throw new BusinessException("Instalação não tem endereço cadastrado para geocodificar");
        }

        double[] clientCoords = orsService.geocode(
                installation.getAddress(), installation.getCity(), installation.getState()
        );

        if (clientCoords == null) {
            throw new BusinessException("Não foi possível geocodificar o endereço do cliente");
        }

        Double km = orsService.calculateRoundTripKm(
                technician.getLatitude(), technician.getLongitude(),
                clientCoords[0], clientCoords[1]
        );

        if (km == null) {
            throw new BusinessException("Não foi possível calcular a distância (OSRM falhou)");
        }

        BigDecimal displacement = orsService.calculateDisplacement(km);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("km", km);
        result.put("displacement", displacement);
        result.put("technicianName", technician.getName());
        result.put("technicianAddress", technician.getAddress());

        return result;

    }

    // Diagnostico TEMPORARIO (GET /installations/diagnostic/test-displacement)
    // — testa calculateDisplacement() com o primeiro tecnico com lat/lon e
    // a primeira instalacao fora de REMOVIDO_DO_PORTAL, sem precisar
    // descobrir ids na mao. Sem autenticacao (permitAll em SecurityConfig)
    // — remover junto com a rota depois de confirmar o calculo.
    public Map<String, Object> testDisplacement() {

        Map<String, Object> result = new LinkedHashMap<>();

        Optional<Technician> technicianOpt = technicianRepository.findAll().stream()
                .filter(t -> t.getLatitude() != null && t.getLongitude() != null)
                .findFirst();

        Map<String, Object> technicianInfo = null;
        if (technicianOpt.isPresent()) {
            Technician t = technicianOpt.get();
            technicianInfo = new LinkedHashMap<>();
            technicianInfo.put("id", t.getId());
            technicianInfo.put("name", t.getName());
            technicianInfo.put("latitude", t.getLatitude());
            technicianInfo.put("longitude", t.getLongitude());
        }
        result.put("technician", technicianInfo);

        List<Installation> installations = repository.findAll().stream()
                .filter(i -> !InstallationSyncService.STATUS_REMOVIDO_DO_PORTAL.equals(i.getPortalStatus()))
                .limit(3)
                .toList();

        result.put("installations", installations.stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("plate", i.getPlate());
            m.put("customerName", i.getCustomerName());
            m.put("address", i.getAddress());
            m.put("city", i.getCity());
            m.put("state", i.getState());
            m.put("portalStatus", i.getPortalStatus());
            return m;
        }).toList());

        Map<String, Object> displacementTest = new LinkedHashMap<>();
        if (technicianOpt.isPresent() && !installations.isEmpty()) {
            try {
                displacementTest.put("success", true);
                displacementTest.put("result", calculateDisplacement(
                        installations.get(0).getId(), technicianOpt.get().getId()
                ));
            } catch (Exception e) {
                displacementTest.put("success", false);
                displacementTest.put("error", e.getMessage());
            }
        } else {
            displacementTest.put("success", false);
            displacementTest.put("error", "Faltam dados: " +
                    (technicianOpt.isEmpty() ? "nenhum técnico com lat/lon cadastrado" : "nenhuma instalação disponível"));
        }
        result.put("displacementTest", displacementTest);

        return result;

    }

    // Inclui a "aba" REMOVIDO_DO_PORTAL (marcador nosso, nao vem do
    // portal — ver InstallationSyncService.varreduraDeOrfaos) junto com
    // os 8 status oficiais, senao a tela nunca mostraria esses registros.
    public Map<String, Object> getPortalStatusGroups() {

        List<String> statusesExibidos = new ArrayList<>(InstallationSyncService.ALL_STATUSES);
        statusesExibidos.add(InstallationSyncService.STATUS_REMOVIDO_DO_PORTAL);

        Map<String, List<Installation>> porStatus = repository
                .findByPortalStatusIn(statusesExibidos)
                .stream()
                .collect(Collectors.groupingBy(Installation::getPortalStatus));

        Map<String, Object> result = new LinkedHashMap<>();

        for (String status : statusesExibidos) {
            List<InstallationPortalItemResponse> items = porStatus.getOrDefault(status, List.of())
                    .stream()
                    .sorted(Comparator.comparing(
                            Installation::getDataAtualizacao,
                            Comparator.nullsLast(Comparator.reverseOrder())
                    ))
                    .map(InstallationPortalItemResponse::from)
                    .toList();
            result.put(status, Map.of("total", items.size(), "items", items));
        }

        return result;

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

    // "status" aqui e' um dos 8 valores de portalStatus (ver
    // InstallationSyncService.ALL_STATUSES), nao mais o InstallationStatus
    // local antigo (PENDING/SCHEDULED/SENT/CANCELLED/APPROVED_FOR_PAYMENT) —
    // a tela de relatorios passou a filtrar pelos status do portal.
    public List<InstallationResponse> report(String search, String portalStatus, LocalDate startDate, LocalDate endDate) {

        Specification<Installation> spec = buildReportSpec(search, portalStatus, startDate, endDate);

        return repository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(InstallationResponse::from)
                .toList();

    }

    private Specification<Installation> buildReportSpec(
            String search, String portalStatus, LocalDate startDate, LocalDate endDate
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

            if (portalStatus != null && !portalStatus.isBlank()) {
                predicates.add(cb.equal(root.get("portalStatus"), portalStatus));
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
