package com.fusion.fusion.policy;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PolicyService {

    private final PolicyRepository policyRepository;

    private final VehicleRepository vehicleRepository;

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

    public List<PendingVehicleResponse> findPending() {

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

        return vehicleRepository.findAll()
                .stream()
                .filter(v -> v.getDeletedAt() == null
                        && !platesWithActivePolicy.contains(v.getPlate().toUpperCase()))
                .map(v -> new PendingVehicleResponse(
                        v.getId(),
                        v.getPlate(),
                        v.getInsuredName(),
                        v.getPlatform()
                ))
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
