import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Header from './components/Header';
import ArticleList from './components/ArticleList';
import ArticleDetail from './components/ArticleDetail';
import './App.css';

function App() {
  const [isScraping, setIsScraping] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header onScrapingChange={setIsScraping} />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<ArticleList isScraping={isScraping} />} />
            <Route path="/article/:id" element={<ArticleDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
