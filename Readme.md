
# 🌌 Zenith-Shop: Distributed Event-Driven Ecosystem

Zenith-Shop is a high-performance, microservices-based e-commerce backend built for **extreme scalability** and **data consistency**. It utilizes a "Mixed-Persistence" strategy, leveraging the strengths of different database engines for specific business domains.


## 🏗️ System Architecture

The system is decoupled into specialized services that communicate via a central **API Gateway** and an **Apache Kafka** event bus:

1.  **API Gateway (Port 5000):** The entry point. Handles **Rate Limiting (Redis)**, **Authentication (JWT + Redis Session)**, and Request Proxying.
2.  **Auth Service (Port 3001):** Manages user identity using **PostgreSQL** for strong relational integrity.
3.  **Product Service (Port 3002):** Manages the catalog using **MongoDB**. Implements a **Cache-Aside** pattern with **Redis** for sub-5ms read latency.
4.  **Order Service (Port 3003):** Handles complex transactions, stock synchronization, and event emission.

---

## 📂 Project Structure

```text
├── packages/              # Shared internal library
│   ├── database/          # Multi-DB clients (Prisma + MongoDB/Postgres)
│   └── shared/            # Reusable Kafka & Redis utilities
├── services/              # Independent Microservices
│   ├── api-gateway/       # Security & Routing
│   ├── auth-services/     # Postgres-backed Identity
│   └── product-services/  # Mongo-backed Catalog + Kafka Workers
├── scripts/               # Automation & Testing suite
├── docker-compose.yml     # Infrastructure (Kafka, Zookeeper, Redis, DBs)
└── Makefile               # Single-command orchestration
```

---

## 🚀 Key Engineering Patterns

* **Mixed-Persistence Strategy:** Uses **PostgreSQL** for relational user data and **MongoDB (Replica Set)** for flexible, high-volume product catalogs.
* **Write-Through & Cache-Warming:** Products are automatically cached in Redis upon creation, ensuring "Instant-On" performance for users.
* **Eventual Consistency:** When an order is placed, a **Kafka Worker** asynchronously synchronizes stock levels across the MongoDB catalog.
* **Infrastructure-Aware Bootstrapping:** Services verify the health of Redis, Kafka, and Databases before opening ports to prevent "Partial Boot" failures.
* **Atomic Rate Limiting:** Gateway uses Redis atomic increments to protect the ecosystem from DDoS and brute-force attacks.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Runtime** | Node.js (ES Modules) |
| **Gateway** | Express + http-proxy-middleware |
| **Databases** | PostgreSQL (Prisma), MongoDB (Prisma Replica Set) |
| **Caching** | Redis (ioredis) |
| **Messaging** | Apache Kafka (kafkajs) |
| **DevOps** | Docker, Docker-Compose, Makefile |

---

## 🚦 Getting Started

### 1. Spin up Infrastructure
Zenith-Shop requires a full suite of distributed tools. Use the Makefile for a one-click setup:
```bash
make dev
```
This command starts **Postgres, MongoDB (RS), Redis, Kafka, Zookeeper,** and all **Microservices** simultaneously.

### 2. Initialize the MongoDB Replica Set
Prisma requires MongoDB to run as a Replica Set for transaction support. If it's your first time running the project:
```bash
docker exec -it zenith-shop_mongodb_1 mongosh --eval "rs.initiate()"
```

### 3. Database Management
Access your data visually via Prisma Studio:
* **Postgres Studio:** [http://localhost:5555](http://localhost:5555)
* **MongoDB Studio:** [http://localhost:5556](http://localhost:5556)

---

## 🧪 Testing the Ecosystem

We provide specialized bash scripts to test cross-service communication:

**Auth Flow Test:**
```bash
./scripts/test-auth.sh
```

**Product & Cache-Sync Test:**
```bash
./scripts/test-products.sh
```
*This script verifies the Product Service creates data in Mongo, warms the Redis cache, and invalidates the cache correctly upon updates.*

---

## 📈 Monitoring & Scalability

* **Horizontal Scaling:** Each service in `/services` can be containerized and scaled to $N$ instances.
* **Fault Tolerance:** If the Product Service goes down, the **API Gateway** returns a `504 Service Unreachable` while the rest of the system (Auth/Orders) remains operational.
* **Kafka Buffering:** During high load, Kafka holds messages in the `order.events` topic, allowing workers to process them at their own pace without crashing the databases.

---
