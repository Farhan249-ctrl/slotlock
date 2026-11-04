package com.slotlock.auth.dto;

import com.slotlock.user.Role;

public record AuthResponse(
        String token,
        String type,
        Long userId,
        String email,
        String name,
        Role role
) {
    public static AuthResponse of(String token, Long userId, String email, String name, Role role) {
        return new AuthResponse(token, "Bearer", userId, email, name, role);
    }
}
