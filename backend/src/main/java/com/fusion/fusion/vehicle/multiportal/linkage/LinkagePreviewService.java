package com.fusion.fusion.vehicle.multiportal.linkage;

import com.fusion.fusion.importation.preview.*;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.device.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LinkagePreviewService {

    private final DeviceLinkageRepository repository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;

    public ImportPreviewResponse preview(
            MultipartFile file
    ) {

        List<ImportPreviewItem> items =
                new ArrayList<>();

        int creates = 0;
        int updates = 0;
        int noChanges = 0;

        try {

            InputStream inputStream =
                    file.getInputStream();

            Workbook workbook =
                    WorkbookFactory.create(inputStream);

            Sheet sheet = workbook.getSheetAt(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null) {
                    continue;
                }

                String plate =
                        normalizePlate(
                                getCellValue(row.getCell(2))
                        );

                if (plate == null || plate.isBlank()) {
                    continue;
                }

                Optional<Vehicle> optionalVehicle =
                        vehicleRepository.findByPlate(
                                plate
                        );

                if (optionalVehicle.isEmpty()) {
                    continue;
                }

                Vehicle vehicle =
                        optionalVehicle.get();

                Optional<DeviceLinkage> activeLinkage =
                        repository.findByVehicleAndActiveTrue(
                                vehicle
                        );

                String numberStr =
                        getCellValue(row.getCell(5));

                Optional<Device> optionalDevice =
                        deviceRepository.findAll()
                                .stream()
                                .filter(device ->
                                        numberStr.equals(
                                                device.getNumberStr()
                                        )
                                )
                                .findFirst();

                if (optionalDevice.isEmpty()) {
                    continue;
                }

                Device importedDevice =
                        optionalDevice.get();

                if (activeLinkage.isEmpty()) {

                    creates++;

                    items.add(
                            new ImportPreviewItem(
                                    plate,
                                    ImportDiffType.CREATE,
                                    List.of()
                            )
                    );

                    continue;

                }

                DeviceLinkage linkage =
                        activeLinkage.get();

                List<ImportFieldDiff> diffs =
                        new ArrayList<>();

                compare(
                        diffs,
                        "device",
                        linkage.getDevice() != null
                                ? linkage.getDevice()
                                .getNumberStr()
                                : null,
                        importedDevice.getNumberStr()
                );

                compare(
                        diffs,
                        "manufacturer",
                        linkage.getManufacturer(),
                        getCellValue(row.getCell(6))
                );

                compare(
                        diffs,
                        "status",
                        linkage.getActive() != null
                                && linkage.getActive()
                                ? "Aberto"
                                : "Encerrado",
                        getCellValue(row.getCell(7))
                );

                if (diffs.isEmpty()) {

                    noChanges++;

                    items.add(
                            new ImportPreviewItem(
                                    plate,
                                    ImportDiffType.NO_CHANGES,
                                    List.of()
                            )
                    );

                } else {

                    updates++;

                    items.add(
                            new ImportPreviewItem(
                                    plate,
                                    ImportDiffType.UPDATE,
                                    diffs
                            )
                    );

                }

            }

            workbook.close();

        } catch (Exception e) {

            throw new RuntimeException(
                    "Erro ao gerar preview vínculos"
            );

        }

        return new ImportPreviewResponse(
                items.size(),
                creates,
                updates,
                noChanges,
                items
        );

    }

    private void compare(

            List<ImportFieldDiff> diffs,

            String field,

            String currentValue,

            String newValue

    ) {

        String current =
                currentValue != null
                        ? currentValue.trim()
                        : null;

        String incoming =
                newValue != null
                        ? newValue.trim()
                        : null;

        if (equals(current, incoming)) {
            return;
        }

        diffs.add(
                new ImportFieldDiff(
                        field,
                        current,
                        incoming
                )
        );

    }

    private boolean equals(
            String a,
            String b
    ) {

        if (a == null && b == null) {
            return true;
        }

        if (a == null || b == null) {
            return false;
        }

        return a.equalsIgnoreCase(b);

    }

    private String getCellValue(Cell cell) {

        if (cell == null) {
            return null;
        }

        return switch (cell.getCellType()) {

            case STRING ->
                    cell.getStringCellValue();

            case NUMERIC ->
                    String.valueOf(
                            (long) cell.getNumericCellValue()
                    );

            default -> null;

        };

    }

    private String normalizePlate(String plate) {

        return plate
                .replace("-", "")
                .replace(" ", "")
                .trim()
                .toUpperCase();

    }

}