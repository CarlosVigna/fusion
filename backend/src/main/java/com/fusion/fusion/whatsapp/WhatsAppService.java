package com.fusion.fusion.whatsapp;

import com.fusion.fusion.installation.Installation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppService {

    private final RestTemplate restTemplate;

    @Value("${evolution.api.url}")
    private String apiUrl;

    @Value("${evolution.api.key}")
    private String apiKey;

    @Value("${evolution.api.instance}")
    private String instance;

    @Value("${evolution.whatsapp.number}")
    private String number;

    public void sendText(String to, String text) {

        if (apiKey == null || apiKey.isBlank() || number == null || number.isBlank()) {
            log.debug("[WHATSAPP] Credenciais não configuradas — mensagem não enviada");
            return;
        }

        try {

            String url = apiUrl + "/message/sendText/" + instance;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", apiKey);

            Map<String, String> body = Map.of("number", to, "text", text);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class
            );

            log.info("[WHATSAPP] Mensagem enviada para {} — HTTP {}", to, response.getStatusCode());

        } catch (Exception e) {
            log.error("[WHATSAPP] Falha ao enviar mensagem para {}: {}", to, e.getMessage());
        }

    }

    @Async
    public void sendInstallationAlert(Installation inst) {

        StringBuilder sb = new StringBuilder("*INSTALAÇÃO NOVA:*");
        appendLine(sb, "NOME",       inst.getCustomerName());
        appendLine(sb, "ENDEREÇO",   inst.getAddress());
        appendLine(sb, "BAIRRO",     inst.getNeighborhood());
        if (hasValue(inst.getCity()) || hasValue(inst.getState())) {
            sb.append("\n*CIDADE/UF:* ").append(nullSafe(inst.getCity()))
              .append("/").append(nullSafe(inst.getState()));
        }
        appendLine(sb, "CEP",        inst.getZipCode());
        appendLine(sb, "TELEFONE",   inst.getPhone());
        appendLine(sb, "PLACA",      inst.getPlate());
        appendLine(sb, "MODELO",     inst.getModel());

        sendText(number, sb.toString());

    }

    @Async
    public void sendNewOrderAlert(String serviceType, String plate, String customerName,
                                   String address, String neighborhood, String city,
                                   String state, String zipCode, String phone) {

        StringBuilder sb = new StringBuilder("*NOVA ORDEM DE SERVIÇO:*");
        appendLine(sb, "TIPO",    serviceType);
        appendLine(sb, "PLACA",   plate);
        appendLine(sb, "CLIENTE", customerName);

        StringBuilder endLine = new StringBuilder();
        if (hasValue(address)) endLine.append(address);
        if (hasValue(neighborhood)) {
            if (endLine.length() > 0) endLine.append(", ");
            endLine.append(neighborhood);
        }
        if (endLine.length() > 0) sb.append("\n*ENDEREÇO:* ").append(endLine);

        if (hasValue(city) || hasValue(state)) {
            sb.append("\n*CIDADE/UF:* ").append(nullSafe(city)).append("/").append(nullSafe(state));
        }
        appendLine(sb, "CEP",      zipCode);
        appendLine(sb, "TELEFONE", phone);

        sendText(number, sb.toString());

    }

    @Async
    public void sendSchedulingAlert(String plate, String serviceType, String customerName,
                                    String technicianName, String scheduledDate, String scheduledTime,
                                    String address, String city, String state) {
        String text = String.format(
                "🔧 *AGENDAMENTO REALIZADO*\n" +
                "*OS:* %s — %s\n" +
                "*Cliente:* %s\n" +
                "*Técnico:* %s\n" +
                "*Data:* %s às %s\n" +
                "*Endereço:* %s, %s/%s",
                nullSafe(plate), nullSafe(serviceType),
                nullSafe(customerName),
                nullSafe(technicianName),
                nullSafe(scheduledDate), nullSafe(scheduledTime),
                nullSafe(address), nullSafe(city), nullSafe(state)
        );
        sendText(number, text);
    }

    @Async
    public void sendDisplacementPendingAlert(String plate, String serviceType,
                                             String technicianName, Double distanceKm,
                                             java.math.BigDecimal displacementValue) {
        String text = String.format(
                "⏳ *APROVAÇÃO DE DESLOCAMENTO*\n" +
                "*OS:* %s — %s\n" +
                "*Técnico:* %s\n" +
                "*Distância:* %.1f km\n" +
                "*Valor deslocamento:* R$ %s\n" +
                "*Aguardando aprovação para prosseguir*",
                nullSafe(plate), nullSafe(serviceType),
                nullSafe(technicianName),
                distanceKm != null ? distanceKm : 0.0,
                displacementValue != null ? displacementValue.toPlainString() : "0.00"
        );
        sendText(number, text);
    }

    @Async
    public void sendDisplacementApprovedAlert(String plate, String serviceType,
                                              String technicianName, String scheduledDate,
                                              String scheduledTime, java.math.BigDecimal displacementValue) {
        String text = String.format(
                "✅ *DESLOCAMENTO APROVADO*\n" +
                "*OS:* %s — %s\n" +
                "*Técnico:* %s\n" +
                "*Data:* %s às %s\n" +
                "*Valor aprovado:* R$ %s",
                nullSafe(plate), nullSafe(serviceType),
                nullSafe(technicianName),
                nullSafe(scheduledDate), nullSafe(scheduledTime),
                displacementValue != null ? displacementValue.toPlainString() : "0.00"
        );
        sendText(number, text);
    }

    @Async
    public void sendDisplacementRejectedAlert(String plate, String serviceType, String technicianName) {
        String text = String.format(
                "❌ *DESLOCAMENTO REPROVADO*\n" +
                "*OS:* %s — %s\n" +
                "*Técnico:* %s\n" +
                "*Ordem retornada para agendamento*",
                nullSafe(plate), nullSafe(serviceType),
                nullSafe(technicianName)
        );
        sendText(number, text);
    }

    @Async
    public void sendCompletionAlert(String plate, String serviceType, String customerName,
                                    String technicianName, java.math.BigDecimal serviceValue,
                                    java.math.BigDecimal totalValue) {
        String text = String.format(
                "🏁 *ORDEM CONCLUÍDA*\n" +
                "*OS:* %s — %s\n" +
                "*Cliente:* %s\n" +
                "*Técnico:* %s\n" +
                "*Valor serviço:* R$ %s\n" +
                "*Valor total:* R$ %s",
                nullSafe(plate), nullSafe(serviceType),
                nullSafe(customerName),
                nullSafe(technicianName),
                serviceValue    != null ? serviceValue.toPlainString()    : "0.00",
                totalValue      != null ? totalValue.toPlainString()      : "0.00"
        );
        sendText(number, text);
    }

    private String nullSafe(String value) {
        return value != null ? value : "";
    }

    private boolean hasValue(String value) {
        return value != null && !value.isBlank();
    }

    private void appendLine(StringBuilder sb, String label, String value) {
        if (hasValue(value)) {
            sb.append("\n*").append(label).append(":* ").append(value);
        }
    }

}
