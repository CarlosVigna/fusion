package com.fusion.fusion.microsoft;

public record MicrosoftStatusResponse(
        boolean connected,
        String email,
        String name
) {}
