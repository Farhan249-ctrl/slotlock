package com.slotlock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.slotlock.booking.BookingRepository;
import com.slotlock.booking.dto.CreateBookingRequest;
import com.slotlock.hall.Hall;
import com.slotlock.hall.HallRepository;
import com.slotlock.security.JwtService;
import com.slotlock.user.Role;
import com.slotlock.user.User;
import com.slotlock.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.HttpStatusCodeException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class BookingConcurrencyIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private HallRepository hallRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${app.admin.email:admin@slotlock.local}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    private String studentToken;
    private String adminToken;
    private Hall testHall;

    @BeforeEach
    void setUp() {
        // Do not throw exceptions on 4xx/5xx HTTP responses so we can assert on response entities directly
        restTemplate.getRestTemplate().setErrorHandler(new DefaultResponseErrorHandler() {
            @Override
            public boolean hasError(HttpStatusCode statusCode) {
                return false;
            }
        });

        bookingRepository.deleteAll();

        // Setup student user
        User student = userRepository.findByEmail("student@test.com")
                .orElseGet(() -> userRepository.save(new User(
                        "student@test.com",
                        passwordEncoder.encode("Password123!"),
                        "Test Student",
                        Role.STUDENT
                )));
        studentToken = jwtService.generateToken(student);

        // Setup admin user
        User admin = userRepository.findByEmail(adminEmail)
                .orElseGet(() -> userRepository.save(new User(
                        adminEmail,
                        passwordEncoder.encode(adminPassword),
                        "System Admin",
                        Role.ADMIN
                )));
        adminToken = jwtService.generateToken(admin);

        // Fetch a seeded hall
        testHall = hallRepository.findAll().stream().findFirst().orElseThrow();
    }

    @Test
    @DisplayName("50 concurrent threads requesting the same hall and slot: exactly 1 201 and 49 409s")
    void testConcurrentBookings50Threads() throws Exception {
        final int THREAD_COUNT = 50;
        Instant startTime = Instant.now().plus(5, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
        Instant endTime = startTime.plus(1, ChronoUnit.HOURS);

        CreateBookingRequest request = new CreateBookingRequest(
                testHall.getId(),
                "Concurrent Test Booking",
                startTime,
                endTime
        );

        CountDownLatch readyLatch = new CountDownLatch(THREAD_COUNT);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(THREAD_COUNT);

        List<ResponseEntity<String>> responses = Collections.synchronizedList(new ArrayList<>());
        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);

        for (int i = 0; i < THREAD_COUNT; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    headers.setBearerAuth(studentToken);
                    HttpEntity<CreateBookingRequest> entity = new HttpEntity<>(request, headers);

                    ResponseEntity<String> response = restTemplate.postForEntity(
                            "/api/bookings",
                            entity,
                            String.class
                    );
                    responses.add(response);
                } catch (HttpStatusCodeException ex) {
                    responses.add(ResponseEntity.status(ex.getStatusCode()).body(ex.getResponseBodyAsString()));
                } catch (Exception e) {
                    System.err.println("Thread error: " + e.getMessage());
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // Wait for all threads to be ready, then fire them simultaneously
        assertTrue(readyLatch.await(10, TimeUnit.SECONDS), "Threads timed out while preparing");
        startLatch.countDown();

        assertTrue(doneLatch.await(60, TimeUnit.SECONDS), "Threads timed out during execution");
        executor.shutdown();

        long count201 = responses.stream().filter(r -> r.getStatusCode().value() == 201).count();
        long count409 = responses.stream().filter(r -> r.getStatusCode().value() == 409).count();
        long otherCount = responses.stream().filter(r -> r.getStatusCode().value() != 201 && r.getStatusCode().value() != 409).count();

        System.out.println("=== 50-THREAD CONCURRENCY PROOF RESULTS ===");
        System.out.println("Total requests: " + responses.size());
        System.out.println("HTTP 201 (CREATED): " + count201);
        System.out.println("HTTP 409 (CONFLICT): " + count409);
        System.out.println("Other (neither 201 nor 409): " + otherCount);
        System.out.println("==========================================");

        assertEquals(0, otherCount, "Any response that is neither 201 nor 409 must be 0");
        assertEquals(1, count201, "Exactly one thread must succeed with HTTP 201");
        assertEquals(49, count409, "Exactly 49 threads must fail with HTTP 409");

        // Verify conflict response payload
        for (ResponseEntity<String> resp : responses) {
            if (resp.getStatusCode().value() == 409) {
                assertTrue(resp.getBody().contains("SLOT_TAKEN"),
                        "Conflict body must contain SLOT_TAKEN: " + resp.getBody());
            }
        }
    }

    @Test
    @DisplayName("Back-to-back slots (10-11 and 11-12) must both succeed")
    void testBackToBackSlots() {
        Instant slot1Start = Instant.now().plus(10, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
        Instant slot1End = slot1Start.plus(1, ChronoUnit.HOURS);
        Instant slot2Start = slot1End;
        Instant slot2End = slot2Start.plus(1, ChronoUnit.HOURS);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(studentToken);

        // Booking 1: 10:00 to 11:00
        CreateBookingRequest req1 = new CreateBookingRequest(testHall.getId(), "Slot 1 (10-11)", slot1Start, slot1End);
        ResponseEntity<String> res1 = restTemplate.postForEntity("/api/bookings", new HttpEntity<>(req1, headers), String.class);
        assertEquals(201, res1.getStatusCode().value(), "Slot 1 must be created successfully");

        // Booking 2: 11:00 to 12:00
        CreateBookingRequest req2 = new CreateBookingRequest(testHall.getId(), "Slot 2 (11-12)", slot2Start, slot2End);
        ResponseEntity<String> res2 = restTemplate.postForEntity("/api/bookings", new HttpEntity<>(req2, headers), String.class);
        assertEquals(201, res2.getStatusCode().value(), "Back-to-back Slot 2 must be created successfully");
    }

    @Test
    @DisplayName("A REJECTED booking frees the slot for another booking")
    void testRejectedBookingFreesSlot() throws Exception {
        Instant startTime = Instant.now().plus(15, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
        Instant endTime = startTime.plus(1, ChronoUnit.HOURS);

        HttpHeaders studentHeaders = new HttpHeaders();
        studentHeaders.setContentType(MediaType.APPLICATION_JSON);
        studentHeaders.setBearerAuth(studentToken);

        HttpHeaders adminHeaders = new HttpHeaders();
        adminHeaders.setContentType(MediaType.APPLICATION_JSON);
        adminHeaders.setBearerAuth(adminToken);

        // 1. First student booking: succeeds with 201
        CreateBookingRequest initialReq = new CreateBookingRequest(testHall.getId(), "Initial Booking", startTime, endTime);
        ResponseEntity<String> res1 = restTemplate.postForEntity("/api/bookings", new HttpEntity<>(initialReq, studentHeaders), String.class);
        assertEquals(201, res1.getStatusCode().value());

        JsonNode jsonNode = objectMapper.readTree(res1.getBody());
        Long bookingId = jsonNode.get("id").asLong();
        assertNotNull(bookingId);

        // 2. Second booking for the exact same slot: rejected with 409
        CreateBookingRequest conflictReq = new CreateBookingRequest(testHall.getId(), "Conflicting Booking", startTime, endTime);
        ResponseEntity<String> res2 = restTemplate.postForEntity("/api/bookings", new HttpEntity<>(conflictReq, studentHeaders), String.class);
        assertEquals(409, res2.getStatusCode().value());
        assertTrue(res2.getBody().contains("SLOT_TAKEN"));

        // 3. Admin rejects the first booking
        String updateJson = "{\"status\":\"REJECTED\"}";
        HttpEntity<String> patchEntity = new HttpEntity<>(updateJson, adminHeaders);
        ResponseEntity<String> patchRes = restTemplate.exchange(
                "/api/bookings/" + bookingId + "/status",
                HttpMethod.PATCH,
                patchEntity,
                String.class
        );
        assertEquals(200, patchRes.getStatusCode().value());

        // 4. Retry the second booking for the now-freed slot: must succeed with 201
        ResponseEntity<String> res3 = restTemplate.postForEntity("/api/bookings", new HttpEntity<>(conflictReq, studentHeaders), String.class);
        assertEquals(201, res3.getStatusCode().value(), "Slot freed by rejection must now succeed");
    }

    @Test
    @DisplayName("A booking with end_time before start_time must return a 4xx (validation), not 500 and not 409")
    void testBookingWithEndTimeBeforeStartTimeReturns4xx() {
        Instant startTime = Instant.now().plus(20, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
        Instant endTime = startTime.minus(1, ChronoUnit.HOURS);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(studentToken);

        CreateBookingRequest invalidReq = new CreateBookingRequest(
                testHall.getId(),
                "Invalid End Time Before Start Time",
                startTime,
                endTime
        );

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/bookings",
                new HttpEntity<>(invalidReq, headers),
                String.class
        );

        System.out.println("=== END_TIME BEFORE START_TIME VALIDATION TEST ===");
        System.out.println("HTTP Status: " + response.getStatusCode().value());
        System.out.println("Response Body: " + response.getBody());
        System.out.println("=================================================");

        assertTrue(response.getStatusCode().is4xxClientError(), "Status code must be 4xx client error (validation)");
        assertEquals(400, response.getStatusCode().value(), "Status code must be 400 BAD_REQUEST");
        assertTrue(response.getStatusCode().value() != 500, "Status code must not be 500");
        assertTrue(response.getStatusCode().value() != 409, "Status code must not be 409");
    }
}
