package com.fusion.fusion.installation;

import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.common.security.CurrentUserService;
import com.fusion.fusion.ors.OrsService;
import com.fusion.fusion.policy.EtlPolicyResult;
import com.fusion.fusion.policy.PolicyService;
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
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InstallationService {

    private final InstallationRepository repository;

    private final InstallationObservationRepository observationRepository;

    private final CurrentUserService currentUserService;

    private final TechnicianRepository technicianRepository;

    private final PolicyService policyService;

    private final OrsService orsService;

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

    // Monta o resumo de aprovacao de pagamento pro fluxo de WhatsApp
    // (ver approvalFlow.js no fusion-etl) — NAO muda nenhum status,
    // so' calcula e devolve formatado. fetchFromPortal() nao traz
    // endereco do segurado (so policyNumber/datas/nome/cpf/veiculo),
    // entao o endereco vem de fetchRawPolicyItems() — mesmo numero de
    // apolice que fetchFromPortal() selecionou, pra nao pegar
    // cidade/estado de uma apolice diferente do mesmo veiculo.
    @Transactional(readOnly = true)
    public WhatsAppApprovalSummary buildWhatsAppApproval(WhatsAppApproveRequest req) {

        if (req.plate() == null || req.plate().isBlank()) {
            throw new BusinessException("Placa não informada");
        }

        if (req.technicianCpf() == null || req.technicianCpf().isBlank()) {
            throw new BusinessException("CPF do técnico não informado");
        }

        String plate = req.plate().trim().toUpperCase();

        Installation installation = repository
                .findFirstByPlateIgnoreCaseAndStatusOrderByCreatedAtDesc(plate, InstallationStatus.PENDING)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Nenhuma instalação pendente encontrada para a placa " + plate
                ));

        Technician technician = technicianRepository.findByCpf(req.technicianCpf())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Técnico não encontrado para o CPF " + req.technicianCpf()
                ));

        EtlPolicyResult portalResult;
        List<Map<String, Object>> rawItems;
        try {
            portalResult = policyService.fetchFromPortal(plate);
            rawItems = policyService.fetchRawPolicyItems(plate);
        } catch (Exception e) {
            log.warn("[INSTALACOES-WHATSAPP] Falha ao consultar portal pra placa={}: {}", plate, e.getMessage());
            portalResult = new EtlPolicyResult(false, null);
            rawItems = List.of();
        }

        Map<String, Object> rawItem = selectRawItem(portalResult, rawItems);

        String customerName = portalResult.found() && portalResult.data() != null
                ? portalResult.data().insuredName()
                : installation.getCustomerName();

        String city  = rawItem != null ? asString(rawItem.get("cidade")) : installation.getCity();
        String state = rawItem != null ? asString(rawItem.get("estado")) : installation.getState();

        // Endereco (rua/numero) nao vem da consulta de apolices — so'
        // cidade/estado/cep. Reaproveita o endereco ja salvo na
        // instalacao (extraido do endpoint de ordens-instalacao no
        // sync, que tem logradouro/numero de verdade).
        String address = installation.getAddress();

        Double distanceKm = null;
        BigDecimal displacementFee = null;

        if (technician.getLatitude() != null && technician.getLongitude() != null
                && (address != null || city != null)) {

            double[] clientCoords = orsService.geocode(
                    address != null ? address : "", city, state
            );

            if (clientCoords != null) {
                Double roundTripKm = orsService.calculateRoundTripKm(
                        technician.getLatitude(), technician.getLongitude(),
                        clientCoords[0], clientCoords[1]
                );
                if (roundTripKm != null) {
                    distanceKm = roundTripKm;
                    displacementFee = orsService.calculateDisplacement(roundTripKm);
                }
            }

        }

        BigDecimal value = req.value() != null ? req.value() : BigDecimal.ZERO;
        BigDecimal totalValue = value.add(displacementFee != null ? displacementFee : BigDecimal.ZERO);

        String formattedMessage = buildApprovalMessage(
                installation, customerName, technician, value, distanceKm, displacementFee, totalValue
        );

        return new WhatsAppApprovalSummary(
                installation.getId(), plate, customerName,
                technician.getName(), technician.getCpf(),
                value, distanceKm, displacementFee, totalValue,
                formattedMessage
        );

    }

    // Prefere o item cru com o MESMO numero_apolice que fetchFromPortal()
    // ja selecionou (mesma prioridade vigente > mais recente) — sem
    // isso, um veiculo com mais de uma apolice no portal poderia pegar
    // cidade/estado de uma apolice diferente da que foi exibida.
    private Map<String, Object> selectRawItem(EtlPolicyResult portalResult, List<Map<String, Object>> rawItems) {

        if (rawItems.isEmpty()) {
            return null;
        }

        if (portalResult.found() && portalResult.data() != null && portalResult.data().policyNumber() != null) {
            String selectedNumber = portalResult.data().policyNumber();
            for (Map<String, Object> item : rawItems) {
                if (Objects.equals(String.valueOf(item.get("numero_apolice")), selectedNumber)) {
                    return item;
                }
            }
        }

        return rawItems.get(0);

    }

    private String asString(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private String buildApprovalMessage(
            Installation installation, String customerName, Technician technician,
            BigDecimal value, Double distanceKm, BigDecimal displacementFee, BigDecimal totalValue
    ) {

        StringBuilder sb = new StringBuilder("*SOLICITAÇÃO DE APROVAÇÃO DE PAGAMENTO*\n\n");

        sb.append("PLACA: ").append(installation.getPlate()).append("\n");
        sb.append("CLIENTE: ").append(customerName != null ? customerName : "--").append("\n");
        sb.append("TÉCNICO: ").append(technician.getName())
                .append(" (CPF ").append(technician.getCpf()).append(")\n");
        sb.append("VALOR DO SERVIÇO: R$ ").append(value).append("\n");

        if (distanceKm != null) {
            sb.append("DISTÂNCIA (ida+volta): ").append(distanceKm).append(" km\n");
            sb.append("DESLOCAMENTO: R$ ").append(displacementFee).append("\n");
        } else {
            sb.append("DISTÂNCIA: não foi possível calcular\n");
        }

        sb.append("TOTAL: R$ ").append(totalValue).append("\n\n");
        sb.append("Responda !aprovado ").append(installation.getPlate())
                .append(" ou !rejeitar ").append(installation.getPlate());

        return sb.toString();

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
