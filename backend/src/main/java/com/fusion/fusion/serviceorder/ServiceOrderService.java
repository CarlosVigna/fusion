package com.fusion.fusion.serviceorder;

import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.ors.OrsService;
import com.fusion.fusion.serviceorder.audit.ServiceOrderAuditLog;
import com.fusion.fusion.serviceorder.audit.ServiceOrderAuditLogRepository;
import com.fusion.fusion.technician.Technician;
import com.fusion.fusion.technician.TechnicianService;
import com.fusion.fusion.vehicle.PlateNormalizer;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import com.fusion.fusion.whatsapp.WhatsAppService;
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
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceOrderService {

    private final ServiceOrderRepository repository;
    private final TechnicianService technicianService;
    private final OrsService orsService;
    private final VehicleRepository vehicleRepository;
    private final VehicleOperationalStateRepository operationalStateRepository;
    private final OperationalSnapshotRepository operationalSnapshotRepository;
    private final ServiceOrderAuditLogRepository auditLogRepository;
    private final WhatsAppService whatsAppService;

    // Mesmos padrões usados no formulário do frontend (ServiceOrders.jsx) —
    // mantidos aqui só como rede de segurança para quem chamar a API
    // diretamente; o placa não entra aqui porque, assim como no frontend,
    // placa fora do padrão não bloqueia a OS (só é sinalizada visualmente).
    private static final Pattern CHASSIS_PATTERN = Pattern.compile("[A-HJ-NPR-Z0-9]{17}");
    private static final Pattern PHONE_PATTERN   = Pattern.compile("\\(\\d{2}\\)\\s\\d{4,5}-\\d{4}");
    private static final Pattern NAME_PATTERN    = Pattern.compile("[A-Za-zÀ-ÿ\\s]+");
    private static final Pattern CEP_PATTERN     = Pattern.compile("\\d{5}-?\\d{3}");

    public List<ServiceOrderResponse> listAll(boolean includeCompleted) {
        return repository.findAll().stream()
                .filter(o -> o.getDeletedAt() == null)
                .filter(o -> includeCompleted || o.getSchedulingStatus() != SchedulingStatus.CONCLUIDO)
                .sorted(Comparator.comparing(ServiceOrder::getRequestedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .toList();
    }

    public List<ServiceOrderResponse> listCompleted() {
        return repository.findAll().stream()
                .filter(o -> o.getDeletedAt() == null)
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
        // Só valida formato pra entrada manual — OS vindas do portal/sync
        // automático não passam por formulário e não devem ser rejeitadas
        // por formato (mesmo critério do check de customerName acima).
        if (isManual) {
            validateFields(request);
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
        ServiceOrderResponse saved = toResponse(repository.save(so));
        audit(so, "CRIADA", null, null, so.getPlate());
        if (isManual) {
            whatsAppService.sendNewOrderAlert(
                    so.getServiceType() != null ? so.getServiceType().name() : "INSTALACAO",
                    so.getPlate(), so.getCustomerName(), so.getAddress(),
                    so.getNeighborhood(), so.getCity(), so.getState(),
                    so.getZipCode(), so.getCustomerPhone());
        }
        return saved;
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

        validateFields(request);

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

        ServiceOrderResponse saved = toResponse(repository.save(so));
        audit(so, "EDITADA", null, null, null);
        return saved;
    }

    @Transactional
    public ServiceOrderResponse updateScheduling(UUID id, SchedulingRequest request) {
        ServiceOrder so = find(id);

        // Captura estado antes das mudanças para auditoria campo a campo
        BigDecimal prevServiceValue    = so.getServiceValue();
        LocalDate  prevScheduledDate   = so.getScheduledDate();
        String     prevScheduledTime   = so.getScheduledTime();
        Technician prevTech            = so.getTechnician();
        String     prevTechName        = prevTech != null ? prevTech.getName() : null;
        SchedulingStatus prevStatus    = so.getSchedulingStatus();
        boolean wasApproved            = so.getFinancialApprovalStatus() == FinancialApprovalStatus.APROVADO;

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

        // Auto-transition: técnico + data preenchidos
        // Se há deslocamento → aguardar aprovação financeira; senão → agendado direto
        if (request.technicianId() != null && request.scheduledDate() != null) {
            BigDecimal disp = so.getDisplacementValue();
            if (disp != null && disp.compareTo(BigDecimal.ZERO) > 0) {
                so.setSchedulingStatus(SchedulingStatus.AGUARDANDO_APROVACAO);
            } else {
                so.setSchedulingStatus(SchedulingStatus.AGENDADO);
            }
        }
        // Sobrescreve se OP/ADMIN enviar status explicitamente
        if (request.schedulingStatus() != null) {
            so.setSchedulingStatus(request.schedulingStatus());
            if (request.schedulingStatus() == SchedulingStatus.CONCLUIDO && so.getClosedAt() == null) {
                so.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            }
        }

        if (request.scheduledDate() != null) {
            if (so.getScheduledAt() == null) so.setScheduledAt(LocalDateTime.now(ZoneOffset.UTC));
            so.setScheduledDate(request.scheduledDate());
        }
        if (request.scheduledTime() != null) so.setScheduledTime(request.scheduledTime());

        // Deslocamento efetivo após possível recálculo por mudança de técnico
        BigDecimal effectiveDisplacement = so.getDisplacementValue();

        // Detecta mudança no valor do serviço
        boolean serviceValueChanged = request.serviceValue() != null
                && (prevServiceValue == null || prevServiceValue.compareTo(request.serviceValue()) != 0);

        boolean approvalReverted = false;
        if (serviceValueChanged) {
            // CORREÇÃO 3: se havia deslocamento e a OS estava aprovada → reverter para PENDENTE
            if (wasApproved
                    && effectiveDisplacement != null
                    && effectiveDisplacement.compareTo(BigDecimal.ZERO) > 0) {
                so.setFinancialApprovalStatus(FinancialApprovalStatus.PENDENTE);
                approvalReverted = true;
            }
            // CORREÇÃO 4: marcar flag se não tem deslocamento e valor mudou após já estar agendado
            if (prevStatus == SchedulingStatus.AGENDADO
                    && (effectiveDisplacement == null || effectiveDisplacement.compareTo(BigDecimal.ZERO) == 0)) {
                so.setServiceValueChangedAfterScheduling(true);
            }
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

        ServiceOrderResponse saved = toResponse(repository.save(so));

        // CORREÇÃO 2: audit campo a campo
        String auditAction = so.getSchedulingStatus() == SchedulingStatus.CONCLUIDO ? "CONCLUIDA" : "AGENDADA";
        boolean auditado = false;

        if (techChanged) {
            audit(so, auditAction, "tecnico",
                    prevTechName != null ? prevTechName : "—",
                    so.getTechnician() != null ? so.getTechnician().getName() : "—");
            auditado = true;
        }
        if (request.scheduledDate() != null && !request.scheduledDate().equals(prevScheduledDate)) {
            audit(so, auditAction, "dataAgendamento",
                    prevScheduledDate != null ? prevScheduledDate.toString() : "—",
                    request.scheduledDate().toString());
            auditado = true;
        }
        if (request.scheduledTime() != null && !request.scheduledTime().equals(prevScheduledTime)) {
            audit(so, auditAction, "horario",
                    prevScheduledTime != null ? prevScheduledTime : "—",
                    request.scheduledTime());
            auditado = true;
        }
        if (serviceValueChanged) {
            String prevStr = prevServiceValue != null ? "R$" + prevServiceValue : "—";
            String newStr  = "R$" + request.serviceValue();
            audit(so, auditAction, "valorServico", prevStr, newStr);
            auditado = true;
            if (approvalReverted) {
                audit(so, "EDITADA", "aprovacao",
                        "APROVADO — Aprovação revertida: valor alterado de " + prevStr + " para " + newStr,
                        "PENDENTE");
            }
        }
        if (!auditado) {
            audit(so, auditAction, "status",
                    prevStatus != null ? prevStatus.name() : null,
                    so.getSchedulingStatus() != null ? so.getSchedulingStatus().name() : null);
        }

        // Notificações WhatsApp — agendamento confirmado (sem deslocamento pendente)
        if (techChanged && so.getTechnician() != null && so.getScheduledDate() != null
                && so.getSchedulingStatus() == SchedulingStatus.AGENDADO) {
            whatsAppService.sendSchedulingAlert(
                    so.getPlate(),
                    so.getServiceType() != null ? so.getServiceType().name() : "",
                    so.getCustomerName(),
                    so.getTechnician().getName(),
                    so.getScheduledDate() != null ? so.getScheduledDate().toString() : "—",
                    so.getScheduledTime() != null ? so.getScheduledTime() : "—",
                    so.getAddress(), so.getCity(), so.getState());
        }
        // Notificação de deslocamento pendente de aprovação
        if (effectiveDisplacement != null && effectiveDisplacement.compareTo(BigDecimal.ZERO) > 0
                && so.getFinancialApprovalStatus() == FinancialApprovalStatus.PENDENTE) {
            whatsAppService.sendDisplacementPendingAlert(
                    so.getPlate(),
                    so.getServiceType() != null ? so.getServiceType().name() : "",
                    so.getTechnician() != null ? so.getTechnician().getName() : "—",
                    so.getDistanceKm(),
                    effectiveDisplacement);
        }

        return saved;
    }

    @Transactional
    public ServiceOrderResponse updateFinancialApproval(UUID id, FinancialApprovalRequest request) {
        ServiceOrder so = find(id);
        String oldStatus = so.getFinancialApprovalStatus() != null ? so.getFinancialApprovalStatus().name() : null;

        if (request.financialApprovalStatus() == FinancialApprovalStatus.REPROVADO) {
            // Notificar antes de limpar os dados do técnico
            String techName = so.getTechnician() != null ? so.getTechnician().getName() : "—";
            String prevStatusName = so.getSchedulingStatus() != null ? so.getSchedulingStatus().name() : "AGENDADO";
            whatsAppService.sendDisplacementRejectedAlert(
                    so.getPlate(),
                    so.getServiceType() != null ? so.getServiceType().name() : "",
                    techName);

            // Reverter OS para aberto
            so.setSchedulingStatus(SchedulingStatus.ABERTO);
            so.setTechnician(null);
            so.setScheduledDate(null);
            so.setScheduledTime(null);
            so.setServiceValue(null);
            so.setDisplacementValue(null);
            so.setDistanceKm(null);
            so.setTotalValue(null);
            so.setServiceValueChangedAfterScheduling(false);
            audit(so, "REPROVADA", "schedulingStatus", prevStatusName,
                    "ABERTO — Deslocamento reprovado: OS retornada para agendamento");
        } else if (request.financialApprovalStatus() == FinancialApprovalStatus.APROVADO) {
            so.setSchedulingStatus(SchedulingStatus.AGENDADO);
            whatsAppService.sendSchedulingAlert(
                    so.getPlate(),
                    so.getServiceType() != null ? so.getServiceType().name() : "",
                    so.getCustomerName(),
                    so.getTechnician() != null ? so.getTechnician().getName() : "—",
                    so.getScheduledDate() != null ? so.getScheduledDate().toString() : "—",
                    so.getScheduledTime() != null ? so.getScheduledTime() : "—",
                    so.getAddress(), so.getCity(), so.getState());
            whatsAppService.sendDisplacementApprovedAlert(
                    so.getPlate(),
                    so.getServiceType() != null ? so.getServiceType().name() : "",
                    so.getTechnician() != null ? so.getTechnician().getName() : "—",
                    so.getScheduledDate() != null ? so.getScheduledDate().toString() : "—",
                    so.getScheduledTime() != null ? so.getScheduledTime() : "—",
                    so.getDisplacementValue());
        }

        so.setFinancialApprovalStatus(request.financialApprovalStatus());
        ServiceOrderResponse saved = toResponse(repository.save(so));
        String action = request.financialApprovalStatus() == FinancialApprovalStatus.APROVADO ? "APROVADA" : "REPROVADA";
        audit(so, action, "financialApprovalStatus", oldStatus,
                request.financialApprovalStatus() != null ? request.financialApprovalStatus().name() : null);
        return saved;
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
        ServiceOrderResponse saved = toResponse(repository.save(so));
        audit(so, "CONCLUIDA", "schedulingStatus", "AGENDADO", "CONCLUIDO");
        whatsAppService.sendCompletionAlert(
                so.getPlate(),
                so.getServiceType() != null ? so.getServiceType().name() : "",
                so.getCustomerName(),
                so.getTechnician() != null ? so.getTechnician().getName() : "—",
                so.getServiceValue(),
                so.getTotalValue());
        return saved;
    }

    // OS de instalacao as vezes chega/e' criada sem placa (ex: portal ainda
    // nao tinha o dado no momento). So permite vincular enquanto a OS
    // ainda esta' ABERTO — depois de agendada/concluida a placa devia vir
    // de outro fluxo (edicao normal), nao desse atalho.
    @Transactional
    public ServiceOrderResponse linkPlate(UUID id, String plate) {
        ServiceOrder so = find(id);

        if (so.getSchedulingStatus() != SchedulingStatus.ABERTO) {
            throw new BusinessException("Só é possível vincular placa a uma OS aberta");
        }

        if (plate == null || plate.isBlank()) {
            throw new BusinessException("Informe uma placa");
        }

        String normalizedPlate = PlateNormalizer.normalize(plate);

        Vehicle vehicle = vehicleRepository.findByPlate(normalizedPlate)
                .filter(v -> v.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException("Placa não encontrada no cadastro de veículos"));

        String oldPlate = so.getPlate();
        so.setPlate(vehicle.getPlate());

        ServiceOrderResponse saved = toResponse(repository.save(so));
        audit(so, "PLACA_VINCULADA", "plate", oldPlate != null && !oldPlate.isBlank() ? oldPlate : "—", so.getPlate());
        return saved;
    }

    // Pra instalacoes feitas antes do Fusion existir — nao ha tecnico/
    // agendamento pra passar pelo fluxo normal de confirmCompletion(), mas
    // precisa constar como concluida. So permitido quando ainda nao entrou
    // em nenhum fluxo (ABERTO, sem tecnico) e o veiculo prova que a
    // instalacao aconteceu de fato (esta' posicionando).
    @Transactional
    public void concludeAsLegacy(UUID id, String performedBy) {
        ServiceOrder so = find(id);

        if (so.getSchedulingStatus() != SchedulingStatus.ABERTO || so.getTechnician() != null) {
            throw new BusinessException("Só é possível concluir como legado uma OS aberta e sem técnico atribuído");
        }

        if (so.getPlate() == null || so.getPlate().isBlank()) {
            throw new BusinessException("OS sem placa — vincule uma placa antes de concluir");
        }

        if (!checkVehicleSignal(so.getPlate())) {
            throw new BusinessException("Veículo não está posicionando — não é possível concluir como legado");
        }

        String legacyNote = "Concluída como legado — instalação realizada antes da implantação do sistema";
        so.setObservations(so.getObservations() != null && !so.getObservations().isBlank()
                ? so.getObservations() + "\n" + legacyNote
                : legacyNote);

        so.setSchedulingStatus(SchedulingStatus.CONCLUIDO);
        so.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
        so.setCompletionConfirmed(true);

        repository.save(so);

        audit(so, "CONCLUIDA_LEGADO", "schedulingStatus", "ABERTO", "CONCLUIDO");
    }

    public Map<String, Object> dashboard(boolean showAnalytics) {
        List<ServiceOrder> all = repository.findAll().stream()
                .filter(o -> o.getDeletedAt() == null)
                .toList();

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
        return repository.findByServiceTypeAndSchedulingStatusNotAndCompletionConfirmedFalseAndDeletedAtIsNull(
                ServiceType.INSTALACAO, SchedulingStatus.CONCLUIDO);
    }

    // Soft-delete — mantem o registro (e o historico de auditoria que
    // aponta pra ele) pra fins de rastreabilidade, so tira da listagem
    // (ver filtros getDeletedAt() == null em listAll/listCompleted/
    // dashboard/find()).
    @Transactional
    public void delete(UUID id, String performedBy) {
        ServiceOrder so = find(id);
        so.setDeletedAt(LocalDateTime.now(ZoneOffset.UTC));
        repository.save(so);
        audit(so, "EXCLUIDA", null, so.getPlate(), null);
    }

    // ADMIN corrige uma conclusao feita por engano — volta pro fluxo normal
    // sem perder o que ja foi preenchido (tecnico/data/valores), so desfaz
    // o que confirmCompletion()/concludeAsLegacy() setam na conclusao.
    @Transactional
    public void revertCompletion(UUID id, String performedBy) {
        ServiceOrder so = find(id);

        if (so.getSchedulingStatus() != SchedulingStatus.CONCLUIDO) {
            throw new BusinessException("Só é possível reverter uma OS concluída");
        }

        so.setSchedulingStatus(SchedulingStatus.ABERTO);
        so.setClosedAt(null);
        so.setCompletionConfirmed(false);

        repository.save(so);

        audit(so, "CONCLUSAO_REVERTIDA", "schedulingStatus", "CONCLUIDO", "ABERTO");
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

    private void validateFields(ServiceOrderRequest request) {

        if (request.chassis() != null && !request.chassis().isBlank()
                && !CHASSIS_PATTERN.matcher(request.chassis().trim().toUpperCase()).matches()) {
            throw new BusinessException("Chassi inválido — deve ter 17 caracteres (sem I, O, Q)");
        }

        if (request.customerPhone() != null && !request.customerPhone().isBlank()
                && !PHONE_PATTERN.matcher(request.customerPhone().trim()).matches()) {
            throw new BusinessException("Telefone inválido — use o formato (00) 00000-0000");
        }

        if (request.customerName() != null && !request.customerName().isBlank()
                && !NAME_PATTERN.matcher(request.customerName().trim()).matches()) {
            throw new BusinessException("Nome do cliente deve conter apenas letras e espaços");
        }

        if (request.zipCode() != null && !request.zipCode().isBlank()
                && !CEP_PATTERN.matcher(request.zipCode().trim()).matches()) {
            throw new BusinessException("CEP inválido — deve ter 8 dígitos");
        }

    }

    private ServiceOrder find(UUID id) {
        return repository.findById(id)
                .filter(so -> so.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("OS não encontrada: " + id));
    }

    private void audit(ServiceOrder so, String action, String field, String oldValue, String newValue) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String performedBy = auth != null ? auth.getName() : "SISTEMA";
            auditLogRepository.save(ServiceOrderAuditLog.builder()
                    .serviceOrderId(so.getId())
                    .plate(so.getPlate())
                    .action(action)
                    .field(field)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .performedBy(performedBy)
                    .performedByName(performedBy)
                    .build());
        } catch (Exception e) {
            log.warn("[AUDIT] Falha ao registrar log OS={}: {}", so.getId(), e.getMessage());
        }
    }

    public List<ServiceOrderAuditLog> getAuditLog(String plate, String action, String performedBy,
                                                   String dateFrom, String dateTo) {
        List<ServiceOrderAuditLog> all = auditLogRepository.findAllByOrderByPerformedAtDesc();
        return all.stream()
                .filter(l -> plate == null || plate.isBlank()
                        || (l.getPlate() != null && l.getPlate().toLowerCase().contains(plate.toLowerCase())))
                .filter(l -> action == null || action.isBlank() || action.equals(l.getAction()))
                .filter(l -> performedBy == null || performedBy.isBlank()
                        || (l.getPerformedBy() != null && l.getPerformedBy().toLowerCase().contains(performedBy.toLowerCase())))
                .filter(l -> {
                    if (dateFrom == null || dateFrom.isBlank()) return true;
                    return l.getPerformedAt() != null && !l.getPerformedAt().toLocalDate().isBefore(java.time.LocalDate.parse(dateFrom));
                })
                .filter(l -> {
                    if (dateTo == null || dateTo.isBlank()) return true;
                    return l.getPerformedAt() != null && !l.getPerformedAt().toLocalDate().isAfter(java.time.LocalDate.parse(dateTo));
                })
                .toList();
    }

    public List<ServiceOrderAuditLog> getAuditLogForOrder(UUID id) {
        return auditLogRepository.findByServiceOrderIdOrderByPerformedAtDesc(id);
    }

    ServiceOrderResponse toResponse(ServiceOrder so) {

        // Usado pelo botao "Concluir como Legado" no frontend pra nao nem
        // oferecer a acao quando o veiculo nunca mandou posicao — evita um
        // clique que so vai falhar la' na frente em checkVehicleSignal().
        boolean hasEverCommunicated = false;
        if (so.getPlate() != null) {
            hasEverCommunicated = operationalSnapshotRepository
                    .findFirstByVehiclePlate(so.getPlate())
                    .map(s -> s.getLastCommunicationAt() != null)
                    .orElse(false);
        }

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
                so.isLate(),
                so.getServiceValueChangedAfterScheduling(),
                hasEverCommunicated
        );
    }

}
