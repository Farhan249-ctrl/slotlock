package com.slotlock.booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Query("SELECT b FROM Booking b " +
           "JOIN FETCH b.hall " +
           "JOIN FETCH b.user " +
           "WHERE (:hallId IS NULL OR b.hall.id = :hallId) " +
           "AND (cast(:startOfDay as timestamp) IS NULL OR b.startTime >= :startOfDay) " +
           "AND (cast(:endOfDay as timestamp) IS NULL OR b.startTime < :endOfDay) " +
           "ORDER BY b.startTime ASC")
    List<Booking> findFiltered(
            @Param("hallId") Long hallId,
            @Param("startOfDay") Instant startOfDay,
            @Param("endOfDay") Instant endOfDay
    );
}
