package com.fusion.fusion.sinistro;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SinistroAnalysisRepository extends JpaRepository<SinistroAnalysis, java.util.UUID> {

    Optional<SinistroAnalysis> findFirstByStatusOrderByCreatedAtAsc(SinistroStatus status);

    List<SinistroAnalysis> findAllByOrderByCreatedAtDesc();

}
