import express from 'express';
import { body } from 'express-validator';
import AuthController from '../controllers/AuthController.js';
import { authenticate } from '../middleware/auth.js';


const router = express.Router();

// Validation rules
const registerValidation = [
  body('walletAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address'),
  body('username').isString().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

// Routes
router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);
router.get('/profile', authenticate, AuthController.getProfile);

export default router;
