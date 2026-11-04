package com.slotlock.hall;

import com.slotlock.hall.dto.HallResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class HallService {

    private final HallRepository hallRepository;

    public HallService(HallRepository hallRepository) {
        this.hallRepository = hallRepository;
    }

    public List<HallResponse> getAllHalls() {
        return hallRepository.findAll().stream()
                .map(hall -> new HallResponse(hall.getId(), hall.getName(), hall.getCapacity()))
                .toList();
    }
}
