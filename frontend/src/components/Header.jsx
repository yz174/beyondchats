import { Link } from 'react-router-dom';
import { useState } from 'react';

function Header({ onScrapingChange }) {
  const [isScraping, setIsScraping] = useState(false);

  const handleScrape = async () => {
    if (isScraping) return;

    setIsScraping(true);
    
    // Notify parent that scraping started
    if (onScrapingChange) onScrapingChange(true);

    try {
      console.log('Calling scrape API endpoint');
      const response = await fetch('http://localhost:5000/api/articles/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Scrape API response:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('Scrape started:', data);
        
        // Keep polling until scraping completes (60 seconds max)
        setTimeout(() => {
          if (onScrapingChange) onScrapingChange(false);
          setIsScraping(false);
        }, 60000); // 60 seconds
        
      } else {
        setIsScraping(false);
        if (onScrapingChange) onScrapingChange(false);
      }
    } catch (error) {
      console.error('Scrape error:', error);
      setIsScraping(false);
      if (onScrapingChange) onScrapingChange(false);
    }
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold text-blue-600">BeyondChats</h1>
          </Link>
          <nav className="flex items-center space-x-6">
            <Link 
              to="/" 
              className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
            >
              Articles
            </Link>
            <button
              onClick={handleScrape}
              disabled={isScraping}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isScraping
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isScraping ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Scraping...</span>
                </span>
              ) : (
                'Scrape Articles'
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
