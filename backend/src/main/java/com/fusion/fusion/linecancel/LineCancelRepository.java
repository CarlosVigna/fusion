package com.fusion.fusion.linecancel;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface LineCancelRepository extends JpaRepository<LineCancel, UUID> {

    // Chave de dedup do sync — mesmo veiculo + mesma data de fim de
    // apolice ja tem um registro. syncFromPolicies() usa o resultado
    // pra decidir entre criar um novo ou so' fazer backfill de
    // imei/iccid/msisdn num registro existente que esteja sem IMEI.
    Optional<LineCancel> findByVehicleAndPolicyEndDate(Vehicle vehicle, LocalDate policyEndDate);

}
