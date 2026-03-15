# Zenith-Shop: High-Concurrency Event-Driven Backend

This project demonstrates an industry-standard backend architecture designed to handle massive traffic spikes without crashing the primary database.

## 🏗️ Architecture Overview



Unlike traditional CRUD applications, this system separates the **Request Phase** from the **Persistence Phase**:

1.  **Fast Validation (Redis):** Every request is validated against an in-memory Redis cache. Stock management happens here atomically to prevent "Double Selling."
2.  **Asynchronous Hand-off (Kafka):** Once validated, the order is pushed into a Kafka topic. The user receives a `202 Accepted` response immediately ($<50ms$).
3.  **Resilient Persistence (MongoDB):** Background workers consume messages from Kafka and perform the "heavy" write operations to the main database and trigger external APIs (Emails/Payments).

## 📂 Final Directory Check

```text
├── docker-compose.yml
├── package.json
├── shared/
│   └── kafka-client.js
├── producer/
│   └── server.js
├── workers/
│   └── order-worker.js
└── .gitIgnore
└── README.md
```
## 🚀 Key Features

* **Write-Behind Caching:** Updates the cache first and the database later to ensure low latency.
* **Decoupled Services:** If the MongoDB or Email service goes down, the API remains functional. Kafka buffers the messages until the services recover.
* **Atomic Concurrency:** Uses Redis `DECRBY` to handle race conditions during flash sales.
* **Horizontal Scalability:** You can spin up 10 `order-workers` to handle a massive queue backlog without affecting the API's performance.

## 🛠️ Tech Stack

* **Runtime:** Node.js (Express)
* **Cache:** Redis (In-memory)
* **Message Broker:** Apache Kafka
* **Main Database:** MongoDB
* **Mailing:** Nodemailer
* **Containerization:** Docker & Docker-Compose

## 🚦 Getting Started

### 1. Start the Infrastructure
Ensure Docker is running and execute:
```bash
docker-compose up -d

```

### 2. Install Dependencies

```bash
npm install

```

### 3. Run the Application

You need two terminals:

* **Terminal 1 (The API):** `node producer/server.js`
* **Terminal 2 (The Worker):** `node workers/order-worker.js`

### 4. Test the Flow

Send a POST request to `http://localhost:3000/api/checkout`:

```json
{
    "userId": "user_01",
    "productId": "laptop",
    "qty": 1
}

```

## 📉 Failure Handling (Self-Healing)

Try stopping the `order-worker.js` and placing 5 orders. You will see the API succeed. Once you restart the worker, it will automatically "drain" the Kafka queue and update MongoDB.

---
