import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { articlesAPI } from '../services/api';

function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('current'); // 'current', 'original', 'comparison'

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const response = await articlesAPI.getById(id);
      
      if (response.data.success) {
        setArticle(response.data.data);
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch article details');
      console.error('Error fetching article:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatContent = (content) => {
    if (!content) return '';
    
    // Split by lines and format
    return content.split('\n').map((line, index) => {
      line = line.trim();
      
      // Headers
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-4xl font-bold mt-8 mb-4 text-gray-900">{line.substring(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-3xl font-bold mt-6 mb-3 text-gray-800">{line.substring(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-2xl font-bold mt-5 mb-2 text-gray-800">{line.substring(4)}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={index} className="text-xl font-bold mt-4 mb-2 text-gray-700">{line.substring(5)}</h4>;
      }
      
      // Horizontal rule
      if (line === '---') {
        return <hr key={index} className="my-8 border-t-2 border-gray-200" />;
      }
      
      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-6 mb-2 text-gray-700">{line.substring(2)}</li>;
      }
      
      // Numbered lists
      if (/^\d+\.\s/.test(line)) {
        return <li key={index} className="ml-6 mb-2 text-gray-700 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
      }
      
      // Links in markdown format [text](url)
      if (line.includes('[') && line.includes('](')) {
        const parts = line.split(/(\[.*?\]\(.*?\))/g);
        return (
          <p key={index} className="mb-4 text-gray-700 leading-relaxed">
            {parts.map((part, i) => {
              const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
              if (linkMatch) {
                return (
                  <a
                    key={i}
                    href={linkMatch[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {linkMatch[1]}
                  </a>
                );
              }
              return part;
            })}
          </p>
        );
      }
      
      // Regular paragraphs
      if (line) {
        return <p key={index} className="mb-4 text-gray-700 leading-relaxed">{line}</p>;
      }
      
      return null;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-red-900">Error Loading Article</h3>
          <p className="mt-2 text-red-700">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Back to Articles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Articles
      </Link>

      {/* Article Header */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            {article.isUpdated ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                AI-Optimized
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                Original Article
              </span>
            )}
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
          >
            View Source
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">{article.title}</h1>

        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(article.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          {article.metadata?.author && (
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {article.metadata.author}
            </div>
          )}
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {article.source}
          </div>
        </div>
      </div>

      {/* View Mode Selector (if article is updated) */}
      {article.isUpdated && article.originalContent && (
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode('current')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === 'current'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Optimized Version
              </button>
              <button
                onClick={() => setViewMode('original')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === 'original'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Original Version
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === 'comparison'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Side-by-Side
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article Content */}
      {viewMode === 'comparison' && article.isUpdated && article.originalContent ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Original */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-blue-200">
              Original Version
            </h2>
            <div className="prose prose-blue max-w-none">
              {formatContent(article.originalContent)}
            </div>
          </div>
          
          {/* Optimized */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-green-200">
              AI-Optimized Version
            </h2>
            <div className="prose prose-green max-w-none">
              {formatContent(article.content)}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="prose prose-lg max-w-none">
            {viewMode === 'original' && article.originalContent
              ? formatContent(article.originalContent)
              : formatContent(article.content)}
          </div>
        </div>
      )}

      {/* References Section */}
      {article.isUpdated && article.references && article.references.length > 0 && viewMode !== 'original' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-8 mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reference Sources
          </h2>
          <p className="text-gray-600 mb-6">
            This article was optimized based on insights from the following top-ranking sources:
          </p>
          <div className="space-y-4">
            {article.references.map((ref, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-4 border border-blue-200 hover:border-blue-400 transition-all hover:shadow-md"
              >
                <div className="flex items-start">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {ref.title}
                    </a>
                    <p className="text-sm text-gray-500 mt-1 break-all">{ref.url}</p>
                    {ref.scrapedAt && (
                      <p className="text-xs text-gray-400 mt-2">
                        Scraped on {new Date(ref.scrapedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 ml-4 text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ArticleDetail;
