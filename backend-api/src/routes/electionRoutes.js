import express from 'express';
import ElectionController from '../controllers/ElectionController.js';

const router = express.Router();

// Public routes
router.get('/', ElectionController.getAllElections);
router.get('/:id', ElectionController.getElection);
router.get('/address/:address', ElectionController.getElectionByAddress);

// Protected routes (we'll add auth later)
router.post('/', ElectionController.createElection);
router.put('/:id', ElectionController.updateElection);
router.delete('/:id', ElectionController.deleteElection);

export default router;
