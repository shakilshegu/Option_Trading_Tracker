import mongoose, { Schema, Document, models } from 'mongoose'

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId
  date: Date
  day: string
  time: string
  symbol: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'MIDCPNIFTY' | 'SENSEX' | 'BANKEX'
  type: 'CE' | 'PE'
  expiry: Date
  strike: number
  lots: number
  lotSize: number
  entry: number
  exit: number
  grossPnL: number
  charges: number
  netPnL: number
  setupValid: boolean
  rulesFollowed: boolean
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'] as const

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    day: { type: String, required: true },
    time: { type: String, required: true },
    symbol: { type: String, enum: SYMBOLS, required: true },
    type: { type: String, enum: ['CE', 'PE'], required: true },
    expiry: { type: Date, required: true },
    strike: { type: Number, required: true },
    lots: { type: Number, required: true },
    lotSize: { type: Number, required: true, default: 25 },
    entry: { type: Number, required: true },
    exit: { type: Number, required: true },
    grossPnL: { type: Number, required: true },
    charges: { type: Number, required: true, default: 0 },
    netPnL: { type: Number, required: true },
    setupValid: { type: Boolean, required: true, default: false },
    rulesFollowed: { type: Boolean, required: true, default: false },
    notes: { type: String },
  },
  { timestamps: true }
)

export default models.Trade || mongoose.model<ITrade>('Trade', TradeSchema)
