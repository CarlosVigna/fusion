package com.fusion.fusion.linecancel;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.policy.PolicyRepository;
import com.fusion.fusion.policy.PolicyResponse;
import com.fusion.fusion.policy.PolicyStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;

// Controle de cancelamento de linha de chip — veiculos cuja apolice foi
// cancelada/encerrada precisam ter a linha do chip cancelada junto com
// a operadora, senao ela continua sendo cobrada. Ver LineCancelStatus
// pro fluxo (AGUARDANDO -> VERIFICAR -> PRONTO -> SOLICITADO -> CONCLUIDO).
@Slf4j
@Service
@RequiredArgsConstructor
public class LineCancelService {

    private final LineCancelRepository repository;

    private final PolicyRepository policyRepository;

    private final DeviceLinkageRepository linkageRepository;

    // Apos esse numero de dias sem verificacao manual, promove
    // AGUARDANDO -> VERIFICAR.
    private static final int VERIFY_AFTER_DAYS = 30;

    private static final EnumSet<PolicyStatus> TARGET_STATUSES =
            EnumSet.of(PolicyStatus.CANCELLED, PolicyStatus.CLOSED, PolicyStatus.EXPIRED);

    @Transactional
    public List<LineCancelResponse> findAll(LineCancelStatus filterStatus) {

        List<LineCancel> all = repository.findAll();

        boolean changed = false;

        for (LineCancel lc : all) {

            LineCancelStatus before = lc.getStatus();

            updateStatus(lc);

            if (lc.getStatus() != before) {
                changed = true;
            }

        }

        if (changed) {
            repository.saveAll(all);
        }

        List<LineCancel> filtered = filterStatus != null
                ? all.stream().filter(lc -> lc.getStatus() == filterStatus).toList()
                : all;

        return filtered.stream()
                .sorted(Comparator.comparing(
                        LineCancel::getPolicyEndDate,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .map(LineCancelResponse::from)
                .toList();

    }

    // Varre apolices CANCELLED/CLOSED/EXPIRED de veiculos ativos e cria
    // um LineCancel pra cada uma que ainda nao tem registro (dedup por
    // vehicle + policyEndDate, ver LineCancelRepository). Reaproveita o
    // ICCID/MSISDN/IMEI do device vinculado ao veiculo via DeviceLinkage
    // ativa — mesmo padrao ja usado em ReportCustomService/
    // VehicleGridService pra resolver o device "atual" de um veiculo.
    // cancelledAt nunca e' preenchido aqui — pra CANCELLED fica pendente
    // de preenchimento manual (ver setCancelledAt()); pra CLOSED/EXPIRED
    // nem chega a ser usado, a referencia e' sempre policyEndDate.
    @Transactional
    public int syncFromPolicies() {

        Map<UUID, DeviceLinkage> activeLinkageByVehicleId = new HashMap<>();

        for (DeviceLinkage linkage : linkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (linkage.getVehicle() != null) {
                activeLinkageByVehicleId.putIfAbsent(linkage.getVehicle().getId(), linkage);
            }
        }

        int created = 0;

        for (Policy policy : policyRepository.findAllActive()) {

            Vehicle vehicle = policy.getVehicle();

            if (vehicle == null
                    || vehicle.getDeletedAt() != null
                    || !Boolean.TRUE.equals(vehicle.getActive())) {
                continue;
            }

            PolicyStatus computed = PolicyResponse.computeStatus(policy);

            if (!TARGET_STATUSES.contains(computed)) {
                continue;
            }

            if (policy.getEndDate() == null) {
                // Sem data de fim de vigencia nao da pra contar os dias
                // nem classificar o registro — pula.
                continue;
            }

            if (repository.existsByVehicleAndPolicyEndDate(vehicle, policy.getEndDate())) {
                continue;
            }

            DeviceLinkage linkage = activeLinkageByVehicleId.get(vehicle.getId());
            Device device = linkage != null ? linkage.getDevice() : null;

            LineCancel lineCancel = LineCancel.builder()
                    .vehicle(vehicle)
                    .plate(vehicle.getPlate())
                    .insuredName(policy.getInsuredName() != null
                            ? policy.getInsuredName()
                            : vehicle.getInsuredName())
                    .iccid(device != null ? device.getSerialChip1() : null)
                    .msisdn(device != null ? device.getLineNumber() : null)
                    .imei(device != null ? device.getImei() : null)
                    .policyEndDate(policy.getEndDate())
                    .policyStatus(computed.name())
                    .status(LineCancelStatus.AGUARDANDO)
                    .build();

            repository.save(lineCancel);

            created++;

        }

        log.info("[LINE-CANCEL] Sync concluido — {} novo(s) registro(s)", created);

        return created;

    }

    // Data usada como referencia pra contar os dias: CANCELLED depende
    // de o usuario informar cancelledAt manualmente (o portal nao avisa
    // quando a operadora de fato desligou a linha); CLOSED/EXPIRED usam
    // policyEndDate direto, que ja vem preenchido do sync.
    private LocalDate referenceDate(LineCancel lc) {

        if ("CANCELLED".equals(lc.getPolicyStatus())) {
            return lc.getCancelledAt();
        }

        return lc.getPolicyEndDate();

    }

    // So recalcula estados "automaticos" (AGUARDANDO/VERIFICAR/PRONTO) —
    // SOLICITADO/CONCLUIDO sao avancos manuais definitivos, nunca voltam
    // pra tras so' porque os dias desde a data de referencia mudaram.
    void updateStatus(LineCancel lc) {

        if (lc.getStatus() == LineCancelStatus.SOLICITADO
                || lc.getStatus() == LineCancelStatus.CONCLUIDO) {
            return;
        }

        if (lc.getVerifiedAt() != null) {
            lc.setStatus(LineCancelStatus.PRONTO);
            return;
        }

        LocalDate reference = referenceDate(lc);

        if (reference == null) {
            // CANCELLED sem cancelledAt informado ainda — a contagem de
            // dias nem comecou, fica em AGUARDANDO indefinidamente ate
            // alguem preencher a data.
            lc.setStatus(LineCancelStatus.AGUARDANDO);
            return;
        }

        long days = ChronoUnit.DAYS.between(reference, LocalDate.now(ZoneOffset.UTC));

        lc.setStatus(days >= VERIFY_AFTER_DAYS
                ? LineCancelStatus.VERIFICAR
                : LineCancelStatus.AGUARDANDO);

    }

    @Transactional
    public LineCancelResponse setCancelledAt(UUID id, LocalDate cancelledAt) {

        LineCancel lc = findOrThrow(id);

        lc.setCancelledAt(cancelledAt);

        updateStatus(lc);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    @Transactional
    public LineCancelResponse markVerified(UUID id, String user) {

        LineCancel lc = findOrThrow(id);

        lc.setVerifiedAt(LocalDate.now(ZoneOffset.UTC));

        lc.setVerifiedBy(user);

        lc.setStatus(LineCancelStatus.PRONTO);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    @Transactional
    public LineCancelResponse markRequested(UUID id, String user) {

        LineCancel lc = findOrThrow(id);

        lc.setRequestedAt(LocalDate.now(ZoneOffset.UTC));

        lc.setRequestedBy(user);

        lc.setStatus(LineCancelStatus.SOLICITADO);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    @Transactional
    public LineCancelResponse markDone(UUID id) {

        LineCancel lc = findOrThrow(id);

        lc.setStatus(LineCancelStatus.CONCLUIDO);

        repository.save(lc);

        return LineCancelResponse.from(lc);

    }

    public String generateCancelEmail(List<UUID> ids) {

        List<LineCancel> items = repository.findAllById(ids);

        StringBuilder sb = new StringBuilder();

        sb.append("Bom dia, tudo joia?\n\n");
        sb.append("Solicito, por gentileza, o cancelamento das linhas abaixo:\n\n");

        for (LineCancel lc : items) {

            sb.append("ICCID: ").append(valueOrDash(lc.getIccid())).append("\n");
            sb.append("MSISDN: ").append(valueOrDash(lc.getMsisdn())).append("\n");
            sb.append("IMEI: ").append(valueOrDash(lc.getImei())).append("\n\n");

        }

        sb.append("Desde já, agradeço pela atenção e fico no aguardo da confirmação.\n\n");
        sb.append("Atenciosamente,");

        return sb.toString();

    }

    private String valueOrDash(String value) {
        return value != null && !value.isBlank() ? value : "-";
    }

    private LineCancel findOrThrow(UUID id) {

        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cancelamento de linha não encontrado"
                ));

    }

}
