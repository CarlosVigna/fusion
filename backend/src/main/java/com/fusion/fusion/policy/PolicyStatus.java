package com.fusion.fusion.policy;

public enum PolicyStatus {
    ACTIVE,
    FUTURE,
    EXPIRING,
    EXPIRED,
    CANCELLED,
    SUPERSEDED,
    // Portal manda statusDescricao contendo "encerrada" pra apolices que
    // o segurado/corretora encerrou explicitamente — antes disso caia
    // junto com EXPIRED (vencida por data), misturando dois conceitos
    // diferentes na secao "Vencidas".
    CLOSED
}
