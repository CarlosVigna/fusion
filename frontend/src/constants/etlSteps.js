// Etapas reportadas pelos scripts do ETL (ver reportHeartbeat() em
// fusion-etl/index*.js e TracknMeSyncService.java) — mesma ordem usada
// lá, pra o checklist do EtlProgressPanel bater com o que de fato é
// enviado. Alguns steps (ex: "Buscando apólice: {placa}" do i4pro) têm
// sufixo dinâmico — por isso o match em EtlProgressPanel usa
// startsWith(), não igualdade estrita.
export const ETL_STEPS = {
  MULTIPORTAL_ULTIMA_POSICAO: [
    "Fazendo login no portal",
    "Abrindo relatório de posições",
    "Aguardando download da planilha",
    "Processando dados",
    "Concluído",
  ],
  MULTIPORTAL_DEVICE: [
    "Fazendo login no portal",
    "Abrindo cadastro de dispositivos",
    "Aguardando download",
    "Enviando para o Fusion",
    "Concluído",
  ],
  MULTIPORTAL_LINKAGE: [
    "Fazendo login no portal",
    "Abrindo dispositivo vínculo",
    "Aguardando download",
    "Enviando para o Fusion",
    "Concluído",
  ],
  TRACKNME: [
    "Autenticando na API TracknMe",
    "Buscando dispositivos",
    "Concluído",
  ],
  TRACKNME_POSITION: [
    "Autenticando na API TracknMe",
    "Atualizando posições",
    "Concluído",
  ],
  I4PRO: [
    "Fazendo login no i4pro",
    "Buscando apólice",
    "Salvando dados",
    "Concluído",
  ],
};

export const ETL_LABELS = {
  MULTIPORTAL_ULTIMA_POSICAO: "POSICIONAMENTO",
  MULTIPORTAL_DEVICE: "DISPOSITIVOS",
  MULTIPORTAL_LINKAGE: "VÍNCULOS",
  TRACKNME: "TRACKNME (DISPOSITIVOS)",
  TRACKNME_POSITION: "TRACKNME (POSIÇÕES)",
  I4PRO: "APÓLICES I4PRO",
};
