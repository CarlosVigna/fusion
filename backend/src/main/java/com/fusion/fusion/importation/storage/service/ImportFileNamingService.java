package com.fusion.fusion.importation.storage.service;

import com.fusion.fusion.importation.storage.enums.ImportFileType;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class ImportFileNamingService {

    public String build(
            ImportFileType type,
            String extension
    ) {

        String timestamp = LocalDateTime.now()
                .format(
                        DateTimeFormatter.ofPattern(
                                "yyyy-MM-dd_HH-mm"
                        )
                );

        return type.name()
                + "_"
                + timestamp
                + extension;

    }

}