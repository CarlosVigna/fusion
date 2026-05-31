package com.fusion.fusion.comment;

import com.fusion.fusion.occurrence.Occurrence;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OccurrenceComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Occurrence occurrence;

    @Column(length = 5000)
    private String content;

    private String author;

    private LocalDateTime createdAt;

}