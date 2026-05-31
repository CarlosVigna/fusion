package com.fusion.fusion.auth;

import com.fusion.fusion.user.Role;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
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

        User user = repository.findByEmail(
                request.email()
        ).orElseThrow();

        System.out.println(user.getPassword());

        String token = jwtService.generateToken(
                user.getEmail()
        );

        return new LoginResponse(token);

    }

    @GetMapping("/register")
    public void register() {

        if (repository.findByEmail("admin@fusion.com").isPresent()) {
            return;
        }

        User user = User.builder()
                .name("Administrador")
                .email("admin@fusion.com")
                .password(passwordEncoder.encode("123456"))
                .role(Role.ADMIN)
                .build();

        repository.save(user);

    }

    @GetMapping("/me")
    public MeResponse me() {

        return authService.me();

    }
    @GetMapping("/reset")
    public void reset() {

        User user = repository.findByEmail(
                "admin@fusion.com"
        ).orElseThrow();

        user.setPassword(
                passwordEncoder.encode("123456")
        );

        user.setActive(true);

        repository.save(user);

    }

}