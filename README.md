# SlotLock

SlotLock is a conflict-free university hall and slot booking system built with Spring Boot, PostgreSQL, and React.

## Run locally

1. **Start PostgreSQL database**:
   ```powershell
   docker compose -f docker-compose.dev.yml up -d
   ```

2. **Start Spring Boot Backend**:
   Configure `.env` (from `.env.example`), then run:
   ```powershell
   cd backend
   .\mvnw.cmd spring-boot:run
   ```
   Backend listens on `http://localhost:8080`.

3. **Start Frontend**:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`.
