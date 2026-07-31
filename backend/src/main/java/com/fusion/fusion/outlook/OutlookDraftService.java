package com.fusion.fusion.outlook;

import com.fusion.fusion.common.security.CurrentUserService;
import com.fusion.fusion.microsoft.MicrosoftAuthService;
import com.fusion.fusion.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutlookDraftService {

    private final MicrosoftAuthService microsoftAuthService;
    private final CurrentUserService currentUserService;
    private final RestTemplate restTemplate;

    public Map<String, Object> createDraft(OutlookDraftRequest request) {
        String accessToken = microsoftAuthService.getAccessToken();
        User user = currentUserService.getCurrentUser();

        String html = buildHtmlContent(request, user);

        Map<String, Object> message = Map.of(
                "subject", "Passagem de Turno " + esc(request.dataEntrada()) + " – " + esc(request.dataSaida()),
                "body", Map.of("contentType", "HTML", "content", html),
                "toRecipients", List.of(Map.of("emailAddress", Map.of("address", request.toEmail()))),
                "isDraft", true
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> response = restTemplate.exchange(
                "https://graph.microsoft.com/v1.0/me/messages",
                HttpMethod.POST,
                new HttpEntity<>(message, headers),
                Map.class
        );

        Map<String, Object> created = response.getBody();
        String id = created != null ? (String) created.get("id") : null;
        String webLink = created != null ? (String) created.get("webLink") : null;

        log.info("[OUTLOOK] Rascunho criado para {} — id={}", user.getEmail(), id);

        return Map.of(
                "success", true,
                "draftId", id != null ? id : "",
                "webLink", webLink != null ? webLink : "https://outlook.office.com/mail/drafts"
        );
    }

    public String buildPreview(OutlookDraftRequest request) {
        User user = currentUserService.getCurrentUser();
        return buildHtmlContent(request, user);
    }

    private String buildHtmlContent(OutlookDraftRequest request, User user) {
        StringBuilder html = new StringBuilder();

        html.append("<html><body style=\"font-family: 'Aptos Serif', Georgia, serif; font-size: 12pt; color: #000000; line-height: 1.6; margin: 0; padding: 20px;\">");

        html.append("<p>Bom dia,</p>");
        html.append("<p>Segue abaixo a passagem de turno <strong>")
                .append(esc(request.dataEntrada())).append(" – ")
                .append(esc(request.dataSaida())).append("</strong>.</p>");

        html.append("<p><strong>MULTIPORTAL:</strong></p>");
        html.append("<p><strong>CASOS PARA VERIFICAÇÃO:</strong></p>");

        List<OutlookVehicleItem> veiculos = request.veiculosList() == null
                ? List.of() : request.veiculosList();

        List<OutlookVehicleItem> casosParaVerificar = veiculos.stream()
                .filter(v -> !"Comandos pertinentes enviados.".equalsIgnoreCase(v.observation()))
                .toList();

        if (casosParaVerificar.isEmpty()) {
            html.append("<p><em>Nenhum veículo pendente.</em></p>");
        } else {
            html.append("<ul>");
            for (OutlookVehicleItem v : casosParaVerificar) {
                html.append("<li><strong>").append(esc(v.plate())).append("</strong>");
                if (v.lastCommunicationAt() != null && !v.lastCommunicationAt().isBlank()) {
                    html.append(" – Última posição: ").append(esc(v.lastCommunicationAt()));
                }
                if (v.policyEndDate() != null && !v.policyEndDate().isBlank()) {
                    html.append(" | Fim vigência: ").append(esc(v.policyEndDate()));
                }
                if (v.observation() != null && !v.observation().isBlank()) {
                    html.append("<br>&nbsp;&nbsp;&nbsp;Obs: ").append(esc(v.observation()));
                }
                html.append("</li>");
            }
            html.append("</ul>");
        }

        html.append("<p>Uma planilha com os sinais tratados durante o turno foi anexada ao e-mail.</p>");

        html.append("<p><strong>TRACKNME MAX:</strong><br>")
                .append("Comandos pertinentes enviados somente para as placas abaixo, aguardar atualização – PLANILHA ATUALIZADA.</p>");

        List<String> tracknme = request.tracknmeList() == null ? List.of() : request.tracknmeList();
        List<String> tracknmePlates = tracknme.stream().filter(s -> s != null && !s.isBlank()).toList();

        if (tracknmePlates.isEmpty()) {
            html.append("<p>&nbsp;</p>");
        } else {
            html.append("<ul>");
            for (String plate : tracknmePlates) {
                html.append("<li><strong>").append(esc(plate.trim())).append("</strong></li>");
            }
            html.append("</ul>");
        }

        html.append("<p><strong>NEO:</strong><br>Nenhum chamado registrado durante meu turno.</p>");
        html.append("<p><strong>CARBIGDATA:</strong><br>Nenhum chamado registrado durante meu turno.</p>");
        html.append("<p><strong>DEMAIS OCORRÊNCIAS:</strong></p><p>&nbsp;</p>");
        html.append("<p>Sendo assim, encerro meu turno com os alertas devidamente tratados e planilhas atualizadas.</p>");

        html.append("<p>Atenciosamente,<br>");
        String signature = user.getMicrosoftSignatureHtml();
        if (signature != null && !signature.isBlank()) {
            html.append(signature);
        } else {
            html.append(esc(user.getName()));
        }
        html.append("</p>");

        html.append("</body></html>");

        return html.toString();
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

}
