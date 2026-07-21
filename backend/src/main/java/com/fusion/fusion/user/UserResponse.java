package com.fusion.fusion.user;

import java.time.LocalDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String name,
        String email,
        Role role,
        Boolean active,
        LocalDateTime createdAt
) {}
