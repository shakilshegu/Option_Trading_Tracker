import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
    try {
        const { email, newPassword } = await req.json()

        if (!email || !newPassword) {
            return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }

        await connectDB()

        const user = await User.findOne({ email: email.toLowerCase() })
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(newPassword, salt)

        user.password = hashedPassword
        await user.save()

        return NextResponse.json({ message: 'Password updated successfully' }, { status: 200 })
    } catch (error) {
        console.error('RESET_PASSWORD_ERROR:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
