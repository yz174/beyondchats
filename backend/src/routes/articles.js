import express from 'express';
import Article from '../models/Article.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    
    console.log(`📊 GET /articles - Filter:`, filter, `Found: ${articles.length} articles, Total: ${total}`);
    
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
    console.error('❌ Error fetching articles:', error);
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

// POST trigger scraping
router.post('/scrape', async (req, res) => {
  try {
    console.log('Scrape endpoint called');
    
    // Import the scraping function
    const { default: scrapeBeyondChatsArticles } = await import('../scripts/scrape-beyondchats.js');
    
    // Send immediate response that scraping has started
    res.json({
      success: true,
      message: 'Scraping started. Articles will appear as they are scraped.',
    });

    // Run scraping in background without awaiting
    scrapeBeyondChatsArticles().catch(error => {
      console.error('Background scraping error:', error.message);
    });

  } catch (error) {
    console.error('Scrape endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting scraper',
      error: error.message,
    });
  }
});

// POST optimize single article
router.post('/:id/optimize', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found',
      });
    }

    if (article.isUpdated) {
      return res.status(400).json({
        success: false,
        message: 'Article is already optimized',
      });
    }

    // Import optimization functions
    const { default: puppeteer } = await import('puppeteer-extra');
    const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
    const axios = (await import('axios')).default;
    
    puppeteer.use(StealthPlugin());

    // Send initial response
    res.json({
      success: true,
      message: 'Optimization started. Please check back in a few minutes.',
      articleId: article._id,
    });

    // Run optimization in background
    setTimeout(async () => {
      try {
        await optimizeSingleArticle(article, puppeteer, axios);
      } catch (error) {
        console.error('Background optimization error:', error);
      }
    }, 0);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error starting optimization',
      error: error.message,
    });
  }
});

// Helper function to optimize a single article
async function optimizeSingleArticle(article, puppeteer, axios) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    console.log(`Optimizing article: ${article.title}`);

    // Search Google for similar articles
    const searchResults = await searchGoogleForArticle(article.title, puppeteer);
    
    if (searchResults.length === 0) {
      console.log('No search results found');
      return;
    }

    // Scrape reference articles
    const referenceArticles = [];
    for (const result of searchResults.slice(0, 2)) {
      const content = await scrapeArticleContent(result.url, puppeteer);
      if (content && content.length > 100) {
        referenceArticles.push({
          title: result.title,
          url: result.url,
          content: content,
        });
      }
    }

    if (referenceArticles.length === 0) {
      console.log('Could not scrape reference articles');
      return;
    }

    // Optimize with Gemini
    const prompt = `You are an expert content writer and SEO specialist. Your task is to rewrite and optimize the following article based on the style and formatting of top-ranking articles on Google.

ORIGINAL ARTICLE:
Title: ${article.title}
Content:
${article.content}

REFERENCE ARTICLES (Top Google Results):
${referenceArticles.map((ref, idx) => `
Reference ${idx + 1}: ${ref.title}
URL: ${ref.url}
Content Preview:
${ref.content.slice(0, 2000)}
---
`).join('\n')}

INSTRUCTIONS:
1. Rewrite the original article to match the style, tone, and formatting of the reference articles
2. Improve readability, structure, and SEO optimization
3. Keep the core message and facts from the original article
4. Use proper headings (##, ###), bullet points, and formatting
5. Make it engaging and professional
6. Ensure the article is between 800-1500 words
7. Do NOT include any preamble or meta-commentary - provide ONLY the rewritten article content
8. Start directly with the article title as an H1 heading (# Title)

OPTIMIZED ARTICLE:`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const optimizedContent = response.data.candidates[0].content.parts[0].text.trim();

    // Add citations
    const citationsSection = `\n\n---\n\n## References\n\nThis article was optimized based on insights from the following sources:\n\n${referenceArticles.map((ref, idx) => 
      `${idx + 1}. [${ref.title}](${ref.url})`
    ).join('\n')}\n`;

    // Update article
    article.originalContent = article.content;
    article.content = optimizedContent + citationsSection;
    article.isUpdated = true;
    article.references = referenceArticles.map(ref => ({
      title: ref.title,
      url: ref.url,
      scrapedAt: new Date(),
    }));
    
    await article.save();
    console.log(`Article optimized successfully: ${article.title}`);

  } catch (error) {
    console.error(`Error optimizing article: ${error.message}`);
  }
}

// Helper function to search Google
async function searchGoogleForArticle(query, puppeteer) {
  const browser = await puppeteer.launch({
    headless: false,  // Headful mode to see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' blog')}&hl=en`;
    
    console.log(`   Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Check for CAPTCHA
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const isBlocked = bodyText.includes('unusual traffic') || 
                      bodyText.includes('captcha') || 
                      bodyText.includes('robot');

    if (isBlocked) {
      console.log('   🔴 GOOGLE BLOCK DETECTED!');
      console.log('   👉 Please solve the CAPTCHA in the browser window');
      console.log('   ⏳ Waiting for search results...');
      await page.waitForSelector('.g, .MjjYud', { timeout: 0 });
      console.log('   ✅ CAPTCHA solved!');
      await new Promise(r => setTimeout(r, 2000));
    }

    const results = await page.evaluate(() => {
      const items = [];
      
      // Try multiple strategies to find results
      let elements = document.querySelectorAll('.g, .MjjYud, div[data-sokoban-container]');
      if (elements.length === 0) {
        elements = document.querySelectorAll('div:has(> a > h3)');
      }
      
      console.log(`Found ${elements.length} result containers`);

      elements.forEach(element => {
        let titleEl = element.querySelector('h3');
        let linkEl = element.querySelector('a[href^="http"]');
        
        if (!linkEl && titleEl) {
          linkEl = titleEl.closest('a') || titleEl.parentElement.querySelector('a[href^="http"]');
        }

        if (titleEl && linkEl) {
          const title = titleEl.innerText.trim();
          const url = linkEl.href;
          
          const banned = ['beyondchats.com', 'google.com', 'youtube.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'instagram.com'];

          if (!banned.some(domain => url.includes(domain)) && title.length > 10) {
            items.push({ title, url });
          }
        }
      });
      return items;
    });

    console.log(`   Found ${results.length} valid results`);
    return results;
  } catch (error) {
    console.error(`Error searching Google: ${error.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// Helper function to scrape article content
async function scrapeArticleContent(url, puppeteer) {
  const browser = await puppeteer.launch({
    headless: 'new',  // Use new headless mode
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    const content = await page.evaluate(() => {
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement, .sidebar');
      unwanted.forEach(el => el.remove());

      const contentSelectors = ['article', '[role="main"]', 'main', '.article-content', '.post-content', '.entry-content', '#content'];
      let contentElement = null;
      
      for (const selector of contentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      if (!contentElement) contentElement = document.body;

      const paragraphs = Array.from(contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
      const text = paragraphs.map(p => p.textContent.trim()).filter(t => t.length > 20).join('\n\n');

      return text.slice(0, 5000);
    });

    return content;
  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
    return '';
  } finally {
    await browser.close();
  }
}

export default router;
