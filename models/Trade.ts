import mongoose, { Schema, Document, models } from 'mongoose'

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId
  symbol: string
  type: 'Call' | 'Put'
  action: 'Buy' | 'Sell'
  strike: number
  expiry: Date
  premium: number
  quantity: number
  status: 'Open' | 'Closed'
  closePrice?: number
  pnl?: number
  createdAt: Date
  updatedAt: Date
}

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    symbol: { type: String, required: true, uppercase: true },
    type: { type: String, enum: ['Call', 'Put'], required: true },
    action: { type: String, enum: ['Buy', 'Sell'], required: true },
    strike: { type: Number, required: true },
    expiry: { type: Date, required: true },
    premium: { type: Number, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
    closePrice: { type: Number },
    pnl: { type: Number },
  },
  { timestamps: true }
)

export default models.Trade || mongoose.model<ITrade>('Trade', TradeSchema)
