# Stage 1: Build
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy pom.xml first for layer caching
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy src and build the application jar
COPY src ./src
RUN mvn package -DskipTests -B

# Stage 2: Runtime
FROM eclipse-temurin:21.0.6_7-jre-alpine
WORKDIR /app

# Install curl for healthcheck and configure non-root user
RUN apk add --no-cache curl \
    && addgroup -S appgroup \
    && adduser -S appuser -G appgroup

# Copy only the built jar
COPY --from=build /app/target/slotlock-backend-*.jar app.jar
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=25s \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-Duser.timezone=UTC", "-jar", "app.jar"]
