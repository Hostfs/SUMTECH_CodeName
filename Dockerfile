# 빌드는 이 파일 안에서 끝내고, 컨테이너 시작 명령은 서버 실행만 한다(마이그레이션·시드는 앱이 기동하며 수행).

FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /build
COPY backend/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY backend/src ./src
RUN mvn -B -q -DskipTests package && cp target/otgyeol-*.jar /build/app.jar

FROM eclipse-temurin:21-jre
ARG RELEASE_ID=dev
ENV RELEASE_ID=${RELEASE_ID} \
    TZ=Asia/Seoul \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:TieredStopAtLevel=1"
WORKDIR /app
COPY --from=backend /build/app.jar app.jar
EXPOSE 3000
CMD ["java", "-jar", "/app/app.jar"]
