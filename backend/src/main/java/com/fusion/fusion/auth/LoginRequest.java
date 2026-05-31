package com.fusion.fusion.auth;

public record LoginRequest(
        String email,
        String password
) {
}