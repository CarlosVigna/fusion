package com.fusion.fusion.setup;

import com.fusion.fusion.user.Role;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/setup")
@RequiredArgsConstructor
public class SetupController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/init")
    public Map<String, Object> init() {

        if (userRepository.count() > 0) {
            return Map.of("created", false, "reason", "Users already exist");
        }

        User admin = User.builder()
                .name("Carlos Garcia")
                .email("admin@fusion.com")
                .password(passwordEncoder.encode("fusion123"))
                .role(Role.ADMIN)
                .build();

        userRepository.save(admin);

        return Map.of("created", true);

    }

}
