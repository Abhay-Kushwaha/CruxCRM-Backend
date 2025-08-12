import mongoose from 'mongoose';  

const assignmentSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
  },
  leads: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    }
  ],
  dueDate: {
    type: String,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['active', 'overdue', 'completed'],
    default: 'active',
  },
  notes: {
    type: String,
    trim: true,
  },
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
