package com.slotlock.booking;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    @EntityGraph(attributePaths = {"hall", "user"})
    List<Booking> findAllByOrderByStartTimeAsc();

    @EntityGraph(attributePaths = {"hall", "user"})
    List<Booking> findByHallIdOrderByStartTimeAsc(Long hallId);

    @EntityGraph(attributePaths = {"hall", "user"})
    List<Booking> findByStartTimeGreaterThanEqualAndStartTimeLessThanOrderByStartTimeAsc(Instant start, Instant end);

    @EntityGraph(attributePaths = {"hall", "user"})
    List<Booking> findByHallIdAndStartTimeGreaterThanEqualAndStartTimeLessThanOrderByStartTimeAsc(Long hallId, Instant start, Instant end);
}
