package com.slotlock.auth.dto;

import com.slotlock.user.Role;
import com.slotlock.user.User;

public record UserSummaryResponse(
        Long id,
        String name,
        String email,
        Role role
) {
    public static UserSummaryResponse fromEntity(User user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole()
        );
    }
}
