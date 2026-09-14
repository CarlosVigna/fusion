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
    OPERATIONAL_ENGINE

    // WHATSAPP_MESSAGE removido — mensagem de instalacao nova agora usa
    // a fila dedicada EtlTriggerService.requestWhatsApp()/pollWhatsApp()
    // (Queue<String>, suporta varias pendentes), nao mais esse enum via
    // request(ImportType, String) (Map de 1 pendente por tipo, perdia
    // mensagem quando 2+ instalacoes chegavam no mesmo ciclo de sync).

}