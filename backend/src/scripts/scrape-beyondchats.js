import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import Article from '../models/Article.js';

dotenv.config();

async function scrapeBeyondChatsArticles() {
  console.log('Starting BeyondChats article scraper...');
  
  // Connect to database only if not already connected (for CLI usage)
  if (mongoose.connection.readyState === 0) {
    console.log('Connecting to database...');
    await connectDB();
  } else {
    console.log('Using existing database connection');
  }
  
  // Use default Puppeteer Chrome for local development
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Wait for page to be ready
    await page.evaluateOnNewDocument(() => {
      // This runs before any page script
    });
    
    console.log('Navigating to BeyondChats blogs page...');
    try {
      await page.goto('https://beyondchats.com/blogs/', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
    } catch (navigationError) {
      console.log('First navigation attempt failed, retrying...');
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.goto('https://beyondchats.com/blogs/', {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
    }

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Find pagination to get to the last page
    console.log('Looking for pagination...');
    
    // Try to find the last page link or pagination buttons
    let lastPageNumber = 1;
    try {
      // Look for pagination elements (adjust selectors based on actual site structure)
      const paginationSelectors = [
        'nav[aria-label="pagination"] a',
        '.pagination a',
        'ul.pagination li a',
        '[class*="pagination"] a',
        '[class*="page"] a[href*="page"]',
      ];

      let pageLinks = [];
      for (const selector of paginationSelectors) {
        try {
          pageLinks = await page.$$(selector);
          if (pageLinks.length > 0) break;
        } catch (e) {
          continue;
        }
      }

      if (pageLinks.length > 0) {
        const pageNumbers = await Promise.all(
          pageLinks.map(async (link) => {
            const text = await link.evaluate(el => el.textContent.trim());
            const num = parseInt(text);
            return isNaN(num) ? 0 : num;
          })
        );
        lastPageNumber = Math.max(...pageNumbers.filter(n => n > 0));
        console.log(`Found pagination. Last page: ${lastPageNumber}`);
      } else {
        console.log('No pagination found, assuming single page');
      }
    } catch (error) {
      console.log('Error finding pagination:', error.message);
      console.log('Continuing with first page...');
    }

    // Navigate to last page if pagination exists
    if (lastPageNumber > 1) {
      console.log(`Navigating to page ${lastPageNumber}...`);
      try {
        await page.goto(`https://beyondchats.com/blogs/?page=${lastPageNumber}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
      } catch (error) {
        console.log('Error navigating to last page, trying alternative URL format...');
        try {
          await page.goto(`https://beyondchats.com/blogs/page/${lastPageNumber}/`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });
        } catch (secondError) {
          console.log('Both pagination attempts failed, continuing with first page...');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Scrape articles from the current page
    console.log('Scraping articles...');
    
    const articles = await page.evaluate(() => {
      const articleElements = [];
      
      // Try multiple possible selectors for article cards
      const selectors = [
        'article',
        '.blog-card',
        '.post',
        '[class*="article"]',
        '[class*="blog"]',
        '[class*="post-"]',
        'div[class*="card"]',
        'a[href*="/blog"]',
      ];

      let elements = [];
      for (const selector of selectors) {
        elements = document.querySelectorAll(selector);
        if (elements.length > 0) break;
      }

      elements.forEach((element, index) => {
        try {
          // Try to find title
          let title = '';
          const titleSelectors = ['h1', 'h2', 'h3', '.title', '[class*="title"]', '[class*="heading"]'];
          for (const sel of titleSelectors) {
            const titleEl = element.querySelector(sel);
            if (titleEl && titleEl.textContent.trim()) {
              title = titleEl.textContent.trim();
              break;
            }
          }

          // Try to find link
          let url = '';
          const linkEl = element.querySelector('a[href]') || element.closest('a[href]');
          if (linkEl) {
            url = linkEl.href;
          }

          // Try to find content/excerpt
          let content = '';
          const contentSelectors = ['.excerpt', '.description', '.content', 'p', '[class*="excerpt"]', '[class*="description"]'];
          for (const sel of contentSelectors) {
            const contentEl = element.querySelector(sel);
            if (contentEl && contentEl.textContent.trim()) {
              content = contentEl.textContent.trim();
              break;
            }
          }

          // Try to find author and date
          let author = '';
          let publishedDate = '';
          
          const authorEl = element.querySelector('[class*="author"], .author, [rel="author"]');
          if (authorEl) author = authorEl.textContent.trim();
          
          const dateEl = element.querySelector('time, [datetime], .date, [class*="date"]');
          if (dateEl) {
            publishedDate = dateEl.getAttribute('datetime') || dateEl.textContent.trim();
          }

          if (title && url) {
            articleElements.push({
              title,
              url,
              content: content || 'Content will be scraped from article page',
              author,
              publishedDate,
            });
          }
        } catch (error) {
          console.error('Error parsing article element:', error);
        }
      });

      return articleElements;
    });

    console.log(`Found ${articles.length} articles on the page`);

    if (articles.length === 0) {
      console.log('No articles found. The site structure might be different.');
      console.log('Attempting to extract all links from the page...');
      
      // Fallback: get all blog links
      const allLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/blog"]'));
        return links.map(link => ({
          title: link.textContent.trim() || 'Untitled',
          url: link.href,
          content: 'Content to be scraped',
        })).filter(item => item.url && item.url.includes('beyondchats.com'));
      });
      
      console.log(`Found ${allLinks.length} blog links`);
      articles.push(...allLinks);
    }

    // Take the oldest 5 articles (assuming they appear in chronological order on last page)
    const articlesToScrape = articles.slice(0, 5);
    
    console.log(`\nScraping detailed content for ${articlesToScrape.length} articles...`);

    // Scrape full content for each article
    for (let i = 0; i < articlesToScrape.length; i++) {
      const article = articlesToScrape[i];
      console.log(`\n[${i + 1}/${articlesToScrape.length}] Scraping: ${article.title}`);
      console.log(`URL: ${article.url}`);

      try {
        // Check if article already exists in database
        const existingArticle = await Article.findOne({ url: article.url });
        if (existingArticle) {
          console.log('Article already exists in database, skipping...');
          continue;
        }

        // Navigate to article page
        try {
          await page.goto(article.url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
        } catch (navigationError) {
          console.log(`Navigation failed for ${article.url}, skipping...`);
          continue;
        }

        // Wait for content to load - try multiple strategies
        try {
          await page.waitForSelector('h1', { timeout: 10000 });
        } catch (selectorError) {
          console.log(`Article content not found for ${article.url}, skipping...`);
          continue;
        }
        
        // Wait a bit for dynamic content to render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Scroll down to trigger lazy loading of content
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Debug: Log page HTML length to verify content is loaded
        const htmlLength = await page.evaluate(() => document.body.innerHTML.length);
        console.log(`Page HTML length: ${htmlLength} characters`);
        
        // Scrape full article content
// Scrape full article content
        const fullContent = await page.evaluate(() => {
          // 1. CLEANUP: Remove parts we don't want BEFORE we start scraping
          const junkSelectors = [
            '#comments', 
            '.comments-area', 
            '#respond', 
            '.elementor-location-footer',
            '.elementor-location-header',
            '.related-posts',
            '.sharedaddy'
          ];
          junkSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
          });

          // 2. METADATA EXTRACTION
          const title = document.querySelector('h1')?.textContent.trim() || '';
          
          const authorElement = document.querySelector('.author-name, .elementor-icon-list-text, [rel="author"]');
          const author = authorElement?.textContent.trim() || '';
          
          const dateElement = document.querySelector('time, .elementor-post-info__item--type-date');
          const date = dateElement?.textContent.trim() || '';

          // 3. CONTENT EXTRACTION
          const contentSelectors = [
            '.elementor-widget-theme-post-content', 
            '.entry-content',                       
            '.post-content',                        
            'main article',                         
            'article'                               
          ];

          let contentElement = null;
          for (const sel of contentSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              contentElement = el;
              break;
            }
          }
          
          if (!contentElement) contentElement = document.body;

          // 4. TEXT PROCESSING
          const contentParts = [];
          const allElements = contentElement.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote');
          
          allElements.forEach(element => {
            const text = element.textContent.trim();
            
            if (text.length < 5) return;
            
            const skipPatterns = [
              /^share this/i,
              /^published in/i,
              /^tagged with/i
            ];
            if (skipPatterns.some(p => p.test(text))) return;

            if (element.tagName === 'UL' || element.tagName === 'OL') {
               const items = Array.from(element.querySelectorAll('li'))
                                  .map(li => `• ${li.textContent.trim()}`)
                                  .join('\n');
               if(items) contentParts.push(items);
            } else {
               contentParts.push(text);
            }
          });

          return {
            content: contentParts.join('\n\n') || 'Unable to extract content',
            title,
            author,
            date,
          };
        });
        // Log what we extracted
        console.log(`Title: ${fullContent.title || article.title}`);
        console.log(`Author: ${fullContent.author || article.author || 'Unknown'}`);
        console.log(`Date: ${fullContent.date || article.publishedDate || 'Unknown'}`);
        console.log(`Content length: ${fullContent.content.length} characters`);
        console.log(`Content preview: ${fullContent.content.substring(0, 200)}...`);

        // Create article in database
        const newArticle = new Article({
          title: fullContent.title || article.title,
          content: fullContent.content,
          url: article.url,
          source: 'BeyondChats',
          metadata: {
            author: fullContent.author || article.author,
            publishedDate: fullContent.date || article.publishedDate || new Date(),
          },
          isUpdated: false,
        });

        await newArticle.save();
        console.log('✓ Article saved to database');

        // Wait a bit to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error scraping article: ${error.message}`);
      }
    }

    console.log('\n✓ Scraping completed successfully!');
    
    // Print summary
    const totalArticles = await Article.countDocuments({ source: 'BeyondChats' });
    console.log(`\nTotal articles in database: ${totalArticles}`);

  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Export the function
export default scrapeBeyondChatsArticles;

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeBeyondChatsArticles().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
