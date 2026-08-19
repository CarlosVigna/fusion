package com.fusion.fusion.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StockPendingConfirmationRepository extends JpaRepository<StockPendingConfirmation, Long> {

    List<StockPendingConfirmation> findByConfirmedFalseOrderByDetectedAtDesc();

    // Guarda de idempotencia: nao criar uma segunda pendencia pro mesmo
    // estoque enquanto a anterior ainda nao foi confirmada/ignorada — o
    // motor operacional roda de hora em hora e chamaria isso toda vez.
    Optional<StockPendingConfirmation> findFirstByStockAndConfirmedFalse(TechnicianStock stock);

}
