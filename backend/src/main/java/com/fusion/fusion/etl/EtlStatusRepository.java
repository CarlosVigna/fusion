package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EtlStatusRepository
        extends JpaRepository<EtlStatus, ImportType> {
}
