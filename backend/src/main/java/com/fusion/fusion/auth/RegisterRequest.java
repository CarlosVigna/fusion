package com.fusion.fusion.auth;

import com.fusion.fusion.user.Role;

public record RegisterRequest(
        String name,
        String email,
        String password,
        Role role
) {
}
