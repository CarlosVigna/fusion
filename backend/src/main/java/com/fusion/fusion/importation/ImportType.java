package com.fusion.fusion.importation;

public enum ImportType {

    TRACKNME,
    TRACKNME_POSITION,
    MULTIPORTAL_DEVICE,
    MULTIPORTAL_LINKAGE,
    MULTIPORTAL_OPERATIONAL,
    MULTIPORTAL_ULTIMA_POSICAO,
    INSTALACOES,
    I4PRO,

    // Nao e' um import de verdade — so reaproveita a fila em memoria do
    // EtlTriggerService (Map<ImportType, TriggerEntry>) pra levar o texto
    // de uma notificacao de instalacao nova ate' o ETL local, que repassa
    // pro grupo do WhatsApp via Baileys (ver InstallationSyncService e
    // fusion-etl/src/whatsapp.js). Nunca e' gravado em etl_status nem
    // import_history — so' passa pelo poll() do EtlTriggerService.
    WHATSAPP_MESSAGE

}