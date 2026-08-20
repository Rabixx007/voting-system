import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { validationResult } from 'express-validator';

class AuthController {
    // Register a new user
    static async register(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { walletAddress, username, email, password } = req.body;

            const existing = await User.findOne({
                where: {
                    [Op.or]: [{ walletAddress }, { username }, { email }]
                }
            });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'User with this wallet, username, or email already exists'
                });
            }

            const user = await User.create({
                walletAddress,
                username,
                email,
                password,
                isAdmin: false,
            });

            const token = jwt.sign(
                { id: user.id, walletAddress: user.walletAddress, isAdmin: user.isAdmin },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );

            res.status(201).json({
                success: true,
                data: {
                    id: user.id,
                    walletAddress: user.walletAddress,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    token,
                }
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Login user
    static async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { email, password } = req.body;

            const user = await User.findOne({ where: { email } });
            if (!user) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            const isMatch = user.password ? await user.comparePassword(password) : false;
            if (!isMatch) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, walletAddress: user.walletAddress, isAdmin: user.isAdmin },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                data: {
                    id: user.id,
                    walletAddress: user.walletAddress,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    token,
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Get current user profile
    static async getProfile(req, res) {
        try {
            const user = await User.findByPk(req.user.id, {
                attributes: { exclude: ['password'] }
            });
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            res.json({ success: true, data: user });
        } catch (error) {
            console.error('Profile error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

export default AuthController;
