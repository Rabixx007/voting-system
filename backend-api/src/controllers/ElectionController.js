import Election from '../models/Election.js';

class ElectionController {
  // Get all elections
  static async getAllElections(req, res) {
    try {
      const elections = await Election.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.json({ success: true, data: elections });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get election by ID
  static async getElection(req, res) {
    try {
      const election = await Election.findByPk(req.params.id);
      if (!election) {
        return res.status(404).json({ success: false, error: 'Election not found' });
      }
      res.json({ success: true, data: election });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get election by contract address
  static async getElectionByAddress(req, res) {
    try {
      const election = await Election.findOne({
        where: { contractAddress: req.params.address }
      });
      if (!election) {
        return res.status(404).json({ success: false, error: 'Election not found' });
      }
      res.json({ success: true, data: election });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create election metadata (called after blockchain deployment)
  static async createElection(req, res) {
    try {
      const { contractAddress, title, description, category, startTime, endTime, imageUrl, creatorAddress } = req.body;
      
      // Check if election already exists
      const existing = await Election.findOne({ where: { contractAddress } });
      if (existing) {
        return res.status(409).json({ success: false, error: 'Election already exists' });
      }

      const election = await Election.create({
        contractAddress,
        title,
        description,
        category: category || 'general',
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        imageUrl: imageUrl || null,
        creatorAddress
      });

      res.status(201).json({ success: true, data: election });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Update election metadata
  static async updateElection(req, res) {
    try {
      const election = await Election.findByPk(req.params.id);
      if (!election) {
        return res.status(404).json({ success: false, error: 'Election not found' });
      }

      await election.update(req.body);
      res.json({ success: true, data: election });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete election metadata
  static async deleteElection(req, res) {
    try {
      const election = await Election.findByPk(req.params.id);
      if (!election) {
        return res.status(404).json({ success: false, error: 'Election not found' });
      }

      await election.destroy();
      res.json({ success: true, message: 'Election deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default ElectionController;
