package com.fusion.fusion.linecancel;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.UUID;

public interface LineCancelRepository extends JpaRepository<LineCancel, UUID> {

    // Chave de dedup do sync — mesmo veiculo + mesma data de fim de
    // apolice ja tem um registro, nao cria de novo (ver
    // LineCancelService.syncFromPolicies()).
    boolean existsByVehicleAndPolicyEndDate(Vehicle vehicle, LocalDate policyEndDate);

}
