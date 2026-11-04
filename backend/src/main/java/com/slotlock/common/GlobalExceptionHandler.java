package com.slotlock.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLException;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErrorResponse> handleDataAccessException(DataAccessException ex) {
        String sqlState = extractSqlState(ex);
        log.warn("Database exception [sqlState={}]: {}", sqlState, ex.getMessage());
        if ("23P01".equals(sqlState) || "40P01".equals(sqlState)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("SLOT_TAKEN"));
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse("INTERNAL_SERVER_ERROR"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException ex) {
        String errorMsg = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(errorMsg));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse("INVALID_CREDENTIALS"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse("FORBIDDEN"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        String sqlState = extractSqlState(ex);
        if ("23P01".equals(sqlState) || "40P01".equals(sqlState)) {
            log.warn("Database exception wrapped in general exception [sqlState={}]: {}", sqlState, ex.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("SLOT_TAKEN"));
        }
        log.error("Unhandled exception: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse("INTERNAL_SERVER_ERROR"));
    }

    private String extractSqlState(Throwable ex) {
        Throwable current = ex;
        while (current != null) {
            if (current instanceof SQLException sqlEx) {
                String state = sqlEx.getSQLState();
                if (state != null) {
                    return state;
                }
                SQLException next = sqlEx.getNextException();
                while (next != null) {
                    if (next.getSQLState() != null) {
                        return next.getSQLState();
                    }
                    next = next.getNextException();
                }
            }
            current = current.getCause();
        }
        return null;
    }
}
