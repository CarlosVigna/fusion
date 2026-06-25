package com.fusion.fusion.comment.service;

import com.fusion.fusion.comment.CreateCommentRequest;
import com.fusion.fusion.comment.OccurrenceComment;
import com.fusion.fusion.comment.OccurrenceCommentRepository;
import com.fusion.fusion.occurrence.Occurrence;
import com.fusion.fusion.occurrence.OccurrenceRepository;
import com.fusion.fusion.timeline.TimelineEventType;
import com.fusion.fusion.timeline.service.TimelineService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OccurrenceCommentService {

    private final OccurrenceCommentRepository repository;

    private final OccurrenceRepository occurrenceRepository;

    private final TimelineService timelineService;

    public void create(
            UUID occurrenceId,
            CreateCommentRequest request
    ) {

        Occurrence occurrence =
                occurrenceRepository.findById(
                        occurrenceId
                ).orElseThrow();

        OccurrenceComment comment =
                OccurrenceComment.builder()
                        .occurrence(occurrence)
                        .author(request.getAuthor())
                        .content(request.getContent())
                        .createdAt(LocalDateTime.now(ZoneOffset.UTC))
                        .build();

        repository.save(comment);

        timelineService.register(
                occurrence.getVehicle(),
                occurrence,
                TimelineEventType.COMMENT_ADDED,
                request.getAuthor()
                        + ": "
                        + request.getContent()
        );

    }

}