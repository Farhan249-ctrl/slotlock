package com.slotlock.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record CreateBookingRequest(
        @NotNull(message = "Hall ID is required")
        Long hallId,

        @NotBlank(message = "Title is required")
        String title,

        @NotNull(message = "Start time is required")
        Instant startTime,

        @NotNull(message = "End time is required")
        Instant endTime
) {
}
