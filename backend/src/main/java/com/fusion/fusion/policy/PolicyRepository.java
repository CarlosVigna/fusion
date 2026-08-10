package com.fusion.fusion.policy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface PolicyRepository extends JpaRepository<Policy, Long> {

    List<Policy> findAllByPlateIn(Collection<String> plates);

    @Query("SELECT p FROM Policy p WHERE p.vehicle IS NULL OR p.vehicle.deletedAt IS NULL")
    List<Policy> findAllActive();

}
