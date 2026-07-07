package com.fusion.fusion.installation;

public record InstallationRequest(

        String externalId,

        String customerName,

        String address,

        String neighborhood,

        String city,

        String state,

        String zipCode,

        String phone,

        String plate,

        String serviceType

) {
}
