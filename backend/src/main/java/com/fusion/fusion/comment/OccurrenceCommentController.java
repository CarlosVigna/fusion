package com.fusion.fusion.comment;

import com.fusion.fusion.comment.service
        .OccurrenceCommentService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/occurrences")
public class OccurrenceCommentController {

    private final OccurrenceCommentService service;

    @PostMapping("/{id}/comments")
    public void comment(
            @PathVariable UUID id,
            @RequestBody CreateCommentRequest request
    ) {

        service.create(id, request);

    }

}