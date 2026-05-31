package com.fusion.fusion.vehicle.multiportal.device;

import com.fusion.fusion.importation.preview.*;
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
public class DevicePreviewService {

    private final DeviceRepository repository;

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

                String imei =
                        getCellValue(row.getCell(12));

                if (imei == null || imei.isBlank()) {
                    continue;
                }

                Optional<Device> optionalDevice =
                        repository.findByImei(imei);

                String manufacturer =
                        getCellValue(row.getCell(14));

                String model =
                        getCellValue(row.getCell(15));

                String lineNumber =
                        getCellValue(row.getCell(8));

                String operator =
                        getCellValue(row.getCell(7));

                String number =
                        getCellValue(row.getCell(0));

                String numberStr =
                        getCellValue(row.getCell(1));

                if (optionalDevice.isEmpty()) {

                    creates++;

                    items.add(
                            new ImportPreviewItem(
                                    imei,
                                    ImportDiffType.CREATE,
                                    List.of()
                            )
                    );

                    continue;

                }

                Device device =
                        optionalDevice.get();

                List<ImportFieldDiff> diffs =
                        new ArrayList<>();

                compare(
                        diffs,
                        "manufacturer",
                        device.getManufacturer(),
                        manufacturer
                );

                compare(
                        diffs,
                        "model",
                        device.getModel(),
                        model
                );

                compare(
                        diffs,
                        "lineNumber",
                        device.getLineNumber(),
                        lineNumber
                );

                compare(
                        diffs,
                        "operator",
                        device.getOperator(),
                        operator
                );

                compare(
                        diffs,
                        "number",
                        device.getNumber(),
                        number
                );

                compare(
                        diffs,
                        "numberStr",
                        device.getNumberStr(),
                        numberStr
                );

                if (diffs.isEmpty()) {

                    noChanges++;

                    items.add(
                            new ImportPreviewItem(
                                    imei,
                                    ImportDiffType.NO_CHANGES,
                                    List.of()
                            )
                    );

                } else {

                    updates++;

                    items.add(
                            new ImportPreviewItem(
                                    imei,
                                    ImportDiffType.UPDATE,
                                    diffs
                            )
                    );

                }

            }

            workbook.close();

        } catch (Exception e) {

            throw new RuntimeException(
                    "Erro ao gerar preview devices"
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

}