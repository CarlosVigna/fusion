package com.fusion.fusion.installation;

import com.fusion.fusion.etl.EtlHeartbeatRequest;
import com.fusion.fusion.etl.EtlRunStatus;
import com.fusion.fusion.etl.EtlStatusService;
import com.fusion.fusion.importation.ImportType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InstallationSyncService {

    private final InstallationRepository installationRepository;
    private final EtlStatusService etlStatusService;
    private final RestTemplate restTemplate;

    @Value("${portal.parceiro.url:https://onmeseguros.com.br}")
    private String portalUrl;

    @Value("${portal.parceiro.client-id:}")
    private String portalClientId;

    @Value("${portal.parceiro.client-secret:}")
    private String portalClientSecret;

    private volatile InstallationSyncResult lastResult;

    @Scheduled(cron = "0 */15 * * * *")
    public void scheduledSync() {

        try {

            InstallationSyncResult result = syncFromPortal();

            log.info("[INSTALACOES] Sync concluído: {} encontradas, {} inseridas, {} ignoradas",
                    result.found(), result.inserted(), result.skipped());

        } catch (Exception e) {

            log.error("[INSTALACOES] Erro no sync agendado: {}", e.getMessage(), e);

        }

    }

    public InstallationSyncResult syncFromPortal() {

        long startMs = System.currentTimeMillis();

        try {

            etlStatusService.heartbeat(new EtlHeartbeatRequest(
                    ImportType.INSTALACOES, EtlRunStatus.RUNNING,
                    null, null, null, null
            ));

            if (portalClientId.isBlank() || portalClientSecret.isBlank()) {
                throw new IllegalStateException(
                        "Credenciais do portal parceiro não configuradas " +
                        "(portal.parceiro.client-id / portal.parceiro.client-secret)"
                );
            }

            String token = getPortalToken();

            List<Map<String, Object>> allItems = fetchAllPages(token);

            int found = allItems.size();
            int inserted = 0;
            int skipped = 0;

            if (!allItems.isEmpty()) {
                log.info("[INSTALACOES] Campos da primeira ordem recebida: {}", allItems.get(0).keySet());
                log.info("[INSTALACOES] Valores da primeira ordem: {}", allItems.get(0));
            }

            for (Map<String, Object> item : allItems) {

                String externalId = extractString(item, "id");

                Object rawId = item.get("id");
                log.info("[INSTALACOES] Raw id={} (type={}), plate={}, customerName={}, dataCriacao={}",
                        rawId,
                        rawId == null ? "null" : rawId.getClass().getSimpleName(),
                        item.get("placa"),
                        item.get("nome_cliente"),
                        item.get("data_criacao"));

                if (externalId == null) {
                    log.warn("[INSTALACOES] externalId nulo, ignorando item: {}", item);
                    skipped++;
                    continue;
                }

                if (installationRepository.findByExternalId(externalId).isPresent()) {
                    skipped++;
                    continue;
                }

                Installation installation = Installation.builder()
                        .externalId(externalId)
                        .customerName(extractString(item, "nome_cliente", "nomeCliente", "nome", "customer_name", "customerName"))
                        .address(extractString(item, "endereco", "address", "logradouro"))
                        .neighborhood(extractString(item, "bairro", "neighborhood"))
                        .city(extractString(item, "cidade", "city", "municipio"))
                        .state(extractString(item, "estado", "state", "uf"))
                        .zipCode(extractString(item, "cep", "zipCode", "zip_code"))
                        .phone(extractString(item, "telefone", "phone", "celular"))
                        .plate(extractString(item, "placa", "plate"))
                        .model(extractString(item, "modelo", "model", "veiculo_modelo", "veiculoModelo"))
                        .numeroProposta(extractLong(item, "numero_proposta", "numeroProposta", "proposta"))
                        .portalCreatedAt(extractDateTime(item, "data_criacao", "dataCriacao", "createdAt", "created_at"))
                        .serviceType(extractString(item, "tipo_servico", "tipoServico", "serviceType", "service_type"))
                        .portalStatus(extractString(item, "status", "portalStatus", "portal_status", "situacao"))
                        .build();

                log.info("[INSTALACOES] Tentando inserir: externalId={}, plate={}, customerName={}",
                        installation.getExternalId(), installation.getPlate(), installation.getCustomerName());

                installationRepository.save(installation);
                inserted++;

            }

            long durationMs = System.currentTimeMillis() - startMs;
            LocalDateTime nextRun = LocalDateTime.now(ZoneOffset.UTC).plusMinutes(30);

            etlStatusService.heartbeat(new EtlHeartbeatRequest(
                    ImportType.INSTALACOES, EtlRunStatus.SUCCESS,
                    durationMs, null, inserted, nextRun
            ));

            InstallationSyncResult result = new InstallationSyncResult(
                    found, inserted, skipped, LocalDateTime.now(ZoneOffset.UTC)
            );
            lastResult = result;
            return result;

        } catch (Exception e) {

            long durationMs = System.currentTimeMillis() - startMs;

            etlStatusService.heartbeat(new EtlHeartbeatRequest(
                    ImportType.INSTALACOES, EtlRunStatus.ERROR,
                    durationMs, e.getMessage(), 0, null
            ));

            throw e;

        }

    }

    public InstallationSyncResult getLastResult() {
        return lastResult;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchAllPages(String token) {

        List<Map<String, Object>> all = new ArrayList<>();
        int page = 0;

        while (true) {

            String url = portalUrl
                    + "/ordens-instalacao"
                    + "?page=" + page
                    + "&size=50"
                    + "&status=AGUARDANDO_AGENDAMENTO";

            log.info("[INSTALACOES] GET {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(token);

            ResponseEntity<Object> response;
            try {
                response = restTemplate.exchange(
                        url, HttpMethod.GET,
                        new HttpEntity<>(headers),
                        Object.class
                );
            } catch (HttpClientErrorException e) {
                log.error("[INSTALACOES] Portal retornou {}: body={}", e.getStatusCode(), e.getResponseBodyAsString());
                throw e;
            }

            log.info("[INSTALACOES] Página {} — HTTP {}, body type={}", page, response.getStatusCode(), response.getBody() == null ? "null" : response.getBody().getClass().getSimpleName());

            List<Map<String, Object>> items = extractItems(response.getBody());

            log.info("[INSTALACOES] Página {} — {} itens extraídos", page, items.size());

            if (items.isEmpty()) break;

            all.addAll(items);

            if (items.size() < 50) break;

            page++;

        }

        return all;

    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractItems(Object body) {

        if (body instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }

        if (body instanceof Map<?, ?> map) {
            Object content = map.get("content");
            if (content instanceof List<?> list) {
                return (List<Map<String, Object>>) list;
            }
        }

        return Collections.emptyList();

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
                    "Token não encontrado na resposta. Campos: " + tokenData.keySet()
            );
        }

        return (String) token;

    }

    private String extractString(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val == null) continue;
            if (val instanceof String s && !s.isBlank()) return s;
            if (val instanceof Number) return val.toString();
        }
        return null;
    }

    private Long extractLong(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof Number n) return n.longValue();
        }
        return null;
    }

    private LocalDateTime extractDateTime(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof String s && !s.isBlank()) {
                try {
                    return LocalDateTime.parse(s.replace(" ", "T"));
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

}
