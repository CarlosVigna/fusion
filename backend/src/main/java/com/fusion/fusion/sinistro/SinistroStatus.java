package com.fusion.fusion.sinistro;

public enum SinistroStatus {

    // PENDING nao estava no pedido original, mas e necessario: o job
    // existe no banco assim que /sinistro/start responde, antes do ETL
    // (que so passa por aqui a cada 15s de poll) sequer ter visto o
    // pedido. RUNNING fica reservado para "ETL reivindicou e esta
    // rodando o Playwright agora".
    PENDING,

    RUNNING,

    DONE,

    ERROR

}
