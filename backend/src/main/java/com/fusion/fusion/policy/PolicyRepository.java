package com.fusion.fusion.policy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface PolicyRepository extends JpaRepository<Policy, Long> {

    List<Policy> findAllByPlateIn(Collection<String> plates);

    @Query("SELECT p FROM Policy p WHERE p.vehicle IS NULL OR p.vehicle.deletedAt IS NULL")
    List<Policy> findAllActive();

    // Mesmo filtro de findAllActive(), mas com o veiculo ja carregado —
    // usado onde o codigo acessa policy.getVehicle().getVehicleGroup()/
    // outros campos fora de uma sessao Hibernate aberta (ex: dentro de
    // uma thread @Async, que nao tem OpenSessionInView) e por
    // findAll(), que senao faria 1 SELECT extra por policy so pra
    // resolver o proxy lazy de vehicle (N+1 mascarado pelo OSIV dentro
    // de requisicoes HTTP normais).
    @Query("SELECT p FROM Policy p LEFT JOIN FETCH p.vehicle WHERE p.vehicle IS NULL OR p.vehicle.deletedAt IS NULL")
    List<Policy> findAllActiveWithVehicle();

}
