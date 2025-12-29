import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
    unique: true,
  },
  source: {
    type: String,
    default: 'BeyondChats',
  },
  references: [{
    title: String,
    url: String,
    scrapedAt: Date,
  }],
  isUpdated: {
    type: Boolean,
    default: false,
  },
  originalContent: {
    type: String,
  },
  metadata: {
    author: String,
    publishedDate: Date,
    tags: [String],
  },
}, {
  timestamps: true,
});

const Article = mongoose.model('Article', articleSchema);

export default Article;
