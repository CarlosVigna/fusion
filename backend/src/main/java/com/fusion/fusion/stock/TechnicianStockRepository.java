package com.fusion.fusion.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TechnicianStockRepository extends JpaRepository<TechnicianStock, Long> {

    List<TechnicianStock> findByTechnicianIdOrderByCreatedAtDesc(UUID technicianId);

    // IMEI nao e' unico por design (equipamento pode ser devolvido e
    // reaparecer em estoque de outro tecnico depois) — pega o mais
    // recente em EM_ESTOQUE, que e' o unico caso que importa pra
    // deteccao automatica de posicionamento.
    Optional<TechnicianStock> findFirstByImeiAndStatusOrderByCreatedAtDesc(String imei, StockStatus status);

    List<TechnicianStock> findByStatus(StockStatus status);

    boolean existsByImei(String imei);

}
