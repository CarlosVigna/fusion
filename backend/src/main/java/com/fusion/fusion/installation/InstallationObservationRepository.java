package com.fusion.fusion.installation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InstallationObservationRepository extends JpaRepository<InstallationObservation, Long> {

    List<InstallationObservation> findByInstallationOrderByCreatedAtDesc(Installation installation);

}
