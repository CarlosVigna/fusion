package com.fusion.fusion.sinistro;

import java.time.LocalDate;

// Uma entrada por dia do relatório "Tempo de Ignição" do Multiportal.
// minutosLigada: coluna "Tempo ligada" convertida de HH:mm[:ss] para minutos.
// km: coluna "KM" do mesmo relatório.
public record IgnicaoDayEntry(LocalDate date, Integer minutosLigada, Double km) {}
