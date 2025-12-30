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

// DELETE all articles (must come before /:id route)
router.delete('/all', async (req, res) => {
  try {
    const result = await Article.deleteMany({});
    
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} articles`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting articles:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting articles',
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
    console.log('🚀 Scrape endpoint called');
    
    // Import the scraping function
    const { default: scrapeBeyondChatsArticles } = await import('../scripts/scrape-beyondchats.js');
    
    // Send immediate response that scraping has started
    res.json({
      success: true,
      message: 'Scraping started. Articles will appear as they are scraped.',
    });

    // Run scraping in background without awaiting
    scrapeBeyondChatsArticles()
      .then(() => {
        console.log('✅ Background scraping completed successfully');
      })
      .catch(error => {
        console.error('❌ Background scraping error:', error.message);
        console.error('Full error details:', error);
        // Log more specific error information
        if (error.message.includes('Failed to launch') || error.message.includes('ENOENT')) {
          console.error('🔧 This appears to be a Chrome executable issue on Railway');
          console.error('💡 Solution: Ensure Chrome is installed or set PUPPETEER_EXECUTABLE_PATH');
        }
      });

  } catch (error) {
    console.error('🚨 Scrape endpoint error:', error);
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

    // Search Google using SERP API for similar articles
    const searchResults = await searchGoogleForArticle(article.title, puppeteer);
    
    if (searchResults.length === 0) {
      console.log('No search results found - Google may have blocked the request or Chrome unavailable');
      
      // Instead of failing, optimize with just the original content
      const prompt = `You are an expert content writer and SEO specialist. Your task is to rewrite and improve the following article for better readability, engagement, and SEO optimization.

ORIGINAL ARTICLE:
Title: ${article.title}
Content:
${article.content}

INSTRUCTIONS:
1. Rewrite the article to improve readability, structure, and SEO
2. Use proper headings (##, ###), bullet points, and formatting
3. Make it more engaging and professional
4. Ensure the article is between 800-1500 words
5. Keep the core message and facts from the original article
6. Do NOT include any preamble - provide ONLY the rewritten article content
7. Start directly with the article title as an H1 heading (# Title)

OPTIMIZED ARTICLE:`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const optimizedContent = response.data.candidates[0].content.parts[0].text.trim();

      // Update article without references
      article.originalContent = article.content;
      article.content = optimizedContent + '\n\n---\n\n*This article was optimized using AI for improved readability and SEO.*';
      article.isUpdated = true;
      
      await article.save();
      console.log(`Article optimized without references: ${article.title}`);
      return;
    }

    // Scrape reference articles
    const referenceArticles = [];
    console.log(`   📰 Attempting to scrape ${Math.min(searchResults.length, 2)} reference articles...`);
    
    for (const result of searchResults.slice(0, 2)) {
      try {
        console.log(`   🔄 Scraping: ${result.url}`);
        const content = await scrapeArticleContent(result.url, puppeteer);
        if (content && content.length > 100) {
          referenceArticles.push({
            title: result.title,
            url: result.url,
            content: content,
          });
          console.log(`   ✅ Successfully scraped: ${result.title}`);
        } else {
          console.log(`   ⚠️ Content too short from: ${result.url}`);
          // Use SERP snippet as fallback if available
          if (result.snippet && result.snippet.length > 50) {
            referenceArticles.push({
              title: result.title,
              url: result.url,
              content: result.snippet + '\n\n[Note: Full content could not be scraped, using search snippet]',
            });
            console.log(`   📝 Using SERP snippet for: ${result.title}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Failed to scrape ${result.url}: ${error.message}`);
        // Use SERP snippet as fallback if available
        if (result.snippet && result.snippet.length > 50) {
          referenceArticles.push({
            title: result.title,
            url: result.url,
            content: result.snippet + '\n\n[Note: Full content could not be scraped, using search snippet]',
          });
          console.log(`   📝 Using SERP snippet for: ${result.title}`);
        }
      }
    }

    if (referenceArticles.length === 0) {
      console.log('   ⚠️ Could not scrape any reference articles, optimizing with original content only');
      
      // Fallback: optimize with just the original content
      const prompt = `You are an expert content writer and SEO specialist. Your task is to rewrite and improve the following article for better readability, engagement, and SEO optimization.

ORIGINAL ARTICLE:
Title: ${article.title}
Content:
${article.content}

INSTRUCTIONS:
1. Rewrite the article to improve readability, structure, and SEO
2. Use proper headings (##, ###), bullet points, and formatting
3. Make it more engaging and professional
4. Ensure the article is between 800-1500 words
5. Keep the core message and facts from the original article
6. Do NOT include any preamble - provide ONLY the rewritten article content
7. Start directly with the article title as an H1 heading (# Title)

OPTIMIZED ARTICLE:`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const optimizedContent = response.data.candidates[0].content.parts[0].text.trim();

      // Update article without references
      article.originalContent = article.content;
      article.content = optimizedContent + '\n\n---\n\n*This article was optimized using AI for improved readability and SEO.*';
      article.isUpdated = true;
      
      await article.save();
      console.log(`   ✅ Article optimized without references: ${article.title}`);
      return;
    }

    console.log(`   📚 Successfully gathered ${referenceArticles.length} reference articles`);

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

// Helper function to search Google using SERP API
async function searchGoogleForArticle(query, puppeteer) {
  const SERP_API_KEY = process.env.SERP_API_KEY;
  
  if (!SERP_API_KEY) {
    console.error('SERP API key not found in environment variables');
    return [];
  }

  try {
    const axios = (await import('axios')).default;
    const searchQuery = encodeURIComponent(query + ' blog');
    const serpUrl = `https://serpapi.com/search?q=${searchQuery}&api_key=${SERP_API_KEY}&engine=google&num=10&hl=en`;
    
    console.log(`   🔍 Searching SERP API for: ${query}`);
    
    const response = await axios.get(serpUrl);
    const data = response.data;
    
    if (!data.organic_results) {
      console.log('   ❌ No organic results found');
      return [];
    }
    
    const results = [];
    const banned = ['beyondchats.com', 'google.com', 'youtube.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'instagram.com'];
    
    for (const result of data.organic_results.slice(0, 10)) {
      if (result.title && result.link && result.title.length > 10) {
        const url = result.link;
        
        // Skip banned domains
        if (!banned.some(domain => url.includes(domain))) {
          results.push({
            title: result.title,
            url: url,
            snippet: result.snippet || ''
          });
        }
      }
    }
    
    console.log(`   ✅ Found ${results.length} valid results from SERP API`);
    return results;
    
  } catch (error) {
    console.error(`Error using SERP API: ${error.message}`);
    return [];
  }
}

// Helper function to scrape article content
async function scrapeArticleContent(url, puppeteer) {
  // Detect Chrome executable path
  let executablePath;
  
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else if (process.platform === 'linux') {
    // Railway and other Linux environments
    const possiblePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
      '/app/.chrome-for-testing/chrome-linux64/chrome' // Railway specific
    ];
    
    const fs = await import('fs');
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        executablePath = path;
        break;
      }
    }
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',  // Use new headless mode
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins'
      ],
    });

    const page = await browser.newPage();
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set realistic viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    // Additional stealth measures
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      delete navigator.__proto__.webdriver;
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Increased from 30s to 60s
    
    // Random delay to mimic human behavior
    const randomDelay = Math.floor(Math.random() * 1500) + 1000; // 1-2.5 seconds
    await new Promise(r => setTimeout(r, randomDelay));
    
    // Check if page loaded properly
    const title = await page.title();
    if (!title || title.toLowerCase().includes('error') || title.toLowerCase().includes('not found')) {
      console.log(`   ⚠️ Page might not have loaded properly: ${title}`);
    }

    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comment, .comments, .social-share, .newsletter, .popup');
      unwanted.forEach(el => el.remove());

      // Try multiple content selectors in order of preference
      const contentSelectors = [
        'article',
        '[role="main"]', 
        'main', 
        '.article-content', 
        '.post-content', 
        '.entry-content',
        '.content',
        '#content',
        '.post-body',
        '.article-body',
        '.story-body'
      ];
      
      let contentElement = null;
      for (const selector of contentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement && contentElement.innerText.trim().length > 200) {
          break;
        }
      }

      // Fallback to body if no content found
      if (!contentElement || contentElement.innerText.trim().length < 200) {
        contentElement = document.body;
      }

      // Extract text from paragraphs and headings
      const textElements = Array.from(contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'));
      const text = textElements
        .map(p => p.textContent.trim())
        .filter(t => t.length > 15 && !t.match(/^(cookie|privacy|terms|subscribe|follow)/i))
        .join('\n\n');

      return text.slice(0, 8000); // Increased from 5000 to 8000
    });

    // Validate content quality
    if (content.length < 100) {
      console.log(`   ⚠️ Scraped content too short (${content.length} chars) from: ${url}`);
      return '';
    }
    
    console.log(`   📄 Scraped ${content.length} characters from: ${url}`);
    return content;
  } catch (error) {
    if (error.message.includes('Failed to launch') || error.message.includes('ENOENT')) {
      console.error(`Failed to launch browser for scraping ${url}: ${error.message}`);
      return '';
    }
    console.error(`Error scraping ${url}: ${error.message}`);
    return '';
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export default router;
