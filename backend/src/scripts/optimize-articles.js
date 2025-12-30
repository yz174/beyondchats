import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Article from '../models/Article.js';

// Enable stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Function to search Google using Stealth Puppeteer
async function searchGoogle(query) {
  console.log('   Using Stealth Puppeteer to search Google...');
  return await scrapeGoogleWithPuppeteer(query);
}

// Function to scrape Google using Stealth Puppeteer
async function scrapeGoogleWithPuppeteer(query) {
  // Launch browser in headful mode to see what's happening
  const browser = await puppeteer.launch({
    headless: false,  // Headful mode for debugging and CAPTCHA solving
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--ignore-certificate-errors',
    ],
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' blog')}&hl=en`;
    console.log(`   Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // --- UPDATED CAPTCHA DETECTION ---
    // Check specifically for the text found in your logs
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const isBlocked = bodyText.includes('unusual traffic') || 
                      bodyText.includes('captcha') || 
                      bodyText.includes('robot');

    if (isBlocked) {
      console.log('\n   🔴 GOOGLE BLOCK DETECTED!');
      console.log('   👉 ACTION REQUIRED: Switch to the pop-up browser window.');
      console.log('   👉 Please solve the CAPTCHA manually.');
      console.log('   ⏳ Waiting for search results to appear...');

      // This line pauses the script FOREVER until you solve the captcha
      // and the search results (div with class 'g') appear on the screen.
      await page.waitForSelector('.g, .MjjYud', { timeout: 0 });
      
      console.log('   ✅ CAPTCHA solved! Resuming script...');
      await new Promise(r => setTimeout(r, 3000)); // Extra wait for results to render
    }
    // --------------------------------

    // Cookie Consent Handling (Just in case)
    try {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText.toLowerCase(), btn);
        if (text.includes('accept all') || text.includes('i agree')) {
          await btn.click();
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (e) {}

    // Wait for search results to load
    console.log('   Waiting for search results...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Debug: Take screenshot to see what page looks like
    await page.screenshot({ path: 'google-search-debug.png', fullPage: false });
    console.log('   📸 Screenshot saved to google-search-debug.png');

    // Scrape Results with better selectors
    const results = await page.evaluate(() => {
      const items = [];
      
      // Try multiple selector strategies
      const strategies = [
        // Strategy 1: Standard result containers
        () => document.querySelectorAll('.g, .MjjYud, div[data-sokoban-container]'),
        // Strategy 2: Look for any div with h3
        () => document.querySelectorAll('div:has(> a > h3), div:has(> div > a > h3)'),
        // Strategy 3: Look for search result links
        () => {
          const allLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
          return allLinks.map(a => a.closest('div')).filter(d => d && d.querySelector('h3'));
        }
      ];
      
      let elements = [];
      for (const strategy of strategies) {
        try {
          elements = Array.from(strategy());
          if (elements.length > 0) break;
        } catch (e) {
          continue;
        }
      }
      
      console.log(`Found ${elements.length} potential result containers`);

      elements.forEach(element => {
        // Try multiple ways to find title and link
        let titleEl = element.querySelector('h3');
        let linkEl = element.querySelector('a[href^="http"]');
        
        // Alternative: the link might contain the h3
        if (!linkEl && titleEl) {
          linkEl = titleEl.closest('a') || titleEl.parentElement.querySelector('a[href^="http"]');
        }
        
        const snippetEl = element.querySelector('.VwiC3b, .IsZvec, .lyLwlc, [data-content-feature="1"]') || 
                          element.querySelector('div[style*="line-height"]');

        if (titleEl && linkEl) {
          const title = titleEl.innerText.trim();
          const url = linkEl.href;
          
          const banned = ['beyondchats.com', 'google.com', 'youtube.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'instagram.com', 'reddit.com'];

          if (!banned.some(domain => url.includes(domain)) && title.length > 10) {
             items.push({
               title,
               url,
               snippet: snippetEl ? snippetEl.innerText.trim() : ''
             });
          }
        }
      });
      return items;
    });

    console.log(`   Found ${results.length} valid Google results`);
    return results.slice(0, 2);

  } catch (error) {
    console.error(`   Error scraping Google: ${error.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// Function to scrape article content from URL
async function scrapeArticleContent(url) {
  const browser = await puppeteer.launch({
    headless: 'new',  // Keep this headless since we don't need to see article scraping
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    // Random delay to mimic human behavior
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

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

  console.log('Using Stealth Puppeteer for Google searches (bypasses CAPTCHA)\n');

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
