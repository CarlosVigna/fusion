package com.fusion.fusion.serviceorder;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.ors.OrsService;
import com.fusion.fusion.technician.Technician;
import com.fusion.fusion.technician.TechnicianService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceOrderService {

    private final ServiceOrderRepository repository;
    private final TechnicianService technicianService;
    private final OrsService orsService;
    private final VehicleRepository vehicleRepository;
    private final VehicleOperationalStateRepository operationalStateRepository;
    private final ServiceOrderAuditLogRepository auditLogRepository;

    public List<ServiceOrderResponse> listAll(boolean includeCompleted) {
        return repository.findAll().stream()
                .filter(o -> includeCompleted || o.getSchedulingStatus() != SchedulingStatus.CONCLUIDO)
                .sorted(Comparator.comparing(ServiceOrder::getRequestedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .toList();
    }

    public List<ServiceOrderResponse> listCompleted() {
        return repository.findAll().stream()
                .filter(o -> o.getSchedulingStatus() == SchedulingStatus.CONCLUIDO)
                .sorted(Comparator.comparing(ServiceOrder::getClosedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceOrderResponse create(ServiceOrderRequest request, String createdBy) {
        boolean isManual = !"PORTAL".equals(createdBy) && !"SISTEMA".equals(createdBy);
        if (isManual && (request.customerName() == null || request.customerName().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome do cliente é obrigatório");
        }
        ServiceOrder so = ServiceOrder.builder()
                .requestedBy(request.requestedBy() != null ? request.requestedBy() : createdBy)
                .requestedAt(request.requestedAt() != null ? request.requestedAt() : LocalDateTime.now(ZoneOffset.UTC))
                .plate(request.plate())
                .chassis(request.chassis())
                .equipment(request.equipment() != null ? request.equipment() : "LUMINI")
                .serviceType(request.serviceType() != null ? request.serviceType() : ServiceType.INSTALACAO)
                .city(request.city())
                .address(request.address())
                .neighborhood(request.neighborhood())
                .state(request.state())
                .zipCode(request.zipCode())
                .customerName(request.customerName())
                .customerPhone(request.customerPhone())
                .observations(request.observations())
                .createdBy(createdBy)
                .build();
        ServiceOrder saved = repository.save(so);
        audit(saved.getId(), saved.getPlate(), "CRIADA", null, null, null);
        return toResponse(saved);
    }

    @Transactional
    public ServiceOrderResponse createFromPortal(ServiceOrderRequest request) {
        if (request.plate() != null && repository.existsByExternalInstallationId(request.plate())) return null;
        return create(request, "PORTAL");
    }

    @Transactional
    public ServiceOrderResponse createFromInstallation(
            String externalInstallationId, String plate, String customerName,
            String customerPhone, String city, String address,
            String neighborhood, String state, String zipCode, LocalDateTime requestedAt) {

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
                .zipCode(zipCode)
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

        auditIfChanged(id, so.getPlate(), "plate",         so.getPlate(),                                  request.plate());
        auditIfChanged(id, so.getPlate(), "city",          so.getCity(),                                   request.city());
        auditIfChanged(id, so.getPlate(), "customerName",  so.getCustomerName(),                           request.customerName());
        auditIfChanged(id, so.getPlate(), "serviceType",   so.getServiceType() != null ? so.getServiceType().name() : null,
                                                           request.serviceType() != null ? request.serviceType().name() : null);

        so.setPlate(request.plate());
        so.setChassis(request.chassis());
        if (request.equipment() != null) so.setEquipment(request.equipment());
        if (request.serviceType() != null) so.setServiceType(request.serviceType());
        so.setCity(request.city());
        so.setAddress(request.address());
        so.setNeighborhood(request.neighborhood());
        so.setState(request.state());
        so.setZipCode(request.zipCode());
        so.setCustomerName(request.customerName());
        so.setCustomerPhone(request.customerPhone());
        if (request.requestedBy() != null) so.setRequestedBy(request.requestedBy());
        if (request.observations() != null) so.setObservations(request.observations());

        audit(id, request.plate() != null ? request.plate() : so.getPlate(), "EDITADA", null, null, null);
        return toResponse(repository.save(so));
    }

    @Transactional
    public ServiceOrderResponse updateScheduling(UUID id, SchedulingRequest request) {
        ServiceOrder so = find(id);

        // Captura valores anteriores para auditoria campo a campo
        String auditOldTech         = so.getTechnician()        != null ? so.getTechnician().getName()              : null;
        String auditOldDate         = so.getScheduledDate()     != null ? so.getScheduledDate().toString()          : null;
        String auditOldStatus       = so.getSchedulingStatus()  != null ? so.getSchedulingStatus().name()           : null;
        String auditOldService      = so.getServiceValue()      != null ? so.getServiceValue().toPlainString()      : null;
        String auditOldDisplacement = so.getDisplacementValue() != null ? so.getDisplacementValue().toPlainString() : null;

        Technician prevTech = so.getTechnician();
        boolean techChanged = request.technicianId() != null
                && (prevTech == null || !prevTech.getId().equals(request.technicianId()));

        if (request.technicianId() != null) {
            Technician tech = technicianService.find(request.technicianId());
            so.setTechnician(tech);

            if (techChanged) {
                // Coordenadas do técnico enviadas pelo frontend (geocoding feito no browser)
                if (request.techLat() != null && request.techLon() != null) {
                    technicianService.updateCoords(tech, request.techLat(), request.techLon());
                }

                // Calcular deslocamento usando coords do cliente enviadas pelo frontend
                if (tech.getLatitude() != null && request.clientLat() != null && request.clientLon() != null) {
                    log.info("[OS] Calculando deslocamento via coords frontend, OS={}, tecnico={}", id, request.technicianId());
                    Double km = orsService.calculateRoundTripKm(tech.getLatitude(), tech.getLongitude(), request.clientLat(), request.clientLon());
                    if (km != null) {
                        so.setDistanceKm(km);
                        so.setDisplacementValue(orsService.calculateDisplacement(km));
                        recalcTotal(so);
                        log.info("[OS] Deslocamento calculado: {}km, R${}", km, so.getDisplacementValue());
                    } else {
                        log.warn("[OS] ORS retornou null para rota OS={}", id);
                    }
                } else {
                    log.info("[OS] Deslocamento nao calculado: techLat={}, clientLat={}", tech.getLatitude(), request.clientLat());
                }
            }
        }

        // Auto-transition: técnico + data preenchidos → AGENDADO automático
        if (request.technicianId() != null && request.scheduledDate() != null) {
            so.setSchedulingStatus(SchedulingStatus.AGENDADO);
        }

        // Sobrescreve se OP/ADMIN enviar status explicitamente
        if (request.schedulingStatus() != null) {
            so.setSchedulingStatus(request.schedulingStatus());
            if (request.schedulingStatus() == SchedulingStatus.CONCLUIDO && so.getClosedAt() == null) {
                so.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            }
        }

        if (request.scheduledDate() != null) {
            // Track first time a date is scheduled (tempo Deila agir)
            if (so.getScheduledAt() == null) {
                so.setScheduledAt(LocalDateTime.now(ZoneOffset.UTC));
            }
            so.setScheduledDate(request.scheduledDate());
        }

        if (request.scheduledTime() != null) so.setScheduledTime(request.scheduledTime());
        if (request.serviceValue() != null) {
            so.setServiceValue(request.serviceValue());
            recalcTotal(so);
        }
        if (request.displacementValue() != null) {
            so.setDisplacementValue(request.displacementValue());
            recalcTotal(so);
        }
        if (request.observations() != null) so.setObservations(request.observations());
        if (request.technicianAddress() != null) so.setTechnicianAddress(request.technicianAddress());
        if (request.clientAddress() != null) so.setClientAddress(request.clientAddress());

        // Audit campo a campo — registra apenas o que realmente mudou
        if (request.technicianId() != null) {
            auditIfChanged(id, so.getPlate(), "technician", auditOldTech,
                    so.getTechnician() != null ? so.getTechnician().getName() : null);
        }
        auditIfChanged(id, so.getPlate(), "scheduledDate", auditOldDate,
                so.getScheduledDate() != null ? so.getScheduledDate().toString() : null);
        if (request.schedulingStatus() != null) {
            auditIfChanged(id, so.getPlate(), "schedulingStatus", auditOldStatus,
                    so.getSchedulingStatus() != null ? so.getSchedulingStatus().name() : null);
        }
        if (request.serviceValue() != null) {
            auditIfChanged(id, so.getPlate(), "serviceValue", auditOldService,
                    so.getServiceValue() != null ? so.getServiceValue().toPlainString() : null);
        }
        if (request.displacementValue() != null) {
            auditIfChanged(id, so.getPlate(), "displacementValue", auditOldDisplacement,
                    so.getDisplacementValue() != null ? so.getDisplacementValue().toPlainString() : null);
        }

        ServiceOrder saved = repository.save(so);
        audit(saved.getId(), saved.getPlate(), "AGENDADA", null, null, null);
        return toResponse(saved);
    }

    @Transactional
    public ServiceOrderResponse updateFinancialApproval(UUID id, FinancialApprovalRequest request) {
        ServiceOrder so = find(id);
        so.setFinancialApprovalStatus(request.financialApprovalStatus());
        ServiceOrder saved = repository.save(so);
        String action = request.financialApprovalStatus() == FinancialApprovalStatus.APROVADO ? "APROVADA" : "REPROVADA";
        audit(saved.getId(), saved.getPlate(), action, "financialApprovalStatus",
                so.getFinancialApprovalStatus().name(), request.financialApprovalStatus().name());
        return toResponse(saved);
    }

    @Transactional
    public ServiceOrderResponse confirmCompletion(UUID id) {
        ServiceOrder so = find(id);

        if (so.getTechnician() == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Técnico deve ser atribuído antes de confirmar conclusão");
        }
        if (so.getServiceValue() == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Valor do serviço deve ser informado antes de confirmar conclusão");
        }

        boolean hasSignal = checkVehicleSignal(so.getPlate());
        so.setCompletedWithoutSignal(!hasSignal);
        if (!hasSignal) {
            log.info("[OS] Concluída sem sinal do veículo: OS={} placa={}", id, so.getPlate());
        }

        so.setCompletionConfirmed(true);
        so.setSchedulingStatus(SchedulingStatus.CONCLUIDO);
        if (so.getClosedAt() == null) so.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
        ServiceOrder saved = repository.save(so);
        audit(saved.getId(), saved.getPlate(), "CONCLUIDA", null, null, null);
        return toResponse(saved);
    }

    public Map<String, Object> dashboard(boolean showAnalytics) {
        List<ServiceOrder> all = repository.findAll();

        long abertas = all.stream()
                .filter(o -> o.getTechnician() == null
                        && o.getSchedulingStatus() == SchedulingStatus.ABERTO)
                .count();

        long emAndamento = all.stream()
                .filter(o -> o.getTechnician() != null
                        && o.getSchedulingStatus() == SchedulingStatus.AGENDADO)
                .count();

        long atrasadas = all.stream()
                .filter(o -> o.getSchedulingStatus() != SchedulingStatus.CONCLUIDO
                        && o.isLate())
                .count();

        long pendentesAprov = all.stream()
                .filter(o -> o.getDisplacementValue() != null
                        && o.getDisplacementValue().compareTo(BigDecimal.ZERO) > 0
                        && o.getFinancialApprovalStatus() == FinancialApprovalStatus.PENDENTE)
                .count();

        long pendentesConclusao = all.stream()
                .filter(o -> o.getSchedulingStatus() == SchedulingStatus.AGENDADO
                        && o.getTechnician() != null
                        && o.getScheduledDate() != null
                        && !o.getScheduledDate().isAfter(LocalDate.now())
                        && o.getServiceValue() != null
                        && checkVehicleSignal(o.getPlate()))
                .count();

        // Diagnostic: log each AGENDADO OS with technician to diagnose prazoCumprido
        all.stream()
                .filter(o -> o.getSchedulingStatus() == SchedulingStatus.AGENDADO
                        && o.getTechnician() != null
                        && o.getScheduledDate() != null)
                .forEach(o -> log.info("[DASHBOARD] prazoCumprido check - OS={} scheduledDate={} scheduledTime={} passed={} tecnico={} serviceValue={} status={}",
                        o.getId(), o.getScheduledDate(), o.getScheduledTime(),
                        isScheduledDateTimePassed(o), o.getTechnician() != null,
                        o.getServiceValue(), o.getSchedulingStatus()));

        long prazoCumprido = all.stream()
                .filter(o -> o.getSchedulingStatus() == SchedulingStatus.AGENDADO
                        && o.getTechnician() != null
                        && o.getScheduledDate() != null
                        && o.getServiceValue() != null
                        && isScheduledDateTimePassed(o))
                .count();

        log.info("[DASHBOARD] abertas={} emAndamento={} atrasadas={} prazoCumprido={}",
                abertas, emAndamento, atrasadas, prazoCumprido);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("abertas",             abertas);
        result.put("emAndamento",         emAndamento);
        result.put("atrasadas",           atrasadas);
        result.put("pendentesAprovacao",  pendentesAprov);
        result.put("pendentesConclusao",  pendentesConclusao);
        result.put("prazoCumprido",       prazoCumprido);

        if (showAnalytics) {
            OptionalDouble slaMedia = all.stream()
                    .filter(o -> o.getSchedulingStatus() == SchedulingStatus.CONCLUIDO)
                    .mapToLong(ServiceOrder::getSlaDays).average();

            OptionalDouble tempoDeila = all.stream()
                    .filter(o -> o.getRequestedAt() != null && o.getScheduledAt() != null)
                    .mapToDouble(o -> java.time.Duration.between(o.getRequestedAt(), o.getScheduledAt()).toMinutes() / 60.0)
                    .average();

            OptionalDouble tempoResolucao = all.stream()
                    .filter(o -> o.getRequestedAt() != null && o.getClosedAt() != null
                            && o.getSchedulingStatus() == SchedulingStatus.CONCLUIDO)
                    .mapToDouble(o -> java.time.Duration.between(o.getRequestedAt(), o.getClosedAt()).toMinutes() / 60.0)
                    .average();

            result.put("slaMediaDias",         slaMedia.isPresent()       ? Math.round(slaMedia.getAsDouble()       * 10.0) / 10.0 : 0);
            result.put("tempoMedioDeila",      tempoDeila.isPresent()     ? Math.round(tempoDeila.getAsDouble()     * 10.0) / 10.0 : 0);
            result.put("tempoMedioResolucao",  tempoResolucao.isPresent() ? Math.round(tempoResolucao.getAsDouble() * 10.0) / 10.0 : 0);
        }

        return result;
    }

    public Map<String, Object> monthlyClose(String month) {
        List<ServiceOrder> orders = repository.findConcludedByMonth(month);
        List<ServiceOrderResponse> rows = orders.stream().map(this::toResponse).toList();

        BigDecimal totalService      = rows.stream().map(r -> r.serviceValue()      != null ? r.serviceValue()      : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDisplacement = rows.stream().map(r -> r.displacementValue() != null ? r.displacementValue() : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalValue        = rows.stream().map(r -> r.totalValue()        != null ? r.totalValue()        : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("month",                 month);
        result.put("count",                 rows.size());
        result.put("totalServiceValue",     totalService);
        result.put("totalDisplacementValue",totalDisplacement);
        result.put("totalValue",            totalValue);
        result.put("orders",                rows);
        return result;
    }

    public List<ServiceOrder> findPendingInstallations() {
        return repository.findByServiceTypeAndSchedulingStatusNotAndCompletionConfirmedFalse(
                ServiceType.INSTALACAO, SchedulingStatus.CONCLUIDO);
    }

    @Transactional
    public void delete(UUID id) {
        ServiceOrder so = find(id);
        String plate = so.getPlate();
        repository.deleteById(id);
        audit(id, plate, "EXCLUIDA", null, null, null);
    }

    @Transactional
    public void markCompletionAlertSent(UUID id) {
        repository.findById(id).ifPresent(so -> {
            so.setCompletionAlertSent(true);
            repository.save(so);
        });
    }

    private void recalcTotal(ServiceOrder so) {
        BigDecimal disp = so.getDisplacementValue() != null ? so.getDisplacementValue() : BigDecimal.ZERO;
        BigDecimal svc  = so.getServiceValue()      != null ? so.getServiceValue()      : BigDecimal.ZERO;
        so.setTotalValue(disp.add(svc));
        // Auto-approve when no displacement cost
        if (disp.compareTo(BigDecimal.ZERO) == 0) {
            so.setFinancialApprovalStatus(FinancialApprovalStatus.APROVADO);
        }
    }

    public boolean hasVehicleSignal(UUID id) {
        return checkVehicleSignal(find(id).getPlate());
    }

    private boolean isScheduledDateTimePassed(ServiceOrder o) {
        if (o.getScheduledDate() == null) return false;
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (o.getScheduledTime() == null) return !o.getScheduledDate().isAfter(today);
        try {
            LocalTime time = LocalTime.parse(o.getScheduledTime());
            // scheduledTime stored as local Brazil time (UTC-3); compare with UTC by adding offset
            LocalDateTime scheduledUtc = LocalDateTime.of(o.getScheduledDate(), time).plusHours(3);
            return scheduledUtc.isBefore(LocalDateTime.now(ZoneOffset.UTC));
        } catch (Exception e) {
            return !o.getScheduledDate().isAfter(today);
        }
    }

    private boolean checkVehicleSignal(String plate) {
        if (plate == null || plate.isBlank()) return false;
        try {
            Optional<Vehicle> vehicleOpt = vehicleRepository.findByPlate(plate.toUpperCase());
            if (vehicleOpt.isEmpty()) return false;
            Optional<VehicleOperationalState> stateOpt = operationalStateRepository.findFirstByVehicle(vehicleOpt.get());
            if (stateOpt.isEmpty()) return false;
            LocalDateTime lastComm = stateOpt.get().getLastCommunicationAt();
            if (lastComm == null) return false;
            return lastComm.isAfter(LocalDateTime.now(ZoneOffset.UTC).minusHours(24));
        } catch (Exception e) {
            log.warn("[OS] Erro ao verificar sinal do veiculo {}: {}", plate, e.getMessage());
            return false;
        }
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
                so.getZipCode(),
                so.getCustomerName(),
                so.getCustomerPhone(),
                so.getDistanceKm(),
                so.getTechnicianAddress(),
                so.getClientAddress(),
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
                so.getScheduledAt(),
                so.getCompletedWithoutSignal(),
                so.getSlaDays(),
                so.isLate()
        );
    }

    private void audit(UUID soId, String plate, String action, String field, String oldVal, String newVal) {
        String user = "SISTEMA";
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            user = auth.getName();
        }
        auditLogRepository.save(ServiceOrderAuditLog.builder()
                .serviceOrderId(soId)
                .plate(plate)
                .action(action)
                .field(field)
                .oldValue(oldVal)
                .newValue(newVal)
                .performedBy(user)
                .performedByName(user)
                .performedAt(LocalDateTime.now(ZoneOffset.UTC))
                .build());
    }

    private void auditIfChanged(UUID soId, String plate, String field, String oldVal, String newVal) {
        if (!java.util.Objects.equals(oldVal, newVal)) {
            audit(soId, plate, "EDITADA", field, oldVal, newVal);
        }
    }

    public List<ServiceOrderAuditLog> findAuditLog(
            String plate, String action, String performedBy,
            LocalDateTime dateFrom, LocalDateTime dateTo) {
        return auditLogRepository.findFiltered(plate, action, performedBy, dateFrom, dateTo);
    }
}
