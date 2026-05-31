package com.fusion.fusion.vehicle.tracknme;

import com.fusion.fusion.importation.preview.ImportPreviewResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fusion.fusion.importation.confirm.ImportConfirmRequest;
import com.fusion.fusion.importation.confirm.ImportConfirmResponse;

@RestController
@RequestMapping("/tracknme")
@RequiredArgsConstructor
public class TracknMeController {

    private final TracknMeImportService service;
    private final TracknMePreviewService previewService;
    private final TracknMeConfirmService confirmService;

    @PostMapping("/import")
    public TracknMeImportResponse importFile(
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