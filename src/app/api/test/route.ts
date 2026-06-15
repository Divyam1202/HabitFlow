import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ 
    uri: process.env.MONGODB_URI ? 'Defined' : 'Undefined',
    val: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 10) : ''
  });
}
