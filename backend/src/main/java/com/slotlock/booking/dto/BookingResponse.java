package com.slotlock.booking.dto;

import com.slotlock.booking.Booking;
import com.slotlock.booking.BookingStatus;
import java.time.Instant;

public record BookingResponse(
        Long id,
        Long hallId,
        String hallName,
        Long userId,
        String userName,
        String title,
        Instant startTime,
        Instant endTime,
        BookingStatus status,
        Instant createdAt
) {
    public static BookingResponse fromEntity(Booking booking) {
        return new BookingResponse(
                booking.getId(),
                booking.getHall().getId(),
                booking.getHall().getName(),
                booking.getUser().getId(),
                booking.getUser().getName(),
                booking.getTitle(),
                booking.getStartTime(),
                booking.getEndTime(),
                booking.getStatus(),
                booking.getCreatedAt()
        );
    }
}
