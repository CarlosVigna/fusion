package com.fusion.fusion.user;

public record UserRequest(
        String name,
        String email,
        String password,
        Role role
) {}
