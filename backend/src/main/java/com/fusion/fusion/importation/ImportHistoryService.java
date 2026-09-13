package com.fusion.fusion.importation;

import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
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

        register(type, fileName, processedRecords, ImportStatus.SUCCESS);

    }

    public void register(

            ImportType type,

            String fileName,

            Integer processedRecords,

            ImportStatus status

    ) {

        register(type, fileName, processedRecords, null, status);

    }

    // Overload usado por DeviceImportService/LinkageImportService, que
    // distinguem "novos" (processedRecords) de "existentes alterados"
    // (updatedRecords) — os demais tipos de import continuam usando os
    // overloads acima, sem essa distincao (updatedRecords fica null).
    public void register(

            ImportType type,

            String fileName,

            Integer processedRecords,

            Integer updatedRecords,

            ImportStatus status

    ) {

        // Chamado tanto a partir de requisições autenticadas (upload manual)
        // quanto do orchestrator agendado (sem usuário logado) — nesse
        // segundo caso, importedBy fica nulo (import do sistema).
        User user = currentUser();

        ImportHistory history =
                ImportHistory.builder()
                        .type(type)
                        .fileName(fileName)
                        .processedRecords(processedRecords)
                        .updatedRecords(updatedRecords)
                        .status(status)
                        .importedBy(user)
                        .build();

        repository.save(history);

    }

    private User currentUser() {

        Authentication authentication =
                SecurityContextHolder.getContext()
                        .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {

            return null;

        }

        return userRepository.findByEmail(
                authentication.getName()
        ).orElse(null);

    }

}