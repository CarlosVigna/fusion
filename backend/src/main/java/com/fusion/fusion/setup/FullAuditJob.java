package com.fusion.fusion.setup;

// Mesmo padrao de com.fusion.fusion.policy.VerificationJob — status
// RUNNING/DONE/ERROR/NOT_FOUND + progresso. "error" carrega a mensagem
// quando status=ERROR; o Excel pronto (quando DONE) fica em
// FullAuditService.results, nao aqui, pra esse status nunca serializar
// o arquivo inteiro em JSON.
public record FullAuditJob(
        String status,
        int processed,
        int total,
        String error
) {}
