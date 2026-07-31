package com.fusion.fusion.outlook;

import java.util.List;

public record OutlookDraftRequest(
        String dataEntrada,
        String dataSaida,
        List<OutlookVehicleItem> veiculosList,
        List<String> tracknmeList,
        String toEmail
) {}
