package com.fusion.fusion.technician;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.ors.OrsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechnicianService {

    private final TechnicianRepository repository;
    private final OrsService orsService;

    public List<TechnicianResponse> listAll() {
        return repository.findByActiveTrueOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public TechnicianResponse create(TechnicianRequest request) {
        Technician t = Technician.builder()
                .name(request.name())
                .phone(request.phone())
                .address(request.address())
                .city(request.city())
                .state(request.state())
                .zipCode(request.zipCode())
                .defaultServiceValue(request.defaultServiceValue())
                .active(true)
                .build();
        geocode(t);
        return toResponse(repository.save(t));
    }

    @Transactional
    public TechnicianResponse update(UUID id, TechnicianRequest request) {
        Technician t = find(id);
        boolean addressChanged = !eq(t.getAddress(), request.address())
                || !eq(t.getCity(), request.city())
                || !eq(t.getState(), request.state());
        t.setName(request.name());
        t.setPhone(request.phone());
        t.setAddress(request.address());
        t.setCity(request.city());
        t.setState(request.state());
        t.setZipCode(request.zipCode());
        t.setDefaultServiceValue(request.defaultServiceValue());
        if (addressChanged) geocode(t);
        return toResponse(repository.save(t));
    }

    @Transactional
    public void delete(UUID id) {
        Technician t = find(id);
        t.setActive(false);
        repository.save(t);
    }

    public Technician find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Técnico não encontrado: " + id));
    }

    private void geocode(Technician t) {
        if (t.getAddress() == null || t.getCity() == null) return;
        double[] coords = orsService.geocode(t.getAddress(), t.getCity(), t.getState());
        if (coords != null) {
            t.setLatitude(coords[0]);
            t.setLongitude(coords[1]);
        }
    }

    private boolean eq(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }

    public TechnicianResponse toResponse(Technician t) {
        return new TechnicianResponse(
                t.getId(), t.getName(), t.getPhone(), t.getAddress(),
                t.getCity(), t.getState(), t.getZipCode(),
                t.getLatitude(), t.getLongitude(),
                t.getDefaultServiceValue(), t.getActive(), t.getCreatedAt()
        );
    }
}
