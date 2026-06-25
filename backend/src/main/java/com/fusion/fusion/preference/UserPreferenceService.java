package com.fusion.fusion.preference;

import com.fusion.fusion.common.security.CurrentUserService;
import com.fusion.fusion.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserPreferenceService {

    private final UserPreferenceRepository repository;

    private final CurrentUserService currentUserService;

    public String get(String key) {

        User user = currentUserService.getCurrentUser();

        return repository.findByUserAndKey(user, key)
                .map(UserPreference::getValue)
                .orElse(null);

    }

    @Transactional
    public String save(String key, String value) {

        User user = currentUserService.getCurrentUser();

        UserPreference preference = repository
                .findByUserAndKey(user, key)
                .orElseGet(() -> UserPreference.builder()
                        .user(user)
                        .key(key)
                        .build()
                );

        preference.setValue(value);

        repository.save(preference);

        return preference.getValue();

    }

}
