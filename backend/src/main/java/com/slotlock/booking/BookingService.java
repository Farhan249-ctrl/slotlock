package com.slotlock.booking;

import com.slotlock.booking.dto.BookingResponse;
import com.slotlock.booking.dto.CreateBookingRequest;
import com.slotlock.hall.Hall;
import com.slotlock.hall.HallRepository;
import com.slotlock.user.User;
import com.slotlock.user.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final HallRepository hallRepository;
    private final UserRepository userRepository;

    public BookingService(BookingRepository bookingRepository,
                          HallRepository hallRepository,
                          UserRepository userRepository) {
        this.bookingRepository = bookingRepository;
        this.hallRepository = hallRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public BookingResponse createBooking(CreateBookingRequest request, String userEmail) {
        if (!request.startTime().isAfter(Instant.now())) {
            throw new IllegalArgumentException("Start time must be in the future");
        }
        if (!request.endTime().isAfter(request.startTime())) {
            throw new IllegalArgumentException("End time must be after start time");
        }

        Hall hall = hallRepository.findById(request.hallId())
                .orElseThrow(() -> new IllegalArgumentException("Hall not found with id: " + request.hallId()));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userEmail));

        Booking booking = new Booking(
                hall,
                user,
                request.title(),
                request.startTime(),
                request.endTime(),
                BookingStatus.PENDING
        );

        Booking saved = bookingRepository.saveAndFlush(booking);
        return BookingResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getBookings(Long hallId, LocalDate date, BookingStatus status, boolean isAdmin) {
        if (status != null) {
            if (!isAdmin) {
                throw new AccessDeniedException("Only admins can filter bookings by status");
            }
            List<Booking> bookings;
            if (hallId != null) {
                bookings = bookingRepository.findByHallIdAndStatusOrderByCreatedAtDesc(hallId, status);
            } else {
                bookings = bookingRepository.findByStatusOrderByCreatedAtDesc(status);
            }
            return bookings.stream().map(BookingResponse::fromEntity).toList();
        }

        if (!isAdmin) {
            if (hallId == null || date == null) {
                throw new IllegalArgumentException("hallId and date are required for students");
            }
        }

        Instant startOfDay = null;
        Instant endOfDay = null;
        if (date != null) {
            startOfDay = date.atStartOfDay(ZoneOffset.UTC).toInstant();
            endOfDay = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        }

        List<Booking> bookings;
        if (hallId != null && date != null) {
            bookings = bookingRepository.findByHallIdAndStartTimeGreaterThanEqualAndStartTimeLessThanOrderByStartTimeAsc(
                    hallId, startOfDay, endOfDay
            );
        } else if (hallId != null) {
            bookings = bookingRepository.findByHallIdOrderByStartTimeAsc(hallId);
        } else if (date != null) {
            bookings = bookingRepository.findByStartTimeGreaterThanEqualAndStartTimeLessThanOrderByStartTimeAsc(
                    startOfDay, endOfDay
            );
        } else {
            bookings = bookingRepository.findAllByOrderByCreatedAtDesc();
        }

        return bookings.stream()
                .map(BookingResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings(String userEmail) {
        return bookingRepository.findByUserEmailOrderByCreatedAtDesc(userEmail)
                .stream()
                .map(BookingResponse::fromEntity)
                .toList();
    }

    @Transactional
    public BookingResponse cancelBooking(Long bookingId, String userEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found with id: " + bookingId));

        if (!booking.getUser().getEmail().equalsIgnoreCase(userEmail)) {
            throw new AccessDeniedException("Only the booking owner can cancel this booking");
        }

        if (booking.getStatus() != BookingStatus.PENDING && booking.getStatus() != BookingStatus.APPROVED) {
            throw new IllegalArgumentException("Only PENDING or APPROVED bookings can be cancelled");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        Booking saved = bookingRepository.saveAndFlush(booking);
        return BookingResponse.fromEntity(saved);
    }

    @Transactional
    public BookingResponse updateBookingStatus(Long bookingId, BookingStatus newStatus) {
        if (newStatus != BookingStatus.APPROVED && newStatus != BookingStatus.REJECTED) {
            throw new IllegalArgumentException("Status must be either APPROVED or REJECTED");
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found with id: " + bookingId));

        booking.setStatus(newStatus);
        Booking updated = bookingRepository.saveAndFlush(booking);
        return BookingResponse.fromEntity(updated);
    }
}
