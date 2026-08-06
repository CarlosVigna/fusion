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
        return toResponse(repository.save(so));
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

            if (techChanged) {
                if (tech.getLatitude() == null && tech.getAddress() != null) {
                    log.info("[OS] Tecnico sem coordenadas, geocodificando em tempo real: {}, {}", tech.getAddress(), tech.getCity());
                    technicianService.geocodeIfMissing(tech);
                }

                if (tech.getLatitude() != null && so.getAddress() != null && so.getCity() != null) {
                    log.info("[OS] Calculando deslocamento para OS={}, tecnico={}, endereco='{}, {}'",
                            id, request.technicianId(), so.getAddress(), so.getCity());
                    double[] clientCoords = orsService.geocode(so.getAddress(), so.getCity(), so.getState() != null ? so.getState() : "");
                    if (clientCoords != null) {
                        Double km = orsService.calculateRoundTripKm(tech.getLatitude(), tech.getLongitude(), clientCoords[0], clientCoords[1]);
                        if (km != null) {
                            so.setDistanceKm(km);
                            so.setDisplacementValue(orsService.calculateDisplacement(km));
                            recalcTotal(so);
                            log.info("[OS] Deslocamento calculado: {}km, R${}", km, so.getDisplacementValue());
                        } else {
                            log.warn("[OS] ORS retornou null para rota OS={}", id);
                        }
                    } else {
                        log.warn("[OS] Geocoding sem resultado para OS={} endereco='{}'", id, so.getAddress());
                    }
                } else {
                    log.info("[OS] Deslocamento nao calculado: techLat={}, address={}, city={}",
                            tech.getLatitude(), so.getAddress(), so.getCity());
                }
            }
        }

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
        return toResponse(repository.save(so));
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
                .filter(o -> o.getTechnician() != null
                        && o.getScheduledDate() != null
                        && !o.getScheduledDate().isAfter(LocalDate.now())
                        && o.getServiceValue() != null
                        && o.getSchedulingStatus() == SchedulingStatus.AGENDADO)
                .count();

        long prazoCumprido = all.stream()
                .filter(o -> o.getSchedulingStatus() == SchedulingStatus.AGENDADO
                        && o.getTechnician() != null
                        && o.getScheduledDate() != null
                        && o.getServiceValue() != null
                        && isScheduledDateTimePassed(o))
                .count();

        log.info("[DASHBOARD] abertas={} emAndamento={} atrasadas={} pendAprovacao={} pendConclusao={} prazoCumprido={}",
                abertas, emAndamento, atrasadas, pendentesAprov, pendentesConclusao, prazoCumprido);

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
        if (!repository.existsById(id)) throw new ResourceNotFoundException("OS não encontrada: " + id);
        repository.deleteById(id);
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
        if (o.getScheduledTime() == null) return !o.getScheduledDate().isAfter(LocalDate.now());
        try {
            LocalTime time = LocalTime.parse(o.getScheduledTime());
            return LocalDateTime.of(o.getScheduledDate(), time).isBefore(LocalDateTime.now());
        } catch (Exception e) {
            return !o.getScheduledDate().isAfter(LocalDate.now());
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
}
