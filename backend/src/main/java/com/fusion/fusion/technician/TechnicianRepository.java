package com.fusion.fusion.technician;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TechnicianRepository extends JpaRepository<Technician, UUID> {
    List<Technician> findByActiveTrueOrderByNameAsc();
}
