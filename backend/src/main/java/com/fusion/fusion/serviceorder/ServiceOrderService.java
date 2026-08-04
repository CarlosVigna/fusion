package com.fusion.fusion.serviceorder;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.ors.OrsService;
import com.fusion.fusion.technician.Technician;
import com.fusion.fusion.technician.TechnicianService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceOrderService {

    private final ServiceOrderRepository repository;
    private final TechnicianService technicianService;
    private final OrsService orsService;

    public List<ServiceOrderResponse> listAll() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(ServiceOrder::getRequestedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceOrderResponse create(ServiceOrderRequest request, String createdBy) {
        ServiceOrder so = ServiceOrder.builder()
                .requestedBy(request.requestedBy() != null ? request.requestedBy() : createdBy)
                .requestedAt(request.requestedAt() != null ? request.requestedAt() : LocalDateTime.now(ZoneOffset.UTC))
                .plate(request.plate())
                .chassis(request.chassis())
                .equipment(request.equipment() != null ? request.equipment() : "LUMINI")
                .serviceType(request.serviceType() != null ? request.serviceType() : ServiceType.INSTALACAO)
                .city(request.city())
                .address(request.address())
                .customerName(request.customerName())
                .customerPhone(request.customerPhone())
                .observations(request.observations())
                .createdBy(createdBy)
                .build();
        return toResponse(repository.save(so));
    }

    // Criação interna a partir do portal (sem usuário autenticado)
    @Transactional
    public ServiceOrderResponse createFromPortal(ServiceOrderRequest request) {
        if (request.plate() != null && repository.existsByExternalInstallationId(request.plate())) return null;
        return create(request, "PORTAL");
    }

    @Transactional
    public ServiceOrderResponse createFromInstallation(
            String externalInstallationId, String plate, String customerName,
            String customerPhone, String city, String address,
            String neighborhood, String state, LocalDateTime requestedAt) {

        if (repository.existsByExternalInstallationId(externalInstallationId)) return null;

        ServiceOrder so = ServiceOrder.builder()
                .externalInstallationId(externalInstallationId)
                .requestedBy("PORTAL")
                .requestedAt(requestedAt != null ? requestedAt : LocalDateTime.now(ZoneOffset.UTC))
                .plate(plate)
                .equipment("LUMINI")
                .serviceType(ServiceType.INSTALACAO)
                .city(city)
                .address(address)
                .neighborhood(neighborhood)
                .state(state)
                .customerName(customerName)
                .customerPhone(customerPhone)
                .createdBy("PORTAL")
                .build();

        ServiceOrderResponse saved = toResponse(repository.save(so));
        log.info("[OS] Criada automaticamente do portal: externalId={} plate={}", externalInstallationId, plate);
        return saved;
    }

    @Transactional
    public ServiceOrderResponse update(UUID id, ServiceOrderRequest request) {
        ServiceOrder so = find(id);
        so.setPlate(request.plate());
        so.setChassis(request.chassis());
        if (request.equipment() != null) so.setEquipment(request.equipment());
        if (request.serviceType() != null) so.setServiceType(request.serviceType());
        so.setCity(request.city());
        so.setAddress(request.address());
        so.setCustomerName(request.customerName());
        so.setCustomerPhone(request.customerPhone());
        if (request.requestedBy() != null) so.setRequestedBy(request.requestedBy());
        if (request.observations() != null) so.setObservations(request.observations());
        return toResponse(repository.save(so));
    }

    @Transactional
    public ServiceOrderResponse updateScheduling(UUID id, SchedulingRequest request) {
        ServiceOrder so = find(id);

        Technician prevTech = so.getTechnician();
        boolean techChanged = request.technicianId() != null
                && (prevTech == null || !prevTech.getId().equals(request.technicianId()));

        if (request.technicianId() != null) {
            Technician tech = technicianService.find(request.technicianId());
            so.setTechnician(tech);

            if (techChanged && tech.getLatitude() != null && so.getAddress() != null && so.getCity() != null) {
                double[] clientCoords = orsService.geocode(so.getAddress(), so.getCity(), "");
                if (clientCoords != null) {
                    Double km = orsService.calculateRoundTripKm(tech.getLatitude(), tech.getLongitude(), clientCoords[0], clientCoords[1]);
                    if (km != null) {
                        so.setDistanceKm(km);
                        so.setDisplacementValue(orsService.calculateDisplacement(km));
                        recalcTotal(so);
                    }
                }
            }
        }

        if (request.schedulingStatus() != null) {
            so.setSchedulingStatus(request.schedulingStatus());
            if (request.schedulingStatus() == SchedulingStatus.CONCLUIDO && so.getClosedAt() == null) {
                so.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            }
        }
        if (request.scheduledDate() != null) so.setScheduledDate(request.scheduledDate());
        if (request.scheduledTime() != null) so.setScheduledTime(request.scheduledTime());
        if (request.serviceValue() != null) {
            so.setServiceValue(request.serviceValue());
            recalcTotal(so);
        }
        if (request.observations() != null) so.setObservations(request.observations());

        return toResponse(repository.save(so));
    }

    @Transactional
    public ServiceOrderResponse updateFinancialApproval(UUID id, FinancialApprovalRequest request) {
        ServiceOrder so = find(id);
        so.setFinancialApprovalStatus(request.financialApprovalStatus());
        return toResponse(repository.save(so));
    }

    @Transactional
    public ServiceOrderResponse confirmCompletion(UUID id) {
        ServiceOrder so = find(id);
        so.setCompletionConfirmed(true);
        so.setSchedulingStatus(SchedulingStatus.CONCLUIDO);
        if (so.getClosedAt() == null) so.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
        return toResponse(repository.save(so));
    }

    public Map<String, Object> dashboard() {
        List<ServiceOrder> all = repository.findAll();
        long open     = all.stream().filter(o -> o.getSchedulingStatus() == SchedulingStatus.ABERTO).count();
        long ongoing  = all.stream().filter(o -> o.getSchedulingStatus() == SchedulingStatus.AGENDADO).count();
        long late     = all.stream().filter(o -> o.isLate()).count();
        long pendFin  = all.stream().filter(o -> o.getSchedulingStatus() != SchedulingStatus.CONCLUIDO
                                            && o.getFinancialApprovalStatus() == FinancialApprovalStatus.PENDENTE).count();
        long pendConf = all.stream().filter(o -> Boolean.TRUE.equals(o.getCompletionAlertSent()) && !Boolean.TRUE.equals(o.getCompletionConfirmed())).count();
        OptionalDouble avgSla = all.stream()
                .filter(o -> o.getSchedulingStatus() == SchedulingStatus.CONCLUIDO)
                .mapToLong(ServiceOrder::getSlaDays).average();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("open", open);
        result.put("ongoing", ongoing);
        result.put("late", late);
        result.put("pendingFinancialApproval", pendFin);
        result.put("pendingCompletionConfirmation", pendConf);
        result.put("avgSlaDays", avgSla.isPresent() ? Math.round(avgSla.getAsDouble() * 10.0) / 10.0 : 0);
        return result;
    }

    public Map<String, Object> monthlyClose(String month) {
        List<ServiceOrder> orders = repository.findConcludedByMonth(month);
        List<ServiceOrderResponse> rows = orders.stream().map(this::toResponse).toList();

        BigDecimal totalService     = rows.stream().map(r -> r.serviceValue()     != null ? r.serviceValue()     : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDisplacement= rows.stream().map(r -> r.displacementValue()!= null ? r.displacementValue(): BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalValue       = rows.stream().map(r -> r.totalValue()       != null ? r.totalValue()       : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("month", month);
        result.put("count", rows.size());
        result.put("totalServiceValue", totalService);
        result.put("totalDisplacementValue", totalDisplacement);
        result.put("totalValue", totalValue);
        result.put("orders", rows);
        return result;
    }

    // Verificação periódica: INSTALACAO não concluída com veículo ativo
    public List<ServiceOrder> findPendingInstallations() {
        return repository.findByServiceTypeAndSchedulingStatusNotAndCompletionConfirmedFalse(
                ServiceType.INSTALACAO, SchedulingStatus.CONCLUIDO);
    }

    @Transactional
    public void markCompletionAlertSent(UUID id) {
        find(id).setCompletionAlertSent(true);
        repository.findById(id).ifPresent(so -> {
            so.setCompletionAlertSent(true);
            repository.save(so);
        });
    }

    private void recalcTotal(ServiceOrder so) {
        BigDecimal disp = so.getDisplacementValue() != null ? so.getDisplacementValue() : BigDecimal.ZERO;
        BigDecimal svc  = so.getServiceValue()      != null ? so.getServiceValue()      : BigDecimal.ZERO;
        so.setTotalValue(disp.add(svc));
    }

    private ServiceOrder find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OS não encontrada: " + id));
    }

    ServiceOrderResponse toResponse(ServiceOrder so) {
        return new ServiceOrderResponse(
                so.getId(),
                so.getExternalInstallationId(),
                so.getRequestedBy(),
                so.getRequestedAt(),
                so.getPlate(),
                so.getChassis(),
                so.getEquipment(),
                so.getServiceType(),
                so.getTechnician() != null ? technicianService.toResponse(so.getTechnician()) : null,
                so.getSchedulingStatus(),
                so.getScheduledDate(),
                so.getScheduledTime(),
                so.getCity(),
                so.getAddress(),
                so.getNeighborhood(),
                so.getState(),
                so.getCustomerName(),
                so.getCustomerPhone(),
                so.getDistanceKm(),
                so.getDisplacementValue(),
                so.getServiceValue(),
                so.getTotalValue(),
                so.getFinancialApprovalStatus(),
                so.getCompletionConfirmed(),
                so.getCompletionAlertSent(),
                so.getObservations(),
                so.getCreatedBy(),
                so.getCreatedAt(),
                so.getUpdatedAt(),
                so.getClosedAt(),
                so.getSlaDays(),
                so.isLate()
        );
    }
}
