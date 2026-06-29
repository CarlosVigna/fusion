package com.fusion.fusion.vehicle;

import com.fusion.fusion.vehicle.grid.GridVehicleResponse;
import com.fusion.fusion.vehicle.grid.VehicleGridService;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateRequest;
import com.fusion.fusion.vehicle.multiportal.operational.OperationalUpdateResponse;
import com.fusion.fusion.vehicle.tracknme.TracknMeImportResponse;
import com.fusion.fusion.vehicle.tracknme.TracknMeImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@RestController
@RequestMapping("/vehicles")
@RequiredArgsConstructor
public class VehicleController {

    private final VehicleGridService gridService;
    private final TracknMeImportService tracknMeImportService;
    private final VehicleService service;
    private final VehicleDetailService detailService;

    @PostMapping
    public VehicleResponse create(
            @RequestBody @Valid VehicleRequest request
    ) {

        return service.create(request);

    }

    @GetMapping
    public List<VehicleResponse> findAll() {

        return service.findAll();

    }

    @GetMapping("/{plate}")
    public VehicleResponse findByPlate(
            @PathVariable String plate
    ) {

        return service.findByPlate(plate);

    }


    @GetMapping("/{plate}/detail")
    public VehicleDetailResponse detail(
            @PathVariable String plate
    ) {

        return detailService.findByPlate(plate);

    }


    @PutMapping("/{plate}")
    public VehicleResponse update(
            @PathVariable String plate,
            @RequestBody VehicleUpdateRequest request
    ) {

        return service.update(plate, request);

    }

    @PostMapping("/tracknme/import")
    public TracknMeImportResponse importTracknMe(
            @RequestParam("file") MultipartFile file
    ) {

        return tracknMeImportService.importFile(file);

    }

    @GetMapping("/grid")
    public List<GridVehicleResponse> grid() {

        return gridService.getGrid();

    }

    @DeleteMapping("/{plate}")
    public void delete(
            @PathVariable String plate
    ) {

        service.delete(plate);

    }

}