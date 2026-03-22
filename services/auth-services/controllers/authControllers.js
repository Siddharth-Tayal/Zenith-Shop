import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pgClient } from '../../../packages/database/index.js';
import { RedisUtil } from '../../../packages/shared/redis.js';
import { KafkaUtil } from '../../../packages/shared/kafka.js';

export const register = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email.includes('@') || password.length < 6) {
            return res.status(400).json({ error: "Invalid email or weak password" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword)
        // 1. Primary Write (Postgres)
        const user = await pgClient.user.create({
            data: { email, password: hashedPassword }
        });

        // 2. Event Emission (Kafka)
        KafkaUtil.emit('user.events', { 
            type: 'USER_REGISTERED', 
            userId: user.id, 
            email 
        }).catch(err => console.error("Kafka Event Failed:", err));

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
        await RedisUtil.setCache(`session:${user.id}`, { 
            active: true, 
            email: user.email,
            role: user.role || 'USER' 
        }, 86400);
        console.error("token",token)
        // 3. Audit Log (Kafka) - Record the login without slowing down the response
        await KafkaUtil.emit('user.events', { type: 'USER_LOGIN', userId: user.id });

        res.json({ token });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
};

export const validate = async(req , res)=>{
  // 1. Get token from header (NGINX passes this along)
    const token = req.headers['authorization']?.split(' ')[1];
    console.log("Hello" , token)
    if (!token) {
        return res.status(401).send('No token provided');
    }

    try {
        // 2. Verify JWT (Same as your old gateway logic)
        console.log("gello ")
        const decoded =  jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded , "decoded token")
        // 3. Check Redis Session
        const session = await RedisUtil.getCache(`session:${decoded.id}`);
        console.warn(session)
        if (!session) {
            return res.status(401).send('Session expired');
        }

        // SUCCESS: Tell NGINX this user is allowed through
        // We can pass the user ID back to NGINX via a header
        res.set('X-User-Id', decoded.id);
        return res.status(200).send(); 
    } catch (err) {
        return res.status(401).send('Invalid token');
    }
};