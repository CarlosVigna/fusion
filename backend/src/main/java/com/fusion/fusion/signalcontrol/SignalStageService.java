package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import org.springframework.stereotype.Service;

@Service
public class SignalStageService {

    // Etapa SUGERIDA com base em dias sem sinal + ultima observacao
    // manual do operador. A sugestao nunca forca nada — o operador pode
    // registrar uma observacao diferente da sugestao a qualquer momento.
    // SIGNAL_RETURNED nao e calculado aqui — vem de um alerta separado
    // (ver SignalReturnAlertService) sobreposto pelo chamador quando
    // existe um alerta de retorno ainda nao dispensado para o veiculo.
    public SignalStage calculateStage(
            Vehicle vehicle,
            VehicleOperationalState state,
            VehicleObservation lastObservation
    ) {

        if (state == null || state.getSignalDelayMinutes() == null) {
            return SignalStage.OK;
        }

        int days = state.getSignalDelayMinutes() / 1440;

        String obs = lastObservation != null
                ? lastObservation.getText().toUpperCase()
                : "";

        if (days < 1) {
            return SignalStage.OK;
        }

        if (days <= 2) {
            return SignalStage.AWAITING_COMMAND;
        }

        if (days <= 4) {
            return SignalStage.CONTACT_INSURED;
        }

        // 5+ dias
        if (obs.contains("#MANUTENCAO")) {
            return SignalStage.MAINTENANCE_PENDING;
        }

        if (obs.contains("#CARTASUSPENSAO")) {
            return SignalStage.SUSPENSION_PENDING;
        }

        return SignalStage.SUSPENSION_PENDING; // padrão para 5+ dias

    }

}
