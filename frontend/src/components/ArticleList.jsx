import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { articlesAPI } from '../services/api';

function ArticleList() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'original', 'updated'
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    fetchArticles();
  }, [filter, pagination.page]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filter === 'original') {
        params.isUpdated = 'false';
      } else if (filter === 'updated') {
        params.isUpdated = 'true';
      }

      const response = await articlesAPI.getAll(params);
      
      if (response.data.success) {
        setArticles(response.data.data);
        setPagination(response.data.pagination);
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch articles. Please make sure the backend server is running.');
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const truncateText = (text, maxLength = 200) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-red-900">Error Loading Articles</h3>
          <p className="mt-2 text-red-700">{error}</p>
          <button
            onClick={fetchArticles}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-2">Article Collection</h2>
        <p className="text-gray-600">Browse original articles and AI-optimized versions</p>
      </div>

      {/* Filter Buttons */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={() => handleFilterChange('all')}
          className={`px-6 py-2 rounded-full font-medium transition-all ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          All Articles ({pagination.total})
        </button>
        <button
          onClick={() => handleFilterChange('original')}
          className={`px-6 py-2 rounded-full font-medium transition-all ${
            filter === 'original'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          Original Only
        </button>
        <button
          onClick={() => handleFilterChange('updated')}
          className={`px-6 py-2 rounded-full font-medium transition-all ${
            filter === 'updated'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          AI-Optimized
        </button>
      </div>

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No articles found</h3>
          <p className="mt-2 text-gray-600">Run the scraper to fetch articles from BeyondChats</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article) => (
            <Link
              key={article._id}
              to={`/article/${article._id}`}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-300"
            >
              <div className="p-6">
                {/* Status Badge */}
                <div className="mb-3">
                  {article.isUpdated ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      AI-Optimized
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Original
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 hover:text-blue-600 transition-colors">
                  {article.title}
                </h3>

                {/* Content Preview */}
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {truncateText(article.content.replace(/[#*\-\n]/g, ' ').trim())}
                </p>

                {/* Metadata */}
                <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className="text-blue-600 font-medium hover:underline">
                    Read more →
                  </span>
                </div>

                {/* References Count */}
                {article.isUpdated && article.references && article.references.length > 0 && (
                  <div className="mt-3 text-xs text-gray-500">
                    <span>✓ {article.references.length} reference sources</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-12 flex justify-center items-center space-x-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              pagination.page === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
            }`}
          >
            Previous
          </button>

          <div className="flex items-center space-x-1">
            {[...Array(pagination.pages)].map((_, index) => {
              const pageNum = index + 1;
              // Show first, last, current, and adjacent pages
              if (
                pageNum === 1 ||
                pageNum === pagination.pages ||
                (pageNum >= pagination.page - 1 && pageNum <= pagination.page + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      pagination.page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              } else if (pageNum === pagination.page - 2 || pageNum === pagination.page + 2) {
                return <span key={pageNum} className="px-2 text-gray-400">...</span>;
              }
              return null;
            })}
          </div>

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.pages}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              pagination.page === pagination.pages
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default ArticleList;
