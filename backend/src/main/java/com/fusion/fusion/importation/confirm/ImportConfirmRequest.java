package com.fusion.fusion.importation.confirm;

import java.util.List;

public record ImportConfirmRequest(

        List<ImportConfirmItem> items

) {
}