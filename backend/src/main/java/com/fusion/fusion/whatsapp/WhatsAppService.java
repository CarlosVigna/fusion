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

        String text = String.format(
                "*INSTALAÇÃO NOVA:*\n" +
                "*NOME:* %s\n" +
                "*ENDEREÇO:* %s\n" +
                "*BAIRRO:* %s\n" +
                "*CIDADE/UF:* %s/%s\n" +
                "*CEP:* %s\n" +
                "*TELEFONE:* %s\n" +
                "*PLACA:* %s\n" +
                "*MODELO:* %s\n" +
                "*CHASSI:* Não informado",
                nullSafe(inst.getCustomerName()),
                nullSafe(inst.getAddress()),
                nullSafe(inst.getNeighborhood()),
                nullSafe(inst.getCity()),
                nullSafe(inst.getState()),
                nullSafe(inst.getZipCode()),
                nullSafe(inst.getPhone()),
                inst.getPlate()  != null ? inst.getPlate()  : "—",
                inst.getModel()  != null ? inst.getModel()  : "—"
        );

        sendText(number, text);

    }

    @Async
    public void sendInstallationOsAlert(
            String plate, String customerName, String address,
            String neighborhood, String city, String state,
            String zipCode, String phone) {

        String text = String.format(
                "*OS INSTALAÇÃO (FUSION):*\n" +
                "*NOME:* %s\n" +
                "*ENDEREÇO:* %s\n" +
                "*BAIRRO:* %s\n" +
                "*CIDADE/UF:* %s/%s\n" +
                "*CEP:* %s\n" +
                "*TELEFONE:* %s\n" +
                "*PLACA:* %s",
                nullSafe(customerName),
                nullSafe(address),
                nullSafe(neighborhood),
                nullSafe(city),
                nullSafe(state),
                nullSafe(zipCode),
                nullSafe(phone),
                plate != null ? plate : "—"
        );

        sendText(number, text);

    }

    private String nullSafe(String value) {
        return value != null ? value : "";
    }

}
