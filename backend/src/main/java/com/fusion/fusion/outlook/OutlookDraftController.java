package com.fusion.fusion.outlook;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/outlook/draft")
@RequiredArgsConstructor
public class OutlookDraftController {

    private final OutlookDraftService outlookDraftService;

    @PostMapping("/passagem-turno")
    public Map<String, Object> createDraft(@RequestBody OutlookDraftRequest request) {
        return outlookDraftService.createDraft(request);
    }

    @PostMapping("/passagem-turno/preview")
    public Map<String, String> preview(@RequestBody OutlookDraftRequest request) {
        return Map.of("html", outlookDraftService.buildPreview(request));
    }

}
