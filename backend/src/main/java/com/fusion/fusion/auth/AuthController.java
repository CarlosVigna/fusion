package com.fusion.fusion.auth;

import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public LoginResponse login(
            @RequestBody LoginRequest request
    ) {

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.email(),
                            request.password()
                    )
            );
        } catch (AuthenticationException ex) {
            throw new BusinessException("Credenciais inválidas");
        }

        String token = jwtService.generateToken(request.email());

        return new LoginResponse(token);

    }

    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public void register(
            @RequestBody RegisterRequest request
    ) {

        if (repository.findByEmail(request.email()).isPresent()) {
            throw new BusinessException("E-mail já cadastrado");
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(request.role())
                .build();

        repository.save(user);

    }

    @GetMapping("/me")
    public MeResponse me() {

        return authService.me();

    }

}
