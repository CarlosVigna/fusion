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

            for (Map<String, Object> item : allItems) {

                String externalId = extractString(item, "externalId");

                if (externalId == null) {
                    log.warn("[INSTALACOES] externalId nulo, ignorando item id={}", item.get("id"));
                    skipped++;
                    continue;
                }

                if (installationRepository.findByExternalId(externalId).isPresent()) {
                    skipped++;
                    continue;
                }

                String logradouro = extractNestedString(item, "segurado", "endereco", "logradouro");
                String numero     = extractNestedString(item, "segurado", "endereco", "numero");
                String address    = (logradouro != null && numero != null)
                        ? logradouro + ", " + numero
                        : logradouro;

                Installation installation = Installation.builder()
                        .externalId(externalId)
                        .customerName(extractNestedString(item, "segurado", "nome"))
                        .address(address)
                        .neighborhood(extractNestedString(item, "segurado", "endereco", "bairro"))
                        .city(extractNestedString(item, "segurado", "endereco", "cidade"))
                        .state(extractNestedString(item, "segurado", "endereco", "uf"))
                        .zipCode(extractNestedString(item, "segurado", "endereco", "cep"))
                        .phone(formatPhone(item))
                        .plate(extractNestedString(item, "veiculo", "placa"))
                        .model(extractNestedString(item, "veiculo", "modelo"))
                        .numeroProposta(extractNestedLong(item, "proposta", "numeroProposta"))
                        .portalCreatedAt(extractDateTime(item, "dataCriacao", "data_criacao"))
                        .serviceType(extractString(item, "tipoServico", "tipo_servico"))
                        .portalStatus(extractString(item, "statusAtual", "status"))
                        .build();

                log.info("[INSTALACOES] Tentando inserir: externalId={}, plate={}, customerName={}",
                        installation.getExternalId(), installation.getPlate(), installation.getCustomerName());

                installationRepository.save(installation);
                inserted++;

            }

            long durationMs = System.currentTimeMillis() - startMs;
            LocalDateTime nextRun = LocalDateTime.now(ZoneOffset.UTC).plusMinutes(15);

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

    @SuppressWarnings("unchecked")
    private String extractNestedString(Map<String, Object> map, String... path) {
        Object current = map;
        for (int i = 0; i < path.length - 1; i++) {
            if (!(current instanceof Map<?, ?> m)) return null;
            current = m.get(path[i]);
        }
        if (!(current instanceof Map<?, ?> m)) return null;
        Object val = m.get(path[path.length - 1]);
        if (val == null) return null;
        if (val instanceof String s && !s.isBlank()) return s;
        if (val instanceof Number) return val.toString();
        return null;
    }

    @SuppressWarnings("unchecked")
    private Long extractNestedLong(Map<String, Object> map, String... path) {
        Object current = map;
        for (int i = 0; i < path.length - 1; i++) {
            if (!(current instanceof Map<?, ?> m)) return null;
            current = m.get(path[i]);
        }
        if (!(current instanceof Map<?, ?> m)) return null;
        Object val = m.get(path[path.length - 1]);
        if (val instanceof Number n) return n.longValue();
        return null;
    }

    @SuppressWarnings("unchecked")
    private String formatPhone(Map<String, Object> map) {
        Object segurado = map.get("segurado");
        if (!(segurado instanceof Map<?, ?> s)) return null;
        Object telefone = s.get("telefonePrincipal");
        if (!(telefone instanceof Map<?, ?> t)) return null;
        Object ddd = t.get("ddd");
        Object numero = t.get("numero");
        if (ddd == null || numero == null) return null;
        return "(" + ddd + ") " + numero;
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
