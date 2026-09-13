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

    // Roda 100% dentro do backend (OperationalStateEngineService) — nao
    // depende do ETL local, entao nunca passa pela fila do
    // EtlTriggerService, so' pelo caso direto em ImportStatusController.
    // Ja previsto na constraint de etl_status (EtlStatusConstraintMigration)
    // desde antes de existir aqui — so' nao tinha nenhum jeito de disparar
    // manualmente ate' agora.
    OPERATIONAL_ENGINE,

    // Nao e' um import de verdade — so reaproveita a fila em memoria do
    // EtlTriggerService (Map<ImportType, TriggerEntry>) pra levar o texto
    // de uma notificacao de instalacao nova ate' o ETL local, que repassa
    // pro grupo do WhatsApp via Baileys (ver InstallationSyncService e
    // fusion-etl/src/whatsapp.js). Nunca e' gravado em etl_status nem
    // import_history — so' passa pelo poll() do EtlTriggerService.
    WHATSAPP_MESSAGE

}