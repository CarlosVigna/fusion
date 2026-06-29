package com.fusion.fusion.auth;

public record ChangePasswordRequest(

        String currentPassword,

        String newPassword

) {
}
