package com.fusion.fusion.vehicle.tracknme;

import com.fusion.fusion.importation.preview.ImportDiffType;
import com.fusion.fusion.importation.preview.ImportFieldDiff;
import com.fusion.fusion.importation.preview.ImportPreviewItem;
import com.fusion.fusion.importation.preview.ImportPreviewResponse;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehiclePlatform;
import com.fusion.fusion.vehicle.VehicleRepository;
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
public class TracknMePreviewService {

    private final VehicleRepository repository;

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
                                getCellValue(row.getCell(8))
                        );

                if (plate == null || plate.isBlank()) {
                    continue;
                }

                String insuredName =
                        getCellValue(row.getCell(7));

                Optional<Vehicle> optionalVehicle =
                        repository.findByPlate(plate);

                if (optionalVehicle.isEmpty()) {

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

                Vehicle vehicle =
                        optionalVehicle.get();

                List<ImportFieldDiff> diffs =
                        new ArrayList<>();

                compare(
                        diffs,
                        "insuredName",
                        vehicle.getInsuredName(),
                        insuredName
                );

                compare(
                        diffs,
                        "platform",
                        vehicle.getPlatform() != null
                                ? vehicle.getPlatform().name()
                                : null,
                        VehiclePlatform.TRACKNME.name()
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
                    "Erro ao gerar preview"
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