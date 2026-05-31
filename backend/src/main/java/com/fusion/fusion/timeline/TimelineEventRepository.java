package com.fusion.fusion.timeline;

import com.fusion.fusion.occurrence.Occurrence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TimelineEventRepository
        extends JpaRepository<TimelineEvent, Long> {

    List<TimelineEvent> findByOccurrenceOrderByCreatedAtDesc(
            Occurrence occurrence
    );

}