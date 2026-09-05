package com.fusion.fusion.linecancel;

import java.util.List;
import java.util.UUID;

public record LineCancelEmailRequest(List<UUID> ids) {
}
