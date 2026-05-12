<!-- Docker Deployment: MQTT Configuration -->

# 🐳 MQTT Integration in Docker

## For Containerized Deployment

Your project uses Docker. Here's how to ensure MQTT works in containers.

---

## Configuration

### 1. Update `.env.local` (Development)
```bash
MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
MQTT_TOPIC=return/tracker/+/location
```

### 2. Update Docker Compose Environment

**File**: `docker-compose.app.yml`

**Change**:
```yaml
services:
  return-web:
    build: .
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NODE_ENV: production
      # ADD THESE:
      MQTT_BROKER_URL: wss://broker.hivemq.com:8884/mqtt
      MQTT_TOPIC: return/tracker/+/location
    volumes:
      - ./src/data:/app/src/data
```

### 3. Update Dockerfile

**File**: `Dockerfile`

**Verify these lines exist** (they should already):
```dockerfile
# MQTT library installation
RUN npm install mqtt
```

If not, add `mqtt` to `package.json` dependencies:
```bash
npm install mqtt
```

---

## Production Deployment

### Option 1: Environment Variables (Recommended)

When deploying to production (Vercel, Render, AWS, etc.), set:
- `MQTT_BROKER_URL`: Your broker URL
- `MQTT_TOPIC`: `return/tracker/+/location`
- `MQTT_USERNAME`: (if required)
- `MQTT_PASSWORD`: (if required)

### Option 2: Secrets Management

For sensitive brokers requiring authentication:

```yaml
# docker-compose.app.yml
services:
  return-web:
    environment:
      MQTT_BROKER_URL: ${MQTT_BROKER_URL}
      MQTT_USERNAME: ${MQTT_USERNAME}  # Use secrets manager
      MQTT_PASSWORD: ${MQTT_PASSWORD}  # Use secrets manager
```

Then deploy with:
```bash
docker-compose up --env-file .env.production
```

---

## Network Access

### Local Development (Docker)

If running containers locally:

```bash
# HiveMQ public broker - works from everywhere
MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt

# Local broker inside Docker (if using docker-compose with mqtt service)
MQTT_BROKER_URL=mqtt://mqtt-broker:1883
```

### Production Server

#### Public Broker (HiveMQ) - Simplest
```bash
MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
# ✓ Works from anywhere
# ✓ No authentication needed
# ✗ Unauthenticated (anyone can see your data)
```

#### Private Broker - More Secure
```bash
# If you host your own or use enterprise broker
MQTT_BROKER_URL=mqtt://your-broker.com:1883
MQTT_USERNAME=your_user
MQTT_PASSWORD=your_pass

# Or with TLS:
MQTT_BROKER_URL=mqtts://your-broker.com:8883
```

---

## Container Networking

### Multi-Container Setup

If A9G devices connect to your private broker inside Docker:

```yaml
version: '3.8'

services:
  return-web:
    build: .
    ports:
      - "3000:3000"
    environment:
      MQTT_BROKER_URL: mqtt://mqtt-broker:1883
    depends_on:
      - mqtt-broker
    networks:
      - return-network

  mqtt-broker:
    image: eclipse-mosquitto:latest
    ports:
      - "1883:1883"      # MQTT
      - "8883:8883"      # MQTT/TLS
      - "9001:9001"      # WebSocket
    volumes:
      - mosquitto-data:/mosquitto/data
      - mosquitto-logs:/mosquitto/log
    networks:
      - return-network

  postgres:
    # ... existing postgres service

volumes:
  mosquitto-data:
  mosquitto-logs:

networks:
  return-network:
    driver: bridge
```

### A9G → Private Broker (External Network)

If A9G is outside Docker network but can reach your server:

```yaml
services:
  return-web:
    environment:
      # Use container IP or hostname accessible from outside
      MQTT_BROKER_URL: mqtt://your-server-ip:1883
```

**Note**: Your A9G device needs network access to the broker (firewall rules, port forwarding, etc.)

---

## Health Checks

### Monitor MQTT Connection

Add to Dockerfile or docker-compose:

```yaml
services:
  return-web:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/tracker/stream"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### Check Logs

```bash
# View container logs
docker logs return-web | grep MQTT

# Expected output:
# [MQTT] Connected ✓
# [MQTT] Subscribed to return/tracker/+/location
# [MQTT] Message received: {...}
```

---

## Troubleshooting in Docker

### Issue: Can't connect to HiveMQ

```bash
# Check container can reach broker
docker exec return-web curl -v wss://broker.hivemq.com:8884/mqtt

# Or use DNS check
docker exec return-web nslookup broker.hivemq.com
```

### Issue: Environment variable not set

```bash
# Verify env vars are passed
docker exec return-web env | grep MQTT

# If empty, check docker-compose or deployment config
```

### Issue: MQTT events not reaching frontend

```bash
# Check SSE stream is working
docker exec return-web curl http://localhost:3000/api/tracker/stream

# Should output heartbeat or event data
```

### Issue: Device not found after MQTT message

```bash
# Check mqtt-bridge is subscribed
docker logs return-web | grep "MQTT"

# Should show:
# [MQTT] Connected ✓
# [MQTT] Subscribed to return/tracker/+/location
```

---

## Production Checklist

- [ ] MQTT_BROKER_URL set in environment variables
- [ ] MQTT broker is accessible from container
- [ ] Firewall rules allow MQTT port (1883, 8883, or 8884)
- [ ] TLS certificates valid (if using mqtts://)
- [ ] Container has `mqtt` npm package (check package.json)
- [ ] Environment loaded before app starts
- [ ] Logs show `[MQTT] Connected ✓`
- [ ] Test MQTT message received by app

---

## Scaling (Multiple Replicas)

If running multiple `return-web` containers:

- ✓ All connect to same MQTT broker → OK
- ✓ Each keeps its own EventSource stream → Multiple listeners per device → OK
- ✗ Database: Ensure GpsLocation writes are serialized (Prisma handles this)

Each container's mqtt-bridge runs independently but connects to the same broker topic. The first to process a message updates the database. Other containers ignore already-processed events. **No conflicts.**

---

## Examples

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  return-web:
    build: .
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NODE_ENV: development
      DATABASE_URL: postgresql://user:pass@postgres:5432/return
      MQTT_BROKER_URL: wss://broker.hivemq.com:8884/mqtt
      MQTT_TOPIC: return/tracker/+/location
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: return
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

### Dockerfile (Verification)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

# mqtt should already be in package.json
RUN npm ls mqtt

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

---

## Security Notes

### HiveMQ Public Broker
- ✓ No setup needed
- ✓ Works from anywhere
- ✗ No authentication
- ✗ Data visible to anyone on the topic

### Private MQTT Broker
- ✓ Requires username/password
- ✓ Data encrypted (with TLS)
- ✗ Requires infrastructure
- ✗ Must be accessible from your server

### Recommended for Production
1. **Authentication**: Use MQTT_USERNAME + MQTT_PASSWORD
2. **TLS/SSL**: Use `mqtts://` or `wss://` protocol
3. **Private Network**: Run broker inside Docker/VPC
4. **Rate Limiting**: mqtt-bridge already has re-connection logic
5. **Logging**: Check server logs for auth failures

---

## Questions?

1. HiveMQ works, but want more security? → Use private MQTT broker
2. Container can't reach broker? → Check firewall, use VPN if needed
3. Multiple servers need tracking? → Use shared MQTT broker (not local)
4. Need high-reliability? → Use enterprise MQTT broker (Azure IoT Hub, AWS IoT Core)
