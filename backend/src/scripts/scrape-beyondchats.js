import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Article from '../models/Article.js';

dotenv.config();

async function scrapeBeyondChatsArticles() {
  console.log('Starting BeyondChats article scraper...');
  
  // Connect to database
  await connectDB();
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to BeyondChats blogs page...');
    await page.goto('https://beyondchats.com/blogs/', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for content to load
    await page.waitForSelector('body', { timeout: 10000 });
    
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
          waitUntil: 'networkidle2',
          timeout: 60000,
        });
      } catch (error) {
        console.log('Error navigating to last page, trying alternative URL format...');
        await page.goto(`https://beyondchats.com/blogs/page/${lastPageNumber}/`, {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });
      }
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
        await page.goto(article.url, {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });

        // Scrape full article content
        const fullContent = await page.evaluate(() => {
          // Try to find main article content
          const contentSelectors = [
            'article',
            '.article-content',
            '.post-content',
            '.entry-content',
            'main',
            '[class*="content"]',
            '[class*="article"]',
          ];

          let contentElement = null;
          for (const selector of contentSelectors) {
            contentElement = document.querySelector(selector);
            if (contentElement) break;
          }

          if (!contentElement) {
            contentElement = document.body;
          }

          // Extract text content, preserving paragraphs
          const paragraphs = Array.from(contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'));
          const text = paragraphs.map(p => p.textContent.trim()).filter(t => t.length > 20).join('\n\n');

          // Also try to get metadata
          let title = document.querySelector('h1')?.textContent.trim() || '';
          let author = document.querySelector('[class*="author"], .author, [rel="author"]')?.textContent.trim() || '';
          let date = document.querySelector('time, [datetime], .date')?.textContent.trim() || '';

          return {
            content: text || 'Unable to extract content',
            title,
            author,
            date,
          };
        });

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
    process.exit(0);
  }
}

// Run the scraper
scrapeBeyondChatsArticles().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
