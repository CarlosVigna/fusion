package com.fusion.fusion.reports;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportsController {

    private final MultiportalSheetService multiportalSheetService;

    @GetMapping("/multiportal-sheet")
    public MultiportalSheetResponse multiportalSheet() {
        return multiportalSheetService.build();
    }

}
