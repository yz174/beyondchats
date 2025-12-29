import express from 'express';
import Article from '../models/Article.js';

const router = express.Router();

// GET all articles
router.get('/', async (req, res) => {
  try {
    const { isUpdated, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (isUpdated !== undefined) {
      filter.isUpdated = isUpdated === 'true';
    }

    const skip = (page - 1) * limit;
    
    const articles = await Article.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Article.countDocuments(filter);
    
    res.json({
      success: true,
      data: articles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching articles',
      error: error.message,
    });
  }
});

// GET single article by ID
router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found',
      });
    }
    
    res.json({
      success: true,
      data: article,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching article',
      error: error.message,
    });
  }
});

// POST create new article
router.post('/', async (req, res) => {
  try {
    const article = new Article(req.body);
    await article.save();
    
    res.status(201).json({
      success: true,
      data: article,
      message: 'Article created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating article',
      error: error.message,
    });
  }
});

// PUT update article by ID
router.put('/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found',
      });
    }

    // Store original content before updating
    if (!article.originalContent) {
      article.originalContent = article.content;
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== '__v') {
        article[key] = req.body[key];
      }
    });

    await article.save();
    
    res.json({
      success: true,
      data: article,
      message: 'Article updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating article',
      error: error.message,
    });
  }
});

// DELETE article by ID
router.delete('/:id', async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Article deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting article',
      error: error.message,
    });
  }
});

export default router;
