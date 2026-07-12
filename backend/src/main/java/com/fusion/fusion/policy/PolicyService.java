package com.fusion.fusion.policy;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
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

    @Value("${portal.parceiro.url:https://onmeseguros.com.br}")
    private String portalUrl;

    @Value("${portal.parceiro.client-id:}")
    private String portalClientId;

    @Value("${portal.parceiro.client-secret:}")
    private String portalClientSecret;

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

    public EtlPolicyResult fetchFromPortal(String plate) {

        if (portalClientId.isBlank() || portalClientSecret.isBlank()) {
            throw new IllegalStateException(
                    "Credenciais do portal parceiro não configuradas " +
                    "(portal.parceiro.client-id / portal.parceiro.client-secret)"
            );
        }

        String token = getPortalToken();

        HttpHeaders getHeaders = new HttpHeaders();
        getHeaders.setBearerAuth(token);

        String url = portalUrl
                + "/seguro/auto/v1/protocolos/apolices"
                + "?pesquisa=" + plate.toUpperCase()
                + "&inicio=01/01/2017&fim=31/12/2030&page=0&size=50";

        ResponseEntity<Object> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(getHeaders),
                Object.class
        );

        List<Map<String, Object>> items = extractItems(response.getBody());

        List<Map<String, Object>> vigentes = items.stream()
                .filter(i -> "Apólice vigente".equals(i.get("status_descricao")))
                .sorted((a, b) -> {
                    LocalDate da = parsePortalDate((String) a.get("fim_vigencia"));
                    LocalDate db = parsePortalDate((String) b.get("fim_vigencia"));
                    if (da == null) return 1;
                    if (db == null) return -1;
                    return db.compareTo(da);
                })
                .toList();

        if (vigentes.isEmpty()) {
            return new EtlPolicyResult(false, null);
        }

        Map<String, Object> item = vigentes.get(0);

        return new EtlPolicyResult(true, new EtlPolicyResult.EtlPolicyData(
                (String) item.get("numero_apolice"),
                formatIsoDate((String) item.get("inicio_vigencia")),
                formatIsoDate((String) item.get("fim_vigencia")),
                (String) item.get("nome_razao_social"),
                (String) item.get("cpf_cnpj"),
                (String) item.get("placa"),
                (String) item.get("veiculo_modelo"),
                (String) item.get("veiculo_marca"),
                item.get("bonus") != null ? ((Number) item.get("bonus")).intValue() : null
        ));

    }

    @SuppressWarnings("unchecked")
    private String getPortalToken() {

        String credentials = Base64.getEncoder().encodeToString(
                (portalClientId + ":" + portalClientSecret).getBytes()
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.set("Authorization", "Basic " + credentials);
        headers.set("Origin", "https://parceiro.usebens.com.br");

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "password");
        body.add("client_id", portalClientId);
        body.add("client_secret", portalClientSecret);
        body.add("username", portalClientId);
        body.add("password", portalClientSecret);

        ResponseEntity<Map> response = restTemplate.exchange(
                portalUrl + "/oauth/token",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                Map.class
        );

        Map<String, Object> tokenData = response.getBody();

        if (tokenData == null) {
            throw new IllegalStateException("Resposta vazia do token do portal parceiro");
        }

        Object token = tokenData.get("accessToken");
        if (token == null) token = tokenData.get("access_token");
        if (token == null) token = tokenData.get("token");

        if (token == null) {
            throw new IllegalStateException(
                    "Token não encontrado na resposta do portal. Campos: "
                    + tokenData.keySet()
            );
        }

        return (String) token;

    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractItems(Object body) {

        if (body instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }

        if (body instanceof Map<?, ?> map) {
            Map<String, Object> m = (Map<String, Object>) map;
            for (String key : new String[]{"content", "items", "data"}) {
                if (m.get(key) instanceof List<?> l) {
                    return (List<Map<String, Object>>) l;
                }
            }
        }

        return List.of();

    }

    private LocalDate parsePortalDate(String str) {

        if (str == null || str.isBlank()) return null;

        try {
            String[] parts = str.split("/");
            if (parts.length == 3) {
                return LocalDate.of(
                        Integer.parseInt(parts[2]),
                        Integer.parseInt(parts[1]),
                        Integer.parseInt(parts[0])
                );
            }
        } catch (Exception ignored) {}

        return null;

    }

    private String formatIsoDate(String str) {
        LocalDate d = parsePortalDate(str);
        return d != null ? d.toString() : null;
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
