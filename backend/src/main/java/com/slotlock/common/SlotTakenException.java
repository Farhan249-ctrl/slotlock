package com.slotlock.common;

public class SlotTakenException extends RuntimeException {
    public SlotTakenException() {
        super("SLOT_TAKEN");
    }
}
