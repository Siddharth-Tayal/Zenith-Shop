import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pgClient } from '../../../packages/database/index.js';
import { RedisUtil } from '../../../packages/shared/redis.js';
import { KafkaUtil } from '../../../packages/shared/kafka.js';

export const register = async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword)
        // 1. Primary Write (Postgres)
        const user = await pgClient.user.create({
            data: { email, password: hashedPassword }
        });

        // 2. Event Emission (Kafka) - For analytics, welcome emails, or search indexing
        await KafkaUtil.emit('user.events', { 
            type: 'USER_REGISTERED', 
            userId: user.id, 
            email 
        });

        res.status(201).json({ message: "User created", userId: user.id });
    } catch (error) {
        res.status(400).json({ error: "Registration failed." });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    // 1. Check Postgres for credentials
    const user = await pgClient.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        // 2. SCALE STEP: Cache the session in Redis
        // This prevents the Gateway from hitting the DB on every request
        await RedisUtil.setCache(`session:${user.id}`, { active: true, email }, 86400);

        // 3. Audit Log (Kafka) - Record the login without slowing down the response
        await KafkaUtil.emit('user.events', { type: 'USER_LOGIN', userId: user.id });

        res.json({ token });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
};