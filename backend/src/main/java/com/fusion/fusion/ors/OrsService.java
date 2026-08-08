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

    @Value("${geocode.maps.api.key:}")
    private String geocodeApiKey;

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
            String url = "https://geocode.maps.co/search?q="
                    + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                    + "&api_key=" + geocodeApiKey
                    + "&countrycodes=br&limit=1";

            log.info("[GEOCODE] Geocodificando: {}", query);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            String responseBody = response.getBody();
            JsonNode root = objectMapper.readTree(responseBody);
            if (root.isArray() && root.size() > 0) {
                double lat = root.get(0).path("lat").asDouble();
                double lon = root.get(0).path("lon").asDouble();
                log.info("[GEOCODE] Resultado: lat={}, lon={}", lat, lon);
                return new double[]{lat, lon};
            } else {
                log.warn("[GEOCODE] Retornou vazio para: {} | Response: {}", query, responseBody);
            }
        } catch (HttpClientErrorException e) {
            log.debug("[GEOCODE] HTTP {} para '{}' — deslocamento ficará em branco", e.getStatusCode(), query);
        } catch (Exception e) {
            log.warn("[GEOCODE] Falhou para '{}': {}", query, e.getMessage());
        }
        return null;
    }

    // Retorna distância total (ida + volta) em km via OSRM (gratuito, sem chave)
    public Double calculateRoundTripKm(double techLat, double techLon, double clientLat, double clientLon) {
        try {
            String url = "https://router.project-osrm.org/route/v1/driving/"
                    + techLon + "," + techLat + ";"
                    + clientLon + "," + clientLat
                    + "?overview=false";

            log.info("[OSRM] Calculando rota: techLat={} techLon={} clientLat={} clientLon={}", techLat, techLon, clientLat, clientLon);
            log.info("[OSRM] URL: {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            log.info("[OSRM] Response status: {}", response.getStatusCode());
            log.info("[OSRM] Response body: {}", response.getBody());

            JsonNode root = objectMapper.readTree(response.getBody());
            double meters = root.path("routes").get(0).path("distance").asDouble();
            double km = (meters / 1000.0) * 2; // ida + volta
            return Math.round(km * 10.0) / 10.0;
        } catch (HttpClientErrorException e) {
            log.warn("[OSRM] HTTP {} — body: {}", e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("[OSRM] Falhou: {}", e.getMessage());
        }
        return null;
    }

    public BigDecimal calculateDisplacement(double totalKm) {
        if (totalKm <= FREE_KM) return BigDecimal.ZERO;
        double extra = (totalKm - FREE_KM) * RATE_PER_KM;
        return BigDecimal.valueOf(extra).setScale(2, RoundingMode.HALF_UP);
    }
}
