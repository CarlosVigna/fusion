package com.fusion.fusion.auth;

import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository repository;

    private final PasswordEncoder passwordEncoder;

    public MeResponse me() {

        return toResponse(getCurrentUser());

    }

    @Transactional
    public MeResponse updateProfile(UpdateProfileRequest request) {

        User user = getCurrentUser();

        if (request.name() != null && !request.name().isBlank()) {
            user.setName(request.name());
        }

        // null = nao mudou a foto; string vazia = removeu a foto.
        if (request.photoUrl() != null) {
            user.setPhotoUrl(
                    request.photoUrl().isBlank() ? null : request.photoUrl()
            );
        }

        repository.save(user);

        return toResponse(user);

    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {

        User user = getCurrentUser();

        if (!passwordEncoder.matches(
                request.currentPassword(),
                user.getPassword()
        )) {

            throw new BusinessException("Senha atual incorreta");

        }

        if (request.newPassword() == null
                || request.newPassword().length() < 6) {

            throw new BusinessException(
                    "A nova senha deve ter pelo menos 6 caracteres"
            );

        }

        user.setPassword(
                passwordEncoder.encode(request.newPassword())
        );

        repository.save(user);

    }

    private User getCurrentUser() {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        return repository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuário não encontrado"
                ));

    }

    private MeResponse toResponse(User user) {

        return new MeResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getPhotoUrl()
        );

    }

}