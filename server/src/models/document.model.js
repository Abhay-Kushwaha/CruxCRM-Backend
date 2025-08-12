import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  size: {
    type: Number,
    required: true,
  },
});

const Document = mongoose.model('Document', documentSchema);

export default Document;
