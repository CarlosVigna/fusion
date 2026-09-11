package com.fusion.fusion.vehicle.multiportal.device;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceRepository
        extends JpaRepository<Device, UUID> {

    Optional<Device> findByImei(String imei);

    Optional<Device> findByNumberStr(String numberStr);

    // device.vehicle e' @ManyToOne sem fetch=LAZY (default EAGER) — um
    // findAll() comum dispara 1 SELECT extra por device pra resolver essa
    // associacao (N+1). Usado pelos imports de Dispositivos/Vinculos que
    // carregam todos os devices em memoria de uma vez.
    @Query("SELECT d FROM Device d LEFT JOIN FETCH d.vehicle")
    List<Device> findAllWithVehicle();

}