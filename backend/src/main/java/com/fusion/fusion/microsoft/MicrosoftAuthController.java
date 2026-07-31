package com.fusion.fusion.microsoft;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth/microsoft")
@RequiredArgsConstructor
public class MicrosoftAuthController {

    private final MicrosoftAuthService microsoftAuthService;

    @GetMapping("/url")
    public Map<String, String> getAuthUrl() {
        return Map.of("url", microsoftAuthService.getAuthorizationUrl());
    }

    @PostMapping("/callback")
    public MicrosoftStatusResponse callback(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("code ausente no body");
        }
        return microsoftAuthService.exchangeCode(code);
    }

    @GetMapping("/status")
    public MicrosoftStatusResponse status() {
        return microsoftAuthService.getStatus();
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout() {
        microsoftAuthService.logout();
    }

}
