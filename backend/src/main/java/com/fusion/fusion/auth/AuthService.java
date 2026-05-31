package com.fusion.fusion.auth;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository repository;

    public MeResponse me() {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = repository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuário não encontrado"
                ));

        return new MeResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole()
        );

    }

}