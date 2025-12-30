import { Link } from 'react-router-dom';
import { useState } from 'react';
import { articlesAPI } from '../services/api';

function Header({ onScrapingChange }) {
  const [isScraping, setIsScraping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleScrape = async () => {
    if (isScraping) return;

    setIsScraping(true);
    
    // Notify parent that scraping started
    if (onScrapingChange) onScrapingChange(true);

    try {
      console.log('Calling scrape API endpoint');
      const response = await articlesAPI.scrape();

      console.log('Scrape API response:', response.data);

      if (response.data.success) {
        console.log('Scrape started:', response.data);
        
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

  const handleDeleteAll = async () => {
    if (isDeleting || isScraping) return;

    const confirmed = window.confirm('Are you sure you want to delete ALL articles? This action cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      console.log('Deleting all articles...');
      const response = await articlesAPI.deleteAll();

      if (response.data.success) {
        console.log(`Deleted ${response.data.deletedCount} articles`);
        alert(`Successfully deleted ${response.data.deletedCount} articles`);
        
        // Refresh the page to update the article list
        window.location.reload();
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting articles: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold text-blue-600">BeyondChats</h1>
          </Link>
          <nav className="flex items-center space-x-4">
            <button
              onClick={handleScrape}
              disabled={isScraping || isDeleting}
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
            <button
              onClick={handleDeleteAll}
              disabled={isDeleting || isScraping}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isDeleting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isDeleting ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Deleting...</span>
                </span>
              ) : (
                'Delete Articles'
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
