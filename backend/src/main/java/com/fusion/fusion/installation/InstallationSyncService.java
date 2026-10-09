package com.fusion.fusion.installation;

import com.fusion.fusion.etl.EtlHeartbeatRequest;
import com.fusion.fusion.etl.EtlRunStatus;
import com.fusion.fusion.etl.EtlStatusService;
import com.fusion.fusion.etl.EtlTriggerService;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.serviceorder.ServiceOrderService;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InstallationSyncService {

    private final InstallationRepository installationRepository;
    private final EtlStatusService etlStatusService;
    private final EtlTriggerService etlTriggerService;
    private final RestTemplate restTemplate;
    private final ServiceOrderService serviceOrderService;

    @Value("${portal.parceiro.url:https://onmeseguros.com.br}")
    private String portalUrl;

    @Value("${portal.parceiro.client-id:}")
    private String portalClientId;

    @Value("${portal.parceiro.client-secret:}")
    private String portalClientSecret;

    @Value("${ntfy.topic:}")
    private String ntfyTopic;

    private volatile InstallationSyncResult lastResult;

    // Os 8 status do portal — o sync busca todos (uma chamada paginada por
    // status) pra espelhar o portal, em vez de so' a fila de agendamento.
    private static final List<String> PORTAL_STATUSES = List.of(
            "AGUARDANDO_AGENDAMENTO",
            "AGENDADO_AGUARDANDO_ATIVACAO",
            "AGUARDANDO_INSTALACAO",
            "INSTALACAO_CONCLUIDA_SUCESSO",
            "INSTALACAO_CONCLUIDA_FALHA",
            "PENDENTE_INSTALACAO",
            "INSTALACAO_EM_ANALISE",
            "INSTALACAO_ENVIADA"
    );

    // Limita o sync as instalacoes a partir desta data (inicio/fim da API
    // do portal), pra nao puxar todo o historico a cada ciclo.
    private static final String SYNC_START_DATE = "2026-09-01";

    private static final String STATUS_AGUARDANDO = "AGUARDANDO_AGENDAMENTO";
    private static final String STATUS_CONCLUIDA = "INSTALACAO_CONCLUIDA_SUCESSO";

    private record PortalItem(Map<String, Object> item, String portalStatus) {}

    @Scheduled(cron = "0 0/30 * * * *")
    public void scheduledSync() {

        log.info("[INSTALLATION-SYNC] Iniciando sync - {}", LocalDateTime.now());

        InstallationSyncResult result;

        try {

            result = syncFromPortal();

        } catch (Exception e) {

            // 1 retry apos falha transitoria do portal (rate limit,
            // timeout, instabilidade) — o cron so roda de hora em hora,
            // entao uma unica falha ja custava ~1h de atraso visivel
            // (foi o caso da instalacao das 16:44 que so apareceu as 23h).
            log.warn("[INSTALACOES] Falha na primeira tentativa, aguardando 60s para retry: {}", e.getMessage());

            try {
                Thread.sleep(60000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.error("[INSTALACOES] Retry interrompido: {}", ie.getMessage());
                return;
            }

            try {

                result = syncFromPortal();

            } catch (Exception e2) {

                log.error("[INSTALACOES] Erro no sync agendado (apos retry): {}", e2.getMessage(), e2);
                return;

            }

        }

        log.info("[INSTALACOES] Sync concluído: {} encontradas, {} inseridas, {} ignoradas, {} fechadas, {} reabertas, {} concluídas",
                result.found(), result.inserted(), result.skipped(), result.closed(), result.reopened(), result.concluded());

    }

    public InstallationSyncResult syncFromPortal() {

        long startMs = System.currentTimeMillis();

        try {

            etlStatusService.heartbeat(new EtlHeartbeatRequest(
                    ImportType.INSTALACOES, EtlRunStatus.RUNNING,
                    null, null, null, null, null
            ));

            if (portalClientId.isBlank() || portalClientSecret.isBlank()) {
                throw new IllegalStateException(
                        "Credenciais do portal parceiro não configuradas " +
                        "(portal.parceiro.client-id / portal.parceiro.client-secret)"
                );
            }

            String token = getPortalToken();

            int skipped = 0;

            // Uma chamada paginada por status. Indexado por externalId pra
            // nao processar duas vezes um item que mudou de status no meio
            // da busca (fica o ultimo visto).
            Map<String, PortalItem> portalItems = new LinkedHashMap<>();

            // Falha num status nao derruba o ciclo inteiro (ex.: nome de
            // status recusado pelo portal) — como ausencia no portal nao
            // dispara mais nenhuma acao, processar parcial e' seguro. So'
            // falha (e cai no retry do scheduledSync) se todos falharem.
            Exception lastFetchError = null;
            int failedStatuses = 0;

            for (String status : PORTAL_STATUSES) {
                List<Map<String, Object>> items;
                try {
                    items = fetchAllPages(token, status);
                } catch (Exception e) {
                    log.error("[INSTALACOES] Falha ao buscar status {}: {}", status, e.getMessage());
                    lastFetchError = e;
                    failedStatuses++;
                    continue;
                }
                log.info("[INSTALACOES] Status {}: {} itens", status, items.size());
                for (Map<String, Object> item : items) {
                    String externalId = extractString(item, "externalId");
                    if (externalId == null) {
                        log.warn("[INSTALACOES] externalId nulo, ignorando item id={}", item.get("id"));
                        skipped++;
                        continue;
                    }
                    String itemStatus = extractString(item, "statusAtual", "status");
                    portalItems.put(externalId, new PortalItem(item, itemStatus != null ? itemStatus : status));
                }
            }

            if (failedStatuses == PORTAL_STATUSES.size()) {
                throw new IllegalStateException("Falha ao buscar todos os status do portal", lastFetchError);
            }

            int found = portalItems.size();
            int inserted = 0;
            int closed = 0;
            int reopened = 0;
            int concluded = 0;

            for (Map.Entry<String, PortalItem> entry : portalItems.entrySet()) {

                String externalId = entry.getKey();
                Map<String, Object> item = entry.getValue().item();
                String portalStatus = entry.getValue().portalStatus();

                Optional<Installation> existingOpt = installationRepository.findByExternalId(externalId);
                if (existingOpt.isPresent()) {
                    Installation inst = existingOpt.get();
                    String previousPortalStatus = inst.getPortalStatus();
                    boolean changed = !Objects.equals(previousPortalStatus, portalStatus);

                    inst.setPortalStatus(portalStatus);

                    // Status interno do Fusion continua significando "esta
                    // na fila de agendamento do portal" (PENDING) ou nao —
                    // e' o que badge/dashboard/backfill de OS usam. Antes era
                    // deduzido por ausencia na lista; agora vem do status real.
                    if (STATUS_AGUARDANDO.equals(portalStatus) && inst.getStatus() != InstallationStatus.PENDING) {
                        log.info("[INSTALACOES] {} reaberta no portal (era {})", inst.getPlate(), inst.getStatus());
                        inst.setStatus(InstallationStatus.PENDING);
                        inst.setClosedAt(null);
                        reopened++;
                        changed = true;
                    } else if (!STATUS_AGUARDANDO.equals(portalStatus) && inst.getStatus() == InstallationStatus.PENDING) {
                        log.info("[INSTALACOES] {} saiu de AGUARDANDO_AGENDAMENTO → {} (externalId={})",
                                inst.getPlate(), portalStatus, externalId);
                        inst.setStatus(InstallationStatus.SCHEDULED);
                        if (inst.getClosedAt() == null) {
                            inst.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
                        }
                        closed++;
                        changed = true;
                    }

                    if (changed) {
                        installationRepository.save(inst);
                    } else {
                        skipped++;
                    }

                    // Transicao pra concluida: fecha a OS e notifica uma vez
                    // so' (na mudanca — nos ciclos seguintes o portalStatus
                    // anterior ja' e' CONCLUIDA e nao entra aqui).
                    if (STATUS_CONCLUIDA.equals(portalStatus) && !STATUS_CONCLUIDA.equals(previousPortalStatus)) {
                        concluded++;
                        try {
                            serviceOrderService.completeFromPortal(externalId);
                        } catch (Exception e) {
                            log.warn("[INSTALACOES] Falha ao concluir OS de externalId={}: {}", externalId, e.getMessage());
                        }
                        // So' notifica se o status anterior era um status real
                        // do portal. Registros antigos (null ou o marcador
                        // SAIU_DE_AGUARDANDO_AGENDAMENTO do sync anterior)
                        // fecham a OS em silencio — senao a primeira rodada
                        // depois do deploy mandaria uma mensagem por
                        // instalacao concluida no passado.
                        if (PORTAL_STATUSES.contains(previousPortalStatus)) {
                            queueWhatsAppText(montarMensagemConclusao(inst), inst.getPlate());
                        } else {
                            log.info("[INSTALACOES] {} concluída (status anterior={}) — OS fechada sem notificação",
                                    inst.getPlate(), previousPortalStatus);
                        }
                    }
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
                        .portalStatus(portalStatus)
                        .build();

                // Nova de verdade = entrou na fila de agendamento. Item que
                // ja' chega em outro status e' historico do portal que o
                // Fusion nao tinha (anterior ao Fusion ou apagado pelo
                // purge): entra so' como espelho, ARCHIVED (fora das
                // listagens/dashboard/backfill), sem OS e sem notificacao —
                // senao a primeira rodada criaria uma OS + uma mensagem por
                // instalacao antiga. Se voltar pra AGUARDANDO_AGENDAMENTO,
                // a reabertura acima o trata como PENDING normal.
                if (!STATUS_AGUARDANDO.equals(portalStatus)) {
                    installation.setStatus(InstallationStatus.ARCHIVED);
                    installationRepository.save(installation);
                    inserted++;
                    log.info("[INSTALACOES] Histórico espelhado como ARCHIVED: externalId={} plate={} status={}",
                            externalId, installation.getPlate(), portalStatus);
                    continue;
                }

                log.info("[INSTALACOES] Tentando inserir: externalId={}, plate={}, customerName={}",
                        installation.getExternalId(), installation.getPlate(), installation.getCustomerName());

                installationRepository.save(installation);
                inserted++;

                serviceOrderService.createFromInstallation(
                        installation.getExternalId(),
                        installation.getPlate(),
                        installation.getCustomerName(),
                        installation.getPhone(),
                        installation.getCity(),
                        installation.getAddress(),
                        installation.getNeighborhood(),
                        installation.getState(),
                        installation.getZipCode(),
                        installation.getPortalCreatedAt(),
                        null
                );

                sendNtfyNotification(installation);

                queueWhatsAppMessage(installation);

            }

            // Instalacoes do Fusion que nao vieram em nenhum dos 8 status
            // (deletadas no portal, raro) ficam como estao — sem acao.

            log.info("[INSTALACOES] Fechadas neste ciclo: {}, concluídas: {}", closed, concluded);

            List<Installation> pendingNoBank =
                    installationRepository.findByStatusOrderByCreatedAtDesc(InstallationStatus.PENDING);

            // Backfill: PENDING sem OS vinculada → criar agora
            int backfilled = 0;
            for (Installation inst : pendingNoBank) {
                if (inst.getExternalId() == null) continue;
                var os = serviceOrderService.createFromInstallation(
                        inst.getExternalId(),
                        inst.getPlate(),
                        inst.getCustomerName(),
                        inst.getPhone(),
                        inst.getCity(),
                        inst.getAddress(),
                        inst.getNeighborhood(),
                        inst.getState(),
                        inst.getZipCode(),
                        inst.getPortalCreatedAt(),
                        null
                );
                if (os != null) {
                    backfilled++;
                    log.info("[INSTALACOES] Backfill OS criada para instalação PENDING externalId={} plate={}",
                            inst.getExternalId(), inst.getPlate());
                }
            }
            if (backfilled > 0) log.info("[INSTALACOES] Backfill: {} OS criadas para instalações PENDING sem OS", backfilled);

            long durationMs = System.currentTimeMillis() - startMs;
            LocalDateTime nextRun = LocalDateTime.now(ZoneOffset.UTC).plusMinutes(15);

            etlStatusService.heartbeat(new EtlHeartbeatRequest(
                    ImportType.INSTALACOES, EtlRunStatus.SUCCESS,
                    durationMs, null, inserted, nextRun, null
            ));

            InstallationSyncResult result = new InstallationSyncResult(
                    found, inserted, skipped, closed, reopened, concluded, LocalDateTime.now(ZoneOffset.UTC)
            );
            lastResult = result;
            return result;

        } catch (Exception e) {

            long durationMs = System.currentTimeMillis() - startMs;

            etlStatusService.heartbeat(new EtlHeartbeatRequest(
                    ImportType.INSTALACOES, EtlRunStatus.ERROR,
                    durationMs, e.getMessage(), 0, null, null
            ));

            throw e;

        }

    }

    public InstallationSyncResult getLastResult() {
        return lastResult;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchAllPages(String token, String status) {

        List<Map<String, Object>> all = new ArrayList<>();
        int page = 0;

        // Filtro de data so' nos status finais (onde o historico acumula).
        // Os status em andamento buscam tudo, senao uma instalacao antiga
        // ainda em aberto sumiria do sync.
        String dateFilter = (status.equals(STATUS_CONCLUIDA) || status.equals("INSTALACAO_CONCLUIDA_FALHA"))
                ? "&inicio=" + SYNC_START_DATE + "&fim=" + LocalDate.now()
                : "";

        while (true) {

            String url = portalUrl
                    + "/ordens-instalacao"
                    + "?page=" + page
                    + "&size=50"
                    + "&pesquisa="
                    + "&status=" + status
                    + dateFilter;

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

    // Enviar notificação via Ntfy
    private void sendNtfyNotification(Installation installation) {
        try {
            String message = montarMensagemInstalacao(installation);
            RestTemplate rest = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Title", "INSTALAÇÃO NOVA");
            headers.set("Priority", "high");
            headers.set("Tags", "truck");
            HttpEntity<String> entity = new HttpEntity<>(message, headers);
            rest.postForEntity(
                "https://ntfy.sh/" + ntfyTopic,
                entity,
                String.class
            );
            log.info("[NTFY] Notificação enviada para instalação {}", installation.getPlate());
        } catch (Exception e) {
            log.warn("[NTFY] Falha ao enviar notificação: {}", e.getMessage());
        }
    }

    // Enfileira o texto da instalacao pro ETL local repassar ao grupo do
    // WhatsApp via Baileys. Usa a fila dedicada do EtlTriggerService
    // (requestWhatsApp/pollWhatsApp, suporta multiplas mensagens
    // pendentes) — nao a fila generica de 1-pendente-por-tipo, que
    // perdia mensagem quando duas instalacoes novas chegavam no mesmo
    // ciclo de sync (a segunda sobrescrevia a primeira antes do ETL
    // local reivindicar).
    private void queueWhatsAppMessage(Installation installation) {
        queueWhatsAppText(montarMensagemInstalacao(installation), installation.getPlate());
    }

    private void queueWhatsAppText(String message, String plate) {
        try {
            etlTriggerService.requestWhatsApp(message);
            log.info("[WHATSAPP] Mensagem de instalação enfileirada para {}", plate);
        } catch (Exception e) {
            log.warn("[WHATSAPP] Falha ao enfileirar mensagem: {}", e.getMessage());
        }
    }

    private String montarMensagemConclusao(Installation installation) {
        return "✅ INSTALAÇÃO CONCLUÍDA\n\n"
                + "PLACA: " + orDash(installation.getPlate()) + "\n"
                + "SEGURADO: " + orDash(installation.getCustomerName()) + "\n"
                + "CIDADE: " + orDash(installation.getCity());
    }

    private String orDash(String value) {
        return hasValue(value) ? value : "--";
    }

    private String montarMensagemInstalacao(Installation installation) {
        StringBuilder sb = new StringBuilder("INSTALAÇÃO NOVA:");
        appendLine(sb, "NOME", installation.getCustomerName());
        appendLine(sb, "ENDEREÇO", installation.getAddress());
        appendLine(sb, "BAIRRO", installation.getNeighborhood());
        if (hasValue(installation.getCity()) || hasValue(installation.getState())) {
            sb.append("\nCIDADE/UF: ")
              .append(installation.getCity() != null ? installation.getCity() : "")
              .append("/")
              .append(installation.getState() != null ? installation.getState() : "");
        }
        appendLine(sb, "CEP", installation.getZipCode());
        appendLine(sb, "TELEFONE", installation.getPhone());
        appendLine(sb, "PLACA", installation.getPlate());
        appendLine(sb, "MODELO", installation.getModel());
        return sb.toString();
    }

    private boolean hasValue(String value) {
        return value != null && !value.isBlank();
    }

    private void appendLine(StringBuilder sb, String label, String value) {
        if (hasValue(value)) sb.append("\n").append(label).append(": ").append(value);
    }

}
