package com.fusion.fusion.ors;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrsService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ors.api-key:}")
    private String apiKey;

    private static final double FREE_KM = 40.0;
    private static final double RATE_PER_KM = 1.20;

    public double[] geocode(String address, String city, String state) {
        // Tentativa 1: endereço completo
        String query = address + ", " + city + ", " + (state != null ? state : "") + ", Brasil";
        double[] result = geocodeQuery(query);

        // Fallback: só cidade + estado (útil para cidades pequenas)
        if (result == null && city != null && state != null && !state.isBlank()) {
            log.info("[NOMINATIM] Fallback cidade/estado: {}, {}", city, state);
            result = geocodeQuery(city + ", " + state + ", Brasil");
        }

        return result;
    }

    private double[] geocodeQuery(String query) {
        try {
            String url = "https://nominatim.openstreetmap.org/search?q="
                    + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                    + "&format=json&limit=1&countrycodes=br";

            log.info("[NOMINATIM] Geocodificando: {}", query);

            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "FusionApp/1.0");
            headers.set("Accept-Language", "pt-BR");
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            String responseBody = response.getBody();
            JsonNode root = objectMapper.readTree(responseBody);
            if (root.isArray() && root.size() > 0) {
                double lat = root.get(0).path("lat").asDouble();
                double lon = root.get(0).path("lon").asDouble();
                log.info("[NOMINATIM] Resultado: lat={}, lon={}", lat, lon);
                return new double[]{lat, lon};
            } else {
                log.warn("[NOMINATIM] Retornou vazio para: {} | Response: {}", query, responseBody);
            }
        } catch (HttpClientErrorException e) {
            log.debug("[NOMINATIM] HTTP {} para '{}' — deslocamento ficará em branco", e.getStatusCode(), query);
        } catch (Exception e) {
            log.warn("[NOMINATIM] Falhou para '{}': {}", query, e.getMessage());
        }
        return null;
    }

    // Retorna distância total (ida + volta) em km
    public Double calculateRoundTripKm(double techLat, double techLon, double clientLat, double clientLon) {
        if (apiKey.isBlank()) return null;
        try {
            String url = "https://api.heigit.org/v2/directions/driving-car";
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Ida e volta: técnico → cliente → técnico
            Map<String, Object> body = Map.of(
                    "coordinates", List.of(
                            List.of(techLon, techLat),
                            List.of(clientLon, clientLat),
                            List.of(techLon, techLat)
                    )
            );

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            double meters = root.path("routes").get(0).path("summary").path("distance").asDouble();
            return Math.round(meters / 100.0) / 10.0; // km com 1 decimal
        } catch (HttpClientErrorException e) {
            log.debug("[ORS] routing HTTP {} — deslocamento ficará em branco", e.getStatusCode());
        } catch (Exception e) {
            log.warn("[ORS] routing falhou: {}", e.getMessage());
        }
        return null;
    }

    public BigDecimal calculateDisplacement(double totalKm) {
        if (totalKm <= FREE_KM) return BigDecimal.ZERO;
        double extra = (totalKm - FREE_KM) * RATE_PER_KM;
        return BigDecimal.valueOf(extra).setScale(2, RoundingMode.HALF_UP);
    }
}
