package com.fusion.fusion.linecancel;

public enum LineCancelStatus {

    // < 30 dias desde o fim da apolice — ainda dentro da janela normal,
    // sem necessidade de acao.
    AGUARDANDO,

    // >= 30 dias e ninguem confirmou ainda que a linha de fato pode ser
    // cancelada (verificacao manual).
    VERIFICAR,

    // Verificado manualmente, pronto pra entrar num e-mail de
    // solicitacao de cancelamento.
    PRONTO,

    // E-mail de cancelamento ja gerado/enviado pra operadora.
    SOLICITADO,

    // Cancelamento confirmado pela operadora.
    CONCLUIDO

}
