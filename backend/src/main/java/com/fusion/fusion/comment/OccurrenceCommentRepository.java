package com.fusion.fusion.comment;

import com.fusion.fusion.occurrence.Occurrence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OccurrenceCommentRepository
        extends JpaRepository<OccurrenceComment, Long> {

    List<OccurrenceComment>
    findByOccurrenceOrderByCreatedAtAsc(
            Occurrence occurrence
    );

}