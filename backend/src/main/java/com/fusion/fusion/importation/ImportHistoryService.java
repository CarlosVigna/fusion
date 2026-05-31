package com.fusion.fusion.importation;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ImportHistoryService {

    private final ImportHistoryRepository repository;
    private final UserRepository userRepository;

    public void register(

            ImportType type,

            String fileName,

            Integer processedRecords

    ) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuário não encontrado"
                ));

        ImportHistory history =
                ImportHistory.builder()
                        .type(type)
                        .fileName(fileName)
                        .processedRecords(processedRecords)
                        .importedBy(user)
                        .build();

        repository.save(history);

    }

}