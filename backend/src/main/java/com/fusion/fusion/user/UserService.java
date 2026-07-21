package com.fusion.fusion.user;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;

    public List<UserResponse> listAll() {
        return repository.findAllByOrderByCreatedAtAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public UserResponse create(UserRequest request) {
        if (repository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("E-mail já cadastrado");
        }
        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(request.role())
                .active(true)
                .build();
        return toResponse(repository.save(user));
    }

    @Transactional
    public UserResponse update(UUID id, UserRequest request) {
        User user = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + id));
        user.setName(request.name());
        user.setEmail(request.email());
        user.setRole(request.role());
        if (request.password() != null && !request.password().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        return toResponse(repository.save(user));
    }

    @Transactional
    public void deactivate(UUID id) {
        User user = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + id));
        user.setActive(false);
        repository.save(user);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getActive(),
                user.getCreatedAt()
        );
    }
}
