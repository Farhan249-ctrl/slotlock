package com.slotlock.booking.dto;

import com.slotlock.booking.BookingStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateBookingStatusRequest(
        @NotNull(message = "Status is required")
        BookingStatus status
) {
}
