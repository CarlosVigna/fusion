package com.fusion.fusion.vehicle.multiportal.device;

import com.fusion.fusion.importation.preview.ImportPreviewResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fusion.fusion.importation.confirm.ImportConfirmRequest;
import com.fusion.fusion.importation.confirm.ImportConfirmResponse;

@RestController
@RequestMapping("/multiportal/device")
@RequiredArgsConstructor
public class DeviceController {

    private final DevicePreviewService previewService;
    private final DeviceImportService service;
    private final DeviceConfirmService confirmService;

    @PostMapping("/import")
    public DeviceImportResponse importFile(
            @RequestParam("file") MultipartFile file
    ) {

        return service.importFile(file);

    }

    @PostMapping("/preview")
    public ImportPreviewResponse preview(
            @RequestParam("file") MultipartFile file
    ) {

        return previewService.preview(file);

    }

    @PostMapping("/confirm")
    public ImportConfirmResponse confirm(
            @RequestBody ImportConfirmRequest request
    ) {

        return confirmService.confirm(request);

    }

}