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

    // "/api/v2/brands/tree/{id}" (usado antes) NAO e' uma arvore de
    // dispositivos — e' a hierarquia de marcas/sub-contas (BrandsService
    // no ERP), devolve {brandId, brandChildId, brandChildName}, sem
    // "devices"/"fleets" em lugar nenhum. Confirmado direto contra a API
    // de producao. O endpoint real de dispositivos e' outro, usado pelo
    // DevicesService do proprio ERP:
    //   GET /api/devices?by=default-search&brand={brandId}&limit=&page=
    // paginado (content/page/lastPage), cada item tem "id", "status"
    // (ACTIVE/INACTIVE/DISCARDED/UNINSTALLED/...) e opcionalmente "car"
    // (id numerico do veiculo vinculado) — SEM campo "label"/placa
    // nenhum. A placa mora no cadastro do veiculo (CarService),
    // GET /api/vehicles/{carId} → "licensePlate". Nao existe filtro
    // "by=ids" pra vehicles (só pra devices), entao a placa precisa de
    // 1 chamada por device com car vinculado — aceitavel pra um sync
    // horario com algumas centenas de dispositivos.
    public List<TracknMeDeviceItem> fetchDevices(String token) {

        List<TracknMeDeviceItem> devices = new ArrayList<>();

        int page = 0;
        int limit = 100;
        boolean lastPage = false;

        while (!lastPage) {

            String url = apiUrl + "/api/devices?by=default-search&brand=" + brandId
                    + "&limit=" + limit + "&page=" + page;

            HttpHeaders headers = buildHeaders(token);
            HttpEntity<Void> request = new HttpEntity<>(headers);

            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, request, JsonNode.class);
            JsonNode responseBody = response.getBody();

            log.info("[TracknMe] fetchDevices response (page={}): {}", page, responseBody);

            if (responseBody == null) break;

            JsonNode content = responseBody.path("content");

            if (content.isArray()) {
                for (JsonNode d : content) {

                    String id = d.path("id").asText(null);

                    // So dispositivos ACTIVE viram veiculo no sync — um
                    // device DISCARDED/UNINSTALLED/INACTIVE nao e' um
                    // ativo rastreado de verdade, incluir ele faria o
                    // sync reativar/criar veiculo pra sucata.
                    boolean active = "ACTIVE".equalsIgnoreCase(d.path("status").asText(""));
                    if (!active) continue;

                    JsonNode carNode = d.path("car");
                    String label = (!carNode.isMissingNode() && !carNode.isNull())
                            ? fetchLicensePlate(token, carNode.asText())
                            : null;

                    // "identifier" e "imei" costumam vir com o mesmo
                    // valor no payload real — usa identifier como
                    // preferencial e cai pra imei se ausente.
                    String imei = d.path("identifier").asText(null);
                    if (imei == null) imei = d.path("imei").asText(null);

                    if (id != null && label != null && !label.isBlank()) {
                        devices.add(new TracknMeDeviceItem(
                                id,
                                label,
                                true,
                                imei,
                                d.path("model").asText(null),
                                d.path("operator").asText(null),
                                d.path("simCard").asText(null),
                                d.path("number").asText(null)
                        ));
                    }

                }
            }

            // Paginacao Spring Data padrao (diferente do formato
            // custom do endpoint de brands/tree) — o campo e' "last",
            // nao "lastPage". Confirmado direto contra a API real.
            lastPage = responseBody.path("last").asBoolean(true);
            page++;

        }

        return devices;

    }

    private String fetchLicensePlate(String token, String carId) {
        try {
            String url = apiUrl + "/api/vehicles/" + carId;
            HttpHeaders headers = buildHeaders(token);
            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, request, JsonNode.class);
            JsonNode root = response.getBody();
            return root == null ? null : root.path("licensePlate").asText(null);
        } catch (Exception e) {
            log.warn("[TracknMe] Falha ao buscar veículo (car={}): {}", carId, e.getMessage());
            return null;
        }
    }

    // Confirmado direto contra a API de producao: este endpoint NAO
    // aceita lote (varios deviceId separados por virgula na URL, como o
    // codigo antigo assumia) — sempre devolve so 1 posicao (limit=1 fixo
    // no servidor, ignora ?limit= mesmo passando varios ids no path). O
    // proprio ERP nem usa esse endpoint pra posicao ao vivo — usa MQTT —
    // entao isso aqui e' um fallback de polling raramente exercitado.
    // Alem disso a resposta vem paginada no formato custom antigo
    // ({content:[...], page, elements, ...}, igual brands/tree), nao um
    // array solto como o codigo assumia — por isso "última comunicação"
    // sempre saia vazia. Campos reais: gpsDateTime (quando o GPS gerou o
    // ponto) e receivedDateTime (quando o servidor recebeu) — sem
    // "dateTime"/"online" nenhum. Usa receivedDateTime (mais fiel a
    // "ultima comunicacao") e deriva online pela recencia, ja que a API
    // nao devolve esse flag.
    public List<TracknMePositionItem> fetchPositions(String token, List<String> deviceIds) {

        List<TracknMePositionItem> positions = new ArrayList<>();

        for (String deviceId : deviceIds) {

            try {

                String url = apiUrl + "/api/v2/last/positions/devices/" + deviceId + "?tz=America/Sao_Paulo";
                HttpHeaders headers = buildHeaders(token);
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, request, JsonNode.class);
                JsonNode root = response.getBody();

                if (root == null) continue;

                JsonNode content = root.path("content");
                if (!content.isArray() || content.isEmpty()) continue;

                JsonNode p = content.get(0);

                Double lat = p.path("latitude").isMissingNode() || p.path("latitude").isNull()
                        ? null : p.path("latitude").asDouble();
                Double lon = p.path("longitude").isMissingNode() || p.path("longitude").isNull()
                        ? null : p.path("longitude").asDouble();

                String dateTime = p.path("receivedDateTime").asText(null);
                if (dateTime == null) dateTime = p.path("gpsDateTime").asText(null);

                boolean online = isRecentlyOnline(dateTime);

                positions.add(new TracknMePositionItem(deviceId, lat, lon, dateTime, online));

            } catch (Exception e) {
                log.warn("[TracknMe] Falha ao buscar posição do device {}: {}", deviceId, e.getMessage());
            }

        }

        return positions;

    }

    private boolean isRecentlyOnline(String isoOffsetDateTime) {

        if (isoOffsetDateTime == null) return false;

        try {
            java.time.OffsetDateTime parsed = java.time.OffsetDateTime.parse(isoOffsetDateTime);
            long minutes = java.time.Duration.between(parsed, java.time.OffsetDateTime.now()).toMinutes();
            return minutes <= 30;
        } catch (Exception e) {
            return false;
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
