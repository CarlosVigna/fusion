package com.fusion.fusion.vehicle.multiportal.linkage;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fusion.fusion.importation.preview.ImportPreviewResponse;
import com.fusion.fusion.importation.confirm.ImportConfirmRequest;
import com.fusion.fusion.importation.confirm.ImportConfirmResponse;

@RestController
@RequestMapping("/multiportal/linkage")
@RequiredArgsConstructor
public class LinkageController {

    private final LinkagePreviewService previewService;
    private final LinkageImportService service;
    private final LinkageConfirmService confirmService;

    @PostMapping("/import")
    public LinkageImportResponse importFile(
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