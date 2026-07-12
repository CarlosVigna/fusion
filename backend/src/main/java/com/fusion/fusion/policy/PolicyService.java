package com.fusion.fusion.policy;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PolicyService {

    private final PolicyRepository policyRepository;

    private final VehicleRepository vehicleRepository;

    private final DeviceLinkageRepository linkageRepository;

    private final RestTemplate restTemplate;

    @Value("${fusion.etl.server-url:}")
    private String etlServerUrl;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    public List<PolicyResponse> findAll(String plate, String statusStr) {

        return policyRepository.findAll()
                .stream()
                .filter(p -> {
                    if (plate == null || plate.isBlank()) return true;
                    return plate.equalsIgnoreCase(p.getPlate());
                })
                .filter(p -> {
                    if (statusStr == null || statusStr.isBlank()) return true;
                    try {
                        return PolicyResponse.computeStatus(p) == PolicyStatus.valueOf(statusStr);
                    } catch (IllegalArgumentException e) {
                        return true;
                    }
                })
                .map(PolicyResponse::from)
                .toList();

    }

    public List<PendingVehicleResponse> findPendingVehicles() {

        Set<String> platesWithActivePolicy = policyRepository.findAll()
                .stream()
                .filter(p -> {
                    PolicyStatus s = PolicyResponse.computeStatus(p);
                    return s == PolicyStatus.ACTIVE
                            || s == PolicyStatus.FUTURE
                            || s == PolicyStatus.EXPIRING;
                })
                .map(Policy::getPlate)
                .filter(Objects::nonNull)
                .map(String::toUpperCase)
                .collect(Collectors.toSet());

        Map<UUID, DeviceLinkage> linkageByVehicleId = new HashMap<>();
        for (DeviceLinkage dl : linkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (dl.getVehicle() != null) {
                linkageByVehicleId.putIfAbsent(dl.getVehicle().getId(), dl);
            }
        }

        return vehicleRepository.findAll()
                .stream()
                .filter(v -> v.getDeletedAt() == null
                        && !platesWithActivePolicy.contains(v.getPlate().toUpperCase()))
                .map(v -> {
                    DeviceLinkage dl = linkageByVehicleId.get(v.getId());
                    String activeDevice = dl != null && dl.getDevice() != null
                            ? dl.getDevice().getNumberStr() : null;
                    String lineNumber = dl != null && dl.getDevice() != null
                            ? dl.getDevice().getLineNumber() : null;
                    return new PendingVehicleResponse(
                            v.getId(),
                            v.getPlate(),
                            v.getInsuredName(),
                            v.getPlatform(),
                            activeDevice,
                            lineNumber
                    );
                })
                .toList();

    }

    public List<PolicyResponse> findExpiring(int days) {

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate limit = today.plusDays(days);

        return policyRepository.findAll()
                .stream()
                .filter(p -> {
                    PolicyStatus s = PolicyResponse.computeStatus(p);
                    return (s == PolicyStatus.ACTIVE || s == PolicyStatus.EXPIRING)
                            && p.getEndDate() != null
                            && !p.getEndDate().isAfter(limit);
                })
                .map(PolicyResponse::from)
                .toList();

    }

    public List<PolicyResponse> findExpired() {

        return policyRepository.findAll()
                .stream()
                .filter(p -> PolicyResponse.computeStatus(p) == PolicyStatus.EXPIRED)
                .map(PolicyResponse::from)
                .toList();

    }

    public PolicyBadgeCountsResponse getBadgeCounts() {

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate limit = today.plusDays(30);
        long expired = 0;
        long expiring = 0;

        for (Policy p : policyRepository.findAll()) {

            PolicyStatus s = PolicyResponse.computeStatus(p);

            if (s == PolicyStatus.EXPIRED) {
                expired++;
            } else if ((s == PolicyStatus.ACTIVE || s == PolicyStatus.EXPIRING)
                    && p.getEndDate() != null
                    && !p.getEndDate().isAfter(limit)) {
                expiring++;
            }

        }

        return new PolicyBadgeCountsResponse(expired, expiring);

    }

    public EtlPolicyResult fetchFromEtl(String plate) {

        if (etlServerUrl == null || etlServerUrl.isBlank()) {
            throw new IllegalStateException("ETL server URL não configurada (fusion.etl.server-url)");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-ETL-Key", etlApiKey);

        Map<String, String> body = Map.of("plate", plate.toUpperCase());

        ResponseEntity<EtlPolicyResult> response = restTemplate.exchange(
                etlServerUrl + "/apolice/buscar",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                EtlPolicyResult.class
        );

        EtlPolicyResult result = response.getBody();
        return result != null ? result : new EtlPolicyResult(false, null);

    }

    public PolicyResponse create(PolicyRequest req) {

        var vehicle = vehicleRepository.findByPlate(
                        normalizePlate(req.plate())
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Veículo não encontrado: " + req.plate()
                ));

        Policy policy = Policy.builder()
                .vehicle(vehicle)
                .plate(vehicle.getPlate())
                .policyNumber(req.policyNumber())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .status(PolicyStatus.ACTIVE)
                .insuredName(req.insuredName())
                .cpfCnpj(req.cpfCnpj())
                .vehicleModel(req.vehicleModel())
                .vehicleBrand(req.vehicleBrand())
                .bonus(req.bonus())
                .source(req.source() != null ? req.source() : PolicySource.MANUAL)
                .build();

        return PolicyResponse.from(policyRepository.save(policy));

    }

    public PolicyResponse update(Long id, PolicyRequest req) {

        Policy policy = policyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Apólice não encontrada"
                ));

        policy.setPolicyNumber(req.policyNumber());
        policy.setStartDate(req.startDate());
        policy.setEndDate(req.endDate());
        policy.setInsuredName(req.insuredName());
        policy.setCpfCnpj(req.cpfCnpj());
        policy.setVehicleModel(req.vehicleModel());
        policy.setVehicleBrand(req.vehicleBrand());
        policy.setBonus(req.bonus());

        if (req.status() == PolicyStatus.CANCELLED) {
            policy.setStatus(PolicyStatus.CANCELLED);
        }

        return PolicyResponse.from(policyRepository.save(policy));

    }

    public void delete(Long id) {

        Policy policy = policyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Apólice não encontrada"
                ));

        policyRepository.delete(policy);

    }

    private String normalizePlate(String plate) {
        return plate.replace("-", "").replace(" ", "").trim().toUpperCase();
    }

}
