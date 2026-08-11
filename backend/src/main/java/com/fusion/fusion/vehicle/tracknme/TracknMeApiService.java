package com.fusion.fusion.vehicle.tracknme;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class TracknMeApiService {

    @Value("${tracknme.api.url}")
    private String apiUrl;

    @Value("${tracknme.api.login}")
    private String apiLogin;

    @Value("${tracknme.api.password}")
    private String apiPassword;

    @Value("${tracknme.brand.id}")
    private String brandId;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Endpoint e formato do body confirmados direto contra a API de
    // producao (a doc/URL antiga "/api/v2/login" nao existe — 404 da
    // WordPress do site institucional, que responde em www.tracknme.com.br
    // pra qualquer rota que a API real nao reconheca). O SessionService do
    // proprio ERP (bundle JS servido publicamente em /erp/) usa
    // POST {serverURL}/sessions?essential com esse body exato.
    public String authenticate() {
        String url = apiUrl + "/api/sessions?essential";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = Map.of(
                "login", apiLogin,
                "password", apiPassword,
                "persistent", false,
                "type", "DEFAULT"
        );
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.POST, request, JsonNode.class);
        JsonNode root = response.getBody();
        if (root == null) throw new RuntimeException("TracknMe auth: resposta vazia");
        // accessToken ja vem com o prefixo "Bearer " incluso no valor —
        // usar direto no header Authorization, sem prefixar de novo.
        JsonNode tokenNode = root.path("accessToken");
        if (tokenNode.isMissingNode() || tokenNode.isNull()) {
            throw new RuntimeException("TracknMe auth: accessToken não encontrado na resposta");
        }
        return tokenNode.asText();
    }

    public List<TracknMeDeviceItem> fetchDevices(String token) {
        String url = apiUrl + "/api/v2/brands/tree/" + brandId + "?tz=America/Sao_Paulo";
        HttpHeaders headers = buildHeaders(token);
        HttpEntity<Void> request = new HttpEntity<>(headers);
        ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, request, JsonNode.class);
        JsonNode root = response.getBody();
        if (root == null) return List.of();
        List<TracknMeDeviceItem> devices = new ArrayList<>();
        collectDevices(root, devices);
        return devices;
    }

    // Coleta dispositivos de qualquer nível da árvore (raiz, fleets, etc.)
    private void collectDevices(JsonNode node, List<TracknMeDeviceItem> devices) {
        if (node == null) return;
        JsonNode devicesNode = node.path("devices");
        if (devicesNode.isArray()) {
            for (JsonNode d : devicesNode) {
                String id = d.path("id").asText(null);
                String label = d.path("label").asText(null);
                if (id != null && label != null && !label.isBlank()) {
                    devices.add(new TracknMeDeviceItem(id, label, d.path("active").asBoolean(true)));
                }
            }
        }
        JsonNode fleetsNode = node.path("fleets");
        if (fleetsNode.isArray()) {
            for (JsonNode fleet : fleetsNode) {
                collectDevices(fleet, devices);
            }
        }
    }

    public List<TracknMePositionItem> fetchPositions(String token, List<String> deviceIds) {
        if (deviceIds.isEmpty()) return List.of();
        String ids = String.join(",", deviceIds);
        String url = apiUrl + "/api/v2/last/positions/devices/" + ids + "?tz=America/Sao_Paulo";
        HttpHeaders headers = buildHeaders(token);
        HttpEntity<Void> request = new HttpEntity<>(headers);
        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, request, JsonNode.class);
            JsonNode root = response.getBody();
            if (root == null || !root.isArray()) return List.of();
            List<TracknMePositionItem> positions = new ArrayList<>();
            for (JsonNode p : root) {
                String deviceId = p.path("deviceId").asText(null);
                if (deviceId == null) deviceId = p.path("device_id").asText(null);
                Double lat = p.path("latitude").isNull() ? null : p.path("latitude").asDouble();
                Double lon = p.path("longitude").isNull() ? null : p.path("longitude").asDouble();
                String dateTime = p.path("dateTime").asText(null);
                if (dateTime == null) dateTime = p.path("date_time").asText(null);
                boolean online = p.path("online").asBoolean(false);
                if (deviceId != null) {
                    positions.add(new TracknMePositionItem(deviceId, lat, lon, dateTime, online));
                }
            }
            return positions;
        } catch (Exception e) {
            log.error("Erro ao buscar posições TracknMe: {}", e.getMessage());
            return List.of();
        }
    }

    public JsonNode fetchSimCardLine(String token, String iccid) {
        String url = apiUrl + "/api/v2/simcard?iccid=" + iccid +
                "&status=INACTIVE,ACTIVE,TRADE_IN,ACTIVATION_PROCESS&tz=America/Sao_Paulo";
        HttpHeaders headers = buildHeaders(token);
        HttpEntity<Void> request = new HttpEntity<>(headers);
        ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, request, JsonNode.class);
        return response.getBody();
    }

    private HttpHeaders buildHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // Header real e' Authorization (confirmado: chamada sem ele
        // devolve 401 "Header Authorization não informado"), nao um
        // header customizado "token" como estava antes.
        headers.set(HttpHeaders.AUTHORIZATION, token);
        return headers;
    }

}
