package com.fusion.fusion.auth;

import com.fusion.fusion.user.Role;

import java.util.UUID;

public record MeResponse(

        UUID id,

        String name,

        String email,

        Role role

) {
}