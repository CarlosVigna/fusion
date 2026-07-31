package com.fusion.fusion.microsoft;

import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.common.security.CurrentUserService;
import com.fusion.fusion.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MicrosoftAuthService {

    @Value("${microsoft.client-id:}")
    private String clientId;

    @Value("${microsoft.client-secret:}")
    private String clientSecret;

    @Value("${microsoft.tenant-id:}")
    private String tenantId;

    @Value("${microsoft.redirect-uri:}")
    private String redirectUri;

    private final UserMicrosoftTokenRepository tokenRepository;
    private final CurrentUserService currentUserService;
    private final RestTemplate restTemplate;

    public String getAuthorizationUrl() {
        if (clientId.isBlank() || tenantId.isBlank()) {
            throw new BusinessException("Microsoft OAuth não configurado no servidor");
        }
        try {
            return "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/authorize"
                    + "?client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                    + "&response_type=code"
                    + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
                    + "&scope=" + URLEncoder.encode("Mail.ReadWrite Mail.Send User.Read offline_access", StandardCharsets.UTF_8)
                    + "&response_mode=query";
        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar URL de autorização Microsoft", e);
        }
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public MicrosoftStatusResponse exchangeCode(String code) {
        User user = currentUserService.getCurrentUser();

        String tokenUrl = "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("code", code);
        body.add("redirect_uri", redirectUri);
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);

        ResponseEntity<Map> response = restTemplate.exchange(
                tokenUrl, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class
        );

        Map<String, Object> tokenData = response.getBody();
        if (tokenData == null) {
            throw new IllegalStateException("Resposta vazia ao trocar code por token Microsoft");
        }

        String accessToken = (String) tokenData.get("access_token");
        String refreshToken = (String) tokenData.get("refresh_token");
        int expiresIn = ((Number) tokenData.get("expires_in")).intValue();
        LocalDateTime expiresAt = LocalDateTime.now(ZoneOffset.UTC).plusSeconds(expiresIn);

        HttpHeaders graphHeaders = new HttpHeaders();
        graphHeaders.setBearerAuth(accessToken);
        ResponseEntity<Map> profileResponse = restTemplate.exchange(
                "https://graph.microsoft.com/v1.0/me",
                HttpMethod.GET,
                new HttpEntity<>(graphHeaders),
                Map.class
        );

        Map<String, Object> profile = profileResponse.getBody();
        String msEmail = null;
        String msName = null;
        if (profile != null) {
            msEmail = profile.get("mail") != null
                    ? (String) profile.get("mail")
                    : (String) profile.get("userPrincipalName");
            msName = (String) profile.get("displayName");
        }

        UserMicrosoftToken token = tokenRepository.findByUser(user)
                .orElse(UserMicrosoftToken.builder().user(user).build());
        token.setAccessToken(accessToken);
        token.setRefreshToken(refreshToken);
        token.setExpiresAt(expiresAt);
        token.setMicrosoftEmail(msEmail);
        token.setMicrosoftName(msName);
        tokenRepository.save(token);

        log.info("[MICROSOFT] Token salvo para usuário {} (ms={})", user.getEmail(), msEmail);

        return new MicrosoftStatusResponse(true, msEmail, msName);
    }

    @Transactional(readOnly = true)
    public MicrosoftStatusResponse getStatus() {
        User user = currentUserService.getCurrentUser();
        return tokenRepository.findByUser(user)
                .map(t -> new MicrosoftStatusResponse(true, t.getMicrosoftEmail(), t.getMicrosoftName()))
                .orElse(new MicrosoftStatusResponse(false, null, null));
    }

    @Transactional
    public void logout() {
        User user = currentUserService.getCurrentUser();
        tokenRepository.deleteByUser(user);
        log.info("[MICROSOFT] Token removido para usuário {}", user.getEmail());
    }

    @Transactional
    public String getAccessToken() {
        User user = currentUserService.getCurrentUser();
        UserMicrosoftToken token = tokenRepository.findByUser(user)
                .orElseThrow(() -> new BusinessException("Usuário não autenticado no Microsoft — conecte sua conta em Passagem de Turno"));

        if (token.getExpiresAt() != null
                && token.getExpiresAt().isBefore(LocalDateTime.now(ZoneOffset.UTC).plusMinutes(5))) {
            token = refreshToken(token);
        }

        return token.getAccessToken();
    }

    @SuppressWarnings("unchecked")
    private UserMicrosoftToken refreshToken(UserMicrosoftToken token) {
        log.info("[MICROSOFT] Renovando access token para {}", token.getMicrosoftEmail());

        String tokenUrl = "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "refresh_token");
        body.add("refresh_token", token.getRefreshToken());
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);

        ResponseEntity<Map> response = restTemplate.exchange(
                tokenUrl, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class
        );

        Map<String, Object> tokenData = response.getBody();
        if (tokenData == null) {
            throw new IllegalStateException("Resposta vazia ao renovar token Microsoft");
        }

        token.setAccessToken((String) tokenData.get("access_token"));
        if (tokenData.get("refresh_token") != null) {
            token.setRefreshToken((String) tokenData.get("refresh_token"));
        }
        int expiresIn = ((Number) tokenData.get("expires_in")).intValue();
        token.setExpiresAt(LocalDateTime.now(ZoneOffset.UTC).plusSeconds(expiresIn));

        return tokenRepository.save(token);
    }

}
