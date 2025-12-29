import puppeteer from 'puppeteer';
import axios from 'axios';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Article from '../models/Article.js';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Function to search Google using Custom Search API
async function searchGoogle(query) {
  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 10, // Get 10 results to filter
      },
    });

    // Filter for blog/article URLs
    const blogUrls = response.data.items
      .filter(item => {
        const url = item.link.toLowerCase();
        const title = item.title.toLowerCase();
        // Filter for blog-like URLs and exclude certain domains
        return (
          (url.includes('blog') || 
           url.includes('article') || 
           url.includes('post') ||
           title.includes('blog') ||
           title.includes('article')) &&
          !url.includes('beyondchats.com') &&
          !url.includes('youtube.com') &&
          !url.includes('facebook.com') &&
          !url.includes('twitter.com') &&
          !url.includes('linkedin.com')
        );
      })
      .slice(0, 2)
      .map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
      }));

    return blogUrls;
  } catch (error) {
    console.error('Error searching Google:', error.message);
    
    // Fallback: Use Puppeteer to scrape Google search results
    console.log('Falling back to Puppeteer scraping...');
    return await scrapeGoogleWithPuppeteer(query);
  }
}

// Fallback function to scrape Google using Puppeteer
async function scrapeGoogleWithPuppeteer(query) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
  });

  try {
    const page = await browser.newPage();
    
    // Stealth mode - make it look like a real browser
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    // Override webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' blog article')}`;
    console.log(`   Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for results to load
    await page.waitForTimeout(3000);

    // Check if Google is showing CAPTCHA or blocking
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('unusual traffic') || pageText.includes('CAPTCHA')) {
      console.log('   ⚠️ Google is blocking automated access (CAPTCHA detected)');
      return [];
    }

    const results = await page.evaluate(() => {
      const items = [];
      
      // Try multiple selectors for Google search results
      const selectors = [
        'div.g',           // Standard desktop
        'div[data-sokoban-container]', // New layout
        '.tF2Cxc',         // Alternative
        'div[jsname]'      // Fallback
      ];
      
      let searchResults = [];
      for (const selector of selectors) {
        searchResults = document.querySelectorAll(selector);
        if (searchResults.length > 0) {
          console.log(`Found ${searchResults.length} results with selector: ${selector}`);
          break;
        }
      }
      
      searchResults.forEach((result) => {
        try {
          // Try to find title and link
          const titleEl = result.querySelector('h3') || result.querySelector('[role="heading"]');
          const linkEl = result.querySelector('a[href]');
          
          if (titleEl && linkEl && linkEl.href) {
            const url = linkEl.href;
            const title = titleEl.textContent.trim();
            
            // Filter out unwanted results
            const excludeDomains = [
              'beyondchats.com',
              'google.com',
              'youtube.com',
              'facebook.com',
              'twitter.com',
              'linkedin.com',
              'instagram.com',
              'pinterest.com'
            ];
            
            const isExcluded = excludeDomains.some(domain => url.includes(domain));
            
            if (!isExcluded && url.startsWith('http')) {
              items.push({
                title: title,
                url: url,
                snippet: '',
              });
            }
          }
        } catch (e) {
          // Skip this result
        }
      });
      
      return items;
    });

    console.log(`   Found ${results.length} valid results`);
    
    // If no results found, try alternative search approach
    if (results.length === 0) {
      console.log('   Trying alternative search method...');
      
      // Get all links from the page
      const allLinks = await page.evaluate(() => {
        const links = [];
        const anchors = document.querySelectorAll('a[href]');
        anchors.forEach(a => {
          const href = a.href;
          const text = a.textContent.trim();
          if (href && text && href.startsWith('http') && !href.includes('google.com')) {
            links.push({ url: href, title: text });
          }
        });
        return links;
      });
      
      // Filter for likely blog/article links
      const blogLinks = allLinks.filter(link => {
        const url = link.url.toLowerCase();
        const excludeDomains = ['youtube.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'beyondchats.com'];
        return !excludeDomains.some(domain => url.includes(domain)) && link.title.length > 10;
      });
      
      console.log(`   Found ${blogLinks.length} alternative links`);
      return blogLinks.slice(0, 2).map(link => ({
        title: link.title,
        url: link.url,
        snippet: ''
      }));
    }
    
    return results.slice(0, 2);
    
  } catch (error) {
    console.error(`   Error during Puppeteer search: ${error.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// Function to scrape article content from URL
async function scrapeArticleContent(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement, .sidebar');
      unwanted.forEach(el => el.remove());

      // Try to find main content
      const contentSelectors = [
        'article',
        '[role="main"]',
        'main',
        '.article-content',
        '.post-content',
        '.entry-content',
        '#content',
      ];

      let contentElement = null;
      for (const selector of contentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      if (!contentElement) {
        contentElement = document.body;
      }

      // Extract structured content
      const paragraphs = Array.from(contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
      const text = paragraphs
        .map(p => p.textContent.trim())
        .filter(t => t.length > 20)
        .join('\n\n');

      return text.slice(0, 5000); // Limit to first 5000 chars
    });

    return content;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return '';
  } finally {
    await browser.close();
  }
}

// Function to call Google Gemini API to optimize article
async function optimizeArticleWithLLM(originalArticle, referenceArticles) {
  try {
    const prompt = `You are an expert content writer and SEO specialist. Your task is to rewrite and optimize the following article based on the style and formatting of top-ranking articles on Google.

ORIGINAL ARTICLE:
Title: ${originalArticle.title}
Content:
${originalArticle.content}

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
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error('Error calling Gemini API:', error.response?.data || error.message);
    throw error;
  }
}

// Main optimization function
async function optimizeArticles() {
  console.log('Starting article optimization process...\n');

  // Validate API keys
  if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY not set in .env file');
    console.log('\nTo get your Gemini API key:');
    console.log('1. Go to https://makersuite.google.com/app/apikey');
    console.log('2. Click "Create API Key"');
    console.log('3. Copy the key and add it to backend/.env file\n');
    process.exit(1);
  }

  if (!GOOGLE_API_KEY && !GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('Warning: Google Custom Search API credentials not set.');
    console.warn('Will use Puppeteer fallback for Google searches (works fine!).\n');
  }

  // Connect to database
  await connectDB();

  try {
    // Fetch articles from database (not updated ones)
    const articles = await Article.find({ isUpdated: false });
    
    if (articles.length === 0) {
      console.log('No articles found to optimize. Please run the scraper first.');
      process.exit(0);
    }

    console.log(`Found ${articles.length} articles to optimize\n`);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`\n[${ i + 1}/${articles.length}] Processing: ${article.title}`);
      console.log('='.repeat(80));

      try {
        // Step 1: Search Google
        console.log('\n1. Searching Google for similar articles...');
        const searchResults = await searchGoogle(article.title);
        
        if (searchResults.length === 0) {
          console.log('No search results found, skipping this article');
          continue;
        }

        console.log(`Found ${searchResults.length} reference articles:`);
        searchResults.forEach((result, idx) => {
          console.log(`   ${idx + 1}. ${result.title}`);
          console.log(`      ${result.url}`);
        });

        // Step 2: Scrape reference articles
        console.log('\n2. Scraping reference articles...');
        const referenceArticles = [];
        
        for (const result of searchResults) {
          console.log(`   Scraping: ${result.url}`);
          const content = await scrapeArticleContent(result.url);
          
          if (content && content.length > 100) {
            referenceArticles.push({
              title: result.title,
              url: result.url,
              content: content,
            });
            console.log(`   ✓ Scraped ${content.length} characters`);
          } else {
            console.log(`   ✗ Failed to scrape or content too short`);
          }
          
          // Wait between requests
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (referenceArticles.length === 0) {
          console.log('Could not scrape any reference articles, skipping...');
          continue;
        }

        // Step 3: Optimize with LLM
        console.log('\n3. Optimizing article with AI...');
        const optimizedContent = await optimizeArticleWithLLM(article, referenceArticles);
        console.log(`   ✓ Generated ${optimizedContent.length} characters of optimized content`);

        // Step 4: Add citations
        const citationsSection = `\n\n---\n\n## References\n\nThis article was optimized based on insights from the following sources:\n\n${referenceArticles.map((ref, idx) => 
          `${idx + 1}. [${ref.title}](${ref.url})`
        ).join('\n')}\n`;

        const finalContent = optimizedContent + citationsSection;

        // Step 5: Update article via API
        console.log('\n4. Updating article in database...');
        
        article.originalContent = article.content;
        article.content = finalContent;
        article.isUpdated = true;
        article.references = referenceArticles.map(ref => ({
          title: ref.title,
          url: ref.url,
          scrapedAt: new Date(),
        }));
        
        await article.save();
        console.log('   ✓ Article updated successfully');

        console.log('\n' + '='.repeat(80));
        console.log('✓ Article optimization completed');
        
        // Wait before processing next article
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        console.error(`\n✗ Error optimizing article: ${error.message}`);
        console.log('Continuing with next article...\n');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ All articles processed successfully!');
    
    const stats = await Article.aggregate([
      {
        $group: {
          _id: '$isUpdated',
          count: { $sum: 1 },
        },
      },
    ]);
    
    console.log('\nFinal Statistics:');
    stats.forEach(stat => {
      console.log(`  ${stat._id ? 'Updated' : 'Original'}: ${stat.count} articles`);
    });

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the optimizer
optimizeArticles().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
