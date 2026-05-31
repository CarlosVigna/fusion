package com.fusion.fusion.audit;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.user.User;
import com.fusion.fusion.user.UserRepository;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final VehicleRepository vehicleRepository;
    private final AuditLogRepository repository;
    private final UserRepository userRepository;

    public void log(
            Vehicle vehicle,
            AuditAction action,
            String field,
            String oldValue,
            String newValue
    ) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuário não encontrado"
                ));

        AuditLog log = AuditLog.builder()
                .user(user)
                .vehicle(vehicle)
                .action(action.name())
                .fieldName(field)
                .oldValue(oldValue)
                .newValue(newValue)
                .build();

        repository.save(log);

    }

    public List<AuditResponse> findVehicleHistory(
            String plate
    ) {

        Vehicle vehicle = vehicleRepository.findByPlate(
                        plate
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Veículo não encontrado"
                ));

        return repository.findByVehicleOrderByCreatedAtDesc(
                        vehicle
                )
                .stream()
                .map(log -> new AuditResponse(
                        log.getId(),
                        log.getUser().getName(),
                        log.getAction(),
                        log.getFieldName(),
                        log.getOldValue(),
                        log.getNewValue(),
                        log.getCreatedAt()
                ))
                .toList();

    }

}