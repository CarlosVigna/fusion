package com.fusion.fusion.outlook;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@RestController
@RequestMapping("/outlook")
@RequiredArgsConstructor
public class OutlookExportController {

    private final OutlookDraftService outlookDraftService;
    private final OutlookAttachmentService outlookAttachmentService;

    @PostMapping("/eml/passagem-turno")
    public ResponseEntity<byte[]> downloadEml(@RequestBody OutlookDraftRequest request) {

        String htmlBody = outlookDraftService.buildPreview(request);

        String subject = "Passagem de Turno " + request.dataEntrada() + " – " + request.dataSaida();
        String subjectEncoded = "=?UTF-8?B?"
                + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8))
                + "?=";

        String bodyB64 = Base64.getMimeEncoder(76, "\r\n".getBytes()).encodeToString(
                htmlBody.getBytes(StandardCharsets.UTF_8)
        );

        String eml = "MIME-Version: 1.0\r\n"
                + "Subject: " + subjectEncoded + "\r\n"
                + "To: " + request.toEmail() + "\r\n"
                + "Content-Type: text/html; charset=UTF-8\r\n"
                + "Content-Transfer-Encoding: base64\r\n"
                + "\r\n"
                + bodyB64;

        byte[] bytes = eml.getBytes(StandardCharsets.US_ASCII);

        String today = LocalDate.now(ZoneId.of("America/Sao_Paulo"))
                .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("message/rfc822"));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("passagem-turno-" + today + ".eml").build());

        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    @GetMapping("/attachments/passagem-turno")
    public ResponseEntity<byte[]> downloadAttachments() throws Exception {

        byte[] zip = outlookAttachmentService.buildZip();

        String today = LocalDate.now(ZoneId.of("America/Sao_Paulo"))
                .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/zip"));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("planilhas-" + today + ".zip").build());

        return ResponseEntity.ok().headers(headers).body(zip);
    }

}
